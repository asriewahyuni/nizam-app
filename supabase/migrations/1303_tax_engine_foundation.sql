-- 1303_tax_engine_foundation.sql
-- PPN Engine — Org tax settings + SPT + Faktur Pajak + auto-posting

-- 1. Org Tax Settings (PKP profile)
CREATE TABLE IF NOT EXISTS org_tax_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- PKP Profile
  is_pkp BOOLEAN NOT NULL DEFAULT false,
  npwp TEXT,
  pkp_since DATE,
  tax_period_type TEXT NOT NULL DEFAULT 'MONTHLY',
  
  -- Rates
  ppn_rate NUMERIC(5,2) NOT NULL DEFAULT 11.00,
  pph_21_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  pph_23_rate NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  
  -- Tax Accounts (override default CoA)
  ppn_masukan_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ppn_keluaran_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  pph_21_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  pph_23_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- e-Faktur / e-Billing
  efaktur_username TEXT,
  efaktur_password TEXT,
  ebilling_billing_id TEXT,
  
  -- Settings
  auto_post_tax_journal BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tax Invoice Number (NSFP) tracking
CREATE TABLE IF NOT EXISTS tax_invoice_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  series_number TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_org_series UNIQUE (org_id, series_number),
  CONSTRAINT check_range CHECK (range_start > 0 AND range_end > range_start AND current_number BETWEEN 0 AND range_end)
);

