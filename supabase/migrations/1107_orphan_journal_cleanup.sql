-- ============================================================
-- MIGRATION 1107: Orphan Journal Cleanup
-- ============================================================
-- Remove legacy journal rows that no longer belong to any
-- organization. These rows bypass active-tenant flows and can
-- keep branch/null audit noise alive forever.
-- ============================================================

DELETE FROM public.journal_lines jl
WHERE NOT EXISTS (
  SELECT 1
  FROM public.journal_entries je
  WHERE je.id = jl.entry_id
);

DELETE FROM public.journal_entries je
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organizations o
  WHERE o.id = je.org_id
);

ALTER TABLE public.journal_entries
VALIDATE CONSTRAINT journal_entries_org_id_fkey;

ALTER TABLE public.journal_lines
VALIDATE CONSTRAINT journal_lines_entry_id_fkey;

CREATE OR REPLACE VIEW public.orphan_journal_entry_audit AS
SELECT
  je.org_id,
  COUNT(*) AS orphan_journal_count,
  COUNT(*) FILTER (WHERE je.branch_id IS NULL) AS orphan_null_branch_count,
  MIN(je.created_at) AS oldest_created_at,
  MAX(je.created_at) AS newest_created_at
FROM public.journal_entries je
LEFT JOIN public.organizations o ON o.id = je.org_id
WHERE o.id IS NULL
GROUP BY je.org_id
ORDER BY orphan_journal_count DESC, newest_created_at DESC;

NOTIFY pgrst, 'reload schema';
