-- ==========================================
-- MIGRATION 1423: Periode fiskal eksplisit (period_id) untuk journal_entries,
-- bank_transactions, dan inventory_adjustments.
--
-- Latar belakang: org AHE tidak punya satu pun baris fiscal_periods, sehingga
-- closed-period guard yang sudah ada (date-range match) sama sekali tak
-- berfungsi dan jurnal bisa nyasar ke tanggal sembarangan (JE-2026-001140).
-- Solusinya bukan cuma isi data fiscal_periods, tapi juga beri kolom
-- period_id eksplisit supaya periode transaksi bisa di-set independen dari
-- tanggal transaksi (mis. transaksi 30 Juli yang baru dientry 2 Agustus tapi
-- tetap harus tercatat di periode Juli selama periode itu belum ditutup).
--
-- Nullable permanen & fallback ke date-range kalau NULL -> 100% backward
-- compatible untuk data existing dan seluruh modul yang belum diupdate.
-- ==========================================

-- 1. Kolom period_id di 3 titik penulis journal_entries
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES fiscal_periods(id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period_id ON journal_entries(period_id);

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES fiscal_periods(id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_period_id ON bank_transactions(period_id);

ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES fiscal_periods(id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_period_id ON inventory_adjustments(period_id);

-- 2. Cegah overlap tanggal antar fiscal_periods dalam satu org (defense-in-depth
--    di level DB; validasi ramah di app level ditambahkan terpisah di
--    closing.actions.ts).
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_periods_no_overlap'
      AND conrelid = 'public.fiscal_periods'::regclass
  ) THEN
    ALTER TABLE public.fiscal_periods
      ADD CONSTRAINT fiscal_periods_no_overlap
      EXCLUDE USING gist (
        org_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      );
  END IF;
END $$;

-- 3. check_closed_period(): period_id jadi sumber kebenaran kalau terisi
--    (plus validasi org_id cocok), fallback ke date-range lama kalau NULL.
CREATE OR REPLACE FUNCTION public.check_closed_period()
RETURNS TRIGGER LANGUAGE plpgsql AS $function$
DECLARE
  v_org_id UUID;
  v_entry_date DATE;
  v_period_id UUID;
  v_period RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.org_id;
    v_entry_date := OLD.entry_date;
    v_period_id := OLD.period_id;
  ELSE
    v_org_id := NEW.org_id;
    v_entry_date := NEW.entry_date;
    v_period_id := NEW.period_id;
  END IF;

  IF v_org_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_period_id IS NOT NULL THEN
    SELECT id, org_id, is_closed, name INTO v_period
    FROM fiscal_periods
    WHERE id = v_period_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Periode fiskal (period_id=%) tidak ditemukan.', v_period_id;
    END IF;
    IF v_period.org_id <> v_org_id THEN
      RAISE EXCEPTION 'Periode fiskal tidak sesuai dengan organisasi transaksi.';
    END IF;
    IF v_period.is_closed THEN
      RAISE EXCEPTION 'Transaction is within a closed fiscal period and cannot be modified.';
    END IF;
  ELSIF v_entry_date IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM fiscal_periods
      WHERE org_id = v_org_id
        AND is_closed = TRUE
        AND v_entry_date BETWEEN start_date AND end_date
    ) THEN
      RAISE EXCEPTION 'Transaction is within a closed fiscal period and cannot be modified.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. auto_journal_bank_transaction(): teruskan NEW.period_id ke journal_entries.
--    Body identik dengan definisi live saat ini, hanya tambah 1 kolom+1 value.
CREATE OR REPLACE FUNCTION public.auto_journal_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
  v_bank_branch_id UUID;
BEGIN
  SELECT account_id, branch_id
  INTO v_bank_gl_account_id, v_bank_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Bank account % tidak ditemukan untuk organisasi %', NEW.bank_account_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_bank_branch_id, public.resolve_single_active_branch(NEW.org_id));
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction journaling on organization %', NEW.org_id;
  END IF;

  IF v_bank_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_branch_id;
  END IF;

  v_opp_gl_account_id := NEW.category_id;

  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSIF NEW.type::text = 'TRANSFER' THEN
    v_ref_type := 'BANK_TRANSFER';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto,
    created_by,
    period_id
  ) VALUES (
    NEW.org_id,
    NEW.branch_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED',
    TRUE,
    NEW.created_by,
    NEW.period_id
  ) RETURNING id INTO v_je_id;

  IF NEW.type::text = 'IN' THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$function$;

