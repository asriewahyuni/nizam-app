'use server'

import { revalidatePath } from 'next/cache'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { finalizePaidCommerceOrder } from '@/modules/ecommerce/payments/commerce-payment.service'
import { sendSystemEmail } from '@/lib/email/sender'
import { enqueueNotification } from '@/modules/notifications/outbox.server'

const CANCELLABLE_ORDER_STATUSES = [
  'DRAFT',
  'AWAITING_PAYMENT',
  'PAYMENT_UNDER_REVIEW',
  'PAYMENT_REJECTED',
  'PAYMENT_EXCEPTION',
]

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

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

export async function cancelOrderManualAction(orderId: string, reason?: string) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Organisasi tidak ditemukan.' }

  const role = String(orgData.role || '').toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    return { error: 'Hanya owner/admin yang dapat membatalkan order.' }
  }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const orderResult = await client.query<{
      id: string
      order_number: string
      status: string
      customer_name: string
      customer_email: string | null
      customer_phone: string
      grand_total: number
      user_id: string | null
    }>(
      `SELECT id::text, order_number, status::text, customer_name, customer_email,
              customer_phone, grand_total::float8, user_id::text
       FROM public.ecommerce_orders
       WHERE id = $1::uuid AND org_id = $2::uuid
       LIMIT 1
       FOR UPDATE`,
      [orderId, orgData.org.id],
    )
    const order = orderResult.rows[0]
    if (!order) throw new Error('Order tidak ditemukan.')
    if (order.status === 'CANCELLED') {
      await client.query('COMMIT')
      return { success: true, alreadyCancelled: true }
    }
    if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      throw new Error(
        'Order yang sudah lunas/selesai tidak bisa dibatalkan langsung. Gunakan proses refund.',
      )
    }

    await client.query(
      `UPDATE public.ecommerce_orders
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [orderId, orgData.org.id],
    )
    await client.query(
      `UPDATE public.commerce_payment_intents
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE order_id = $1::uuid AND org_id = $2::uuid AND status = 'PENDING'`,
      [orderId, orgData.org.id],
    )
    await client.query(
      `INSERT INTO public.ecommerce_order_events (
         org_id, order_id, actor_label, event_type, message, payload
       ) VALUES (
         $1::uuid, $2::uuid, 'ADMIN', 'ORDER_CANCELLED',
         'Order dibatalkan oleh admin karena belum ada konfirmasi pembayaran.', $3::jsonb
       )`,
      [orgData.org.id, orderId, JSON.stringify({ reason: reason || null })],
    )

    const itemsResult = await client.query<{ product_name: string }>(
      `SELECT DISTINCT product_name FROM public.ecommerce_order_items WHERE org_id = $1::uuid AND order_id = $2::uuid`,
      [orgData.org.id, orderId],
    )
    const variables: Record<string, string | number | null> = {
      name: order.customer_name || 'Member',
      order_number: order.order_number,
      product_name: itemsResult.rows.map((row) => row.product_name).join(', ') || 'pesanan Anda',
      amount: formatRupiah(order.grand_total),
    }
    const recipients: Array<{ channel: 'EMAIL' | 'WHATSAPP'; value: string }> = []
    if (order.customer_email) recipients.push({ channel: 'EMAIL', value: order.customer_email })
    if (order.customer_phone) recipients.push({ channel: 'WHATSAPP', value: order.customer_phone })
    for (const recipient of recipients) {
      await enqueueNotification({
        orgId: orgData.org.id,
        userId: order.user_id,
        eventType: 'ORDER_CANCELLED',
        channel: recipient.channel,
        recipient: recipient.value,
        templateKey: 'ORDER_CANCELLED',
        variables,
        idempotencyKey: `order-cancelled:${orderId}:${recipient.channel}`,
        payload: { orderId, orderNumber: order.order_number },
      }, client)
    }

    await client.query('COMMIT')
    revalidatePath('/lms/admin/penjualan/transaksi')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      error: error instanceof Error ? error.message : 'Gagal membatalkan order.',
    }
  } finally {
    client.release()
  }
}
