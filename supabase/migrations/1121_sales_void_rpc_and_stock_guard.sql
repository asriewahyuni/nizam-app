-- ============================================================
-- MIGRATION 1121: Sales Void RPC Access + Non-SALAM Stock Guard
-- ============================================================
-- Goals:
-- 1) Ensure authenticated role can execute void atomic RPCs
-- 2) Enforce that non-SALAM sales cannot finish with negative stock
-- ============================================================

DO $$
DECLARE
  v_signature TEXT;
BEGIN
  -- Compatibility: some environments may still have legacy parameter order.
  IF to_regprocedure('public.void_sale_atomic(uuid,uuid,uuid,text)') IS NULL
     AND to_regprocedure('public.void_sale_atomic(uuid,text,uuid,uuid)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.void_sale_atomic(
        p_org_id UUID,
        p_sale_id UUID,
        p_user_id UUID,
        p_reason TEXT
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        RETURN public.void_sale_atomic(p_org_id, p_reason, p_sale_id, p_user_id);
      END;
      $body$;
    $fn$;
  END IF;

  -- Grant execute to any available void_sale_atomic variants.
  FOR v_signature IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'void_sale_atomic'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_signature);
  END LOOP;

  -- Grant execute to any available void_purchase_atomic variants.
  FOR v_signature IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'void_purchase_atomic'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_signature);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_sales_non_salam_stock_after_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_stock_after NUMERIC;
BEGIN
  -- Guard only when status transitions into FINISHED.
  IF NEW.status IS DISTINCT FROM 'FINISHED' OR OLD.status = 'FINISHED' THEN
    RETURN NEW;
  END IF;

  -- Akad SALAM is explicitly allowed to exceed on-hand stock.
  IF UPPER(COALESCE(NEW.shariah_mode::TEXT, 'CASH')) = 'SALAM' THEN
    RETURN NEW;
  END IF;

  IF NEW.warehouse_id IS NULL THEN
    RAISE EXCEPTION
      'Gudang pengiriman wajib dipilih. Penjualan tidak boleh melebihi stok (kecuali akad SALAM).';
  END IF;

  FOR v_item IN
    SELECT
      si.product_id,
      COALESCE(MAX(p.name), MAX(si.description), si.product_id::TEXT) AS product_name
    FROM public.sales_items si
    LEFT JOIN public.products p ON p.id = si.product_id
    WHERE si.org_id = NEW.org_id
      AND si.sale_id = NEW.id
      AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    GROUP BY si.product_id
  LOOP
    SELECT COALESCE(SUM(s.quantity), 0)
    INTO v_stock_after
    FROM public.inventory_stocks s
    WHERE s.org_id = NEW.org_id
      AND s.warehouse_id = NEW.warehouse_id
      AND s.product_id = v_item.product_id;

    IF v_stock_after < -0.000001 THEN
      RAISE EXCEPTION
        'Stok produk "%" tidak cukup. Penjualan tidak boleh melebihi stok (kecuali akad SALAM). Sisa stok setelah pengiriman: %.',
        v_item.product_name,
        v_stock_after;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_non_salam_stock_after_delivery ON public.sales;
CREATE TRIGGER trg_guard_sales_non_salam_stock_after_delivery
  BEFORE UPDATE OF status, warehouse_id ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sales_non_salam_stock_after_delivery();

NOTIFY pgrst, 'reload schema';
