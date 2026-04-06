-- ============================================================
-- MIGRATION 1144: Repair Bank Transaction Report Sync
-- ============================================================
-- Tujuan:
--   Menyempurnakan laporan keuangan historis untuk transaksi kas/bank
--   yang sudah POSTED namun belum sinkron dengan jurnal.
--
-- Perbaikan yang dilakukan:
--   1) Backfill branch_id pada journal_entries yang terkait bank tx.
--   2) Link ulang bank_transactions -> journal_entries bila jurnal
--      sebenarnya sudah ada tapi journal_entry_id masih NULL.
--   3) Re-create jurnal otomatis untuk bank_transactions POSTED lama
--      yang belum punya jurnal sama sekali.
--   4) Koreksi label inter-org source transfer:
--      OUT/CASH_OUT -> TRANSFER/BANK_TRANSFER.
-- ============================================================

CREATE OR REPLACE FUNCTION public.repair_bank_transaction_report_sync(
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_bank_branch_id UUID;
  v_branch_id UUID;
  v_ref_type journal_reference_type;
  v_fixed_bank_tx_branch_count INTEGER := 0;
  v_fixed_journal_branch_count INTEGER := 0;
  v_linked_existing_journal_count INTEGER := 0;
  v_created_journal_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_noop_posting_count INTEGER := 0;
  v_retyped_interorg_source_count INTEGER := 0;
  v_retyped_interorg_journal_count INTEGER := 0;
BEGIN
  -- 1) Legacy-safe: normalisasi branch_id bank_transactions jika masih NULL
  WITH fixed_tx AS (
    UPDATE public.bank_transactions bt
    SET branch_id = COALESCE(
      ba.branch_id,
      public.get_default_branch_id(bt.org_id)
    )
    FROM public.bank_accounts ba
    WHERE bt.branch_id IS NULL
      AND ba.id = bt.bank_account_id
      AND ba.org_id = bt.org_id
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_fixed_bank_tx_branch_count FROM fixed_tx;

  -- 2) Pastikan journal_entries bank tx punya branch_id agar terbaca laporan per unit
  WITH fixed_je AS (
    UPDATE public.journal_entries je
    SET branch_id = COALESCE(
      bt.branch_id,
      ba.branch_id,
      public.get_default_branch_id(bt.org_id)
    )
    FROM public.bank_transactions bt
    LEFT JOIN public.bank_accounts ba
      ON ba.id = bt.bank_account_id
     AND ba.org_id = bt.org_id
    WHERE je.reference_id = bt.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
      AND je.branch_id IS NULL
      AND (p_org_id IS NULL OR je.org_id = p_org_id)
    RETURNING je.id
  )
  SELECT COUNT(*) INTO v_fixed_journal_branch_count FROM fixed_je;

  -- 3) Link ulang bila jurnal sebenarnya sudah ada tetapi pointer tx kosong
  WITH linked_existing AS (
    UPDATE public.bank_transactions bt
    SET journal_entry_id = je.id,
        updated_at = NOW()
    FROM public.journal_entries je
    WHERE bt.status = 'POSTED'
      AND bt.journal_entry_id IS NULL
      AND je.org_id = bt.org_id
      AND je.reference_id = bt.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_linked_existing_journal_count FROM linked_existing;

  -- 4) Buat jurnal untuk tx POSTED yang belum punya jurnal sama sekali
  FOR v_tx IN
    SELECT
      bt.id,
      bt.org_id,
      bt.branch_id,
      bt.bank_account_id,
      bt.transaction_date,
      bt.description,
      bt.amount,
      bt.type,
      bt.category_id,
      bt.created_by
    FROM public.bank_transactions bt
    LEFT JOIN public.journal_entries je
      ON je.id = bt.journal_entry_id
    WHERE bt.status = 'POSTED'
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
      AND (bt.journal_entry_id IS NULL OR je.id IS NULL)
    ORDER BY bt.transaction_date ASC, bt.created_at ASC, bt.id ASC
  LOOP
    -- Coba cari lagi by reference_id untuk jaga-jaga race/duplikasi
    SELECT je.id
      INTO v_je_id
    FROM public.journal_entries je
    WHERE je.org_id = v_tx.org_id
      AND je.reference_id = v_tx.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
    ORDER BY je.created_at DESC
    LIMIT 1;

    IF v_je_id IS NOT NULL THEN
      UPDATE public.bank_transactions
      SET journal_entry_id = v_je_id,
          updated_at = NOW()
      WHERE id = v_tx.id;
      v_linked_existing_journal_count := v_linked_existing_journal_count + 1;
      CONTINUE;
    END IF;

    -- Wajib punya akun lawan untuk membuat jurnal
    IF v_tx.category_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT ba.account_id, ba.branch_id
      INTO v_bank_gl_account_id, v_bank_branch_id
    FROM public.bank_accounts ba
    WHERE ba.id = v_tx.bank_account_id
      AND ba.org_id = v_tx.org_id
    LIMIT 1;

    IF v_bank_gl_account_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = v_tx.category_id
        AND a.org_id = v_tx.org_id
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    v_branch_id := COALESCE(
      v_tx.branch_id,
      v_bank_branch_id,
      public.get_default_branch_id(v_tx.org_id)
    );

    IF v_branch_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    IF v_tx.type::TEXT = 'IN' THEN
      v_ref_type := 'CASH_IN';
    ELSIF v_tx.type::TEXT = 'TRANSFER' THEN
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
      created_by
    ) VALUES (
      v_tx.org_id,
      v_branch_id,
      v_tx.transaction_date,
      COALESCE(v_tx.description, 'Auto Repair: Bank Transaction'),
      v_ref_type,
      v_tx.id,
      'POSTED',
      TRUE,
      v_tx.created_by
    )
    RETURNING id INTO v_je_id;

    IF v_tx.type::TEXT = 'IN' THEN
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_bank_gl_account_id, v_tx.amount, 0, COALESCE(v_tx.description, 'Auto Repair'));

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_tx.category_id, 0, v_tx.amount, COALESCE(v_tx.description, 'Auto Repair'));
    ELSE
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_tx.category_id, v_tx.amount, 0, COALESCE(v_tx.description, 'Auto Repair'));

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_bank_gl_account_id, 0, v_tx.amount, COALESCE(v_tx.description, 'Auto Repair'));
    END IF;

    UPDATE public.bank_transactions
    SET journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = v_tx.id;

    v_created_journal_count := v_created_journal_count + 1;
  END LOOP;

  -- 5) Audit no-op posting (akun lawan = akun bank) agar user tahu
  SELECT COUNT(*)
    INTO v_noop_posting_count
  FROM public.bank_transactions bt
  JOIN public.bank_accounts ba
    ON ba.id = bt.bank_account_id
   AND ba.org_id = bt.org_id
  WHERE bt.status = 'POSTED'
    AND bt.category_id = ba.account_id
    AND (p_org_id IS NULL OR bt.org_id = p_org_id);

  -- 6) Backfill label source transfer antar entitas:
  --    OUT/CASH_OUT -> TRANSFER/BANK_TRANSFER
  WITH interorg_source AS (
    SELECT DISTINCT src.id AS source_tx_id
    FROM public.bank_transactions src
    JOIN public.bank_transactions tgt
      ON tgt.status = 'POSTED'
     AND tgt.type = 'IN'
     AND tgt.org_id <> src.org_id
     AND tgt.amount = src.amount
     AND tgt.transaction_date = src.transaction_date
     AND COALESCE(tgt.reference_number, '') = COALESCE(src.reference_number, '')
     AND tgt.created_by IS NOT DISTINCT FROM src.created_by
    WHERE src.status = 'POSTED'
      AND src.type = 'OUT'
      AND public.is_org_in_consolidation_tree(tgt.org_id, src.org_id)
      AND (p_org_id IS NULL OR src.org_id = p_org_id OR tgt.org_id = p_org_id)
  ),
  updated_source AS (
    UPDATE public.bank_transactions bt
    SET type = 'TRANSFER',
        updated_at = NOW()
    FROM interorg_source src
    WHERE bt.id = src.source_tx_id
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_retyped_interorg_source_count FROM updated_source;

  WITH interorg_source AS (
    SELECT DISTINCT src.id AS source_tx_id
    FROM public.bank_transactions src
    JOIN public.bank_transactions tgt
      ON tgt.status = 'POSTED'
     AND tgt.type = 'IN'
     AND tgt.org_id <> src.org_id
     AND tgt.amount = src.amount
     AND tgt.transaction_date = src.transaction_date
     AND COALESCE(tgt.reference_number, '') = COALESCE(src.reference_number, '')
     AND tgt.created_by IS NOT DISTINCT FROM src.created_by
    WHERE src.status = 'POSTED'
      AND src.type = 'TRANSFER'
      AND public.is_org_in_consolidation_tree(tgt.org_id, src.org_id)
      AND (p_org_id IS NULL OR src.org_id = p_org_id OR tgt.org_id = p_org_id)
  ),
  updated_journal AS (
    UPDATE public.journal_entries je
    SET reference_type = 'BANK_TRANSFER'
    FROM interorg_source src
    WHERE je.reference_id = src.source_tx_id
      AND je.reference_type = 'CASH_OUT'
      AND (p_org_id IS NULL OR je.org_id = p_org_id)
    RETURNING je.id
  )
  SELECT COUNT(*) INTO v_retyped_interorg_journal_count FROM updated_journal;

  RETURN jsonb_build_object(
    'success', TRUE,
    'fixed_bank_tx_branch_count', v_fixed_bank_tx_branch_count,
    'fixed_journal_branch_count', v_fixed_journal_branch_count,
    'linked_existing_journal_count', v_linked_existing_journal_count,
    'created_journal_count', v_created_journal_count,
    'skipped_count', v_skipped_count,
    'noop_posting_count', v_noop_posting_count,
    'retyped_interorg_source_count', v_retyped_interorg_source_count,
    'retyped_interorg_journal_count', v_retyped_interorg_journal_count
  );
END;
$$;

-- Jalankan sekali untuk memperbaiki data historis seluruh organisasi
SELECT public.repair_bank_transaction_report_sync(NULL);

GRANT EXECUTE ON FUNCTION public.repair_bank_transaction_report_sync(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
