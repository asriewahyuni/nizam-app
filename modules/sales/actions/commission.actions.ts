'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { queryPostgres } from '@/lib/db/postgres'
import { checkClosedFiscalPeriod, buildClosedPeriodError } from '@/lib/erp-bridge/fiscal-period'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import {
  calculateCommissionAmount,
  normalizeCommissionType,
  normalizeResellerType,
  type SalesResellerRecord,
} from '@/modules/sales/lib/commission'

export type ResellerCommissionPaymentRow = {
  paymentId: string
  paymentNumber: string
  paymentDate: string
  paymentAmount: number
  label: string | null
  saleId: string
  saleNumber: string
  commissionAmount: number
  settled: boolean
  settlementDate: string | null
  referenceNo: string | null
}

export type ResellerCommissionSettlementHistoryRow = {
  id: string
  settlementDate: string
  totalCommissionAmount: number
  paymentMethod: string | null
  referenceNo: string | null
  paymentCount: number
  entryNumber: string | null
}

type ResellerMutationResult =
  | { success: true; data: SalesResellerRecord; error?: undefined }
  | { success?: false; error: string; data?: undefined }

type DeleteResellerResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

type ResellerSnapshotResult =
  | {
      success: true
      resellerId: string | null
      resellerName: string | null
      commissionType: 'PERCENT' | 'FIXED' | null
      commissionValue: number | null
      error?: undefined
    }
  | {
      success?: false
      error: string
      resellerId?: undefined
      resellerName?: undefined
      commissionType?: undefined
      commissionValue?: undefined
    }

