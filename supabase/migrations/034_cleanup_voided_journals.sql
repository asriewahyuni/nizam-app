-- ============================================================
-- MIGRATION 034: Cleanup Voided Journals
-- Delete all journal entries with status 'VOIDED' from all orgs.
-- This will also delete corresponding journal_lines due to CASCADE.
-- ============================================================

DELETE FROM public.journal_entries 
WHERE status = 'VOIDED';
