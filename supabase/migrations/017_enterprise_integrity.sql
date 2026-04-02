-- ============================================================
-- MIGRATION 017: The CFO & CTO Infrastructure (Sub-Ledger & Atomicity)
-- ============================================================

-- 1. SUB-LEDGER: Stock Movements (Kartu Stok)
-- Ini adalah jembatan antara GL dan Inventaris Fisik.
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity            DECIMAL(15,2) NOT NULL, -- Positif untuk IN, Negatif untuk OUT
  unit_price          DECIMAL(15,2) NOT NULL, -- Biaya (HPP) per unit saat itu
  reference_type      TEXT NOT NULL, -- e.g. 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'
  reference_id        UUID NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk audit trail per produk (Kartu Stok)
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, movement_date);

-- 2. ATOMICITY: Fungsi RPC untuk Pembelian (The CTOs Pride)
-- Menghandle Header, Lines, dan Approval dalam satu transaksi DB.
CREATE OR REPLACE FUNCTION public.process_purchase_atomic(
  p_org_id UUID,
  p_vendor_id UUID,
  p_date TIMESTAMPTZ,
  p_total NUMERIC,
  p_tax NUMERIC,
  p_shipping NUMERIC,
  p_grand_total NUMERIC,
  p_notes TEXT,
  p_lines JSONB,
  p_user_id UUID
) RETURNS JSONB
AS $$
DECLARE
    v_purchase_id UUID;
    v_line RECORD;
BEGIN
    -- A. Insert Header
    INSERT INTO public.purchases (
        org_id, vendor_id, purchase_date, total_amount, tax_amount, 
        shipping_amount, grand_total, status, created_by, notes
    ) VALUES (
        p_org_id, p_vendor_id, p_date, p_total, p_tax, 
        p_shipping, p_grand_total, 'DRAFT', p_user_id, p_notes
    ) RETURNING id INTO v_purchase_id;

    -- B. Insert Lines (dari JSONB)
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        product_id UUID, description TEXT, quantity NUMERIC, 
        unit_price NUMERIC, discount_amount NUMERIC, tax_amount NUMERIC
    ) LOOP
        INSERT INTO public.purchase_items (
            org_id, purchase_id, product_id, description, 
            quantity, unit_price, discount_amount, tax_amount
        ) VALUES (
            p_org_id, v_purchase_id, v_line.product_id, v_line.description, 
            v_line.quantity, v_line.unit_price, v_line.discount_amount, v_line.tax_amount
        );
    END LOOP;

    -- C. Create Approval Request
    INSERT INTO public.approval_requests (
        org_id, requester_id, source_type, source_id, status, reason
    ) VALUES (
        p_org_id, p_user_id, 'PURCHASE_ORDER', v_purchase_id, 'PENDING', 
        'Atomic Purchase Order Creation'
    );

    RETURN jsonb_build_object('success', TRUE, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN
    -- Postgres secara otomatis ROLLBACK semua aksi di atas jika ada error
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
