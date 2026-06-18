-- ============================================================
-- MIGRATION 1366: Fix journal entry number collision
--
-- Masalah: generate_entry_number() menggunakan COUNT(*) untuk
-- menentukan nomor urut. Ini tidak aman saat dua journal entry
-- dibuat hampir bersamaan (misalnya jurnal balik manual + jurnal
-- dari process_purchase_return_atomic), keduanya mendapat nilai
-- COUNT yang sama → generate nomor yang sama → UNIQUE violation
-- pada constraint journal_entries_org_id_entry_number_key.
--
-- Fix:
-- 1. Ubah generate_entry_number() pakai MAX(entry_number) —
--    konsisten dengan TypeScript getNextJournalEntryNumber()
-- 2. Tambah retry loop di process_purchase_return_atomic agar
--    tahan terhadap sisa race condition yang tipis
-- ============================================================

-- 1. Fix generate_entry_number() — gunakan MAX bukan COUNT
CREATE OR REPLACE FUNCTION generate_entry_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year   TEXT := TO_CHAR(NOW(), 'YYYY');
  v_prefix TEXT;
  v_last   TEXT;
  v_seq    INT;
BEGIN
  v_prefix := 'JE-' || v_year || '-';

  -- Ambil nomor urut tertinggi yang sudah ada untuk org + tahun ini
  SELECT MAX(entry_number) INTO v_last
  FROM journal_entries
  WHERE org_id   = p_org_id
    AND entry_number LIKE v_prefix || '%';

  IF v_last IS NOT NULL THEN
    v_seq := SUBSTRING(v_last FROM LENGTH(v_prefix) + 1)::INT + 1;
  ELSE
    v_seq := 1;
  END IF;

  RETURN v_prefix || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Update process_purchase_return_atomic dengan retry pada nomor jurnal bentrok
CREATE OR REPLACE FUNCTION public.process_purchase_return_atomic(
  p_org_id UUID,
  p_purchase_id UUID,
  p_return_number TEXT,
  p_return_date TIMESTAMPTZ,
  p_notes TEXT,
  p_items JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
  v_return_id UUID;
  v_item RECORD;
  v_total_net NUMERIC := 0;
  v_total_tax NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_je_id UUID;
  v_je_entry_number TEXT;
  v_resolved_warehouse UUID;
  v_item_inventory_account UUID;
  v_inventory_credit_by_account JSONB := '{}'::JSONB;
  v_credit_line RECORD;
  v_inventory_line_amount NUMERIC;
  v_attempt INT;
  acc_hutang UUID;
  acc_ppn_masukan UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required.');
  END IF;

  IF NOT public.nizam_has_permission('purchasing:write', p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient permission to create purchase return.');
  END IF;

  SELECT *
  INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PO tidak ditemukan.');
  END IF;

  IF v_purchase.branch_id IS NOT NULL
     AND NOT public.can_access_branch(p_org_id, v_purchase.branch_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Anda tidak memiliki akses unit untuk retur PO ini.');
  END IF;

  v_resolved_warehouse := COALESCE(
    v_purchase.warehouse_id,
    public.resolve_single_active_warehouse(p_org_id, v_purchase.branch_id)
  );

  IF v_resolved_warehouse IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Warehouse penerimaan tidak ditemukan sehingga retur tidak bisa sinkron ke stok fisik.'
    );
  END IF;

  SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id LIMIT 1;
  SELECT id INTO acc_ppn_masukan FROM public.accounts WHERE code = '1401' AND org_id = p_org_id LIMIT 1;

  IF acc_hutang IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Akun hutang (2101) belum lengkap untuk retur pembelian.');
  END IF;

  INSERT INTO public.purchase_returns (
    org_id,
    purchase_id,
    return_number,
    return_date,
    notes,
    created_by,
    branch_id
  )
  VALUES (
    p_org_id,
    p_purchase_id,
    p_return_number,
    p_return_date,
    p_notes,
    p_user_id,
    v_purchase.branch_id
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      product_id UUID,
      quantity NUMERIC,
      unit_price NUMERIC,
      purchase_item_id UUID
    )
  LOOP
    IF COALESCE(v_item.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity retur harus lebih besar dari nol.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.purchase_items pi
      WHERE pi.id = v_item.purchase_item_id
        AND pi.purchase_id = p_purchase_id
        AND pi.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Item retur tidak valid untuk purchase %', p_purchase_id;
    END IF;

    INSERT INTO public.purchase_return_items (
      return_id,
      purchase_item_id,
      product_id,
      quantity,
      unit_price,
      total_price
    )
    VALUES (
      v_return_id,
      v_item.purchase_item_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price,
      v_item.quantity * v_item.unit_price
    );

    INSERT INTO public.stock_movements (
      org_id,
      branch_id,
      product_id,
      quantity,
      unit_price,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      p_org_id,
      v_purchase.branch_id,
      v_item.product_id,
      -v_item.quantity,
      v_item.unit_price,
      'PURCHASE_RETURN',
      v_return_id,
      'Retur Pembelian ' || COALESCE(p_return_number, '')
    );

    PERFORM public.adjust_inventory_stock(
      p_org_id,
      v_item.product_id,
      v_resolved_warehouse,
      -v_item.quantity,
      NULL,
      NULL
    );

    v_item_inventory_account := public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301');
    IF v_item_inventory_account IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akun persediaan produk retur pembelian belum diatur.');
    END IF;

    v_inventory_line_amount := v_item.quantity * v_item.unit_price;

    v_inventory_credit_by_account := jsonb_set(
      v_inventory_credit_by_account,
      ARRAY[v_item_inventory_account::TEXT],
      to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + v_inventory_line_amount),
      TRUE
    );

    v_total_net := v_total_net + v_inventory_line_amount;
  END LOOP;

  v_total_tax := v_total_net * 0.11;
  v_total_return := v_total_net + v_total_tax;

  UPDATE public.purchase_returns
  SET total_amount = v_total_return,
      tax_amount = v_total_tax
  WHERE id = v_return_id;

  -- Retry journal entry insert untuk toleransi nomor bentrok
  v_je_id := NULL;
  FOR v_attempt IN 1..5 LOOP
    BEGIN
      v_je_entry_number := public.generate_entry_number(p_org_id);

      INSERT INTO public.journal_entries (
        org_id,
        branch_id,
        entry_number,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        is_auto
      )
      VALUES (
        p_org_id,
        v_purchase.branch_id,
        v_je_entry_number,
        p_return_date,
        'Retur Pembelian ' || COALESCE(p_return_number, ''),
        'PURCHASE_RETURN',
        v_return_id,
        'POSTED',
        TRUE
      )
      RETURNING id INTO v_je_id;

      EXIT; -- sukses, keluar dari loop
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Nomor jurnal bentrok setelah beberapa percobaan, coba lagi sesaat lagi.');
      END IF;
      -- tunggu sebentar lalu coba ulang
      PERFORM pg_sleep(0.05 * v_attempt);
    END;
  END LOOP;

  INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_je_id, acc_hutang, v_total_return, 0);

  FOR v_credit_line IN
    SELECT key, value
    FROM jsonb_each_text(v_inventory_credit_by_account)
  LOOP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
  END LOOP;

  IF v_total_tax > 0 AND acc_ppn_masukan IS NOT NULL THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, acc_ppn_masukan, 0, v_total_tax);
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_purchase_return_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, JSONB, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
