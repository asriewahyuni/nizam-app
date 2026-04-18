/**
 * Shared promo helpers so Sales pages can read/write one normalized promo catalog
 * from organization settings without duplicating parsing logic.
 */

export type SalesPromoType = 'PERCENT' | 'FIXED'
export type SalesPromoStatus = 'ACTIVE' | 'EXPIRED' | 'INACTIVE'

export type SalesPromoRecord = {
  id: string
  code: string
  type: SalesPromoType
  value: number
  isActive: boolean
  usageCount: number
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  status: SalesPromoStatus
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeIsoDateTime(value: unknown, fallback?: string): string | null {
  if (!value) return fallback ?? null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? (fallback ?? null) : value.toISOString()
  }

  const trimmed = String(value || '').trim()
  if (!trimmed) return fallback ?? null

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`).toISOString()
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return fallback ?? null
  return parsed.toISOString()
}

export function normalizeSalesPromoCode(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function deriveSalesPromoStatus(
  promo: Pick<SalesPromoRecord, 'isActive' | 'expiresAt'>,
  now: Date = new Date()
): SalesPromoStatus {
  if (!promo.isActive) return 'INACTIVE'
  if (!promo.expiresAt) return 'ACTIVE'

  const expiresAtMs = new Date(promo.expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs)) return 'ACTIVE'

  return expiresAtMs < now.getTime() ? 'EXPIRED' : 'ACTIVE'
}

export function normalizeSalesPromoRecord(value: unknown): SalesPromoRecord {
  const source = isPlainObject(value) ? value : {}
  const nowIso = new Date().toISOString()
  const createdAt = normalizeIsoDateTime(source.createdAt ?? source.created_at, nowIso) || nowIso
  const updatedAt = normalizeIsoDateTime(source.updatedAt ?? source.updated_at, createdAt) || createdAt
  const expiresAt = normalizeIsoDateTime(source.expiresAt ?? source.expires_at)

  const promo: SalesPromoRecord = {
    id: String(source.id || '').trim(),
    code: normalizeSalesPromoCode(source.code),
    type: String(source.type || '').trim().toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT',
    value: Math.max(0, toFiniteNumber(source.value, 0)),
    isActive: Boolean(source.isActive ?? source.is_active ?? true),
    usageCount: Math.max(0, Math.trunc(toFiniteNumber(source.usageCount ?? source.usage_count, 0))),
    expiresAt,
    createdAt,
    updatedAt,
    status: 'ACTIVE',
  }

  promo.status = deriveSalesPromoStatus(promo)
  return promo
}

export function getSalesPromosFromSettings(settings: unknown): SalesPromoRecord[] {
  const source = isPlainObject(settings) ? settings : {}
  const rawPromos = Array.isArray(source.sales_promos) ? source.sales_promos : []

  return rawPromos
    .map((promo) => normalizeSalesPromoRecord(promo))
    .filter((promo) => promo.id && promo.code)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function mergeSalesPromosIntoSettings(
  currentSettings: unknown,
  promos: SalesPromoRecord[]
): Record<string, unknown> {
  const normalizedPromos = promos.map((promo) => ({
    id: promo.id,
    code: normalizeSalesPromoCode(promo.code),
    type: promo.type,
    value: Math.max(0, toFiniteNumber(promo.value, 0)),
    isActive: Boolean(promo.isActive),
    usageCount: Math.max(0, Math.trunc(toFiniteNumber(promo.usageCount, 0))),
    expiresAt: promo.expiresAt || null,
    createdAt: normalizeIsoDateTime(promo.createdAt, new Date().toISOString()),
    updatedAt: normalizeIsoDateTime(promo.updatedAt, new Date().toISOString()),
  }))

  return {
    ...(isPlainObject(currentSettings) ? currentSettings : {}),
    sales_promos: normalizedPromos,
  }
}

export function calculateSalesPromoDiscount(promo: SalesPromoRecord, baseAmount: number): number {
  const normalizedBase = Math.max(0, toFiniteNumber(baseAmount, 0))
  if (normalizedBase <= 0) return 0

  if (promo.type === 'FIXED') {
    return Math.min(normalizedBase, Math.max(0, Math.round(promo.value)))
  }

  return Math.min(
    normalizedBase,
    Math.max(0, Math.round(normalizedBase * (Math.max(0, promo.value) / 100)))
  )
}

export function isSalesPromoUsable(promo: SalesPromoRecord): boolean {
  return deriveSalesPromoStatus(promo) === 'ACTIVE'
}
