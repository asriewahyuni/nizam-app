'use server'

import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

export type OrderAlertItem = {
  id: string
  orderNumber: string
  customerName: string
  grandTotal: number
  status?: string
  createdAt?: string
  updatedAt?: string
}

export type LmsOrderAlertsResult = {
  serverTime: string
  newOrders: OrderAlertItem[]
  confirmedPayments: OrderAlertItem[]
}

/**
 * Server action untuk memantau pesanan baru & konfirmasi pembayaran secara real-time
 * dari halaman Admin LMS tanpa membutuhkan koneksi WebSocket.
 */
export async function checkLmsAdminOrderAlertsAction(
  orgId: string,
  sinceTimestamp: string,
): Promise<LmsOrderAlertsResult> {
  const session = await getInternalAuthSession()
  const now = new Date().toISOString()

  if (!session?.user?.id || !orgId) {
    return { serverTime: now, newOrders: [], confirmedPayments: [] }
  }

  if (!sinceTimestamp) {
    return { serverTime: now, newOrders: [], confirmedPayments: [] }
  }

  try {
    const [ordersRes, paymentsRes] = await Promise.all([
      queryPostgres<OrderAlertItem>(
        `SELECT
           id::text,
           order_number AS "orderNumber",
           customer_name AS "customerName",
           COALESCE(grand_total, 0)::float8 AS "grandTotal",
           created_at AS "createdAt"
         FROM public.ecommerce_orders
         WHERE org_id = $1::uuid AND created_at > $2::timestamptz
         ORDER BY created_at DESC
         LIMIT 5`,
        [orgId, sinceTimestamp],
      ),
      queryPostgres<OrderAlertItem>(
        `SELECT
           id::text,
           order_number AS "orderNumber",
           customer_name AS "customerName",
           COALESCE(grand_total, 0)::float8 AS "grandTotal",
           status,
           updated_at AS "updatedAt"
         FROM public.ecommerce_orders
         WHERE org_id = $1::uuid
           AND updated_at > $2::timestamptz
           AND created_at <= $2::timestamptz
           AND status IN ('PAID', 'VERIFYING', 'PAYMENT_UNDER_REVIEW', 'APPROVED', 'LUNAS', 'COMPLETED', 'SELESAI')
         ORDER BY updated_at DESC
         LIMIT 5`,
        [orgId, sinceTimestamp],
      ),
    ])

    return {
      serverTime: now,
      newOrders: ordersRes.rows || [],
      confirmedPayments: paymentsRes.rows || [],
    }
  } catch (err) {
    return { serverTime: now, newOrders: [], confirmedPayments: [] }
  }
}
