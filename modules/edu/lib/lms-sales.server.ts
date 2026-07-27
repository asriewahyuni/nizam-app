/**
 * Service Query Penjualan LMS untuk Admin Dashboard.
 * Mengambil transaksi pesanan, status pembayaran, item kelas, dan atribusi afiliasi.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'

export type LmsSaleItem = {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  grandTotal: number
  subtotalAmount: number
  discountAmount: number
  paymentStatus: 'PAID' | 'PENDING' | 'EXPIRED' | 'CANCELLED'
  paymentGateway: string | null
  items: Array<{
    id: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  affiliate: {
    referralCode: string
    affiliateName: string
    commissionAmount: number
  } | null
  /** 'legacy' = arsip order WordPress/Sejoli hasil migrasi, read-only (tidak bisa disettle/resend). */
  source: 'native' | 'legacy'
}

export type LmsSalesSummaryMetrics = {
  totalRevenue: number
  paidOrderCount: number
  pendingOrderCount: number
  totalAffiliateCommissions: number
}

export async function getLmsSalesSummaryMetrics(
  orgId: string,
): Promise<LmsSalesSummaryMetrics> {
  const [revenueResult, pendingResult, affiliateResult] = await Promise.all([
    queryPostgres<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(grand_total), 0)::float8 AS total, COUNT(*)::int AS count
       FROM public.ecommerce_orders
       WHERE org_id = $1::uuid AND status = 'PAID'`,
      [orgId],
    ),
    queryPostgres<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.ecommerce_orders
       WHERE org_id = $1::uuid AND status IN ('AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW')`,
      [orgId],
    ),
    queryPostgres<{ total: number }>(
      `SELECT COALESCE(SUM(commission_amount), 0)::float8 AS total
       FROM public.commerce_affiliate_commissions
       WHERE org_id = $1::uuid AND status IN ('APPROVED', 'PAYABLE', 'PAID')`,
      [orgId],
    ),
  ])

  return {
    totalRevenue: Number(revenueResult.rows[0]?.total || 0),
    paidOrderCount: Number(revenueResult.rows[0]?.count || 0),
    pendingOrderCount: Number(pendingResult.rows[0]?.count || 0),
    totalAffiliateCommissions: Number(affiliateResult.rows[0]?.total || 0),
  }
}

