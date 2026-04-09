-- ============================================================
-- MIGRATION 1165: Fix Inventory Adjustment Stock Sync Conflict
-- ============================================================
-- Why:
-- Stock opname dan mutasi gudang sama-sama diproses lewat
-- public.process_inventory_adjustment().
--
-- Fungsi lama masih memakai:
--   ON CONFLICT (product_id, warehouse_id, batch_number)
--
-- Setelah inventory_stocks memakai key WMS berbasis ekspresi
-- (product, warehouse, coalesce(batch), coalesce(bin)),
-- target ON CONFLICT lama tidak selalu punya unique/exclusion
-- constraint yang cocok. Akibatnya proses adjustment gagal dengan:
--   there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- This migration:
-- 1. Mengganti sinkron stok fisik menjadi alur lock/update-or-insert
--    yang kompatibel dengan schema lama maupun schema WMS terbaru.
-- 2. Menormalkan jurnal otomatis adjustment ke reference_type
--    'ADJUSTMENT' agar konsisten dengan enum dan laporan.
-- 3. Menjaga branch context jurnal adjustment jika seluruh item
--    berasal dari branch yang sama.

CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
    p_adj_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        created_by
    ) VALUES (
        v_adj.org_id,
        v_branch_id,
        v_adj.adj_date,
        'Inventory Adjustment: ' || v_adj.adj_number || ' (' || v_adj.type::TEXT || ')',
        'ADJUSTMENT',
        v_adj.id,
        'POSTED',
        TRUE,
        p_user_id
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
$$;

NOTIFY pgrst, 'reload schema';
