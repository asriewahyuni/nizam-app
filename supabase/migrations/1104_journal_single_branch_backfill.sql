-- ============================================================
-- MIGRATION 1104: Journal Single-Branch Backfill
-- Repair legacy journal entries that were created without
-- branch_id for organizations that only have one active unit.
-- Also default future branch-less journal inserts to that sole
-- active branch when it is unambiguous.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_branch_date
  ON public.journal_entries(org_id, branch_id, entry_date DESC);

UPDATE public.journal_entries je
SET branch_id = public.resolve_single_active_branch(je.org_id)
WHERE je.branch_id IS NULL
  AND public.resolve_single_active_branch(je.org_id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_journal_entry_default_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF NEW.branch_id IS NULL THEN
    v_branch_id := public.resolve_single_active_branch(NEW.org_id);
    IF v_branch_id IS NOT NULL THEN
      NEW.branch_id := v_branch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_default_branch_context ON public.journal_entries;
CREATE TRIGGER trg_journal_entry_default_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_journal_entry_default_branch_context();

CREATE OR REPLACE VIEW public.journal_entry_branch_backfill_audit AS
WITH active_branch_counts AS (
  SELECT
    b.org_id,
    COUNT(*) FILTER (WHERE b.is_active = TRUE) AS active_branch_count
  FROM public.branches b
  GROUP BY b.org_id
)
SELECT
  je.org_id,
  o.name AS org_name,
  COALESCE(abc.active_branch_count, 0) AS active_branch_count,
  COUNT(*) AS unresolved_journal_count
FROM public.journal_entries je
LEFT JOIN public.organizations o ON o.id = je.org_id
LEFT JOIN active_branch_counts abc ON abc.org_id = je.org_id
WHERE je.branch_id IS NULL
GROUP BY je.org_id, o.name, abc.active_branch_count
ORDER BY unresolved_journal_count DESC, org_name;

NOTIFY pgrst, 'reload schema';