export async function getLmsAdminSalesList(
  orgId: string,
  filters?: {
    search?: string
    status?: string
    courseId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  },
): Promise<{ sales: LmsSaleItem[]; totalCount: number }> {
  const limit = Math.max(1, Math.min(100, filters?.limit || 20))
  const offset = Math.max(0, filters?.offset || 0)

  // Combines live Nizam orders with read-only historical Sejoli/WordPress order
  // archives (imported into commerce_historical_order_archives, never posted to
  // ecommerce_orders so old transactions never re-trigger accounting entries).
  const combinedCte = `
    WITH combined AS (
      SELECT
        orders.id::text AS id,
        orders.order_number AS order_number,
        orders.created_at AS created_at,
        orders.customer_name AS customer_name,
        orders.customer_email AS customer_email,
        orders.customer_phone AS customer_phone,
        orders.grand_total::float8 AS grand_total,
        orders.subtotal_amount::float8 AS subtotal_amount,
        orders.discount_amount::float8 AS discount_amount,
        CASE
          WHEN orders.status = 'PAID' THEN 'PAID'
          WHEN orders.status IN ('CANCELLED', 'PAYMENT_REJECTED') THEN 'CANCELLED'
          WHEN orders.status = 'PAYMENT_EXCEPTION' THEN 'EXPIRED'
          ELSE 'PENDING'
        END AS payment_status,
        payment.payment_gateway AS payment_gateway,
        affiliate_profile.referral_code AS referral_code,
        auth_user.display_name AS affiliate_name,
        commission.commission_amount::float8 AS commission_amount,
        'native' AS source
      FROM public.ecommerce_orders orders
      LEFT JOIN LATERAL (
        SELECT COALESCE(op.provider_code, op.method) AS payment_gateway
        FROM public.ecommerce_order_payments op
        WHERE op.order_id = orders.id AND op.org_id = orders.org_id
        ORDER BY (op.status = 'VALIDATED') DESC, op.created_at DESC
        LIMIT 1
      ) payment ON TRUE
      LEFT JOIN public.commerce_affiliate_commissions commission
        ON commission.order_id = orders.id AND commission.org_id = orders.org_id
      LEFT JOIN public.commerce_affiliate_profiles affiliate_profile
        ON affiliate_profile.id = commission.affiliate_profile_id AND affiliate_profile.org_id = orders.org_id
      LEFT JOIN public.internal_auth_users auth_user
        ON auth_user.legacy_user_id = affiliate_profile.user_id OR auth_user.id = affiliate_profile.user_id
      WHERE orders.org_id = $1::uuid

      UNION ALL

      SELECT
        arc.id::text AS id,
        arc.order_number AS order_number,
        arc.ordered_at AS created_at,
        COALESCE(iu.display_name, 'Member WordPress (Arsip)') AS customer_name,
        COALESCE(NULLIF(arc.customer_email_normalized, ''), iu.login_email) AS customer_email,
        iu.phone AS customer_phone,
        arc.total_amount::float8 AS grand_total,
        arc.total_amount::float8 AS subtotal_amount,
        0::float8 AS discount_amount,
        CASE
          WHEN arc.grants_access THEN 'PAID'
          WHEN arc.status = 'cancelled' THEN 'CANCELLED'
          ELSE 'PENDING'
        END AS payment_status,
        NULL::text AS payment_gateway,
        NULL::text AS referral_code,
        NULL::text AS affiliate_name,
        NULL::float8 AS commission_amount,
        'legacy' AS source
      FROM public.commerce_historical_order_archives arc
      LEFT JOIN public.internal_auth_users iu
        ON iu.id = arc.user_id OR iu.legacy_user_id = arc.user_id
      WHERE arc.org_id = $1::uuid
    )
  `

  const conditions: string[] = []
  const params: unknown[] = [orgId]
  let paramIdx = 2

  if (filters?.status && filters.status !== 'ALL') {
    conditions.push(`payment_status = $${paramIdx}`)
    params.push(filters.status)
    paramIdx++
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`
    conditions.push(
      `(lower(order_number) LIKE $${paramIdx} OR lower(customer_name) LIKE $${paramIdx} OR lower(COALESCE(customer_email, '')) LIKE $${paramIdx})`,
    )
    params.push(term)
    paramIdx++
  }

  if (filters?.startDate) {
    conditions.push(`created_at >= $${paramIdx}::timestamptz`)
    params.push(filters.startDate)
    paramIdx++
  }

  if (filters?.endDate) {
    conditions.push(`created_at <= $${paramIdx}::timestamptz`)
    params.push(filters.endDate)
    paramIdx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await queryPostgres<{ count: number }>(
    `${combinedCte} SELECT COUNT(*)::int AS count FROM combined ${whereClause}`,
    params,
  )
  const totalCount = Number(countResult.rows[0]?.count || 0)

  const ordersResult = await queryPostgres<{
    id: string
    order_number: string
    created_at: string
    customer_name: string
    customer_email: string | null
    customer_phone: string
    grand_total: number
    subtotal_amount: number
    discount_amount: number
    payment_status: 'PAID' | 'PENDING' | 'EXPIRED' | 'CANCELLED'
    payment_gateway: string | null
    referral_code: string | null
    affiliate_name: string | null
    commission_amount: number | null
    source: 'native' | 'legacy'
  }>(
    `${combinedCte}
     SELECT * FROM combined
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  )

  const nativeOrderIds = ordersResult.rows.filter((row) => row.source === 'native').map((row) => row.id)
  const legacyOrderIds = ordersResult.rows.filter((row) => row.source === 'legacy').map((row) => row.id)
  const itemsByOrderId: Record<string, Array<{
    id: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>> = {}

  if (nativeOrderIds.length > 0) {
    const itemsResult = await queryPostgres<{
      id: string
      order_id: string
      product_name: string
      quantity: number
      unit_price: number
      line_total: number
    }>(
      `SELECT
         id::text,
         order_id::text,
         product_name,
         quantity::int,
         unit_price::float8,
         line_total::float8
       FROM public.ecommerce_order_items
       WHERE org_id = $1::uuid AND order_id = ANY($2::uuid[])`,
      [orgId, nativeOrderIds],
    )

    for (const item of itemsResult.rows) {
      if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = []
      itemsByOrderId[item.order_id].push({
        id: item.id,
        productName: item.product_name,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || 0),
        lineTotal: Number(item.line_total || 0),
      })
    }
  }

  if (legacyOrderIds.length > 0) {
    const legacyItemsResult = await queryPostgres<{
      id: string
      product_name: string | null
      quantity: number
      grand_total: number
    }>(
      `SELECT
         arc.id::text,
         sp.public_name AS product_name,
         COALESCE((arc.payload->>'quantity')::int, 1) AS quantity,
         arc.total_amount::float8 AS grand_total
       FROM public.commerce_historical_order_archives arc
       LEFT JOIN public.store_products sp
         ON sp.org_id = arc.org_id
         AND sp.external_source = 'WORDPRESS_COREISEC'
         AND sp.external_id = (arc.payload->>'product_id')
       WHERE arc.org_id = $1::uuid AND arc.id = ANY($2::uuid[])`,
      [orgId, legacyOrderIds],
    )

    for (const item of legacyItemsResult.rows) {
      itemsByOrderId[item.id] = [{
        id: item.id,
        productName: item.product_name || 'Produk Migrasi WordPress',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.grand_total || 0),
        lineTotal: Number(item.grand_total || 0),
      }]
    }
  }

  const sales: LmsSaleItem[] = ordersResult.rows.map((row) => {
    const affiliate = row.referral_code ? {
      referralCode: row.referral_code,
      affiliateName: row.affiliate_name || 'Mitra Afiliasi',
      commissionAmount: Number(row.commission_amount || 0),
    } : null

    return {
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      grandTotal: Number(row.grand_total || 0),
      subtotalAmount: Number(row.subtotal_amount || 0),
      discountAmount: Number(row.discount_amount || 0),
      paymentStatus: row.payment_status,
      paymentGateway: row.payment_gateway,
      items: itemsByOrderId[row.id] || [],
      affiliate,
      source: row.source,
    }
  })

  return { sales, totalCount }
}
