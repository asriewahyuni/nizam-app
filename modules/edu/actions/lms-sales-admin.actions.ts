'use server'

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { finalizePaidCommerceOrder } from '@/modules/ecommerce/payments/commerce-payment.service'
import { sendSystemEmail } from '@/lib/email/sender'

export async function resendOrderAccessEmailAction(orderId: string) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Organisasi tidak ditemukan.' }

  const { rows } = await queryPostgres<{
    id: string
    order_number: string
    customer_name: string
    customer_email: string | null
    grand_total: number
    status: string
  }>(
    `SELECT id::text, order_number, customer_name, customer_email, grand_total::float8, status
     FROM public.ecommerce_orders
     WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
    [orderId, orgData.org.id],
  )

  const order = rows[0]
  if (!order || !order.customer_email) {
    return { error: 'Order atau email pembeli tidak ditemukan.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://member.coreisec.id'
  const accessUrl = `${appUrl}/login`

  const emailRes = await sendSystemEmail({
    fromName: orgData.org.name || 'Nizam LMS',
    toEmail: order.customer_email,
    subject: `[Akses Kelas] Bukti Pembayaran Order ${order.order_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a;">Halo ${order.customer_name},</h2>
        <p>Berikut adalah pengiriman ulang informasi akses kelas untuk pesanan Anda:</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1;">
          <p style="margin: 4px 0;"><strong>No. Order:</strong> ${order.order_number}</p>
          <p style="margin: 4px 0;"><strong>Total Pembayaran:</strong> Rp ${order.grand_total.toLocaleString('id-ID')}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">LUNAS</span></p>
        </div>
        <p>Anda dapat langsung masuk ke portal member untuk mulai belajar:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${accessUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Masuk ke Member Portal
          </a>
        </div>
        <hr style="border: 0; height: 1px; background: #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center;">Salam hangat,<br /><strong>Tim ${orgData.org.name}</strong></p>
      </div>
    `,
  })

  if ('error' in emailRes) {
    return { error: `Gagal mengirim email: ${emailRes.error}` }
  }

  return { success: true }
}

export async function markOrderPaidManualAction(orderId: string) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Organisasi tidak ditemukan.' }

  const role = String(orgData.role || '').toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    return { error: 'Hanya owner/admin yang dapat mengubah status lunas.' }
  }

  try {
    const orderResult = await queryPostgres<{ grand_total: number }>(
      `SELECT grand_total::float8 FROM public.ecommerce_orders WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
      [orderId, orgData.org.id],
    )
    const order = orderResult.rows[0]
    if (!order) return { error: 'Order tidak ditemukan.' }

    const idempotencyKey = `manual-settlement:${orderId}`
    const intentResult = await queryPostgres<{ id: string }>(
      `INSERT INTO public.commerce_payment_intents (
         org_id, order_id, provider_code, provider_reference, amount, idempotency_key
       )
       VALUES ($1::uuid, $2::uuid, 'MANUAL_BANK_TRANSFER', $3, $4, $3)
       ON CONFLICT (org_id, idempotency_key) DO UPDATE SET updated_at = NOW()
       RETURNING id::text`,
      [orgData.org.id, orderId, idempotencyKey, order.grand_total],
    )
    const paymentIntentId = intentResult.rows[0].id

    await finalizePaidCommerceOrder({
      orgId: orgData.org.id,
      orderId,
      paymentIntentId,
      providerCode: 'MANUAL_BANK_TRANSFER',
      providerReference: idempotencyKey,
      providerEventId: `${idempotencyKey}:${Date.now()}`,
      paidAmount: order.grand_total,
      gatewayFeeAmount: 0,
      idempotencyKey: `finalize:${idempotencyKey}`,
    })
    revalidatePath('/lms/admin/penjualan/transaksi')
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal melunaskan order.',
    }
  }
}