-- 5. process_inventory_adjustment(p_adj_id, p_user_id): teruskan
--    v_adj.period_id ke journal_entries. Body identik dengan definisi live
--    saat ini, hanya tambah 1 kolom+1 value pada INSERT journal_entries.
--    Overload lain process_inventory_adjustment(p_adj_id, p_org_id, p_created_by)
--    tidak dipakai kode manapun, sengaja tidak disentuh.
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(p_adj_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_adj RECORD;
    v_item RECORD;
    v_product RECORD;
    v_je_id UUID;
    v_loss_account_id UUID;
    v_inventory_account_id UUID;
    v_default_inventory_account_id UUID;
    v_branch_id UUID;
    v_item_branch_id UUID;
    v_stock_id UUID;
    v_zero_uuid CONSTANT UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    SELECT *
    INTO v_adj
    FROM public.inventory_adjustments
    WHERE id = p_adj_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Adjustment tidak ditemukan.');
    END IF;

    IF v_adj.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Adjustment already processed.');
    END IF;

    SELECT id
    INTO v_loss_account_id
    FROM public.accounts
    WHERE org_id = v_adj.org_id
      AND code = '6011'
    LIMIT 1;

    IF v_loss_account_id IS NULL THEN
        SELECT id
        INTO v_loss_account_id
        FROM public.accounts
        WHERE org_id = v_adj.org_id
          AND code = '6099'
        LIMIT 1;
    END IF;

    IF v_loss_account_id IS NULL THEN
        RAISE EXCEPTION 'Akun kerugian persediaan (6011/6099) belum tersedia untuk organisasi %', v_adj.org_id;
    END IF;

    SELECT
        CASE
            WHEN COUNT(DISTINCT w.branch_id) = 1 THEN MIN(w.branch_id::TEXT)::UUID
            ELSE NULL
        END
    INTO v_branch_id
    FROM public.inventory_adjustment_items iai
    LEFT JOIN public.warehouses w ON w.id = iai.warehouse_id
    WHERE iai.adjustment_id = p_adj_id
      AND w.branch_id IS NOT NULL;

    INSERT INTO public.journal_entries (
        org_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        is_auto,
        created_by,
        period_id
    ) VALUES (
        v_adj.org_id,
        v_branch_id,
        v_adj.adj_date,
        'Inventory Adjustment: ' || v_adj.adj_number || ' (' || v_adj.type::TEXT || ')',
        'ADJUSTMENT',
        v_adj.id,
        'POSTED',
        TRUE,
        p_user_id,
        v_adj.period_id
    ) RETURNING id INTO v_je_id;

    SELECT id
    INTO v_default_inventory_account_id
    FROM public.accounts
    WHERE org_id = v_adj.org_id
      AND code = '1301'
    LIMIT 1;

    FOR v_item IN
        SELECT *
        FROM public.inventory_adjustment_items
        WHERE adjustment_id = p_adj_id
        ORDER BY created_at ASC, id ASC
    LOOP
        IF COALESCE(v_item.diff_quantity, 0) = 0 THEN
            CONTINUE;
        END IF;

        SELECT
            p.asset_account_id,
            p.category
        INTO v_product
        FROM public.products p
        WHERE p.id = v_item.product_id;

        v_inventory_account_id := v_product.asset_account_id;

        IF v_inventory_account_id IS NULL THEN
            SELECT a.id
            INTO v_inventory_account_id
            FROM public.accounts a
            WHERE a.org_id = v_adj.org_id
              AND a.code = CASE
                  WHEN v_product.category = 'Setengah Jadi' THEN '1302'
                  WHEN v_product.category IN ('Bahan', 'Pelengkap') THEN '1303'
                  WHEN v_product.category = 'Siap Jual' THEN '1304'
                  ELSE '1301'
              END
            LIMIT 1;
        END IF;

        v_inventory_account_id := COALESCE(v_inventory_account_id, v_default_inventory_account_id);

        IF v_inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'Akun persediaan belum tersedia untuk produk % pada organisasi %', v_item.product_id, v_adj.org_id;
        END IF;

        SELECT branch_id
        INTO v_item_branch_id
        FROM public.warehouses
        WHERE id = v_item.warehouse_id;

        INSERT INTO public.stock_movements (
            org_id,
            branch_id,
            product_id,
            movement_date,
            quantity,
            unit_price,
            reference_type,
            reference_id,
            notes
        ) VALUES (
            v_adj.org_id,
            v_item_branch_id,
            v_item.product_id,
            v_adj.adj_date,
            v_item.diff_quantity,
            v_item.unit_cost,
            'ADJUSTMENT',
            v_adj.id,
            v_item.notes
        );

        IF v_item.warehouse_id IS NOT NULL THEN
            SELECT id
            INTO v_stock_id
            FROM public.inventory_stocks
            WHERE org_id = v_adj.org_id
              AND product_id = v_item.product_id
              AND warehouse_id = v_item.warehouse_id
              AND COALESCE(batch_number, '') = ''
              AND COALESCE(bin_id, v_zero_uuid) = v_zero_uuid
            ORDER BY created_at ASC NULLS LAST, id ASC
            LIMIT 1
            FOR UPDATE;

            IF v_stock_id IS NOT NULL THEN
                UPDATE public.inventory_stocks
                SET quantity = quantity + v_item.diff_quantity,
                    updated_at = NOW()
                WHERE id = v_stock_id;
            ELSE
                BEGIN
                    INSERT INTO public.inventory_stocks (
                        org_id,
                        product_id,
                        warehouse_id,
                        quantity,
                        batch_number,
                        bin_id
                    ) VALUES (
                        v_adj.org_id,
                        v_item.product_id,
                        v_item.warehouse_id,
                        v_item.diff_quantity,
                        NULL,
                        NULL
                    );
                EXCEPTION
                    WHEN unique_violation THEN
                        SELECT id
                        INTO v_stock_id
                        FROM public.inventory_stocks
                        WHERE org_id = v_adj.org_id
                          AND product_id = v_item.product_id
                          AND warehouse_id = v_item.warehouse_id
                          AND COALESCE(batch_number, '') = ''
                          AND COALESCE(bin_id, v_zero_uuid) = v_zero_uuid
                        ORDER BY created_at ASC NULLS LAST, id ASC
                        LIMIT 1
                        FOR UPDATE;

                        IF v_stock_id IS NULL THEN
                            RAISE;
                        END IF;

                        UPDATE public.inventory_stocks
                        SET quantity = quantity + v_item.diff_quantity,
                            updated_at = NOW()
                        WHERE id = v_stock_id;
                END;
            END IF;
        END IF;

        IF COALESCE(v_item.total_value, 0) > 0 THEN
            IF v_item.diff_quantity < 0 THEN
                INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
                VALUES (
                    v_je_id,
                    v_loss_account_id,
                    v_item.total_value,
                    0,
                    'Kerugian/Write-off Persediaan'
                );

                INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
                VALUES (
                    v_je_id,
                    v_inventory_account_id,
                    0,
                    v_item.total_value,
                    'Penurunan Stok: ' || v_adj.adj_number
                );
            ELSIF v_item.diff_quantity > 0 THEN
                INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
                VALUES (
                    v_je_id,
                    v_inventory_account_id,
                    v_item.total_value,
                    0,
                    'Penambahan Stok: ' || v_adj.adj_number
                );

                INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
                VALUES (
                    v_je_id,
                    v_loss_account_id,
                    0,
                    v_item.total_value,
                    'Penyesuaian Stok (Gain/Correction)'
                );
            END IF;
        END IF;
    END LOOP;

    UPDATE public.inventory_adjustments
    SET status = 'FINISHED',
        journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = p_adj_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'adj_id', p_adj_id,
        'journal_entry_id', v_je_id
    );
END;
$function$;
