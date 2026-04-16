import {
  getDocumentLineDiscountTotal,
  roundMoney,
} from '@/lib/commerce/discounts'

type PurchaseDocumentLike = {
  id?: unknown
  purchase_number?: unknown
  total_amount?: unknown
  discount_amount?: unknown
  tax_amount?: unknown
  shipping_amount?: unknown
  insurance_amount?: unknown
  grand_total?: unknown
}

type PurchaseItemLike = {
  purchase_id?: unknown
  quantity?: unknown
  unit_price?: unknown
  discount_amount?: unknown
}

type JournalEntryLike = {
  reference_type?: unknown
  reference_id?: unknown
  notes?: unknown
}

export interface PurchaseLedgerTransparencySummary {
  purchaseNumber: string | null
  subtotal: number
  lineDiscount: number
  headerDiscount: number
  totalDiscount: number
  subtotalAfterDiscount: number
  shipping: number
  insurance: number
  landedCost: number
  inventoryValue: number
  tax: number
  grandTotal: number
  note: string
}

type QueryRunner = <T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<{ rows: T[] }>

function formatCompactRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundMoney(amount))
}

function toReferenceType(value: unknown) {
  return String(value || '').trim().toUpperCase()
}

function toReferenceId(value: unknown) {
  const trimmed = String(value || '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildPurchaseLedgerTransparency(
  purchase: PurchaseDocumentLike | null | undefined,
  items: PurchaseItemLike[] = []
): PurchaseLedgerTransparencySummary {
  const safeItems = Array.isArray(items) ? items : []
  const subtotal = roundMoney(purchase?.total_amount || 0)
  const lineDiscount = getDocumentLineDiscountTotal(safeItems)
  const shipping = roundMoney(purchase?.shipping_amount || 0)
  const insurance = roundMoney(purchase?.insurance_amount || 0)
  const tax = roundMoney(purchase?.tax_amount || 0)
  const grandTotal = roundMoney(purchase?.grand_total || 0)
  const inferredDiscountTotal = Math.max(
    0,
    roundMoney(subtotal + tax + shipping + insurance - grandTotal)
  )
  const storedDiscount = Math.max(0, roundMoney(purchase?.discount_amount || 0))
  const totalDiscount = roundMoney(Math.max(storedDiscount, lineDiscount, inferredDiscountTotal))
  const headerDiscount = roundMoney(Math.max(totalDiscount - lineDiscount, 0))
  const subtotalAfterDiscount = roundMoney(Math.max(subtotal - totalDiscount, 0))
  const landedCost = roundMoney(shipping + insurance)
  const inventoryValue = roundMoney(subtotalAfterDiscount + landedCost)
  const computedGrandTotal = roundMoney(inventoryValue + tax)
  const finalGrandTotal = roundMoney(grandTotal || computedGrandTotal)
  const purchaseNumber = toReferenceId(purchase?.purchase_number)

  return {
    purchaseNumber,
    subtotal,
    lineDiscount,
    headerDiscount,
    totalDiscount,
    subtotalAfterDiscount,
    shipping,
    insurance,
    landedCost,
    inventoryValue,
    tax,
    grandTotal: finalGrandTotal,
    note: formatPurchaseLedgerTransparencyNote({
      purchaseNumber,
      subtotal,
      lineDiscount,
      headerDiscount,
      totalDiscount,
      subtotalAfterDiscount,
      shipping,
      insurance,
      landedCost,
      inventoryValue,
      tax,
      grandTotal: finalGrandTotal,
      note: '',
    }),
  }
}

export function formatPurchaseLedgerTransparencyNote(summary: PurchaseLedgerTransparencySummary) {
  const parts = [
    `Bruto ${formatCompactRupiah(summary.subtotal)}`,
    `Diskon item ${formatCompactRupiah(summary.lineDiscount)}`,
    `Diskon header ${formatCompactRupiah(summary.headerDiscount)}`,
    `Nilai persediaan ${formatCompactRupiah(summary.inventoryValue)}`,
    `PPN ${formatCompactRupiah(summary.tax)}`,
    `Tagihan ${formatCompactRupiah(summary.grandTotal)}`,
  ]

  if (summary.landedCost > 0) {
    parts.splice(4, 0, `Ongkir/Asuransi ${formatCompactRupiah(summary.landedCost)}`)
  }

  return parts.join(' | ')
}

export async function hydratePurchaseTransparencyForEntries<T extends JournalEntryLike>(
  entries: T[],
  queryRunner: QueryRunner
): Promise<Array<T & { purchase_transparency?: PurchaseLedgerTransparencySummary | null }>> {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) return []

  const purchaseIds = Array.from(
    new Set(
      list
        .filter((entry) => toReferenceType(entry?.reference_type) === 'PURCHASE')
        .map((entry) => toReferenceId(entry?.reference_id))
        .filter((referenceId): referenceId is string => Boolean(referenceId))
    )
  )

  if (purchaseIds.length === 0) {
    return list.map((entry) => ({ ...entry, purchase_transparency: null }))
  }

  const [purchaseResult, purchaseItemsResult] = await Promise.all([
    queryRunner<Record<string, unknown>>(`
      SELECT
        id,
        purchase_number,
        total_amount,
        discount_amount,
        tax_amount,
        shipping_amount,
        insurance_amount,
        grand_total
      FROM public.purchases
      WHERE id = ANY($1::uuid[])
    `, [purchaseIds]),
    queryRunner<Record<string, unknown>>(`
      SELECT
        purchase_id,
        quantity,
        unit_price,
        discount_amount
      FROM public.purchase_items
      WHERE purchase_id = ANY($1::uuid[])
    `, [purchaseIds]),
  ])

  const purchaseById = new Map<string, PurchaseDocumentLike>()
  for (const row of purchaseResult.rows) {
    const purchaseId = toReferenceId(row.id)
    if (!purchaseId) continue
    purchaseById.set(purchaseId, row)
  }

  const itemsByPurchaseId = new Map<string, PurchaseItemLike[]>()
  for (const row of purchaseItemsResult.rows) {
    const purchaseId = toReferenceId(row.purchase_id)
    if (!purchaseId) continue
    const existingItems = itemsByPurchaseId.get(purchaseId) || []
    existingItems.push(row)
    itemsByPurchaseId.set(purchaseId, existingItems)
  }

  return list.map((entry) => {
    const referenceId = toReferenceId(entry?.reference_id)
    if (!referenceId || toReferenceType(entry?.reference_type) !== 'PURCHASE') {
      return { ...entry, purchase_transparency: null }
    }

    const purchase = purchaseById.get(referenceId)
    if (!purchase) {
      return { ...entry, purchase_transparency: null }
    }

    const purchaseTransparency = buildPurchaseLedgerTransparency(
      purchase,
      itemsByPurchaseId.get(referenceId) || []
    )

    return {
      ...entry,
      purchase_transparency: purchaseTransparency,
    }
  })
}
