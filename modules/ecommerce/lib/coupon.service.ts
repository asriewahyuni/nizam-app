/**
 * Validasi dan perhitungan kupon commerce untuk semua jalur checkout.
 * Nominal selalu dihitung ulang di server agar harga tidak dapat dimanipulasi.
 */
import 'server-only'

import type { PoolClient } from 'pg'

export type CommerceCouponLine = {
  storeProductId: string
  lineSubtotal: number
}

export type CommerceCouponQuote = {
  couponId: string
  code: string
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number
  discountAmount: number
  subtotal: number
  eligibleSubtotal: number
  totalAfterDiscount: number
}

type CouponRow = {
  id: string
  code: string
  discount_type: 'FIXED' | 'PERCENT'
  discount_value: number
  minimum_amount: number
  usage_limit: number | null
  per_user_limit: number
  allowed_store_product_ids: string[]
  total_usage: number
  user_usage: number
}

export function normalizeCommerceCouponCode(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 80)
}

function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

/**
 * Mengunci baris kupon sebelum membaca jumlah pemakaian agar checkout serentak
 * tidak dapat melewati kuota global.
 */
export async function quoteCommerceCoupon(
  client: PoolClient,
  input: {
    orgId: string
    code: string
    lines: CommerceCouponLine[]
    userId?: string | null
    email?: string | null
    lock?: boolean
  },
): Promise<CommerceCouponQuote> {
  const code = normalizeCommerceCouponCode(input.code)
  if (!code) throw new Error('Masukkan kode diskon terlebih dahulu.')

  if (input.lock) {
    await client.query(
      `SELECT id
       FROM public.commerce_coupons
       WHERE org_id = $1::uuid
         AND upper(code) = $2
       LIMIT 1
       FOR UPDATE`,
      [input.orgId, code],
    )
  }

  const couponResult = await client.query<CouponRow>(
    `SELECT
       coupon.id::text,
       coupon.code,
       coupon.discount_type,
       coupon.discount_value::float8,
       coupon.minimum_amount::float8,
       coupon.usage_limit,
       coupon.per_user_limit,
       coupon.allowed_store_product_ids::text[],
       (
         SELECT COUNT(*)::int
         FROM public.commerce_coupon_redemptions redemption
         WHERE redemption.coupon_id = coupon.id
       ) AS total_usage,
       (
         SELECT COUNT(*)::int
         FROM public.commerce_coupon_redemptions redemption
         WHERE redemption.coupon_id = coupon.id
           AND (
             ($3::uuid IS NOT NULL AND redemption.user_id = $3::uuid)
             OR (
               $4::text IS NOT NULL
               AND redemption.email_normalized = lower($4)
             )
           )
       ) AS user_usage
     FROM public.commerce_coupons coupon
     WHERE coupon.org_id = $1::uuid
       AND upper(coupon.code) = $2
       AND coupon.is_active = TRUE
       AND (coupon.starts_at IS NULL OR coupon.starts_at <= NOW())
       AND (coupon.expires_at IS NULL OR coupon.expires_at > NOW())
     LIMIT 1`,
    [
      input.orgId,
      code,
      input.userId || null,
      input.email?.trim().toLowerCase() || null,
    ],
  )
  const coupon = couponResult.rows[0]
  if (!coupon) throw new Error('Kode diskon tidak ditemukan atau sudah tidak berlaku.')

  const normalizedLines = input.lines
    .map((line) => ({
      storeProductId: String(line.storeProductId || ''),
      lineSubtotal: Math.max(0, roundMoney(Number(line.lineSubtotal || 0))),
    }))
    .filter((line) => line.storeProductId && line.lineSubtotal > 0)
  const subtotal = roundMoney(
    normalizedLines.reduce((total, line) => total + line.lineSubtotal, 0),
  )
  if (subtotal <= 0) throw new Error('Nilai belanja belum dapat diberi diskon.')

  const allowedIds = new Set(coupon.allowed_store_product_ids || [])
  const eligibleSubtotal = roundMoney(
    normalizedLines.reduce((total, line) => {
      if (allowedIds.size > 0 && !allowedIds.has(line.storeProductId)) return total
      return total + line.lineSubtotal
    }, 0),
  )
  if (eligibleSubtotal <= 0) {
    throw new Error('Kode diskon tidak berlaku untuk produk yang dipilih.')
  }
  if (subtotal < Number(coupon.minimum_amount || 0)) {
    throw new Error('Nilai belanja belum memenuhi minimum kode diskon.')
  }
  if (coupon.usage_limit != null && coupon.total_usage >= coupon.usage_limit) {
    throw new Error('Kuota kode diskon sudah habis.')
  }
  if (coupon.user_usage >= Math.max(1, Number(coupon.per_user_limit || 1))) {
    throw new Error('Batas penggunaan kode diskon untuk email ini sudah tercapai.')
  }

  const rawDiscount = coupon.discount_type === 'PERCENT'
    ? eligibleSubtotal * Number(coupon.discount_value || 0) / 100
    : Number(coupon.discount_value || 0)
  const discountAmount = Math.min(eligibleSubtotal, Math.max(0, roundMoney(rawDiscount)))

  return {
    couponId: coupon.id,
    code: normalizeCommerceCouponCode(coupon.code),
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value || 0),
    discountAmount,
    subtotal,
    eligibleSubtotal,
    totalAfterDiscount: Math.max(0, roundMoney(subtotal - discountAmount)),
  }
}
