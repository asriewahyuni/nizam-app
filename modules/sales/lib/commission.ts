/**
 * Shared helpers untuk modul reseller, target, dan komisi.
 * Semua hitung komisi dilakukan off-invoice agar nilai invoice customer tetap utuh.
 */

export type SalesCommissionType = 'PERCENT' | 'FIXED'
export type SalesResellerType = 'PERSONAL' | 'COMPANY'
export type SalesResellerRecord = {
  id: string
  org_id?: string
  name?: string | null
  reseller_type?: string | null
  company_name?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  target_amount?: number | null
  commission_type?: string | null
  commission_value?: number | null
  is_active?: boolean | null
}
export type SalesReturnRecord = {
  status?: string | null
  grand_total?: number | null
}
export type SalesContactRecord = {
  name?: string | null
}
export type CommissionSaleRecord = {
  id: string
  org_id?: string
  sale_number?: string | null
  sale_date?: string | null
  grand_total?: number | null
  status?: string | null
  reseller_id?: string | null
  commission_type?: string | null
  commission_value?: number | null
  contacts?: SalesContactRecord | SalesContactRecord[] | null
  sales_resellers?: SalesResellerRecord | SalesResellerRecord[] | null
  sales_returns?: SalesReturnRecord[] | null
}

function toNonNegativeNumber(value: unknown): number {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

export function normalizeCommissionType(value?: string | null): SalesCommissionType | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PERCENT' || normalized === 'FIXED') return normalized
  return null
}

export function normalizeResellerType(value?: string | null): SalesResellerType {
  return String(value || '').trim().toUpperCase() === 'COMPANY' ? 'COMPANY' : 'PERSONAL'
}

export function calculateCommissionAmount(
  baseAmount: number,
  commissionType?: string | null,
  commissionValue?: number | null
): number {
  const normalizedType = normalizeCommissionType(commissionType)
  const safeBaseAmount = toNonNegativeNumber(baseAmount)
  const safeCommissionValue = toNonNegativeNumber(commissionValue)

  if (!normalizedType || safeCommissionValue <= 0) return 0

  if (normalizedType === 'PERCENT') {
    return (safeBaseAmount * safeCommissionValue) / 100
  }

  return safeCommissionValue
}

export function getCommissionSchemeLabel(
  commissionType?: string | null,
  commissionValue?: number | null
): string {
  const normalizedType = normalizeCommissionType(commissionType)
  const safeCommissionValue = toNonNegativeNumber(commissionValue)

  if (!normalizedType || safeCommissionValue <= 0) {
    return 'Belum ada skema komisi'
  }

  if (normalizedType === 'PERCENT') {
    const rendered = Number.isInteger(safeCommissionValue)
      ? String(safeCommissionValue)
      : safeCommissionValue.toFixed(2).replace(/\.?0+$/, '')

    return `${rendered}% dari net invoice`
  }

  return `${new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safeCommissionValue)} per invoice`
}

export function getResellerDisplayName(reseller: {
  name?: string | null
  company_name?: string | null
  contact_person?: string | null
  reseller_type?: string | null
} | null | undefined): string {
  if (!reseller) return '-'

  const resellerType = normalizeResellerType(reseller.reseller_type)
  const companyName = String(reseller.company_name || '').trim()
  const name = String(reseller.name || '').trim()
  const contactPerson = String(reseller.contact_person || '').trim()

  if (resellerType === 'COMPANY') {
    return companyName || name || contactPerson || '-'
  }

  return name || contactPerson || companyName || '-'
}

export function getResellerSubtitle(reseller: {
  company_name?: string | null
  contact_person?: string | null
  reseller_type?: string | null
} | null | undefined): string {
  if (!reseller) return ''

  const resellerType = normalizeResellerType(reseller.reseller_type)
  const companyName = String(reseller.company_name || '').trim()
  const contactPerson = String(reseller.contact_person || '').trim()

  if (resellerType === 'COMPANY') {
    return contactPerson ? `PIC: ${contactPerson}` : 'Perusahaan mitra'
  }

  return companyName ? `Mitra: ${companyName}` : 'Reseller personal'
}
