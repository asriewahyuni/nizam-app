/**
 * POS WhatsApp helpers.
 *
 * Compose itemized WhatsApp receipt messages and normalize phone numbers
 * so POS can reuse one consistent formatter for auto-send and resend flows.
 */

import { formatRupiah } from '@/lib/utils'

export type PosWhatsappLineItem = {
  name?: string | null
  qty?: number | null
  price?: number | null
  unit?: string | null
}

export type PosWhatsappReceiptInput = {
  customerName?: string | null
  saleId?: string | null
  items?: PosWhatsappLineItem[] | null
  subtotal?: number | null
  discount?: number | null
  tax?: number | null
  total?: number | null
  customMessage?: string | null
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(6).replace(/\.?0+$/, '')
}

function formatSaleReference(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return '-'
  return normalized.split('-')[0]?.toUpperCase() || normalized.toUpperCase()
}

function normalizeMultilineText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resolveCustomMessageTemplate(template: string, input: PosWhatsappReceiptInput) {
  const items = Array.isArray(input.items) ? input.items : []
  const itemCount = items.reduce((total, item) => total + Number(item?.qty || 0), 0)
  const replacements: Record<string, string> = {
    customer_name: normalizeText(input.customerName) || 'Pelanggan',
    sale_id: formatSaleReference(normalizeText(input.saleId)),
    item_count: formatQuantity(itemCount),
    subtotal: formatRupiah(Number(input.subtotal || 0)),
    discount: formatRupiah(Number(input.discount || 0)),
    tax: formatRupiah(Number(input.tax || 0)),
    total: formatRupiah(Number(input.total || 0)),
  }

  return template.replace(/\{(customer_name|sale_id|item_count|subtotal|discount|tax|total)\}/g, (_match, key) => {
    return replacements[key] || ''
  })
}

export function normalizeWhatsappPhone(value: string | null | undefined) {
  const digits = normalizeText(value).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

export function buildPosWhatsappReceiptMessage(input: PosWhatsappReceiptInput) {
  const customerName = normalizeText(input.customerName) || 'Pelanggan'
  const items = (Array.isArray(input.items) ? input.items : []).filter((item) => normalizeText(item?.name))
  const subtotal = Number(input.subtotal || 0)
  const discount = Number(input.discount || 0)
  const tax = Number(input.tax || 0)
  const total = Number(input.total || 0)
  const customMessageTemplate = normalizeMultilineText(normalizeText(input.customMessage))
  const customMessage = customMessageTemplate
    ? resolveCustomMessageTemplate(customMessageTemplate, input)
    : ''

  const lines: string[] = [
    `Halo Kak ${customerName},`,
    '',
    'Terima kasih telah berbelanja di tempat kami.',
    'Pembayaran Kakak sudah kami terima.',
  ]

  if (items.length > 0) {
    lines.push('', 'Rincian belanja:')

    items.forEach((item, index) => {
      const qty = Number(item.qty || 0)
      const price = Number(item.price || 0)
      const lineTotal = qty * price

      lines.push(
        `${index + 1}. ${normalizeText(item.name)}`,
        `   ${formatQuantity(qty)} x ${formatRupiah(price)} = ${formatRupiah(lineTotal)}`
      )
    })
  }

  lines.push('', 'Ringkasan transaksi:')

  if (normalizeText(input.saleId)) {
    lines.push(`- No. transaksi: ${formatSaleReference(normalizeText(input.saleId))}`)
  }

  lines.push(`- Subtotal: ${formatRupiah(subtotal)}`)

  if (discount > 0) {
    lines.push(`- Diskon: -${formatRupiah(discount)}`)
  }

  if (tax > 0) {
    lines.push(`- Pajak: ${formatRupiah(tax)}`)
  }

  lines.push(`- Total: *${formatRupiah(total)}*`)

  if (customMessage) {
    lines.push('', customMessage)
  }

  lines.push('', 'Semoga hari Kakak menyenangkan!')

  return lines.join('\n')
}
