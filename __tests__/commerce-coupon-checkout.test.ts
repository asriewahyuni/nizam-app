/**
 * Menjaga perhitungan kupon checkout tetap konsisten untuk produk tunggal,
 * multi-produk, pembatasan produk, dan potongan penuh.
 */
import { describe, expect, it, vi } from 'vitest'
import type { PoolClient } from 'pg'

vi.mock('server-only', () => ({}))

import {
  normalizeCommerceCouponCode,
  quoteCommerceCoupon,
} from '@/modules/ecommerce/lib/coupon.service'

function couponClient(row: Record<string, unknown>): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [row] }),
  } as unknown as PoolClient
}

describe('commerce coupon checkout', () => {
  it('membersihkan kode dan menghitung persen hanya untuk produk yang diizinkan', async () => {
    const client = couponClient({
      id: 'coupon-1',
      code: 'hemat20',
      discount_type: 'PERCENT',
      discount_value: 20,
      minimum_amount: 0,
      usage_limit: 10,
      per_user_limit: 1,
      allowed_store_product_ids: ['product-a'],
      total_usage: 0,
      user_usage: 0,
    })

    const quote = await quoteCommerceCoupon(client, {
      orgId: 'org-1',
      code: ' hemat 20 ',
      email: 'member@example.com',
      lines: [
        { storeProductId: 'product-a', lineSubtotal: 100_000 },
        { storeProductId: 'product-b', lineSubtotal: 50_000 },
      ],
    })

    expect(normalizeCommerceCouponCode(' hemat 20 ')).toBe('HEMAT20')
    expect(quote.subtotal).toBe(150_000)
    expect(quote.eligibleSubtotal).toBe(100_000)
    expect(quote.discountAmount).toBe(20_000)
    expect(quote.totalAfterDiscount).toBe(130_000)
  })

  it('membatasi potongan tetap agar total tidak menjadi negatif', async () => {
    const client = couponClient({
      id: 'coupon-2',
      code: 'GRATIS',
      discount_type: 'FIXED',
      discount_value: 500_000,
      minimum_amount: 0,
      usage_limit: null,
      per_user_limit: 2,
      allowed_store_product_ids: [],
      total_usage: 0,
      user_usage: 0,
    })

    const quote = await quoteCommerceCoupon(client, {
      orgId: 'org-1',
      code: 'GRATIS',
      lines: [{ storeProductId: 'product-a', lineSubtotal: 149_000 }],
    })

    expect(quote.discountAmount).toBe(149_000)
    expect(quote.totalAfterDiscount).toBe(0)
  })

  it('menolak kupon yang tidak berlaku untuk produk terpilih', async () => {
    const client = couponClient({
      id: 'coupon-3',
      code: 'KHUSUS',
      discount_type: 'PERCENT',
      discount_value: 10,
      minimum_amount: 0,
      usage_limit: null,
      per_user_limit: 1,
      allowed_store_product_ids: ['product-lain'],
      total_usage: 0,
      user_usage: 0,
    })

    await expect(quoteCommerceCoupon(client, {
      orgId: 'org-1',
      code: 'KHUSUS',
      lines: [{ storeProductId: 'product-a', lineSubtotal: 149_000 }],
    })).rejects.toThrow('tidak berlaku untuk produk')
  })
})
