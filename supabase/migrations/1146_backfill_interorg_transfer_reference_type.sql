-- ============================================================
-- MIGRATION 1146: Backfill Inter-Org Transfer Reference Type
-- ============================================================
-- Tujuan:
--   Data lama inter-org capital transfer sempat tercatat sebagai:
--     - source leg: bank_transactions.type = 'OUT'
--     - journal reference_type = 'CASH_OUT'
--   Label yang benar untuk source leg adalah TRANSFER / BANK_TRANSFER.
--
-- Strategi:
--   1) Deteksi pasangan source/target transfer modal antar org.
--   2) Ubah source leg type dari OUT -> TRANSFER.
--   3) Ubah journal reference_type source leg CASH_OUT -> BANK_TRANSFER.
-- ============================================================

WITH candidate_pairs AS (
  SELECT DISTINCT
    src.id AS source_tx_id
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
    AND src.description ILIKE '%transfer modal%'
    AND tgt.description ILIKE '%transfer modal%'
    AND public.is_org_in_consolidation_tree(tgt.org_id, src.org_id)
),
updated_tx AS (
  UPDATE public.bank_transactions bt
  SET type = 'TRANSFER',
      updated_at = NOW()
  FROM candidate_pairs cp
  WHERE bt.id = cp.source_tx_id
  RETURNING bt.id
),
updated_je AS (
  UPDATE public.journal_entries je
  SET reference_type = 'BANK_TRANSFER'
  FROM public.bank_transactions bt
  WHERE bt.id IN (SELECT id FROM updated_tx)
    AND je.id = bt.journal_entry_id
    AND je.reference_type = 'CASH_OUT'
  RETURNING je.id
)
SELECT jsonb_build_object(
  'updated_source_transfer_type', (SELECT COUNT(*) FROM updated_tx),
  'updated_source_reference_type', (SELECT COUNT(*) FROM updated_je)
) AS migration_result;

NOTIFY pgrst, 'reload schema';
