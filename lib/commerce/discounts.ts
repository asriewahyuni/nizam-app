export type StoredLineDiscountMode = 'per_unit' | 'line_total'

export interface DiscountDocumentLine {
  quantity?: unknown
  unit_price?: unknown
  discount_amount?: unknown
}

export interface DiscountDocument {
  discount_amount?: unknown
  total_amount?: unknown
  tax_amount?: unknown
  shipping_amount?: unknown
  insurance_amount?: unknown
  grand_total?: unknown
  purchase_items?: DiscountDocumentLine[]
}

const MONEY_EPSILON = 0.01

function toMoney(value: unknown): number {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function roundMoney(value: unknown): number {
  const numeric = toMoney(value)
  return Math.round((numeric + Number.EPSILON) * 100) / 100
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(roundMoney(left) - roundMoney(right)) <= MONEY_EPSILON
}

export function clampDiscountAmount(discountAmount: unknown, subtotalAmount: unknown): number {
  const subtotal = Math.max(0, roundMoney(subtotalAmount))
  const discount = Math.max(0, roundMoney(discountAmount))
  return Math.min(discount, subtotal)
}

export function getStoredLineDiscountAmount(discountPerUnit: unknown, quantity: unknown): number {
  return roundMoney(Math.max(0, toMoney(discountPerUnit)) * Math.max(0, toMoney(quantity)))
}

export function inferStoredLineDiscountMode(
  lines: Array<{ quantity?: unknown; discount_amount?: unknown }>,
  headerDiscountAmount: unknown
): StoredLineDiscountMode {
  const headerDiscount = roundMoney(headerDiscountAmount)
  const rawDiscountTotal = lines.reduce((sum, line) => sum + roundMoney(line?.discount_amount), 0)
  const weightedDiscountTotal = lines.reduce(
    (sum, line) => sum + getStoredLineDiscountAmount(line?.discount_amount, line?.quantity),
    0
  )

  if (
    weightedDiscountTotal > 0 &&
    nearlyEqual(headerDiscount, weightedDiscountTotal) &&
    !nearlyEqual(headerDiscount, rawDiscountTotal)
  ) {
    return 'per_unit'
  }

  if (
    rawDiscountTotal > 0 &&
    nearlyEqual(headerDiscount, rawDiscountTotal) &&
    !nearlyEqual(headerDiscount, weightedDiscountTotal)
  ) {
    return 'line_total'
  }

  return 'line_total'
}

export function getEditableLineDiscountAmount(
  storedDiscountAmount: unknown,
  quantity: unknown,
  mode: StoredLineDiscountMode
): number {
  const storedDiscount = Math.max(0, roundMoney(storedDiscountAmount))
  const safeQuantity = Math.max(0, toMoney(quantity))

  if (mode === 'line_total' && safeQuantity > 0) {
    return roundMoney(storedDiscount / safeQuantity)
  }

  return storedDiscount
}

export function getDocumentLineDiscountTotal(lines: DiscountDocumentLine[] = []): number {
  return roundMoney(lines.reduce((sum, line) => sum + roundMoney(line?.discount_amount), 0))
}

export function getDocumentHeaderDiscountAmount(
  document: DiscountDocument | null | undefined,
  lineDiscountTotal = getDocumentLineDiscountTotal(document?.purchase_items || [])
): number {
  const storedDocumentDiscount = Math.max(0, roundMoney(document?.discount_amount))
  const storedHeaderDiscount = Math.max(0, roundMoney(storedDocumentDiscount - lineDiscountTotal))
  const inferredHeaderDiscount = Math.max(
    0,
    roundMoney(
      roundMoney(document?.total_amount) +
      roundMoney(document?.tax_amount) +
      roundMoney(document?.shipping_amount) +
      roundMoney(document?.insurance_amount) -
      roundMoney(document?.grand_total)
    )
  )

  return Math.max(storedHeaderDiscount, inferredHeaderDiscount)
}

function allocateRoundedAmounts(totalAmount: number, rawWeights: number[]): number[] {
  const total = roundMoney(totalAmount)
  const weights = rawWeights.map((weight) => Math.max(0, Number(weight || 0)))

  if (weights.length === 0) return []
  if (Math.abs(total) <= MONEY_EPSILON) return weights.map(() => 0)

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const allocations = weights.map(() => 0)

  if (weightTotal <= 0) {
    allocations[allocations.length - 1] = total
    return allocations
  }

  let remainderIndex = allocations.length - 1
  for (let index = allocations.length - 1; index >= 0; index -= 1) {
    if (weights[index] > 0) {
      remainderIndex = index
      break
    }
  }

  let allocated = 0
  for (let index = 0; index < weights.length; index += 1) {
    if (index === remainderIndex) continue
    const amount = roundMoney((weights[index] / weightTotal) * total)
    allocations[index] = amount
    allocated = roundMoney(allocated + amount)
  }

  allocations[remainderIndex] = roundMoney(total - allocated)
  return allocations
}

export function getDocumentLineDiscountsForDisplay(
  document: DiscountDocument | null | undefined
): number[] {
  const lines = Array.isArray(document?.purchase_items) ? document.purchase_items : []
  const lineDiscountTotal = getDocumentLineDiscountTotal(lines)
  const headerDiscountAmount = getDocumentHeaderDiscountAmount(document, lineDiscountTotal)
  const weights = lines.map((line) =>
    Math.max(
      0,
      roundMoney(
        (Number(line?.quantity || 0) * Number(line?.unit_price || 0)) -
        Number(line?.discount_amount || 0)
      )
    )
  )
  const headerAllocations = allocateRoundedAmounts(headerDiscountAmount, weights)

  return lines.map((line, index) =>
    roundMoney(Number(line?.discount_amount || 0) + Number(headerAllocations[index] || 0))
  )
}
