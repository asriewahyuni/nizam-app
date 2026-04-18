-- ============================================================
-- MIGRATION 1225: Add POS shift opening journal reference type
-- Ensure opening float journals can be posted without enum errors.
-- ============================================================

ALTER TYPE public.journal_reference_type
  ADD VALUE IF NOT EXISTS 'POS_SHIFT_OPENING';
