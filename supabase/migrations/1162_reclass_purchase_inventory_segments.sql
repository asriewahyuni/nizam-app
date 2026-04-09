-- ============================================================
-- MIGRATION 1162: Reclass historical purchase inventory segments
-- ============================================================
-- Why:
-- Historical purchase receipts often parked inventory debits in 1301
-- even when the items were actually raw materials / WIP / finished goods.
-- This made segmented inventory accounts misleading, for example:
-- - 1301 too high
-- - 1303 negative after production consumption
--
-- This migration creates balancing reclass journal entries that move the
-- landed inventory value from 1301 into the resolved inventory account per
-- purchased product, without changing the original document totals.
-- ============================================================

DO $$
DECLARE
  v_purchase RECORD;
  v_alloc RECORD;
  v_entry_id UUID;
  v_acc_1301 UUID;
  v_reclass_total NUMERIC(20, 2);
  v_source_total NUMERIC(20, 2);
BEGIN
  FOR v_purchase IN
    SELECT
      p.id,
      p.org_id,
      p.branch_id,
      p.purchase_date,
      p.purchase_number
    FROM public.purchases p
    WHERE EXISTS (
      SELECT 1
      FROM public.journal_entries je
      JOIN public.journal_lines jl ON jl.entry_id = je.id
      JOIN public.accounts acc
        ON acc.id = jl.account_id
       AND acc.org_id = p.org_id
      WHERE je.org_id = p.org_id
        AND je.reference_type = 'PURCHASE'
        AND je.reference_id = p.id
        AND je.status = 'POSTED'
        AND acc.code = '1301'
        AND jl.debit > 0
        AND COALESCE(jl.memo, '') ILIKE 'Persediaan (Landed)%'
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.journal_entries je_fix
        WHERE je_fix.org_id = p.org_id
          AND je_fix.reference_type = 'ADJUSTMENT'
          AND je_fix.reference_id = p.id
          AND COALESCE(je_fix.notes, '') = '[AUTO_RECLASS_PURCHASE_INVENTORY_SEGMENT]'
      )
  LOOP
    PERFORM public.ensure_inventory_segment_accounts(v_purchase.org_id);

    SELECT id
    INTO v_acc_1301
    FROM public.accounts
    WHERE org_id = v_purchase.org_id
      AND code = '1301'
    LIMIT 1;

    IF v_acc_1301 IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(jl.debit), 0)
    INTO v_source_total
    FROM public.journal_entries je
    JOIN public.journal_lines jl ON jl.entry_id = je.id
    WHERE je.org_id = v_purchase.org_id
      AND je.reference_type = 'PURCHASE'
      AND je.reference_id = v_purchase.id
      AND je.status = 'POSTED'
      AND jl.account_id = v_acc_1301
      AND COALESCE(jl.memo, '') ILIKE 'Persediaan (Landed)%';

    SELECT COALESCE(SUM(alloc.amount), 0)
    INTO v_reclass_total
    FROM (
      SELECT
        public.resolve_inventory_asset_account(v_purchase.org_id, pi.product_id, '1301') AS target_account_id,
        ROUND(SUM(
          ((pi.quantity * pi.unit_price) - COALESCE(pi.discount_amount, 0))
          + CASE
              WHEN COALESCE(p.total_amount, 0) = 0 THEN 0
              ELSE (
                (((pi.quantity * pi.unit_price) - COALESCE(pi.discount_amount, 0)) / p.total_amount)
                * (COALESCE(p.shipping_amount, 0) + COALESCE(p.insurance_amount, 0))
              )
            END
        ), 2) AS amount
      FROM public.purchase_items pi
      JOIN public.purchases p ON p.id = pi.purchase_id
      WHERE pi.purchase_id = v_purchase.id
        AND pi.product_id IS NOT NULL
      GROUP BY 1
    ) alloc
    WHERE alloc.target_account_id IS NOT NULL
      AND alloc.target_account_id <> v_acc_1301
      AND alloc.amount > 0;

    IF v_reclass_total <= 0 THEN
      CONTINUE;
    END IF;

    IF v_source_total <= 0 THEN
      CONTINUE;
    END IF;

    IF v_reclass_total > v_source_total + 0.01 THEN
      CONTINUE;
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
      notes,
      posted_at
    ) VALUES (
      v_purchase.org_id,
      v_purchase.branch_id,
      COALESCE(v_purchase.purchase_date, CURRENT_DATE),
      'Reklas Persediaan Pembelian ' || COALESCE(v_purchase.purchase_number, ''),
      'ADJUSTMENT',
      v_purchase.id,
      'POSTED',
      TRUE,
      '[AUTO_RECLASS_PURCHASE_INVENTORY_SEGMENT]',
      NOW()
    )
    RETURNING id INTO v_entry_id;

    FOR v_alloc IN
      SELECT
        alloc.target_account_id,
        alloc.amount
      FROM (
        SELECT
          public.resolve_inventory_asset_account(v_purchase.org_id, pi.product_id, '1301') AS target_account_id,
          ROUND(SUM(
            ((pi.quantity * pi.unit_price) - COALESCE(pi.discount_amount, 0))
            + CASE
                WHEN COALESCE(p.total_amount, 0) = 0 THEN 0
                ELSE (
                  (((pi.quantity * pi.unit_price) - COALESCE(pi.discount_amount, 0)) / p.total_amount)
                  * (COALESCE(p.shipping_amount, 0) + COALESCE(p.insurance_amount, 0))
                )
              END
          ), 2) AS amount
        FROM public.purchase_items pi
        JOIN public.purchases p ON p.id = pi.purchase_id
        WHERE pi.purchase_id = v_purchase.id
          AND pi.product_id IS NOT NULL
        GROUP BY 1
      ) alloc
      WHERE alloc.target_account_id IS NOT NULL
        AND alloc.target_account_id <> v_acc_1301
        AND alloc.amount > 0
    LOOP
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (
        v_entry_id,
        v_alloc.target_account_id,
        v_alloc.amount,
        0,
        'Reklas dari 1301 untuk ' || COALESCE(v_purchase.purchase_number, 'PO')
      );
    END LOOP;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (
      v_entry_id,
      v_acc_1301,
      0,
      v_reclass_total,
      'Reklas keluar dari 1301 untuk ' || COALESCE(v_purchase.purchase_number, 'PO')
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
