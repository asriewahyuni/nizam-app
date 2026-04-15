import { describe, expect, it } from 'vitest'

import { formatRupiah } from '@/lib/utils'
import { buildPosWhatsappReceiptMessage, normalizeWhatsappPhone } from '@/modules/sales/lib/pos-whatsapp'

describe('pos whatsapp helpers', () => {
  it('normalizes Indonesian WhatsApp phone numbers', () => {
    expect(normalizeWhatsappPhone('0812-3456-789')).toBe('628123456789')
    expect(normalizeWhatsappPhone('62812 3456 789')).toBe('628123456789')
    expect(normalizeWhatsappPhone('+62 812 3456 789')).toBe('628123456789')
    expect(normalizeWhatsappPhone('')).toBe('')
  })

  it('builds an itemized POS WhatsApp receipt message with custom placeholders', () => {
    const message = buildPosWhatsappReceiptMessage({
      customerName: 'Abah',
      saleId: 'abcd1234-1111-2222-3333-444455556666',
      items: [
        { name: 'Kopi Arabica', qty: 2, price: 10000 },
        { name: 'Kurma Ajwa', qty: 1, price: 18414 },
      ],
      subtotal: 38414,
      discount: 5000,
      tax: 414,
      total: 33828,
      customMessage: 'Poin member Kak {customer_name} bertambah setelah transaksi {sale_id}. Total hari ini {total}.',
    })

    expect(message).toContain('Halo Kak Abah,')
    expect(message).toContain('Rincian belanja:')
    expect(message).toContain('1. Kopi Arabica')
    expect(message).toContain(`2 x ${formatRupiah(10000)} = ${formatRupiah(20000)}`)
    expect(message).toContain('2. Kurma Ajwa')
    expect(message).toContain(`- Subtotal: ${formatRupiah(38414)}`)
    expect(message).toContain(`- Diskon: -${formatRupiah(5000)}`)
    expect(message).toContain(`- Pajak: ${formatRupiah(414)}`)
    expect(message).toContain(`- Total: *${formatRupiah(33828)}*`)
    expect(message).toContain(`Poin member Kak Abah bertambah setelah transaksi ABCD1234. Total hari ini ${formatRupiah(33828)}.`)
  })
})
