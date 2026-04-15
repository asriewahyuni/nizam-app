import { describe, expect, it } from 'vitest'

import {
  clampDiscountAmount,
  getEditableLineDiscountAmount,
  getStoredLineDiscountAmount,
  inferStoredLineDiscountMode,
} from '@/lib/commerce/discounts'

describe('commerce discount helpers', () => {
  it('converts per-unit discount input into stored line discount total', () => {
    expect(getStoredLineDiscountAmount(15000, 3)).toBe(45000)
  })

  it('detects legacy per-unit discount rows from header totals', () => {
    const mode = inferStoredLineDiscountMode(
      [{ quantity: 2, discount_amount: 15000 }],
      30000
    )

    expect(mode).toBe('per_unit')
    expect(getEditableLineDiscountAmount(15000, 2, mode)).toBe(15000)
  })

  it('detects line-total discount rows from header totals', () => {
    const mode = inferStoredLineDiscountMode(
      [{ quantity: 2, discount_amount: 30000 }],
      30000
    )

    expect(mode).toBe('line_total')
    expect(getEditableLineDiscountAmount(30000, 2, mode)).toBe(15000)
  })

  it('caps discount so it never exceeds subtotal', () => {
    expect(clampDiscountAmount(125000, 100000)).toBe(100000)
    expect(clampDiscountAmount(-5000, 100000)).toBe(0)
  })
})
