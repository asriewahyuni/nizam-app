export type StoredLineDiscountMode = 'per_unit' | 'line_total'

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
