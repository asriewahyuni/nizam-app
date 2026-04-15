-- ============================================================
-- MIGRATION 1209: Complete Sales Discount Contra Backfill
-- ============================================================
-- Why:
-- Migration 1208 already corrected the delivery posting function and updated
-- historical revenue lines to gross revenue. However, journals that were
-- already updated to gross revenue but still missing account 4002 need one
-- additional backfill pass so the contra revenue line becomes visible in GL.

WITH candidate_journals AS (
  SELECT
    je.id AS entry_id,
    ROUND(COALESCE(s.total_amount, 0), 2) AS gross_revenue,
    ROUND(COALESCE(s.total_amount, 0) - COALESCE(s.discount_amount, 0), 2) AS net_revenue,
    ROUND(COALESCE(s.discount_amount, 0), 2) AS discount_amount,
    revenue_acc.id AS revenue_account_id,
    discount_acc.id AS discount_account_id
  FROM public.journal_entries je
  JOIN public.sales s
    ON s.id = je.reference_id
   AND s.org_id = je.org_id
  JOIN public.accounts revenue_acc
    ON revenue_acc.org_id = je.org_id
   AND revenue_acc.code = '4001'
  JOIN public.accounts discount_acc
    ON discount_acc.org_id = je.org_id
   AND discount_acc.code = '4002'
  WHERE je.reference_type = 'SALE'
    AND je.status = 'POSTED'
    AND je.is_auto = TRUE
    AND COALESCE(s.discount_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_lines jl_disc
      WHERE jl_disc.entry_id = je.id
        AND jl_disc.account_id = discount_acc.id
    )
    AND EXISTS (
      SELECT 1
      FROM public.journal_lines jl_rev
      WHERE jl_rev.entry_id = je.id
        AND jl_rev.account_id = revenue_acc.id
        AND jl_rev.credit > 0
        AND (
          ABS(jl_rev.credit - ROUND(COALESCE(s.total_amount, 0), 2)) <= 0.01
          OR ABS(jl_rev.credit - ROUND(COALESCE(s.total_amount, 0) - COALESCE(s.discount_amount, 0), 2)) <= 0.01
        )
    )
),
first_revenue_line AS (
  SELECT
    c.entry_id,
    c.gross_revenue,
    jl.id AS revenue_line_id,
    ROW_NUMBER() OVER (PARTITION BY c.entry_id ORDER BY jl.id) AS row_num
  FROM candidate_journals c
  JOIN public.journal_lines jl
    ON jl.entry_id = c.entry_id
   AND jl.account_id = c.revenue_account_id
   AND jl.credit > 0
)
UPDATE public.journal_lines jl
SET credit = f.gross_revenue,
    memo = COALESCE(jl.memo, 'Backfill pendapatan bruto penjualan setelah pelengkapan diskon 4002')
FROM first_revenue_line f
WHERE f.row_num = 1
  AND jl.id = f.revenue_line_id
  AND ABS(jl.credit - f.gross_revenue) > 0.01;

WITH candidate_journals AS (
  SELECT
    je.id AS entry_id,
    ROUND(COALESCE(s.discount_amount, 0), 2) AS discount_amount,
    discount_acc.id AS discount_account_id
  FROM public.journal_entries je
  JOIN public.sales s
    ON s.id = je.reference_id
   AND s.org_id = je.org_id
  JOIN public.accounts discount_acc
    ON discount_acc.org_id = je.org_id
   AND discount_acc.code = '4002'
  WHERE je.reference_type = 'SALE'
    AND je.status = 'POSTED'
    AND je.is_auto = TRUE
    AND COALESCE(s.discount_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_lines jl_disc
      WHERE jl_disc.entry_id = je.id
        AND jl_disc.account_id = discount_acc.id
    )
)
INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
SELECT
  c.entry_id,
  c.discount_account_id,
  c.discount_amount,
  0,
  'Backfill pelengkap diskon penjualan kontra (4002)'
FROM candidate_journals c;

NOTIFY pgrst, 'reload schema';