-- 3. Faktur Pajak records
CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  factur_number TEXT NOT NULL UNIQUE,
  
  -- Referensi transaksi
  reference_type TEXT NOT NULL, -- 'SALE' | 'PURCHASE'
  reference_id UUID NOT NULL,
  
  -- Detail Faktur
  faktur_date DATE NOT NULL,
  customer_name TEXT,
  customer_npwp TEXT,
  customer_address TEXT,
  total_dpp NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_ppn NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_ppnbm NUMERIC(20,2) NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | APPROVED | REPORTED | VOID
  reported_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  
  -- Sync DJP
  djponline_status TEXT, -- NONE | PENDING | SUCCESS | FAILED
  djponline_error TEXT,
  djponline_sync_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_reference_type CHECK (reference_type IN ('SALE', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN'))
);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_org_date ON tax_invoices(org_id, faktur_date DESC);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_reference ON tax_invoices(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status ON tax_invoices(status);

-- 4. Function: get SPT Masa PPN 1111 summary
CREATE OR REPLACE FUNCTION get_spt_ppn_1111(
  p_org_id UUID,
  p_tax_period DATE -- first day of month, e.g. '2026-05-01'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', p_tax_period)::DATE;
  v_period_end DATE := (date_trunc('month', p_tax_period) + INTERVAL '1 month - 1 day')::DATE;
  v_total_ppn_keluaran NUMERIC := 0;
  v_total_ppn_masukan NUMERIC := 0;
  v_total_ppn_kurang_bayar NUMERIC := 0;
  v_total_dpp_penjualan NUMERIC := 0;
  v_total_dpp_pembelian NUMERIC := 0;
  v_jumlah_faktur_keluaran INT := 0;
  v_jumlah_faktur_masukan INT := 0;
  v_result JSONB;
BEGIN
  -- 1. Hitung PPN Keluaran dari sales dalam periode
  SELECT 
    COALESCE(SUM(s.grand_total - s.tax_amount), 0),
    COALESCE(SUM(s.tax_amount), 0),
    COUNT(*) FILTER(WHERE s.tax_amount > 0)
  INTO v_total_dpp_penjualan, v_total_ppn_keluaran, v_jumlah_faktur_keluaran
  FROM sales s
  WHERE s.org_id = p_org_id
    AND s.sale_date BETWEEN v_period_start AND v_period_end
    AND s.status = 'POSTED';
    
  -- 2. Hitung PPN Masukan dari purchases dalam periode
  SELECT 
    COALESCE(SUM(p.total_amount), 0),
    COALESCE(SUM(p.tax_amount), 0),
    COUNT(*) FILTER(WHERE p.tax_amount > 0)
  INTO v_total_dpp_pembelian, v_total_ppn_masukan, v_jumlah_faktur_masukan
  FROM purchases p
  WHERE p.org_id = p_org_id
    AND p.purchase_date BETWEEN v_period_start AND v_period_end
    AND p.status = 'POSTED';
  
  v_total_ppn_kurang_bayar := v_total_ppn_keluaran - v_total_ppn_masukan;
  
  -- 3. Build result (format SPT 1111)
  v_result := jsonb_build_object(
    'tax_period', to_char(v_period_start, 'YYYY-MM'),
    'period_start', v_period_start,
    'period_end', v_period_end,
    'section_a', jsonb_build_object( -- Penyerahan & PPN Keluaran
      'total_dpp', v_total_dpp_penjualan,
      'total_ppn', v_total_ppn_keluaran,
      'jumlah_faktur', v_jumlah_faktur_keluaran
    ),
    'section_b', jsonb_build_object( -- Perolehan & PPN Masukan
      'total_dpp', v_total_dpp_pembelian,
      'total_ppn', v_total_ppn_masukan,
      'jumlah_faktur', v_jumlah_faktur_masukan
    ),
    'section_c', jsonb_build_object( -- PPN Kurang/Lebih Bayar
      'ppn_keluaran', v_total_ppn_keluaran,
      'ppn_masukan', v_total_ppn_masukan,
      'ppn_kurang_bayar', GREATEST(v_total_ppn_kurang_bayar, 0),
      'ppn_lebih_bayar', GREATEST(-v_total_ppn_kurang_bayar, 0)
    )
  );
  
  RETURN v_result;
END;
$$;

-- 5. Function: create tax payment journal
CREATE OR REPLACE FUNCTION create_tax_payment_journal(
  p_org_id UUID,
  p_tax_period DATE,
  p_paid_at DATE,
  p_paid_from_account_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ppn_keluaran_account_id UUID;
  v_ppn_kurang_bayar NUMERIC;
  v_entry_id UUID;
  v_entry_number TEXT;
  v_spt_data JSONB;
BEGIN
  -- Cek dulu PPN kurang bayar
  v_spt_data := get_spt_ppn_1111(p_org_id, p_tax_period);
  v_ppn_kurang_bayar := (v_spt_data->'section_c'->>'ppn_kurang_bayar')::NUMERIC;
  
  IF v_ppn_kurang_bayar <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak ada PPN Kurang Bayar untuk periode ini.');
  END IF;
  
  -- Cari akun PPN Keluaran
  SELECT COALESCE(
    (SELECT ppn_keluaran_account_id FROM org_tax_settings WHERE org_id = p_org_id),
    (SELECT id FROM accounts WHERE org_id = p_org_id AND code = '2201' AND is_active = TRUE LIMIT 1)
  ) INTO v_ppn_keluaran_account_id;
  
  IF v_ppn_keluaran_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akun PPN Keluaran (2201) tidak ditemukan.');
  END IF;
  
  -- Buat journal entry number
  v_entry_number := 'TAX-PMT-' || to_char(p_tax_period, 'YYYYMM') || '-' || to_char(now(), 'HH24MISS');
  
  -- Insert JE
  INSERT INTO journal_entries (
    org_id, entry_number, entry_date, description,
    reference_type, status, is_auto, notes, posted_at
  ) VALUES (
    p_org_id, v_entry_number, p_paid_at,
    'Pembayaran PPN Masa ' || to_char(p_tax_period, 'Mon YYYY'),
    'TAX', 'POSTED', TRUE,
    COALESCE(p_notes, 'Auto-payment journal from PPN engine. Kurang Bayar: ' || v_ppn_kurang_bayar),
    now()
  ) RETURNING id INTO v_entry_id;
  
  -- Line 1: Debit PPN Keluaran (kurang bayar dikurangi)
  INSERT INTO journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_entry_id, v_ppn_keluaran_account_id, v_ppn_kurang_bayar, 0);
  
  -- Line 2: Credit Kas/Bank
  INSERT INTO journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_entry_id, p_paid_from_account_id, 0, v_ppn_kurang_bayar);
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'amount', v_ppn_kurang_bayar,
    'tax_period', to_char(p_tax_period, 'YYYY-MM'),
    'spt_data', v_spt_data
  );
END;
$$;

-- Add TAX reference type
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'TAX';
