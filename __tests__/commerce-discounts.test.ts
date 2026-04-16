import { describe, expect, it } from 'vitest'

import {
  clampDiscountAmount,
  getDocumentHeaderDiscountAmount,
  getDocumentLineDiscountsForDisplay,
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

  it('infers legacy header discount from document totals when stored header discount is empty', () => {
    const purchase = {
      total_amount: 350000,
      tax_amount: 34650,
      shipping_amount: 20000,
      insurance_amount: 0,
      grand_total: 369650,
      discount_amount: 0,
      purchase_items: [
        { quantity: 10, unit_price: 35000, discount_amount: 0 },
      ],
    }

    expect(getDocumentHeaderDiscountAmount(purchase)).toBe(35000)
    expect(getDocumentLineDiscountsForDisplay(purchase)).toEqual([35000])
  })

  it('keeps stored line discount separate from header discount in display allocation', () => {
    const purchase = {
      total_amount: 400000,
      tax_amount: 0,
      shipping_amount: 0,
      insurance_amount: 0,
      grand_total: 360000,
      discount_amount: 50000,
      purchase_items: [
        { quantity: 2, unit_price: 100000, discount_amount: 10000 },
        { quantity: 1, unit_price: 200000, discount_amount: 0 },
      ],
    }

    expect(getDocumentHeaderDiscountAmount(purchase)).toBe(40000)
    expect(getDocumentLineDiscountsForDisplay(purchase)).toEqual([29487.18, 20512.82])
  })
})