type ResellerMutationPayload = {
  name: string
  resellerType: 'PERSONAL' | 'COMPANY'
  companyName: string | null
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  targetAmount: number
  commissionType: 'PERCENT' | 'FIXED'
  commissionValue: number
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNonNegativeNumber(value: FormDataEntryValue | null) {
  const numeric = typeof value === 'string' ? Number(value) : Number(value || 0)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return numeric
}

function parseResellerFormData(formData: FormData): ResellerMutationPayload | { error: string } {
  const resellerType = normalizeResellerType(
    typeof formData.get('reseller_type') === 'string' ? (formData.get('reseller_type') as string) : null
  )
  const name = typeof formData.get('name') === 'string' ? (formData.get('name') as string).trim() : ''
  const commissionType = normalizeCommissionType(
    typeof formData.get('commission_type') === 'string' ? (formData.get('commission_type') as string) : null
  )
  const commissionValue = normalizeNonNegativeNumber(formData.get('commission_value'))
  const targetAmount = normalizeNonNegativeNumber(formData.get('target_amount'))

  if (!name) {
    return { error: 'Nama reseller wajib diisi.' }
  }

  if (!commissionType) {
    return { error: 'Tipe komisi wajib dipilih.' }
  }

  return {
    name,
    resellerType,
    companyName: normalizeOptionalText(formData.get('company_name')),
    contactPerson: normalizeOptionalText(formData.get('contact_person')),
    email: normalizeOptionalText(formData.get('email')),
    phone: normalizeOptionalText(formData.get('phone')),
    address: normalizeOptionalText(formData.get('address')),
    notes: normalizeOptionalText(formData.get('notes')),
    targetAmount,
    commissionType,
    commissionValue,
  }
}

function revalidateSalesCommissionPages() {
  revalidatePath('/sales')
  revalidatePath('/sales/commission')
  revalidatePath('/sales/quotations')
}

export async function getActiveResellers(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await db
    .from('sales_resellers')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return []
  return (data || []) as SalesResellerRecord[]
}

export async function createReseller(orgId: string, formData: FormData): Promise<ResellerMutationResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseResellerFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await db
    .from('sales_resellers')
    .insert({
      org_id: orgId,
      name: payload.name,
      reseller_type: payload.resellerType,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      target_amount: payload.targetAmount,
      commission_type: payload.commissionType,
      commission_value: payload.commissionValue,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { error: 'Gagal membuat reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true, data: data as SalesResellerRecord }
}

export async function updateReseller(orgId: string, resellerId: string, formData: FormData): Promise<ResellerMutationResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const payload = parseResellerFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await db
    .from('sales_resellers')
    .update({
      name: payload.name,
      reseller_type: payload.resellerType,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      target_amount: payload.targetAmount,
      commission_type: payload.commissionType,
      commission_value: payload.commissionValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resellerId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: 'Gagal memperbarui reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true, data: data as SalesResellerRecord }
}

export async function deleteReseller(orgId: string, resellerId: string): Promise<DeleteResellerResult> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { error } = await db
    .from('sales_resellers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resellerId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: 'Gagal menghapus reseller: ' + error.message }

  revalidateSalesCommissionPages()
  return { success: true }
}

export async function getResellerCommissionSnapshot(orgId: string, resellerId?: string | null): Promise<ResellerSnapshotResult> {
  const normalizedResellerId = String(resellerId || '').trim()
  if (!normalizedResellerId) {
    return {
      success: true,
      resellerId: null,
      resellerName: null,
      commissionType: null,
      commissionValue: null,
    }
  }

  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('sales_resellers')
    .select('id, name, commission_type, commission_value, is_active')
    .eq('org_id', orgId)
    .eq('id', normalizedResellerId)
    .maybeSingle()

  if (error) {
    return { error: 'Gagal membaca data reseller: ' + error.message }
  }

  const reseller = (data as {
    id?: string
    name?: string | null
    commission_type?: string | null
    commission_value?: number | null
    is_active?: boolean | null
  } | null) ?? null

  if (!reseller || reseller.is_active === false) {
    return { error: 'Reseller tidak ditemukan atau sudah nonaktif.' }
  }

  return {
    success: true,
    resellerId: String(reseller.id),
    resellerName: reseller.name ? String(reseller.name) : null,
    commissionType: normalizeCommissionType(reseller.commission_type) || null,
    commissionValue:
      reseller.commission_value === null || reseller.commission_value === undefined
        ? null
        : Number(reseller.commission_value),
  }
}

function normalizeCommissionPeriod(period: string) {
  const normalized = String(period || '').trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : new Date().toISOString().slice(0, 7)
}

/**
 * Komisi cash-basis: PERCENT dihitung dari nominal pembayaran itu sendiri.
 * FIXED (nominal tetap per invoice) baru cair pada pembayaran yang membuat invoice
 * lunas penuh (running_paid >= grand_total), supaya tidak dibayar duluan sebelum invoice lunas.
 */
function computePaymentCommission(
  paymentAmount: number,
  runningPaidAfterThisPayment: number,
  grandTotal: number,
  commissionType: string | null,
  commissionValue: number
) {
  const normalizedType = String(commissionType || '').trim().toUpperCase()
  if (normalizedType === 'FIXED') {
    return runningPaidAfterThisPayment >= grandTotal - 0.01 ? Math.max(0, commissionValue) : 0
  }
  return calculateCommissionAmount(paymentAmount, commissionType, commissionValue)
}

type CommissionPaymentQueryRow = {
  payment_id: string
  payment_number: string
  payment_date: string
  payment_amount: string
  payment_notes: string | null
  sale_id: string
  sale_number: string
  grand_total: string
  commission_type: string | null
  commission_value: string | null
  running_paid: string
  settlement_id: string | null
  settlement_date: string | null
  reference_no: string | null
}

const COMMISSION_PAYMENT_BASE_QUERY = `
  SELECT
    sp.id AS payment_id, sp.payment_number, sp.payment_date, sp.amount AS payment_amount, sp.notes AS payment_notes,
    s.id AS sale_id, s.sale_number, s.grand_total, s.commission_type, s.commission_value,
    SUM(sp.amount) OVER (PARTITION BY sp.sale_id ORDER BY sp.payment_date, sp.id) AS running_paid,
    sci.settlement_id, cs.settlement_date, cs.reference_no
  FROM sales_payments sp
  JOIN sales s ON s.id = sp.sale_id
  LEFT JOIN sales_commission_settlement_items sci ON sci.payment_id = sp.id
  LEFT JOIN sales_commission_settlements cs ON cs.id = sci.settlement_id
  WHERE s.org_id = $1 AND s.reseller_id = $2
`

function mapCommissionPaymentRow(
  row: CommissionPaymentQueryRow,
  defaultCommissionType: string | null,
  defaultCommissionValue: number
): ResellerCommissionPaymentRow {
  const paymentAmount = Number(row.payment_amount || 0)
  const commissionAmount = computePaymentCommission(
    paymentAmount,
    Number(row.running_paid || 0),
    Number(row.grand_total || 0),
    row.commission_type || defaultCommissionType,
    Number(row.commission_value ?? defaultCommissionValue)
  )

  return {
    paymentId: row.payment_id,
    paymentNumber: row.payment_number,
    paymentDate: String(row.payment_date || '').slice(0, 10),
    paymentAmount,
    label: row.payment_notes,
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    commissionAmount,
    settled: Boolean(row.settlement_id),
    settlementDate: row.settlement_date ? String(row.settlement_date).slice(0, 10) : null,
    referenceNo: row.reference_no,
  }
}

/**
 * Daftar pembayaran/termin reseller pada suatu periode (YYYY-MM), lengkap dengan status pencairan komisi.
 * Komisi dihitung cash-basis (dari nominal yang sudah dibayar customer), dihitung ulang server-side.
 */
export async function getResellerCommissionPayments(
  orgId: string,
  resellerId: string,
  period: string
): Promise<ResellerCommissionPaymentRow[] | { error: string }> {
  const normalizedResellerId = String(resellerId || '').trim()
  if (!normalizedResellerId) return { error: 'Reseller tidak valid.' }

  const normalizedPeriod = normalizeCommissionPeriod(period)

  const { rows: resellerRows } = await queryPostgres<{
    commission_type: string | null
    commission_value: string | null
  }>(
    `SELECT commission_type, commission_value FROM sales_resellers WHERE id = $1 AND org_id = $2`,
    [normalizedResellerId, orgId]
  )
  if (!resellerRows.length) return { error: 'Reseller tidak ditemukan.' }
  const defaultCommissionType = resellerRows[0].commission_type
  const defaultCommissionValue = Number(resellerRows[0].commission_value || 0)

  const { rows } = await queryPostgres<CommissionPaymentQueryRow>(
    `${COMMISSION_PAYMENT_BASE_QUERY}
       AND s.status IN ('ORDERED', 'FINISHED')
       AND to_char(sp.payment_date, 'YYYY-MM') = $3
     ORDER BY sp.payment_date ASC, sp.payment_number ASC`,
    [orgId, normalizedResellerId, normalizedPeriod]
  )

  return rows.map((row) => mapCommissionPaymentRow(row, defaultCommissionType, defaultCommissionValue))
}

/**
 * Cairkan komisi untuk pembayaran/termin yang dipilih milik satu reseller.
 * Satu pembayaran hanya boleh dicairkan sekali (dijamin UNIQUE(payment_id) di sales_commission_settlement_items).
 */
export async function settleResellerCommissionPayments(
  orgId: string,
  resellerId: string,
  payload: {
    paymentIds: string[]
    debitAccountId: string
    creditAccountId: string
    paymentMethod?: string
    referenceNo?: string
    notes?: string
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const normalizedResellerId = String(resellerId || '').trim()
  const paymentIds = Array.from(
    new Set((payload.paymentIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  )
  if (!normalizedResellerId) return { error: 'Reseller tidak valid.' }
  if (paymentIds.length === 0) return { error: 'Pilih minimal satu pembayaran yang mau dicairkan komisinya.' }
  if (!payload.debitAccountId || !payload.creditAccountId) {
    return { error: 'Akun beban komisi dan akun kas/bank wajib dipilih.' }
  }

  const { rows: resellerRows } = await queryPostgres<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM sales_resellers WHERE id = $1 AND org_id = $2`,
    [normalizedResellerId, orgId]
  )
  if (!resellerRows.length) return { error: 'Reseller tidak ditemukan.' }
  const defaultCommissionType = null as string | null
  const defaultCommissionValue = 0

  // Ambil SEMUA pembayaran reseller ini (bukan cuma yang dipilih) supaya running_paid akurat
  // untuk perhitungan komisi FIXED (yang baru cair saat invoice lunas penuh).
  const { rows: allPaymentRows } = await queryPostgres<CommissionPaymentQueryRow>(
    `${COMMISSION_PAYMENT_BASE_QUERY} AND s.status IN ('ORDERED', 'FINISHED')`,
    [orgId, normalizedResellerId]
  )

  const selectedRows = allPaymentRows.filter((row) => paymentIds.includes(row.payment_id))
  if (selectedRows.length !== paymentIds.length) {
    return { error: 'Sebagian pembayaran yang dipilih tidak ditemukan atau bukan milik reseller ini.' }
  }
  const alreadySettled = selectedRows.filter((row) => row.settlement_id)
  if (alreadySettled.length > 0) {
    return {
      error: `Pembayaran ${alreadySettled.map((row) => row.payment_number).join(', ')} sudah pernah dicairkan komisinya.`,
    }
  }

  const { rows: saleBranchRows } = await queryPostgres<{ branch_id: string | null }>(
    `SELECT branch_id FROM sales WHERE id = ANY($1::uuid[]) AND branch_id IS NOT NULL LIMIT 1`,
    [selectedRows.map((row) => row.sale_id)]
  )
  const branchId = saleBranchRows[0]?.branch_id || null

  const items = selectedRows.map((row) => ({
    paymentId: row.payment_id,
    saleId: row.sale_id,
    netSalesAmount: Number(row.payment_amount || 0),
    commissionAmount: mapCommissionPaymentRow(row, defaultCommissionType, defaultCommissionValue).commissionAmount,
  }))

  const totalCommissionAmount = items.reduce((sum, item) => sum + item.commissionAmount, 0)
  if (totalCommissionAmount <= 0) {
    return { error: 'Tidak ada komisi valid untuk pembayaran yang dipilih.' }
  }

  const settlementDate = new Date().toISOString().slice(0, 10)
  const closedPeriod = await checkClosedFiscalPeriod(orgId, settlementDate)
  if (closedPeriod) {
    return { error: buildClosedPeriodError('Pencairan komisi', settlementDate, closedPeriod) }
  }

  const { rows: settlementRows } = await queryPostgres<{ id: string }>(
    `INSERT INTO sales_commission_settlements (
       org_id, reseller_id, branch_id, settlement_date, total_commission_amount,
       payment_method, reference_no, debit_account_id, credit_account_id, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      orgId,
      normalizedResellerId,
      branchId,
      settlementDate,
      totalCommissionAmount,
      payload.paymentMethod || null,
      payload.referenceNo || null,
      payload.debitAccountId,
      payload.creditAccountId,
      payload.notes || null,
      user.id,
    ]
  )
  const settlementId = settlementRows[0]?.id
  if (!settlementId) return { error: 'Gagal membuat catatan pencairan komisi.' }

  try {
    for (const item of items) {
      await queryPostgres(
        `INSERT INTO sales_commission_settlement_items (settlement_id, sale_id, payment_id, commission_amount, net_sales_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [settlementId, item.saleId, item.paymentId, item.commissionAmount, item.netSalesAmount]
      )
    }
  } catch (e: any) {
    await queryPostgres(`DELETE FROM sales_commission_settlements WHERE id = $1`, [settlementId])
    return { error: 'Gagal mencatat pembayaran yang dicairkan (mungkin sudah dicairkan lebih dulu): ' + e.message }
  }

  const reseller = await queryPostgres<{ name: string }>(`SELECT name FROM sales_resellers WHERE id = $1`, [
    normalizedResellerId,
  ])
  const resellerName = reseller.rows[0]?.name || 'Reseller'
  const description = `Pencairan Komisi ${resellerName} (${items.length} pembayaran)`

  const journalResult = await ERPBridge.recordExpense({
    orgId,
    branchId: branchId || undefined,
    amount: totalCommissionAmount,
    date: settlementDate,
    description,
    referenceType: 'SALES_COMMISSION_SETTLEMENT',
    referenceId: settlementId,
    debitAccountId: payload.debitAccountId,
    creditAccountId: payload.creditAccountId,
  })

  if ('error' in journalResult || !('entryId' in journalResult) || !journalResult.entryId) {
    await queryPostgres(`DELETE FROM sales_commission_settlements WHERE id = $1`, [settlementId])
    const journalError = 'error' in journalResult ? journalResult.error : 'Jurnal pencairan komisi tidak berhasil dibuat.'
    return { error: 'Gagal mencatat jurnal pencairan komisi: ' + journalError }
  }

  await queryPostgres(`UPDATE sales_commission_settlements SET journal_entry_id = $1 WHERE id = $2`, [
    journalResult.entryId,
    settlementId,
  ])

  try {
    const { rows: bankAccountRows } = await queryPostgres<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE org_id = $1 AND account_id = $2 AND is_active = TRUE LIMIT 1`,
      [orgId, payload.creditAccountId]
    )
    const bankAccountId = bankAccountRows[0]?.id
    if (bankAccountId) {
      // status RECONCILED supaya trigger auto-journal bank_transactions tidak aktif
      // (jurnal pencairan komisi sudah dibuat manual di atas via ERPBridge.recordExpense).
      await queryPostgres(
        `INSERT INTO bank_transactions (org_id, bank_account_id, transaction_date, description, amount, type, category_id, journal_entry_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'OUT', $6, $7, 'RECONCILED', $8)`,
        [
          orgId,
          bankAccountId,
          settlementDate,
          description,
          totalCommissionAmount,
          payload.debitAccountId,
          journalResult.entryId,
          user.id,
        ]
      )
    }
  } catch {
    // bank_transactions tidak wajib; jurnal sudah tercatat sebagai sumber kebenaran utama
  }

  revalidateSalesCommissionPages()
  return {
    success: true,
    settlementId,
    totalCommissionAmount,
    entryNumber: journalResult.entryNumber || null,
  }
}

/**
 * Riwayat pencairan komisi yang sudah pernah dilakukan untuk satu reseller.
 */
export async function getResellerCommissionSettlementHistory(
  orgId: string,
  resellerId: string
): Promise<ResellerCommissionSettlementHistoryRow[]> {
  const normalizedResellerId = String(resellerId || '').trim()
  if (!normalizedResellerId) return []

  const { rows } = await queryPostgres<{
    id: string
    settlement_date: string
    total_commission_amount: string
    payment_method: string | null
    reference_no: string | null
    payment_count: string
    entry_number: string | null
  }>(
    `SELECT
       cs.id, cs.settlement_date, cs.total_commission_amount, cs.payment_method, cs.reference_no,
       COUNT(sci.id) AS payment_count,
       je.entry_number
     FROM sales_commission_settlements cs
     LEFT JOIN sales_commission_settlement_items sci ON sci.settlement_id = cs.id
     LEFT JOIN journal_entries je ON je.id = cs.journal_entry_id
     WHERE cs.org_id = $1 AND cs.reseller_id = $2
     GROUP BY cs.id, je.entry_number
     ORDER BY cs.settlement_date DESC, cs.created_at DESC`,
    [orgId, normalizedResellerId]
  )

  return rows.map((row) => ({
    id: row.id,
    settlementDate: String(row.settlement_date || '').slice(0, 10),
    totalCommissionAmount: Number(row.total_commission_amount || 0),
    paymentMethod: row.payment_method,
    referenceNo: row.reference_no,
    paymentCount: Number(row.payment_count || 0),
    entryNumber: row.entry_number,
  }))
}
