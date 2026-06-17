-- ============================================================
-- MIGRATION 1365: Add branch_id to purchase_returns
-- Stored procedures in migrations 1116 & 1120 insert branch_id
-- into purchase_returns, but the column was missing from the
-- original table definition (migration 026).
-- ============================================================

ALTER TABLE public.purchase_returns
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Backfill branch_id from the parent purchase row
UPDATE public.purchase_returns pr
SET    branch_id = p.branch_id
FROM   public.purchases p
WHERE  pr.purchase_id = p.id
  AND  pr.branch_id IS NULL
  AND  p.branch_id IS NOT NULL;

-- Index for branch-scoped queries
CREATE INDEX IF NOT EXISTS idx_purchase_returns_branch_id
  ON public.purchase_returns (branch_id);
