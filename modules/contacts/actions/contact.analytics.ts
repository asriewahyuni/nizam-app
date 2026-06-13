'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { createClient } from '@/lib/supabase/server'

async function assertOrgMember(orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const result = await queryPostgres<{ id: string }>(
    `SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
    [orgId, user.id]
  )
  return result.rows.length > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerHeroStats = {
  totalCustomers: number
  newThisMonth: number
  newLastMonth: number
  revenueThisMonth: number
  revenueLastMonth: number
  repeatBuyerCount: number
  repeatBuyerRate: number
  avgOrderValue: number
  totalArOutstanding: number
  avgDso: number
}

export type MonthlyCustomerGrowth = {
  month: string
  month_label: string
  new_customers: number
  revenue: number
  total_orders: number
  unique_buyers: number
  avg_order: number
  prev_revenue: number | null
}

export type CustomerRetentionStats = {
  atRiskCustomers: { id: string; name: string; last_purchase: string; days_since: number }[]
  repeatBuyersByMonth: { month: string; month_label: string; new_buyers: number; repeat_buyers: number }[]
  aovByMonth: { month: string; month_label: string; aov: number }[]
}

export type RfmSegment = {
  id: string
  name: string
  recency_days: number
  frequency: number
  monetary: number
  r_score: number
  f_score: number
  m_score: number
  segment: 'Champions' | 'Loyal' | 'Potential' | 'At Risk' | 'Lost' | 'Others'
}

export type ArAgingStats = {
  totalOutstanding: number
  invoiceCount: number
  dso: number
  buckets: { label: string; count: number; total: number }[]
  topDebtors: { name: string; total: number; oldest_days: number }[]
}

export type CustomerDashboardData = {
  hero: CustomerHeroStats
  monthlyGrowth: MonthlyCustomerGrowth[]
  retention: CustomerRetentionStats
  rfm: RfmSegment[]
  ar: ArAgingStats
}

export async function getCustomerDashboardAnalytics(orgId: string): Promise<CustomerDashboardData | null> {
  const ok = await assertOrgMember(orgId)
  if (!ok) return null

  const [hero, monthly, atRisk, repeatByMonth, aovByMonth, rfmRaw, arSummary, arBuckets, topDebtors] = await Promise.all([

    // Hero stats
    queryPostgres<any>(`
      WITH revenue AS (
        SELECT
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE) THEN grand_total END), 0)::float AS this_month,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN grand_total END), 0)::float AS last_month,
          COALESCE(AVG(CASE WHEN DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE) THEN grand_total END), 0)::float AS aov_this_month
        FROM sales WHERE org_id = $1 AND status != 'VOIDED'
      ),
      customers AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::int AS new_this_month,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN 1 END)::int AS new_last_month
        FROM contacts WHERE org_id = $1 AND type IN ('CUSTOMER','BOTH') AND is_active = true
      ),
      repeat AS (
        SELECT COUNT(DISTINCT customer_id)::int AS cnt
        FROM (
          SELECT customer_id FROM sales WHERE org_id = $1 AND status != 'VOIDED'
          GROUP BY customer_id HAVING COUNT(*) > 1
        ) rb
      ),
      ar AS (
        SELECT
          COALESCE(SUM(grand_total), 0)::float AS outstanding,
          COALESCE(AVG(CURRENT_DATE - sale_date), 0)::float AS avg_dso
        FROM sales WHERE org_id = $1 AND payment_status IN ('UNPAID','PARTIAL','OVERDUE') AND status != 'VOIDED'
      )
      SELECT c.total, c.new_this_month, c.new_last_month, r.this_month, r.last_month, r.aov_this_month,
             rp.cnt AS repeat_buyers, ar.outstanding, ar.avg_dso
      FROM customers c, revenue r, repeat rp, ar
    `, [orgId]),

    // Monthly growth (12 bulan)
    queryPostgres<any>(`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
          DATE_TRUNC('month', CURRENT_DATE),
          '1 month'
        ) AS m
      ),
      new_cust AS (
        SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*)::int AS new_customers
        FROM contacts WHERE org_id = $1 AND type IN ('CUSTOMER','BOTH') AND is_active = true
        GROUP BY 1
      ),
      sales_agg AS (
        SELECT DATE_TRUNC('month', sale_date) AS m,
          COALESCE(SUM(grand_total), 0)::float AS revenue,
          COUNT(*)::int AS total_orders,
          COUNT(DISTINCT customer_id)::int AS unique_buyers,
          COALESCE(AVG(grand_total), 0)::float AS avg_order
        FROM sales WHERE org_id = $1 AND status != 'VOIDED'
        GROUP BY 1
      )
      SELECT
        TO_CHAR(mo.m, 'YYYY-MM') AS month,
        TO_CHAR(mo.m, 'Mon YY') AS month_label,
        COALESCE(nc.new_customers, 0) AS new_customers,
        COALESCE(sa.revenue, 0) AS revenue,
        COALESCE(sa.total_orders, 0) AS total_orders,
        COALESCE(sa.unique_buyers, 0) AS unique_buyers,
        COALESCE(sa.avg_order, 0) AS avg_order,
        LAG(COALESCE(sa.revenue, 0)) OVER (ORDER BY mo.m) AS prev_revenue
      FROM months mo
      LEFT JOIN new_cust nc ON nc.m = mo.m
      LEFT JOIN sales_agg sa ON sa.m = mo.m
      ORDER BY mo.m ASC
    `, [orgId]),

    // At-risk customers (no purchase >= 60 days)
    queryPostgres<any>(`
      SELECT c.id, c.name, MAX(s.sale_date)::text AS last_purchase,
        (CURRENT_DATE - MAX(s.sale_date))::int AS days_since
      FROM contacts c
      JOIN sales s ON s.customer_id = c.id AND s.status != 'VOIDED'
      WHERE c.org_id = $1 AND c.is_active = true AND c.type IN ('CUSTOMER','BOTH')
      GROUP BY c.id, c.name
      HAVING MAX(s.sale_date) < CURRENT_DATE - INTERVAL '60 days'
      ORDER BY days_since DESC
      LIMIT 8
    `, [orgId]),

    // New vs repeat buyers per month
    queryPostgres<any>(`
      WITH first_purchase AS (
        SELECT customer_id, MIN(DATE_TRUNC('month', sale_date)) AS first_month
        FROM sales WHERE org_id = $1 AND status != 'VOIDED'
        GROUP BY customer_id
      ),
      months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
          DATE_TRUNC('month', CURRENT_DATE), '1 month'
        ) AS m
      )
      SELECT
        TO_CHAR(mo.m, 'YYYY-MM') AS month,
        TO_CHAR(mo.m, 'Mon YY') AS month_label,
        COUNT(DISTINCT CASE WHEN fp.first_month = mo.m THEN s.customer_id END)::int AS new_buyers,
        COUNT(DISTINCT CASE WHEN fp.first_month < mo.m THEN s.customer_id END)::int AS repeat_buyers
      FROM months mo
      LEFT JOIN sales s ON DATE_TRUNC('month', s.sale_date) = mo.m AND s.org_id = $1 AND s.status != 'VOIDED'
      LEFT JOIN first_purchase fp ON fp.customer_id = s.customer_id
      GROUP BY mo.m
      ORDER BY mo.m ASC
    `, [orgId]),

    // AOV per month
    queryPostgres<any>(`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
          DATE_TRUNC('month', CURRENT_DATE), '1 month'
        ) AS m
      )
      SELECT
        TO_CHAR(mo.m, 'YYYY-MM') AS month,
        TO_CHAR(mo.m, 'Mon YY') AS month_label,
        COALESCE(AVG(s.grand_total), 0)::float AS aov
      FROM months mo
      LEFT JOIN sales s ON DATE_TRUNC('month', s.sale_date) = mo.m AND s.org_id = $1 AND s.status != 'VOIDED'
      GROUP BY mo.m
      ORDER BY mo.m ASC
    `, [orgId]),

    // RFM segmentation
    queryPostgres<any>(`
      WITH rfm AS (
        SELECT
          c.id, c.name,
          COALESCE((CURRENT_DATE - MAX(s.sale_date))::int, 999) AS recency_days,
          COUNT(s.id)::int AS frequency,
          COALESCE(SUM(s.grand_total), 0)::float AS monetary
        FROM contacts c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.status != 'VOIDED'
        WHERE c.org_id = $1 AND c.type IN ('CUSTOMER','BOTH') AND c.is_active = true
        GROUP BY c.id, c.name
      ),
      scored AS (
        SELECT *,
          CASE
            WHEN recency_days <= 30 THEN 5 WHEN recency_days <= 60 THEN 4
            WHEN recency_days <= 90 THEN 3 WHEN recency_days <= 180 THEN 2 ELSE 1
          END AS r_score,
          NTILE(5) OVER (ORDER BY frequency) AS f_score,
          NTILE(5) OVER (ORDER BY monetary) AS m_score
        FROM rfm
      )
      SELECT *,
        CASE
          WHEN r_score >= 4 AND f_score >= 4 THEN 'Champions'
          WHEN r_score >= 3 AND f_score >= 3 THEN 'Loyal'
          WHEN r_score >= 3 AND f_score <= 2 THEN 'Potential'
          WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk'
          WHEN recency_days >= 180 AND frequency <= 1 THEN 'Lost'
          ELSE 'Others'
        END AS segment
      FROM scored
      ORDER BY monetary DESC
      LIMIT 30
    `, [orgId]),

    // AR summary
    queryPostgres<any>(`
      SELECT
        COALESCE(SUM(grand_total), 0)::float AS total_outstanding,
        COUNT(*)::int AS invoice_count,
        COALESCE(AVG(CURRENT_DATE - sale_date), 0)::float AS dso
      FROM sales
      WHERE org_id = $1 AND payment_status IN ('UNPAID','PARTIAL','OVERDUE') AND status != 'VOIDED'
    `, [orgId]),

    // AR aging buckets
    queryPostgres<any>(`
      SELECT
        CASE
          WHEN CURRENT_DATE - sale_date < 30 THEN '0–30 hari'
          WHEN CURRENT_DATE - sale_date < 60 THEN '30–60 hari'
          ELSE '>60 hari'
        END AS label,
        COUNT(*)::int AS count,
        COALESCE(SUM(grand_total), 0)::float AS total
      FROM sales
      WHERE org_id = $1 AND payment_status IN ('UNPAID','PARTIAL','OVERDUE') AND status != 'VOIDED'
      GROUP BY 1
      ORDER BY MIN(CURRENT_DATE - sale_date)
    `, [orgId]),

    // Top debtors
    queryPostgres<any>(`
      SELECT c.name, COALESCE(SUM(s.grand_total), 0)::float AS total,
        MAX(CURRENT_DATE - s.sale_date)::int AS oldest_days
      FROM sales s
      JOIN contacts c ON c.id = s.customer_id
      WHERE s.org_id = $1 AND s.payment_status IN ('UNPAID','PARTIAL','OVERDUE') AND s.status != 'VOIDED'
      GROUP BY c.id, c.name
      ORDER BY total DESC
      LIMIT 6
    `, [orgId]),
  ])

  const h = hero.rows[0] ?? {}
  const total = h.total ?? 0
  const repeatCount = h.repeat_buyers ?? 0

  return {
    hero: {
      totalCustomers: total,
      newThisMonth: h.new_this_month ?? 0,
      newLastMonth: h.new_last_month ?? 0,
      revenueThisMonth: h.this_month ?? 0,
      revenueLastMonth: h.last_month ?? 0,
      repeatBuyerCount: repeatCount,
      repeatBuyerRate: total > 0 ? Math.round((repeatCount / total) * 100) : 0,
      avgOrderValue: h.aov_this_month ?? 0,
      totalArOutstanding: h.outstanding ?? 0,
      avgDso: Math.round(h.avg_dso ?? 0),
    },
    monthlyGrowth: monthly.rows,
    retention: {
      atRiskCustomers: atRisk.rows,
      repeatBuyersByMonth: repeatByMonth.rows,
      aovByMonth: aovByMonth.rows,
    },
    rfm: rfmRaw.rows,
    ar: {
      totalOutstanding: arSummary.rows[0]?.total_outstanding ?? 0,
      invoiceCount: arSummary.rows[0]?.invoice_count ?? 0,
      dso: Math.round(arSummary.rows[0]?.dso ?? 0),
      buckets: arBuckets.rows,
      topDebtors: topDebtors.rows,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export type VendorHeroStats = {
  totalVendors: number
  newThisMonth: number
  newLastMonth: number
  totalApOutstanding: number
  totalPurchasesThisMonth: number
  totalPurchasesLastMonth: number
  totalActivePo: number
  overdueCount: number
  overdueAmount: number
  onTimePaymentRate: number
}

export type MonthlyVendorGrowth = {
  month: string
  month_label: string
  new_vendors: number
  total_spend: number
  po_count: number
  unique_vendors: number
  prev_spend: number | null
}

export type VendorConcentration = {
  name: string
  spend: number
  pct: number
}

export type ApAgingRow = {
  vendor_name: string
  bucket_0_30: number
  bucket_30_60: number
  bucket_over_60: number
  total_outstanding: number
}

export type VendorSpendCategory = {
  description: string
  order_count: number
  total_spend: number
}

export type VendorDashboardData = {
  hero: VendorHeroStats
  monthlyGrowth: MonthlyVendorGrowth[]
  concentration: VendorConcentration[]
  apAging: ApAgingRow[]
  spendCategories: VendorSpendCategory[]
  topVendors: { name: string; total: number; po_count: number; avg_po: number }[]
  dpoStats: { avg_dpo: number; median_credit_days: number }
}

export async function getVendorDashboardAnalytics(orgId: string): Promise<VendorDashboardData | null> {
  const ok = await assertOrgMember(orgId)
  if (!ok) return null

  const [hero, monthly, concentration, apAging, spendCats, topVendors, dpoStats] = await Promise.all([

    // Hero stats
    queryPostgres<any>(`
      WITH vendors AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::int AS new_this_month,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN 1 END)::int AS new_last_month
        FROM contacts WHERE org_id = $1 AND type IN ('SUPPLIER','BOTH') AND is_active = true
      ),
      spend AS (
        SELECT
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', CURRENT_DATE) THEN grand_total END), 0)::float AS this_month,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN grand_total END), 0)::float AS last_month,
          COALESCE(SUM(CASE WHEN payment_status IN ('UNPAID','PARTIAL','OVERDUE') THEN grand_total END), 0)::float AS ap_outstanding,
          COUNT(CASE WHEN status IN ('DRAFT','ORDERED') THEN 1 END)::int AS active_po,
          COUNT(CASE WHEN payment_status = 'OVERDUE' THEN 1 END)::int AS overdue_count,
          COALESCE(SUM(CASE WHEN payment_status = 'OVERDUE' THEN grand_total END), 0)::float AS overdue_amount
        FROM purchases WHERE org_id = $1 AND status != 'VOIDED'
      ),
      payment AS (
        SELECT
          COUNT(CASE WHEN payment_status = 'PAID' AND (due_date IS NULL OR purchase_date <= due_date) THEN 1 END)::int AS on_time,
          COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END)::int AS total_paid
        FROM purchases WHERE org_id = $1 AND status != 'VOIDED'
          AND purchase_date >= CURRENT_DATE - INTERVAL '6 months'
      )
      SELECT v.*, sp.*, pm.on_time, pm.total_paid FROM vendors v, spend sp, payment pm
    `, [orgId]),

    // Monthly growth (12 bulan)
    queryPostgres<any>(`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
          DATE_TRUNC('month', CURRENT_DATE), '1 month'
        ) AS m
      ),
      new_v AS (
        SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*)::int AS new_vendors
        FROM contacts WHERE org_id = $1 AND type IN ('SUPPLIER','BOTH') AND is_active = true
        GROUP BY 1
      ),
      po_agg AS (
        SELECT DATE_TRUNC('month', purchase_date) AS m,
          COALESCE(SUM(grand_total), 0)::float AS total_spend,
          COUNT(*)::int AS po_count,
          COUNT(DISTINCT vendor_id)::int AS unique_vendors
        FROM purchases WHERE org_id = $1 AND status != 'VOIDED'
        GROUP BY 1
      )
      SELECT
        TO_CHAR(mo.m, 'YYYY-MM') AS month,
        TO_CHAR(mo.m, 'Mon YY') AS month_label,
        COALESCE(nv.new_vendors, 0) AS new_vendors,
        COALESCE(pa.total_spend, 0) AS total_spend,
        COALESCE(pa.po_count, 0) AS po_count,
        COALESCE(pa.unique_vendors, 0) AS unique_vendors,
        LAG(COALESCE(pa.total_spend, 0)) OVER (ORDER BY mo.m) AS prev_spend
      FROM months mo
      LEFT JOIN new_v nv ON nv.m = mo.m
      LEFT JOIN po_agg pa ON pa.m = mo.m
      ORDER BY mo.m ASC
    `, [orgId]),

    // Vendor concentration risk
    queryPostgres<any>(`
      WITH total AS (
        SELECT COALESCE(SUM(grand_total), 1) AS t FROM purchases WHERE org_id = $1 AND status != 'VOIDED'
      )
      SELECT c.name, COALESCE(SUM(p.grand_total), 0)::float AS spend,
        ROUND((COALESCE(SUM(p.grand_total), 0) / t.t * 100)::numeric, 1)::float AS pct
      FROM contacts c
      JOIN purchases p ON p.vendor_id = c.id AND p.org_id = $1 AND p.status != 'VOIDED'
      CROSS JOIN total t
      GROUP BY c.id, c.name, t.t
      ORDER BY spend DESC LIMIT 8
    `, [orgId]),

    // AP aging per vendor
    queryPostgres<any>(`
      SELECT c.name AS vendor_name,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - p.purchase_date < 30 THEN p.grand_total END), 0)::float AS bucket_0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - p.purchase_date BETWEEN 30 AND 60 THEN p.grand_total END), 0)::float AS bucket_30_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - p.purchase_date > 60 THEN p.grand_total END), 0)::float AS bucket_over_60,
        COALESCE(SUM(p.grand_total), 0)::float AS total_outstanding
      FROM purchases p
      JOIN contacts c ON c.id = p.vendor_id
      WHERE p.org_id = $1 AND p.payment_status IN ('UNPAID','PARTIAL','OVERDUE') AND p.status != 'VOIDED'
      GROUP BY c.id, c.name
      ORDER BY total_outstanding DESC LIMIT 8
    `, [orgId]),

    // Spend categories from purchase_items
    queryPostgres<any>(`
      SELECT pi.description, COUNT(*)::int AS order_count,
        COALESCE(SUM(pi.total_amount), 0)::float AS total_spend
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.org_id = $1 AND p.status != 'VOIDED'
      GROUP BY pi.description
      ORDER BY total_spend DESC LIMIT 8
    `, [orgId]),

    // Top vendors by spend + frequency
    queryPostgres<any>(`
      SELECT c.name, COALESCE(SUM(p.grand_total), 0)::float AS total,
        COUNT(p.id)::int AS po_count,
        COALESCE(AVG(p.grand_total), 0)::float AS avg_po
      FROM contacts c
      JOIN purchases p ON p.vendor_id = c.id AND p.org_id = $1 AND p.status != 'VOIDED'
      GROUP BY c.id, c.name
      ORDER BY total DESC LIMIT 8
    `, [orgId]),

    // DPO stats
    queryPostgres<any>(`
      SELECT
        COALESCE(AVG(due_date - purchase_date), 0)::float AS avg_dpo,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY due_date - purchase_date), 0)::float AS median_credit_days
      FROM purchases
      WHERE org_id = $1 AND due_date IS NOT NULL AND status != 'VOIDED'
        AND purchase_date >= CURRENT_DATE - INTERVAL '6 months'
    `, [orgId]),
  ])

  const h = hero.rows[0] ?? {}
  const totalPaid = h.total_paid ?? 0
  const onTime = h.on_time ?? 0

  return {
    hero: {
      totalVendors: h.total ?? 0,
      newThisMonth: h.new_this_month ?? 0,
      newLastMonth: h.new_last_month ?? 0,
      totalApOutstanding: h.ap_outstanding ?? 0,
      totalPurchasesThisMonth: h.this_month ?? 0,
      totalPurchasesLastMonth: h.last_month ?? 0,
      totalActivePo: h.active_po ?? 0,
      overdueCount: h.overdue_count ?? 0,
      overdueAmount: h.overdue_amount ?? 0,
      onTimePaymentRate: totalPaid > 0 ? Math.round((onTime / totalPaid) * 100) : 0,
    },
    monthlyGrowth: monthly.rows,
    concentration: concentration.rows,
    apAging: apAging.rows,
    spendCategories: spendCats.rows,
    topVendors: topVendors.rows,
    dpoStats: {
      avg_dpo: Math.round(dpoStats.rows[0]?.avg_dpo ?? 0),
      median_credit_days: Math.round(dpoStats.rows[0]?.median_credit_days ?? 0),
    },
  }
}
