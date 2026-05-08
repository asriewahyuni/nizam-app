import { describe, expect, it, vi } from 'vitest'

import { hydratePurchaseTransparencyForEntries } from '@/modules/accounting/lib/purchase-ledger-transparency'

describe('purchase ledger transparency', () => {
  it('hydrates purchase transparency with landed cost details', async () => {
    const queryRunner = vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.purchases')) {
        return {
          rows: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              purchase_number: 'PO-001',
              total_amount: 350000,
              discount_amount: 35000,
              tax_amount: 34650,
              shipping_amount: 20000,
              insurance_amount: 10000,
              grand_total: 379650,
            },
          ],
        }
      }

      if (sql.includes('FROM public.purchase_items')) {
        return {
          rows: [
            {
              purchase_id: '11111111-1111-1111-1111-111111111111',
              quantity: 10,
              unit_price: 35000,
              discount_amount: 35000,
            },
          ],
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    })

    const result = await hydratePurchaseTransparencyForEntries(
      [
        {
          id: 'je-1',
          reference_type: 'PURCHASE',
          reference_id: '11111111-1111-1111-1111-111111111111',
        },
      ],
      queryRunner,
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.purchase_transparency).toEqual(
      expect.objectContaining({
        purchaseNumber: 'PO-001',
        subtotal: 350000,
        lineDiscount: 35000,
        headerDiscount: 0,
        shipping: 20000,
        insurance: 10000,
        landedCost: 30000,
        inventoryValue: 345000,
        tax: 34650,
        grandTotal: 379650,
      }),
    )
    expect(String(result[0]?.purchase_transparency?.note || '')).toContain('Ongkir/Asuransi')
    expect(queryRunner).toHaveBeenCalledTimes(2)
    expect(String(queryRunner.mock.calls[0]?.[0] || '')).toContain('insurance_amount')
  })
})
