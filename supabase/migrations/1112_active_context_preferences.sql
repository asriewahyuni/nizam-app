-- ============================================================
-- MIGRATION 1112: Persist active org/unit context per membership
-- Keeps the user's last opened organization and branch preference
-- in the database so the context survives logout and new devices.
-- ============================================================

ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_user_last_active
  ON public.org_members(user_id, last_active_at DESC);

WITH ranked_members AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY joined_at ASC, id ASC
    ) AS row_num
  FROM public.org_members
  WHERE is_active = TRUE
)
UPDATE public.org_members om
SET last_active_at = COALESCE(om.last_active_at, om.joined_at)
FROM ranked_members ranked
WHERE ranked.id = om.id
  AND ranked.row_num = 1
  AND om.last_active_at IS NULL;

NOTIFY pgrst, 'reload schema';
