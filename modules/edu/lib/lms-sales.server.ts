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

  const conditions: string[] = ['orders.org_id = $1::uuid']
  const params: unknown[] = [orgId]
  let paramIdx = 2

  if (filters?.status && filters.status !== 'ALL') {
    conditions.push(`orders.status = $${paramIdx}`)
    params.push(filters.status)
    paramIdx++
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`
    conditions.push(
      `(lower(orders.order_number) LIKE $${paramIdx} OR lower(orders.customer_name) LIKE $${paramIdx} OR lower(COALESCE(orders.customer_email, '')) LIKE $${paramIdx})`,
    )
    params.push(term)
    paramIdx++
  }

  if (filters?.startDate) {
    conditions.push(`orders.created_at >= $${paramIdx}::timestamptz`)
    params.push(filters.startDate)
    paramIdx++
  }

  if (filters?.endDate) {
    conditions.push(`orders.created_at <= $${paramIdx}::timestamptz`)
    params.push(filters.endDate)
    paramIdx++
  }

  const whereClause = conditions.join(' AND ')

  // Count total matching
  const countResult = await queryPostgres<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM public.ecommerce_orders orders
     WHERE ${whereClause}`,
    params,
  )
  const totalCount = Number(countResult.rows[0]?.count || 0)

  // Query order list with affiliate info
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
    status: string
    payment_gateway: string | null
    referral_code: string | null
    affiliate_name: string | null
    commission_amount: number | null
  }>(
    `SELECT
       orders.id::text,
       orders.order_number,
       orders.created_at::text,
       orders.customer_name,
       orders.customer_email,
       orders.customer_phone,
       orders.grand_total::float8,
       orders.subtotal_amount::float8,
       orders.discount_amount::float8,
       orders.status,
       orders.payment_gateway,
       affiliate_profile.referral_code,
       auth_user.display_name AS affiliate_name,
       commission.commission_amount::float8 AS commission_amount
     FROM public.ecommerce_orders orders
     LEFT JOIN public.commerce_affiliate_commissions commission
       ON commission.order_id = orders.id AND commission.org_id = orders.org_id
     LEFT JOIN public.commerce_affiliate_profiles affiliate_profile
       ON affiliate_profile.id = commission.affiliate_profile_id AND affiliate_profile.org_id = orders.org_id
     LEFT JOIN public.internal_auth_users auth_user
       ON auth_user.legacy_user_id = affiliate_profile.user_id OR auth_user.id = affiliate_profile.user_id
     WHERE ${whereClause}
     ORDER BY orders.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  )

  const orderIds = ordersResult.rows.map((row) => row.id)
  let itemsByOrderId: Record<string, Array<{
    id: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>> = {}

  if (orderIds.length > 0) {
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
      [orgId, orderIds],
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

  const sales: LmsSaleItem[] = ordersResult.rows.map((row) => {
    let paymentStatus: 'PAID' | 'PENDING' | 'EXPIRED' | 'CANCELLED' = 'PENDING'
    if (row.status === 'PAID') paymentStatus = 'PAID'
    else if (row.status === 'CANCELLED' || row.status === 'FAILED') paymentStatus = 'CANCELLED'
    else if (row.status === 'EXPIRED') paymentStatus = 'EXPIRED'

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
      paymentStatus,
      paymentGateway: row.payment_gateway,
      items: itemsByOrderId[row.id] || [],
      affiliate,
    }
  })

  return { sales, totalCount }
}
