'use server'

import { revalidatePath } from 'next/cache'
import { generateSlug } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { syncParentAccountToDescendants } from '@/modules/accounting/actions/coa.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { AccountType, CashFlowCategory, Database, NormalBalance } from '@/types/database.types'

type ParsedMigrationRow = {
  rowNumber: number
  values: Record<string, string>
}

type EntityImportSummary = {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

type CoaImportSummary = {
  created: number
  updated: number
  skipped: number
  headerRows: number
  detailRows: number
  errors: string[]
}

type OpeningStockImportSummary = {
  created: number
  skipped: number
  totalQuantity: number
  totalValue: number
  errors: string[]
}

export type MasterDataImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      ignored: {
        coaMappingRows: number
      }
      summaries: {
        customers: EntityImportSummary
        suppliers: EntityImportSummary
        products: EntityImportSummary
        warehouses: EntityImportSummary
      }
    }

export type CoaImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: CoaImportSummary
      metadata: {
        syncedAccounts: number
      }
    }

type CoaImportPayload = {
  coaRows: ParsedMigrationRow[]
}

type MasterDataImportPayload = {
  coaMappingRows: ParsedMigrationRow[]
  customers: ParsedMigrationRow[]
  suppliers: ParsedMigrationRow[]
  products: ParsedMigrationRow[]
  warehouses: ParsedMigrationRow[]
}

type OpeningStockImportPayload = {
  openingStockRows: ParsedMigrationRow[]
}

type OpeningArImportPayload = {
  openingArRows: ParsedMigrationRow[]
}

type OpeningApImportPayload = {
  openingApRows: ParsedMigrationRow[]
}

type OpeningCashBankImportPayload = {
  openingCashBankRows: ParsedMigrationRow[]
}

type FixedAssetsImportPayload = {
  fixedAssetRows: ParsedMigrationRow[]
}

type ManufacturingImportPayload = {
  bomRows: ParsedMigrationRow[]
}

type EmployeesImportPayload = {
  employeeRows: ParsedMigrationRow[]
}

type ExistingContactRecord = {
  id: string
  name: string
  type: string
}

type ExistingProductRecord = {
  id: string
  sku: string | null
}

type ExistingWarehouseRecord = {
  id: string
  code: string
  name: string
}

type ExistingBranchRecord = {
  id: string
  name: string
  code: string
}

type ExistingBankAccountImportRecord = {
  id: string
  account_id: string
  branch_id: string
  bank_name: string
  account_number: string | null
}

type ExistingBankTransactionImportRecord = {
  id: string
  bank_account_id: string
  description: string | null
}

type ExistingFixedAssetImportRecord = {
  id: string
  code: string
  name: string
}

type ExistingBomImportRecord = {
  id: string
  code: string
}

type ExistingEmployeeImportRecord = {
  id: string
  nik: string
}

type ExistingStockRecord = {
  id: string
  product_id: string
  warehouse_id: string
  batch_number: string | null
  quantity: number
}

type ExistingMovementRecord = {
  product_id: string
}

type ExistingProductImportRecord = Pick<
  Database['public']['Tables']['products']['Row'],
  'id' | 'sku' | 'name' | 'type' | 'purchase_price' | 'selling_price' | 'asset_account_id'
> & {
  category: string
}

type ExistingWarehouseImportRecord = Pick<
  Database['public']['Tables']['warehouses']['Row'],
  'id' | 'code' | 'name' | 'branch_id' | 'is_active'
>

type ExistingAccountRecord = Pick<
  Database['public']['Tables']['accounts']['Row'],
  'id' | 'code' | 'name' | 'type'
>

type ExistingCoaImportRecord = Pick<
  Database['public']['Tables']['accounts']['Row'],
  'id' | 'code' | 'name' | 'type' | 'normal_balance' | 'parent_id' | 'description' | 'cash_flow_category' | 'is_system' | 'is_active'
>

type OpeningStockResolvedRow = {
  rowNumber: number
  productId: string
  productName: string
  sku: string
  warehouseId: string
  warehouseName: string
  branchId: string | null
  quantity: number
  unitCost: number
  totalValue: number
  batchNumber: string | null
}

type OpeningStockRollbackInstruction = {
  stockId: string
  previousQuantity: number
  deleteIfCreated: boolean
}

export type OpeningStockImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: OpeningStockImportSummary
      metadata: {
        movementDate: string
        journalEntriesCreated: number
      }
    }

type OpeningArImportSummary = {
  created: number
  skipped: number
  totalOutstanding: number
  errors: string[]
}

export type OpeningArImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: OpeningArImportSummary
      metadata: {
        journalEntriesCreated: number
        journalDate: string
      }
    }

type OpeningApImportSummary = {
  created: number
  skipped: number
  totalOutstanding: number
  errors: string[]
}

type OpeningCashBankImportSummary = {
  created: number
  skipped: number
  totalBalance: number
  bankAccountsCreated: number
  errors: string[]
}

type FixedAssetsImportSummary = {
  created: number
  skipped: number
  totalAcquisitionCost: number
  totalBookValue: number
  errors: string[]
}

type ManufacturingImportSummary = {
  created: number
  skipped: number
  componentLinesCreated: number
  errors: string[]
}

type EmployeesImportSummary = {
  created: number
  skipped: number
  totalBasicSalary: number
  errors: string[]
}

export type OpeningApImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: OpeningApImportSummary
      metadata: {
        journalEntriesCreated: number
        journalDate: string
      }
    }

export type OpeningCashBankImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: OpeningCashBankImportSummary
      metadata: {
        journalEntriesCreated: number
        journalDate: string
      }
    }

export type FixedAssetsImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: FixedAssetsImportSummary
      metadata: {
        journalEntriesCreated: number
        journalDate: string
      }
    }

export type ManufacturingImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: ManufacturingImportSummary
      metadata: {
        bomsCreated: number
      }
    }

export type EmployeesImportResult =
  | {
      success: false
      error: string
    }
  | {
      success: true
      hasErrors: boolean
      message: string
      warnings: string[]
      summary: EmployeesImportSummary
      metadata: {
        assignedBranchId: string | null
      }
    }

function normalizeLookup(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function normalizeCode(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Normalizes various date formats to YYYY-MM-DD.
// Handles: Date object, Excel serial number, DD/MM/YYYY, D/M/YYYY, YYYY/MM/DD, DD-MM-YYYY.
function normalizeDate(value: unknown, fallback: string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && value > 0) {
    // Excel serial date: days since 1900-01-00 (with leap year bug)
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString().slice(0, 10)
  }
  const s = String(value || '').trim()
  if (!s) return fallback
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
  // DD/MM/YYYY or D/M/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // DD-MM-YYYY
  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2].padStart(2, '0')}-${dmyDash[1].padStart(2, '0')}`
  return fallback
}

function parseBoolean(value: string | null | undefined, fallback = true) {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized) return fallback
  return normalized === 'TRUE'
}

function parseNumber(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function composeAddress(address?: string | null, city?: string | null) {
  const trimmedAddress = String(address || '').trim()
  const trimmedCity = String(city || '').trim()

  if (trimmedAddress && trimmedCity) {
    return trimmedAddress.toLowerCase().includes(trimmedCity.toLowerCase())
      ? trimmedAddress
      : `${trimmedAddress}, ${trimmedCity}`
  }

  return trimmedAddress || trimmedCity || null
}

function splitEmployeeName(fullName: string) {
  const trimmed = String(fullName || '').trim()
  if (!trimmed) {
    return {
      firstName: '',
      lastName: '',
    }
  }

  const parts = trimmed.split(/\s+/)
  return {
    firstName: parts[0] || trimmed,
    lastName: parts.slice(1).join(' '),
  }
}

function mapEmploymentStatus(value: string, isActive: boolean) {
  if (!isActive) return 'RESIGNED'

  const normalized = normalizeLookup(value)
  if (normalized === 'tetap') return 'FULL_TIME'
  if (normalized === 'kontrak') return 'CONTRACT'
  if (normalized === 'magang') return 'INTERN'
  if (normalized === 'freelance') return 'CONTRACT'
  return 'FULL_TIME'
}

function buildUniqueImportCode(
  desiredCode: string,
  name: string,
  prefix: string,
  reservedCodes: Set<string>,
  rowNumber: number
) {
  const normalizedDesired = normalizeCode(desiredCode)
  let baseCode = normalizedDesired

  if (!baseCode) {
    const fallbackSlug = generateSlug(name).replace(/-/g, '').toUpperCase()
    baseCode = `${prefix}-${fallbackSlug.slice(0, 10) || String(rowNumber).padStart(4, '0')}`
  }

  let candidate = baseCode
  let suffix = 2
  while (reservedCodes.has(candidate)) {
    const suffixText = `-${suffix}`
    candidate = `${baseCode.slice(0, Math.max(1, 24 - suffixText.length))}${suffixText}`
    suffix += 1
  }

  reservedCodes.add(candidate)
  return candidate
}

function buildWarehouseCode(
  desiredCode: string,
  warehouseName: string,
  reservedCodes: Set<string>
) {
  const normalizedDesired = normalizeCode(desiredCode)
  let baseCode = normalizedDesired

  if (!baseCode) {
    const fallbackSlug = generateSlug(warehouseName).replace(/-/g, '').toUpperCase()
    baseCode = `WH-${fallbackSlug.slice(0, 10) || 'AUTO'}`
  }

  let candidate = baseCode
  let suffix = 2
  while (reservedCodes.has(candidate)) {
    const suffixText = `-${suffix}`
    candidate = `${baseCode.slice(0, Math.max(1, 24 - suffixText.length))}${suffixText}`
    suffix += 1
  }

  reservedCodes.add(candidate)
  return candidate
}

function createSummary(): EntityImportSummary {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }
}

function createCoaSummary(): CoaImportSummary {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    headerRows: 0,
    detailRows: 0,
    errors: [],
  }
}

function createOpeningStockSummary(): OpeningStockImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalQuantity: 0,
    totalValue: 0,
    errors: [],
  }
}

function createOpeningArSummary(): OpeningArImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalOutstanding: 0,
    errors: [],
  }
}

function createOpeningApSummary(): OpeningApImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalOutstanding: 0,
    errors: [],
  }
}

function createOpeningCashBankSummary(): OpeningCashBankImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalBalance: 0,
    bankAccountsCreated: 0,
    errors: [],
  }
}

function createFixedAssetsSummary(): FixedAssetsImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalAcquisitionCost: 0,
    totalBookValue: 0,
    errors: [],
  }
}

function createManufacturingSummary(): ManufacturingImportSummary {
  return {
    created: 0,
    skipped: 0,
    componentLinesCreated: 0,
    errors: [],
  }
}

function createEmployeesSummary(): EmployeesImportSummary {
  return {
    created: 0,
    skipped: 0,
    totalBasicSalary: 0,
    errors: [],
  }
}

function resolveCoaAccountType(value: string) {
  const mapping: Record<string, AccountType> = {
    aset: 'ASSET',
    liabilitas: 'LIABILITY',
    hutang: 'LIABILITY',
    kewajiban: 'LIABILITY',
    ekuitas: 'EQUITY',
    modal: 'EQUITY',
    pendapatan: 'REVENUE',
    pemasukan: 'REVENUE',
    penjualan: 'REVENUE',
    income: 'REVENUE',
    hpp: 'EXPENSE',
    beban: 'EXPENSE',
    'beban operasional': 'EXPENSE',
    'beban lainnya': 'EXPENSE',
    biaya: 'EXPENSE',
  }

  return mapping[normalizeLookup(value)] || null
}

function resolveCoaNormalBalance(value: string): NormalBalance | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'DEBIT' || normalized === 'CREDIT') return normalized
  return null
}

function resolveCoaCashFlowCategory(value: string): CashFlowCategory | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'OPERATING' || normalized === 'INVESTING' || normalized === 'FINANCING') return normalized
  return null
}

function buildOpeningStockKey(productId: string, warehouseId: string, batchNumber?: string | null) {
  return `${productId}::${warehouseId}::${String(batchNumber || '').trim().toUpperCase()}`
}

function revalidateMigrationImportTargets() {
  revalidatePath('/contacts')
  revalidatePath('/sales')
  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  revalidatePath('/inventory/warehouses')
  revalidatePath('/accounting/assets')
  revalidatePath('/factory')
  revalidatePath('/hris')
  revalidatePath('/cash')
  revalidatePath('/settings/accounts')
  revalidatePath('/settings/business')
  revalidatePath('/settings/business/migration')
}

const OPENING_STOCK_IMPORT_TAG = '[AUTO_MIGRATION_OPENING_STOCK]'
const OPENING_AR_IMPORT_TAG = '[AUTO_MIGRATION_OPENING_AR]'
const OPENING_AP_IMPORT_TAG = '[AUTO_MIGRATION_OPENING_AP]'
const OPENING_CASH_BANK_IMPORT_TAG = '[AUTO_MIGRATION_OPENING_CASH_BANK]'
const FIXED_ASSETS_IMPORT_TAG = '[AUTO_MIGRATION_FIXED_ASSETS]'
const MANUFACTURING_IMPORT_TAG = '[AUTO_MIGRATION_BOM]'

export async function importCoaMigration(
  payload: CoaImportPayload
): Promise<CoaImportResult> {
  try {
    const orgData = await getActiveOrg()
    if (!orgData?.org?.id) {
      return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
    }

    if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
      return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi Chart of Accounts.' }
    }

    if (payload.coaRows.length === 0) {
      return { success: false, error: 'Sheet coa belum berisi data untuk dimigrasikan.' }
    }

    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return { success: false, error: 'Sesi login tidak ditemukan.' }
    }

    const orgId = orgData.org.id
    const warnings = new Set<string>([
      'Kolom sub_kategori dan tipe_akun dipakai untuk validasi struktur workbook. Saat ini kolom tersebut belum disimpan sebagai field terpisah di tabel akun.',
      'Akun sistem existing tetap dijaga pada tipe dan saldo normal aslinya. Jika workbook mencoba mengubah keduanya, baris terkait akan dilewati.',
    ])
    const syncWarnings = new Set<string>()
    const summary = createCoaSummary()

    const { data: canManage, error: permissionError } = await supabase
      .rpc('can_manage_finance_master', { p_org_id: orgId })

    if (permissionError || !canManage) {
      return {
        success: false,
        error:
          'Hanya Organisasi Utama (Parent/Holding) pada konteks Unit Utama yang dapat mengimpor rekening CoA langsung. Silakan gunakan unit parent atau ajukan melalui proses pengajuan rekening.',
      }
    }

    const { data: existingAccountRows, error: accountsError } = await supabase
      .from('accounts')
      .select('id, code, name, type, normal_balance, parent_id, description, cash_flow_category, is_system, is_active')
      .eq('org_id', orgId)

    if (accountsError) {
      return { success: false, error: 'Gagal membaca akun existing sebelum migrasi CoA dijalankan.' }
    }

    const accountByCode = new Map<string, ExistingCoaImportRecord>()
    for (const account of (existingAccountRows || []) as ExistingCoaImportRecord[]) {
      const codeKey = normalizeCode(account.code)
      if (!codeKey || accountByCode.has(codeKey)) continue
      accountByCode.set(codeKey, account)
    }

    const sortedRows = [...payload.coaRows].sort((left, right) => {
      const leftLevel = Number.parseInt(String(left.values.level || '').trim(), 10)
      const rightLevel = Number.parseInt(String(right.values.level || '').trim(), 10)
      const safeLeftLevel = Number.isFinite(leftLevel) && leftLevel > 0 ? leftLevel : Number.MAX_SAFE_INTEGER
      const safeRightLevel = Number.isFinite(rightLevel) && rightLevel > 0 ? rightLevel : Number.MAX_SAFE_INTEGER

      if (safeLeftLevel !== safeRightLevel) return safeLeftLevel - safeRightLevel
      return left.rowNumber - right.rowNumber
    })

    for (const row of sortedRows) {
      const code = normalizeCode(row.values.kode_akun)
      const name = String(row.values.nama_akun || '').trim()
      const categoryLabel = String(row.values.kategori_utama || '').trim()
      const parentCode = normalizeCode(row.values.parent_kode)
      const rowType = String(row.values.tipe_akun || '').trim().toUpperCase()
      const level = Number.parseInt(String(row.values.level || '').trim(), 10)
      const description = String(row.values.deskripsi || '').trim() || null
      const accountType = resolveCoaAccountType(categoryLabel)
      const normalBalance = resolveCoaNormalBalance(row.values.saldo_normal)
      const cashFlowCategory = resolveCoaCashFlowCategory(row.values.arus_kas)
      const isActive = parseBoolean(row.values.aktif, true)

      if (!code || !name || !accountType || !normalBalance || !Number.isFinite(level) || level < 1) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: data akun belum lengkap atau format dasar belum valid.`)
        continue
      }

      if (!['HEADER', 'DETAIL'].includes(rowType)) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: tipe_akun harus HEADER atau DETAIL.`)
        continue
      }

      if (level === 1 && parentCode) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: akun level 1 tidak boleh memiliki parent_kode.`)
        continue
      }

      if (level > 1 && !parentCode) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: akun level ${level} wajib memiliki parent_kode.`)
        continue
      }

      if (parentCode && parentCode === code) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: parent_kode tidak boleh sama dengan kode_akun.`)
        continue
      }

      const parentAccount = parentCode ? accountByCode.get(parentCode) || null : null
      if (parentCode && !parentAccount?.id) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: parent_kode ${parentCode} belum ditemukan di sistem atau di baris level sebelumnya.`)
        continue
      }

      if (parentAccount && parentAccount.type !== accountType) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: kategori_utama akun anak harus sama dengan tipe akun parent ${parentCode}.`)
        continue
      }

      const existingAccount = accountByCode.get(code)

      if (existingAccount?.id) {
        if (existingAccount.is_system && (existingAccount.type !== accountType || existingAccount.normal_balance !== normalBalance)) {
          summary.skipped += 1
          summary.errors.push(
            `Baris ${row.rowNumber}: akun sistem ${code} tidak boleh mengubah kategori_utama atau saldo_normal dari struktur bawaan NIZAM.`
          )
          continue
        }

        if (existingAccount.is_system && !isActive) {
          warnings.add(`Akun sistem seperti ${code} akan tetap aktif walaupun kolom aktif diisi FALSE.`)
        }

        const updatePayload: Database['public']['Tables']['accounts']['Update'] = existingAccount.is_system
          ? {
              name,
              parent_id: parentAccount?.id || null,
              description,
              cash_flow_category: cashFlowCategory,
              is_active: existingAccount.is_active,
            }
          : {
              name,
              type: accountType,
              normal_balance: normalBalance,
              parent_id: parentAccount?.id || null,
              description,
              cash_flow_category: cashFlowCategory,
              is_active: isActive,
            }

        const { data: updatedAccount, error: updateError } = await supabase
          .from('accounts')
          .update(updatePayload)
          .eq('id', existingAccount.id)
          .eq('org_id', orgId)
          .select('id, code, name, type, normal_balance, parent_id, description, cash_flow_category, is_system, is_active')
          .single()

        if (updateError || !updatedAccount?.id) {
          summary.skipped += 1
          summary.errors.push(`Baris ${row.rowNumber}: gagal memperbarui akun ${code}.`)
          continue
        }

        const savedAccount = updatedAccount as ExistingCoaImportRecord
        accountByCode.set(code, savedAccount)
        summary.updated += 1
        if (rowType === 'HEADER') summary.headerRows += 1
        if (rowType === 'DETAIL') summary.detailRows += 1

        try {
          const syncResult = await syncParentAccountToDescendants(orgId, savedAccount, {
            previousCode: existingAccount.code,
          })
          if (!syncResult.success) {
            syncWarnings.add('Sebagian akun parent berhasil diperbarui, tetapi sinkronisasi ke unit turunan belum sepenuhnya selesai.')
            console.warn('CoA sync warning (importCoaMigration:update):', syncResult.errors)
          }
        } catch (error) {
          syncWarnings.add('Sebagian akun parent berhasil diperbarui, tetapi sinkronisasi ke unit turunan gagal dijalankan di server.')
          console.error('CoA sync exception (importCoaMigration:update):', error)
        }
        continue
      }

      const { data: insertedAccount, error: insertError } = await supabase
        .from('accounts')
        .insert({
          org_id: orgId,
          code,
          name,
          type: accountType,
          normal_balance: normalBalance,
          parent_id: parentAccount?.id || null,
          description,
          cash_flow_category: cashFlowCategory,
          is_system: false,
          is_active: isActive,
        })
        .select('id, code, name, type, normal_balance, parent_id, description, cash_flow_category, is_system, is_active')
        .single()

      if (insertError || !insertedAccount?.id) {
        summary.skipped += 1
        summary.errors.push(
          insertError?.code === '23505'
            ? `Baris ${row.rowNumber}: kode akun ${code} sudah digunakan.`
            : `Baris ${row.rowNumber}: gagal membuat akun ${code}.`
        )
        continue
      }

      const savedAccount = insertedAccount as ExistingCoaImportRecord
      accountByCode.set(code, savedAccount)
      summary.created += 1
      if (rowType === 'HEADER') summary.headerRows += 1
      if (rowType === 'DETAIL') summary.detailRows += 1

      try {
        const syncResult = await syncParentAccountToDescendants(orgId, savedAccount)
        if (!syncResult.success) {
          syncWarnings.add('Sebagian akun parent berhasil dibuat, tetapi sinkronisasi ke unit turunan belum sepenuhnya selesai.')
          console.warn('CoA sync warning (importCoaMigration:create):', syncResult.errors)
        }
      } catch (error) {
        syncWarnings.add('Sebagian akun parent berhasil dibuat, tetapi sinkronisasi ke unit turunan gagal dijalankan di server.')
        console.error('CoA sync exception (importCoaMigration:create):', error)
      }
    }

    syncWarnings.forEach((warning) => warnings.add(warning))

    revalidatePath('/settings/accounts')
    revalidateMigrationImportTargets()

    return {
      success: true,
      hasErrors: summary.errors.length > 0,
      message: summary.errors.length > 0
        ? 'Migrasi Chart of Accounts selesai dengan beberapa baris yang dilewati.'
        : 'Chart of Accounts berhasil dimigrasikan ke sistem.',
      warnings: Array.from(warnings),
      summary,
      metadata: {
        syncedAccounts: summary.created + summary.updated,
      },
    }
  } catch (error) {
    console.error('importCoaMigration failed unexpectedly:', error)
    return {
      success: false,
      error: error instanceof Error
        ? `Migrasi Chart of Accounts gagal dijalankan: ${error.message}`
        : 'Migrasi Chart of Accounts gagal dijalankan karena terjadi error di server.',
    }
  }
}

export async function importMasterDataMigration(
  payload: MasterDataImportPayload
): Promise<MasterDataImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi master data.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const warnings: string[] = []
  const customerSummary = createSummary()
  const supplierSummary = createSummary()
  const productSummary = createSummary()
  const warehouseSummary = createSummary()

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  const fallbackBranchId = 'error' in branchSelection ? null : branchSelection.branchId

  const [
    { data: existingContactsData, error: contactsError },
    { data: existingProductsData, error: productsError },
    { data: existingWarehousesData, error: warehousesError },
    { data: existingBranchesData, error: branchesError },
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('org_id', orgId),
    supabase
      .from('products')
      .select('id, sku')
      .eq('org_id', orgId),
    supabase
      .from('warehouses')
      .select('id, code, name')
      .eq('org_id', orgId),
    supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true),
  ])

  if (contactsError || productsError || warehousesError || branchesError) {
    return { success: false, error: 'Gagal membaca master data existing sebelum migrasi dijalankan.' }
  }

  const existingContacts = (existingContactsData || []) as ExistingContactRecord[]
  const existingProducts = (existingProductsData || []) as ExistingProductRecord[]
  const existingWarehouses = (existingWarehousesData || []) as ExistingWarehouseRecord[]
  const existingBranches = (existingBranchesData || []) as ExistingBranchRecord[]

  const customerByName = new Map<string, ExistingContactRecord>()
  const supplierByName = new Map<string, ExistingContactRecord>()
  existingContacts.forEach((contact) => {
    const key = normalizeLookup(contact.name)
    if (!key) return
    if (contact.type === 'CUSTOMER' && !customerByName.has(key)) customerByName.set(key, contact)
    if (contact.type === 'SUPPLIER' && !supplierByName.has(key)) supplierByName.set(key, contact)
  })

  const productBySku = new Map<string, ExistingProductRecord>()
  existingProducts.forEach((product) => {
    const key = normalizeCode(product.sku)
    if (!key || productBySku.has(key)) return
    productBySku.set(key, product)
  })

  const warehouseByCode = new Map<string, ExistingWarehouseRecord>()
  const warehouseByName = new Map<string, ExistingWarehouseRecord>()
  const reservedWarehouseCodes = new Set<string>()
  existingWarehouses.forEach((warehouse) => {
    const codeKey = normalizeCode(warehouse.code)
    const nameKey = normalizeLookup(warehouse.name)
    if (codeKey) {
      warehouseByCode.set(codeKey, warehouse)
      reservedWarehouseCodes.add(codeKey)
    }
    if (nameKey && !warehouseByName.has(nameKey)) warehouseByName.set(nameKey, warehouse)
  })

  const branchByLookup = new Map<string, ExistingBranchRecord>()
  existingBranches.forEach((branch) => {
    const nameKey = normalizeLookup(branch.name)
    const codeKey = normalizeLookup(branch.code)
    if (nameKey) branchByLookup.set(nameKey, branch)
    if (codeKey) branchByLookup.set(codeKey, branch)
  })

  const upsertContactRows = async (
    rows: ParsedMigrationRow[],
    type: 'CUSTOMER' | 'SUPPLIER',
    summary: EntityImportSummary,
    existingMap: Map<string, ExistingContactRecord>
  ) => {
    for (const row of rows) {
      const name = String(row.values[`${type === 'CUSTOMER' ? 'customer' : 'supplier'}_name`] || '').trim()
      if (!name) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: nama ${type === 'CUSTOMER' ? 'customer' : 'supplier'} kosong.`)
        continue
      }

      const lookupKey = normalizeLookup(name)
      const payloadToSave = {
        org_id: orgId,
        name,
        type,
        email: String(row.values.email || '').trim() || null,
        phone: String(row.values.phone || '').trim() || null,
        address: composeAddress(row.values.address, row.values.city),
        phone_wa: String(row.values.phone || '').trim() || null,
        is_active: parseBoolean(row.values.is_active, true),
      }

      const existing = existingMap.get(lookupKey)

      if (existing?.id) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...payloadToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('org_id', orgId)

        if (error) {
          summary.skipped += 1
          summary.errors.push(`Baris ${row.rowNumber}: gagal update ${type === 'CUSTOMER' ? 'customer' : 'supplier'} ${name}.`)
        } else {
          summary.updated += 1
        }
        continue
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert(payloadToSave)
        .select('id, name, type')
        .single()

      if (error || !data?.id) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: gagal membuat ${type === 'CUSTOMER' ? 'customer' : 'supplier'} ${name}.`)
      } else {
        summary.created += 1
        existingMap.set(lookupKey, data as ExistingContactRecord)
      }
    }
  }

  await upsertContactRows(payload.customers, 'CUSTOMER', customerSummary, customerByName)
  await upsertContactRows(payload.suppliers, 'SUPPLIER', supplierSummary, supplierByName)

  for (const row of payload.products) {
    const sku = normalizeCode(row.values.sku)
    const name = String(row.values.product_name || '').trim()
    const rawType = String(row.values.type || '').trim().toUpperCase()

    if (!sku || !name || !['INVENTORY', 'SERVICE'].includes(rawType)) {
      productSummary.skipped += 1
      productSummary.errors.push(`Baris ${row.rowNumber}: data produk tidak lengkap atau tipe tidak valid.`)
      continue
    }

    const payloadToSave = {
      org_id: orgId,
      sku,
      name,
      type: rawType,
      category: String(row.values.category || '').trim() || (rawType === 'SERVICE' ? 'Layanan' : 'Bahan'),
      unit: String(row.values.unit || '').trim() || 'Pcs',
      purchase_price: parseNumber(row.values.purchase_price),
      selling_price: parseNumber(row.values.selling_price),
      is_active: parseBoolean(row.values.is_active, true),
    }

    const existing = productBySku.get(sku)
    if (existing?.id) {
      const { error } = await supabase
        .from('products')
        .update({
          ...payloadToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('org_id', orgId)

      if (error) {
        productSummary.skipped += 1
        productSummary.errors.push(`Baris ${row.rowNumber}: gagal update produk ${sku}.`)
      } else {
        productSummary.updated += 1
      }
      continue
    }

    const { data, error } = await supabase
      .from('products')
      .insert(payloadToSave)
      .select('id, sku')
      .single()

    if (error || !data?.id) {
      productSummary.skipped += 1
      productSummary.errors.push(`Baris ${row.rowNumber}: gagal membuat produk ${sku}.`)
    } else {
      productSummary.created += 1
      productBySku.set(sku, data as ExistingProductRecord)
    }
  }

  for (const row of payload.warehouses) {
    const name = String(row.values.warehouse_name || '').trim()
    if (!name) {
      warehouseSummary.skipped += 1
      warehouseSummary.errors.push(`Baris ${row.rowNumber}: nama gudang wajib diisi.`)
      continue
    }

    const requestedBranch = normalizeLookup(row.values.branch_name)
    const matchedBranch = requestedBranch ? branchByLookup.get(requestedBranch) : null
    const branchId = matchedBranch?.id || fallbackBranchId || (existingBranches.length === 1 ? existingBranches[0]?.id : null)

    if (!branchId) {
      warehouseSummary.skipped += 1
      warehouseSummary.errors.push(`Baris ${row.rowNumber}: branch_name untuk gudang ${name} tidak dikenali atau belum dipilih.`)
      continue
    }

    const rawCode = String(row.values.warehouse_code || '').trim()
    const existingByName = warehouseByName.get(normalizeLookup(name))
    const finalCode = existingByName?.code
      ? normalizeCode(existingByName.code)
      : buildWarehouseCode(rawCode, name, reservedWarehouseCodes)

    const payloadToSave = {
      org_id: orgId,
      code: finalCode,
      name,
      branch_id: branchId,
      address: String(row.values.address || '').trim() || null,
      is_active: parseBoolean(row.values.is_active, true),
    }

    const existing = warehouseByCode.get(finalCode) || existingByName
    if (existing?.id) {
      const { error } = await supabase
        .from('warehouses')
        .update({
          ...payloadToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('org_id', orgId)

      if (error) {
        warehouseSummary.skipped += 1
        warehouseSummary.errors.push(`Baris ${row.rowNumber}: gagal update gudang ${name}.`)
      } else {
        warehouseSummary.updated += 1
      }
      continue
    }

    const { data, error } = await supabase
      .from('warehouses')
      .insert(payloadToSave)
      .select('id, code, name')
      .single()

    if (error || !data?.id) {
      warehouseSummary.skipped += 1
      warehouseSummary.errors.push(`Baris ${row.rowNumber}: gagal membuat gudang ${name}.`)
    } else {
      warehouseSummary.created += 1
      const savedWarehouse = data as ExistingWarehouseRecord
      warehouseByCode.set(normalizeCode(savedWarehouse.code), savedWarehouse)
      warehouseByName.set(normalizeLookup(savedWarehouse.name), savedWarehouse)
    }
  }

  if (payload.coaMappingRows.length > 0) {
    warnings.push('Sheet coa_mapping tetap dibaca sebagai lampiran mapping legacy. Import akun yang benar-benar menulis ke sistem sekarang dijalankan dari bagian Chart of Accounts / sheet coa.')
  }
  if (payload.customers.length > 0 || payload.suppliers.length > 0) {
    warnings.push('Kolom customer_code, supplier_code, city, payment_term_days, npwp, dan notes pada kontak belum punya field tujuan langsung di master kontak, jadi masih dipakai sebagai referensi file sumber.')
  }
  if (payload.products.length > 0) {
    warnings.push('Kolom warehouse_default pada produk belum dipetakan ke master produk, jadi saat ini hanya dibaca sebagai referensi onboarding.')
  }

  revalidateMigrationImportTargets()

  const hasErrors = [
    customerSummary,
    supplierSummary,
    productSummary,
    warehouseSummary,
  ].some((summary) => summary.errors.length > 0)

  return {
    success: true,
    hasErrors,
    message: hasErrors
      ? 'Migrasi master data selesai dengan beberapa error baris yang perlu dicek.'
      : 'Migrasi master data berhasil dijalankan.',
    warnings,
    ignored: {
      coaMappingRows: payload.coaMappingRows.length,
    },
    summaries: {
      customers: customerSummary,
      suppliers: supplierSummary,
      products: productSummary,
      warehouses: warehouseSummary,
    },
  }
}

export async function importOpeningStockMigration(
  payload: OpeningStockImportPayload
): Promise<OpeningStockImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi opening stock.' }
  }

  if (payload.openingStockRows.length === 0) {
    return { success: false, error: 'Sheet opening_stock belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const warnings: string[] = []
  const summary = createOpeningStockSummary()
  const movementDate = new Date().toISOString().slice(0, 10)

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const effectiveBranchId = branchSelection.branchId

  const { data: priorImportRows, error: priorImportError } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('org_id', orgId)
    .eq('reference_type', 'INITIAL')
    .like('notes', `${OPENING_STOCK_IMPORT_TAG}%`)
    .limit(1)

  if (priorImportError) {
    return { success: false, error: 'Gagal memeriksa histori opening stock sebelumnya.' }
  }

  if ((priorImportRows || []).length > 0) {
    return {
      success: false,
      error: 'Migrasi opening stock otomatis sudah pernah dijalankan sebelumnya. Untuk sementara, import ulang belum diaktifkan agar stok tidak dobel.',
    }
  }

  const [
    { data: productRows, error: productsError },
    { data: warehouseRows, error: warehousesError },
    { data: accountRows, error: accountsError },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name, type, category, purchase_price, selling_price, asset_account_id')
      .eq('org_id', orgId),
    (() => {
      let query = supabase
        .from('warehouses')
        .select('id, code, name, branch_id, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true)

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId)
      }

      return query
    })(),
    supabase
      .from('accounts')
      .select('id, code, type')
      .eq('org_id', orgId),
  ])

  if (productsError || warehousesError || accountsError) {
    return { success: false, error: 'Gagal membaca master produk, gudang, atau akun sebelum import opening stock.' }
  }

  const products = (productRows || []) as ExistingProductImportRecord[]
  const warehouses = (warehouseRows || []) as ExistingWarehouseImportRecord[]
  const accounts = (accountRows || []) as ExistingAccountRecord[]

  const productBySku = new Map<string, ExistingProductImportRecord>()
  const productByName = new Map<string, ExistingProductImportRecord>()
  products.forEach((product) => {
    const skuKey = normalizeCode(product.sku)
    const nameKey = normalizeLookup(product.name)
    if (skuKey && !productBySku.has(skuKey)) productBySku.set(skuKey, product)
    if (nameKey && !productByName.has(nameKey)) productByName.set(nameKey, product)
  })

  const warehouseByCode = new Map<string, ExistingWarehouseImportRecord>()
  const warehouseByName = new Map<string, ExistingWarehouseImportRecord>()
  warehouses.forEach((warehouse) => {
    const codeKey = normalizeCode(warehouse.code)
    const nameKey = normalizeLookup(warehouse.name)
    if (codeKey && !warehouseByCode.has(codeKey)) warehouseByCode.set(codeKey, warehouse)
    if (nameKey && !warehouseByName.has(nameKey)) warehouseByName.set(nameKey, warehouse)
  })

  const capitalAccount =
    accounts.find((account) => account.code === '3001') ||
    [...accounts]
      .filter((account) => account.type === 'EQUITY')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  if (!capitalAccount?.id) {
    return { success: false, error: 'Akun modal/equity tidak ditemukan. Pastikan CoA organisasi sudah lengkap sebelum import opening stock.' }
  }

  if (capitalAccount.code !== '3001') {
    warnings.push(`Akun lawan opening stock memakai fallback akun equity ${capitalAccount.code} karena akun 3001 belum ditemukan.`)
  }

  warnings.push(`Tanggal jurnal dan stock movement opening stock memakai tanggal sistem ${movementDate} karena template belum memiliki kolom tanggal cut-off.`)

  const resolvedRows: OpeningStockResolvedRow[] = []
  const productCostRollup = new Map<string, { totalQty: number; totalValue: number }>()
  const productIds = new Set<string>()
  const warehouseIds = new Set<string>()
  const rowKeys = new Set<string>()

  for (const row of payload.openingStockRows) {
    const skuInput = String(row.values.sku || '').trim()
    const productNameInput = String(row.values.product_name || '').trim()
    const warehouseInput = String(row.values.warehouse_name || '').trim()
    const batchNumber = String(row.values.batch_number || '').trim() || null
    const binName = String(row.values.bin_name || '').trim()
    const rawQty = Number(String(row.values.qty || '').trim())
    const rawUnitCost = String(row.values.unit_cost || '').trim()
    const rawTotalValue = String(row.values.total_value || '').trim()

    if (binName) {
      warnings.push(`Baris ${row.rowNumber}: kolom bin_name saat ini belum dipakai oleh import opening stock, jadi stok masuk ke level gudang tanpa bin.`)
    }

    if (!warehouseInput) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: warehouse_name wajib diisi.`)
      continue
    }

    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: qty harus berupa angka lebih dari 0.`)
      continue
    }

    const product =
      (skuInput ? productBySku.get(normalizeCode(skuInput)) : null) ||
      (productNameInput ? productByName.get(normalizeLookup(productNameInput)) : null)

    if (!product?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: produk tidak ditemukan dari sku/product_name.`)
      continue
    }

    if (product.type !== 'INVENTORY') {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: produk ${product.name} bukan tipe INVENTORY.`)
      continue
    }

    const warehouse =
      warehouseByName.get(normalizeLookup(warehouseInput)) ||
      warehouseByCode.get(normalizeCode(warehouseInput))

    if (!warehouse?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gudang ${warehouseInput} tidak ditemukan atau tidak berada pada scope unit aktif.`)
      continue
    }

    const providedTotalValue = rawTotalValue ? Number(rawTotalValue) : NaN
    const providedUnitCost = rawUnitCost ? Number(rawUnitCost) : NaN
    const totalValue = Number.isFinite(providedTotalValue) && providedTotalValue > 0
      ? Number(providedTotalValue.toFixed(2))
      : Number.isFinite(providedUnitCost) && providedUnitCost >= 0
        ? Number((rawQty * providedUnitCost).toFixed(2))
        : NaN

    if (!Number.isFinite(totalValue) || totalValue < 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: unit_cost atau total_value harus valid agar nilai stok pembuka bisa dihitung.`)
      continue
    }

    if (Number.isFinite(providedUnitCost) && Number.isFinite(providedTotalValue)) {
      const expectedValue = Number((rawQty * providedUnitCost).toFixed(2))
      if (Math.abs(expectedValue - providedTotalValue) > 0.01) {
        warnings.push(`Baris ${row.rowNumber}: total_value berbeda dari qty x unit_cost. Sistem memakai total_value sebagai sumber nilai utama.`)
      }
    }

    const unitCost = rawQty === 0 ? 0 : Number((totalValue / rawQty).toFixed(2))
    const rowKey = buildOpeningStockKey(product.id, warehouse.id, batchNumber)
    if (rowKeys.has(rowKey)) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: kombinasi produk, gudang, dan batch duplikat di sheet opening_stock.`)
      continue
    }
    rowKeys.add(rowKey)

    const resolvedRow: OpeningStockResolvedRow = {
      rowNumber: row.rowNumber,
      productId: product.id,
      productName: product.name,
      sku: product.sku || skuInput || product.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      branchId: warehouse.branch_id,
      quantity: Number(rawQty.toFixed(4)),
      unitCost,
      totalValue,
      batchNumber,
    }

    resolvedRows.push(resolvedRow)
    productIds.add(resolvedRow.productId)
    warehouseIds.add(resolvedRow.warehouseId)

    const currentRollup = productCostRollup.get(resolvedRow.productId) || { totalQty: 0, totalValue: 0 }
    currentRollup.totalQty += resolvedRow.quantity
    currentRollup.totalValue += resolvedRow.totalValue
    productCostRollup.set(resolvedRow.productId, currentRollup)
  }

  if (resolvedRows.length === 0) {
    return {
      success: true,
      hasErrors: true,
      message: 'Tidak ada baris opening stock yang lolos validasi untuk dimigrasikan.',
      warnings,
      summary,
      metadata: {
        movementDate,
        journalEntriesCreated: 0,
      },
    }
  }

  const [
    { data: existingStocksData, error: existingStocksError },
    { data: existingMovementData, error: existingMovementsError },
  ] = await Promise.all([
    supabase
      .from('inventory_stocks')
      .select('id, product_id, warehouse_id, batch_number, quantity')
      .eq('org_id', orgId)
      .in('product_id', [...productIds])
      .in('warehouse_id', [...warehouseIds]),
    supabase
      .from('stock_movements')
      .select('product_id')
      .eq('org_id', orgId)
      .in('product_id', [...productIds]),
  ])

  if (existingStocksError || existingMovementsError) {
    return { success: false, error: 'Gagal memeriksa stok existing sebelum import opening stock dijalankan.' }
  }

  const existingStocks = (existingStocksData || []) as ExistingStockRecord[]
  const existingMovements = (existingMovementData || []) as ExistingMovementRecord[]

  const stockByKey = new Map<string, ExistingStockRecord>()
  existingStocks.forEach((stock) => {
    stockByKey.set(buildOpeningStockKey(stock.product_id, stock.warehouse_id, stock.batch_number), stock)
  })

  const productIdsWithMovements = new Set(existingMovements.map((movement) => movement.product_id))

  const validRows: OpeningStockResolvedRow[] = []
  resolvedRows.forEach((row) => {
    if (productIdsWithMovements.has(row.productId)) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: produk ${row.productName} sudah punya histori stock movement, jadi opening stock tidak boleh ditimpa otomatis.`)
      return
    }

    const existingStock = stockByKey.get(buildOpeningStockKey(row.productId, row.warehouseId, row.batchNumber))
    if (existingStock && Number(existingStock.quantity || 0) !== 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: stok ${row.productName} di gudang ${row.warehouseName} sudah memiliki quantity ${existingStock.quantity}, jadi import diblok agar tidak dobel.`)
      return
    }

    validRows.push(row)
  })

  if (validRows.length === 0) {
    return {
      success: true,
      hasErrors: true,
      message: 'Semua baris opening stock diblokir karena stok atau histori transaksi sudah ada.',
      warnings,
      summary,
      metadata: {
        movementDate,
        journalEntriesCreated: 0,
      },
    }
  }

  const inventoryAccountCache = new Map<string, string>()
  const resolveInventoryAccountId = async (productId: string) => {
    if (inventoryAccountCache.has(productId)) {
      return inventoryAccountCache.get(productId) || null
    }

    const { data, error } = await supabase.rpc('resolve_inventory_asset_account', {
      p_org_id: orgId,
      p_product_id: productId,
      p_fallback_code: '1301',
    })

    if (error || !data) return null
    inventoryAccountCache.set(productId, data as string)
    return data as string
  }

  const rowsByBranch = new Map<string, OpeningStockResolvedRow[]>()
  validRows.forEach((row) => {
    const branchKey = row.branchId || 'NO_BRANCH'
    rowsByBranch.set(branchKey, [...(rowsByBranch.get(branchKey) || []), row])
  })

  const rollbackInstructions: OpeningStockRollbackInstruction[] = []
  const createdJournalIds: string[] = []
  const createdMovementIds: string[] = []
  const weightedCostByProduct = new Map<string, number>()

  productCostRollup.forEach((rollup, productId) => {
    if (rollup.totalQty > 0) {
      weightedCostByProduct.set(productId, Number((rollup.totalValue / rollup.totalQty).toFixed(2)))
    }
  })

  try {
    for (const [branchKey, branchRows] of rowsByBranch.entries()) {
      const branchId = branchKey === 'NO_BRANCH' ? null : branchKey
      const branchTotal = Number(branchRows.reduce((sum, row) => sum + row.totalValue, 0).toFixed(2))
      const journalDescription = branchRows.length === 1
        ? `Saldo Awal Persediaan Migrasi - ${branchRows[0].warehouseName}`
        : 'Saldo Awal Persediaan Migrasi'

      const { data: entry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          org_id: orgId,
          branch_id: branchId,
          entry_date: movementDate,
          description: journalDescription,
          reference_type: 'ADJUSTMENT',
          reference_id: null,
          status: 'DRAFT',
          is_auto: true,
          notes: OPENING_STOCK_IMPORT_TAG,
          created_by: authData.user.id,
        })
        .select('id')
        .single()

      if (journalError || !entry?.id) {
        throw new Error('Gagal membuat journal entry opening stock.')
      }

      createdJournalIds.push(entry.id)

      for (const row of branchRows) {
        const stockKey = buildOpeningStockKey(row.productId, row.warehouseId, row.batchNumber)
        const existingStock = stockByKey.get(stockKey)

        if (existingStock?.id) {
          const { error } = await supabase
            .from('inventory_stocks')
            .update({
              quantity: row.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id)
            .eq('org_id', orgId)

          if (error) {
            throw new Error(`Gagal memperbarui stok fisik untuk ${row.productName}.`)
          }

          rollbackInstructions.push({
            stockId: existingStock.id,
            previousQuantity: Number(existingStock.quantity || 0),
            deleteIfCreated: false,
          })
        } else {
          const { data: insertedStock, error } = await supabase
            .from('inventory_stocks')
            .insert({
              org_id: orgId,
              product_id: row.productId,
              warehouse_id: row.warehouseId,
              quantity: row.quantity,
              batch_number: row.batchNumber,
              expiry_date: null,
            })
            .select('id')
            .single()

          if (error || !insertedStock?.id) {
            throw new Error(`Gagal membuat stok fisik untuk ${row.productName}.`)
          }

          rollbackInstructions.push({
            stockId: insertedStock.id,
            previousQuantity: 0,
            deleteIfCreated: true,
          })
        }

        summary.created += 1
        summary.totalQuantity += row.quantity
        summary.totalValue += row.totalValue
      }

      const { data: insertedMovements, error: movementError } = await supabase
        .from('stock_movements')
        .insert(
          branchRows.map((row) => ({
            org_id: orgId,
            branch_id: branchId,
            product_id: row.productId,
            movement_date: movementDate,
            quantity: row.quantity,
            unit_price: row.unitCost,
            reference_type: 'INITIAL',
            reference_id: entry.id,
            notes: `${OPENING_STOCK_IMPORT_TAG} ${row.sku} @ ${row.warehouseName}${row.batchNumber ? ` [${row.batchNumber}]` : ''}`,
          }))
        )
        .select('id')

      if (movementError) {
        throw new Error('Gagal membuat stock movement opening stock.')
      }

      ;(insertedMovements || []).forEach((movement) => {
        createdMovementIds.push(movement.id)
      })

      const debitByAccount = new Map<string, number>()
      for (const row of branchRows) {
        const inventoryAccountId = await resolveInventoryAccountId(row.productId)
        if (!inventoryAccountId) {
          throw new Error(`Akun persediaan untuk produk ${row.productName} tidak ditemukan.`)
        }
        const nextValue = (debitByAccount.get(inventoryAccountId) || 0) + row.totalValue
        debitByAccount.set(inventoryAccountId, Number(nextValue.toFixed(2)))
      }

      const journalLines: Database['public']['Tables']['journal_lines']['Insert'][] = [
        ...[...debitByAccount.entries()].map(([accountId, debit]) => ({
          entry_id: entry.id,
          account_id: accountId,
          debit,
          credit: 0,
          memo: 'Saldo Awal Persediaan',
        })),
        {
          entry_id: entry.id,
          account_id: capitalAccount.id,
          debit: 0,
          credit: branchTotal,
          memo: 'Modal Awal (Opening Stock)',
        },
      ]

      const { error: lineError } = await supabase.from('journal_lines').insert(journalLines)
      if (lineError) {
        throw new Error('Gagal membuat journal lines opening stock.')
      }

      const { error: postError } = await supabase
        .from('journal_entries')
        .update({ status: 'POSTED' })
        .eq('id', entry.id)
        .eq('org_id', orgId)

      if (postError) {
        throw new Error('Gagal mem-posting journal entry opening stock.')
      }
    }

    for (const [productId, weightedCost] of weightedCostByProduct.entries()) {
      const costUpdate = {
        purchase_price: weightedCost,
        average_cost: weightedCost,
        updated_at: new Date().toISOString(),
      } as Database['public']['Tables']['products']['Update'] & { average_cost?: number }

      await supabase
        .from('products')
        .update(costUpdate as Database['public']['Tables']['products']['Update'])
        .eq('id', productId)
        .eq('org_id', orgId)
    }
  } catch (error) {
    if (createdMovementIds.length > 0) {
      await supabase.from('stock_movements').delete().in('id', createdMovementIds)
    }

    for (const instruction of [...rollbackInstructions].reverse()) {
      if (instruction.deleteIfCreated) {
        await supabase.from('inventory_stocks').delete().eq('id', instruction.stockId).eq('org_id', orgId)
      } else {
        await supabase
          .from('inventory_stocks')
          .update({ quantity: instruction.previousQuantity, updated_at: new Date().toISOString() })
          .eq('id', instruction.stockId)
          .eq('org_id', orgId)
      }
    }

    if (createdJournalIds.length > 0) {
      await supabase.from('journal_entries').delete().in('id', createdJournalIds).eq('org_id', orgId)
    }

    const message = error instanceof Error ? error.message : 'Import opening stock gagal dijalankan.'
    return { success: false, error: message }
  }

  if (validRows.length < payload.openingStockRows.length) {
    warnings.push('Sebagian baris opening stock dilewati karena produk sudah punya stok atau histori transaksi. Cek detail error sebelum lanjut ke tahap berikutnya.')
  }

  if (summary.created > 0) {
    warnings.push('Import opening stock saat ini didesain satu kali untuk alasan keamanan. Jika perlu re-import, rollback otomatis belum diaktifkan untuk batch kedua.')
  }

  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Opening stock selesai diimport dengan beberapa baris yang dilewati.'
      : 'Opening stock berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalQuantity: Number(summary.totalQuantity.toFixed(4)),
      totalValue: Number(summary.totalValue.toFixed(2)),
    },
    metadata: {
      movementDate,
      journalEntriesCreated: rowsByBranch.size,
    },
  }
}

export async function importOpeningArMigration(
  payload: OpeningArImportPayload
): Promise<OpeningArImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi opening piutang.' }
  }

  if (payload.openingArRows.length === 0) {
    return { success: false, error: 'Sheet opening_ar belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const summary = createOpeningArSummary()
  const warnings: string[] = []
  const journalDate = new Date().toISOString().slice(0, 10)

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const [
    { data: contactsData, error: contactsError },
    { data: branchesData, error: branchesError },
    { data: accountsData, error: accountsError },
    { data: existingSalesData, error: existingSalesError },
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('org_id', orgId),
    supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabase
      .from('accounts')
      .select('id, code, type')
      .eq('org_id', orgId),
    supabase
      .from('sales')
      .select('id, sale_number')
      .eq('org_id', orgId),
  ])

  if (contactsError || branchesError || accountsError || existingSalesError) {
    return { success: false, error: 'Gagal membaca customer, branch, akun, atau invoice existing sebelum migrasi piutang dijalankan.' }
  }

  const contacts = (contactsData || []) as ExistingContactRecord[]
  const branches = (branchesData || []) as ExistingBranchRecord[]
  const accounts = (accountsData || []) as ExistingAccountRecord[]
  const existingSales = (existingSalesData || []) as Array<{ id: string; sale_number: string }>

  const customerByName = new Map<string, ExistingContactRecord>()
  contacts.forEach((contact) => {
    if (contact.type !== 'CUSTOMER') return
    const key = normalizeLookup(contact.name)
    if (key && !customerByName.has(key)) customerByName.set(key, contact)
  })

  const branchByLookup = new Map<string, ExistingBranchRecord>()
  branches.forEach((branch) => {
    const nameKey = normalizeLookup(branch.name)
    const codeKey = normalizeLookup(branch.code)
    if (nameKey) branchByLookup.set(nameKey, branch)
    if (codeKey) branchByLookup.set(codeKey, branch)
  })

  const existingSaleNumbers = new Set(existingSales.map((sale) => String(sale.sale_number || '').trim().toUpperCase()).filter(Boolean))

  const receivableAccount =
    accounts.find((account) => account.code === '1201') ||
    [...accounts]
      .filter((account) => account.type === 'ASSET')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  const capitalAccount =
    accounts.find((account) => account.code === '3001') ||
    [...accounts]
      .filter((account) => account.type === 'EQUITY')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  if (!receivableAccount?.id) {
    return { success: false, error: 'Akun piutang usaha tidak ditemukan. Pastikan akun 1201 sudah ada sebelum migrasi opening piutang.' }
  }

  if (!capitalAccount?.id) {
    return { success: false, error: 'Akun equity/modal tidak ditemukan. Pastikan akun 3001 atau akun equity lain tersedia sebelum migrasi opening piutang.' }
  }

  if (receivableAccount.code !== '1201') {
    warnings.push(`Akun piutang memakai fallback ${receivableAccount.code} karena akun 1201 belum ditemukan.`)
  }

  if (capitalAccount.code !== '3001') {
    warnings.push(`Akun lawan opening piutang memakai fallback akun equity ${capitalAccount.code} karena akun 3001 belum ditemukan.`)
  }

  warnings.push(`Jurnal opening piutang memakai tanggal sistem ${journalDate}. Tanggal invoice dan due date tetap mengikuti file agar aging akurat.`)

  for (const row of payload.openingArRows) {
    const customerName = String(row.values.customer_name || '').trim()
    const invoiceNumberInput = String(row.values.invoice_number || '').trim()
    const invoiceDate = String(row.values.invoice_date || '').trim() || journalDate
    const dueDate = String(row.values.due_date || '').trim() || invoiceDate
    const branchName = String(row.values.branch_name || '').trim()
    const notes = String(row.values.notes || '').trim()
    const outstandingAmount = Number(String(row.values.outstanding_amount || '').trim())

    if (!customerName) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: customer_name wajib diisi.`)
      continue
    }

    if (!Number.isFinite(outstandingAmount) || outstandingAmount <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: outstanding_amount harus lebih dari 0.`)
      continue
    }

    const customer = customerByName.get(normalizeLookup(customerName))
    if (!customer?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: customer ${customerName} belum ada di master data.`)
      continue
    }

    const branch = branchName ? branchByLookup.get(normalizeLookup(branchName)) || null : null
    const branchId = branch?.id || branchSelection.branchId || (branches.length === 1 ? branches[0]?.id : null)

    if (branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name ${branchName} tidak dikenali.`)
      continue
    }

    if (!branchName && !branchId && branches.length > 1) {
      warnings.push(`Baris ${row.rowNumber}: branch_name kosong pada organisasi multi-unit. Invoice akan disimpan tanpa branch khusus.`)
    }

    const generatedSaleNumber = invoiceNumberInput || `OPEN-AR-${new Date(invoiceDate).toISOString().slice(0, 10).replace(/-/g, '')}-${String(row.rowNumber).padStart(4, '0')}`
    const saleNumber = generatedSaleNumber.trim()

    if (existingSaleNumbers.has(saleNumber.toUpperCase())) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: invoice_number ${saleNumber} sudah ada di sistem.`)
      continue
    }

    const saleNotes = [OPENING_AR_IMPORT_TAG, notes].filter(Boolean).join('\n')

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        sale_number: saleNumber,
        sale_date: invoiceDate,
        due_date: dueDate,
        customer_id: customer.id,
        total_amount: outstandingAmount,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: outstandingAmount,
        status: 'FINISHED',
        payment_status: 'UNPAID',
        payment_term: 'TEMPO',
        shariah_mode: 'CASH',
        notes: saleNotes,
        created_by: authData.user.id,
      })
      .select('id')
      .single()

    if (saleError || !sale?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gagal membuat invoice opening AR ${saleNumber}.`)
      continue
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        entry_date: journalDate,
        description: `Saldo Awal Piutang ${saleNumber}`,
        reference_type: 'SALE',
        reference_id: sale.id,
        status: 'DRAFT',
        is_auto: true,
        notes: OPENING_AR_IMPORT_TAG,
        created_by: authData.user.id,
      })
      .select('id')
      .single()

    if (entryError || !entry?.id) {
      await supabase.from('sales').delete().eq('id', sale.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: invoice ${saleNumber} dibuat, tetapi jurnal pembukanya gagal.`)
      continue
    }

    const { error: lineError } = await supabase.from('journal_lines').insert([
      {
        entry_id: entry.id,
        account_id: receivableAccount.id,
        debit: outstandingAmount,
        credit: 0,
        memo: `Piutang Awal ${saleNumber}`,
      },
      {
        entry_id: entry.id,
        account_id: capitalAccount.id,
        debit: 0,
        credit: outstandingAmount,
        memo: `Ekuitas Pembuka ${saleNumber}`,
      },
    ])

    if (lineError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('sales').delete().eq('id', sale.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: journal lines untuk invoice ${saleNumber} gagal dibuat.`)
      continue
    }

    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', entry.id)
      .eq('org_id', orgId)

    if (postError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('sales').delete().eq('id', sale.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: jurnal invoice ${saleNumber} gagal diposting.`)
      continue
    }

    existingSaleNumbers.add(saleNumber.toUpperCase())
    summary.created += 1
    summary.totalOutstanding += outstandingAmount
  }

  revalidatePath('/sales')
  revalidatePath('/accounting/aging')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Opening piutang selesai diimport dengan beberapa baris yang dilewati.'
      : 'Opening piutang berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalOutstanding: Number(summary.totalOutstanding.toFixed(2)),
    },
    metadata: {
      journalEntriesCreated: summary.created,
      journalDate,
    },
  }
}

export async function importOpeningApMigration(
  payload: OpeningApImportPayload
): Promise<OpeningApImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi opening hutang.' }
  }

  if (payload.openingApRows.length === 0) {
    return { success: false, error: 'Sheet opening_ap belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const summary = createOpeningApSummary()
  const warnings: string[] = []
  const journalDate = new Date().toISOString().slice(0, 10)

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const [
    { data: contactsData, error: contactsError },
    { data: branchesData, error: branchesError },
    { data: accountsData, error: accountsError },
    { data: existingPurchasesData, error: existingPurchasesError },
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('org_id', orgId),
    supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabase
      .from('accounts')
      .select('id, code, type')
      .eq('org_id', orgId),
    supabase
      .from('purchases')
      .select('id, purchase_number')
      .eq('org_id', orgId),
  ])

  if (contactsError || branchesError || accountsError || existingPurchasesError) {
    return { success: false, error: 'Gagal membaca supplier, branch, akun, atau bill existing sebelum migrasi hutang dijalankan.' }
  }

  const contacts = (contactsData || []) as ExistingContactRecord[]
  const branches = (branchesData || []) as ExistingBranchRecord[]
  const accounts = (accountsData || []) as ExistingAccountRecord[]
  const existingPurchases = (existingPurchasesData || []) as Array<{ id: string; purchase_number: string }>

  const supplierByName = new Map<string, ExistingContactRecord>()
  contacts.forEach((contact) => {
    if (contact.type !== 'SUPPLIER') return
    const key = normalizeLookup(contact.name)
    if (key && !supplierByName.has(key)) supplierByName.set(key, contact)
  })

  const branchByLookup = new Map<string, ExistingBranchRecord>()
  branches.forEach((branch) => {
    const nameKey = normalizeLookup(branch.name)
    const codeKey = normalizeLookup(branch.code)
    if (nameKey) branchByLookup.set(nameKey, branch)
    if (codeKey) branchByLookup.set(codeKey, branch)
  })

  const existingPurchaseNumbers = new Set(
    existingPurchases.map((purchase) => String(purchase.purchase_number || '').trim().toUpperCase()).filter(Boolean)
  )

  const payableAccount =
    accounts.find((account) => account.code === '2101') ||
    [...accounts]
      .filter((account) => account.type === 'LIABILITY')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  const capitalAccount =
    accounts.find((account) => account.code === '3001') ||
    [...accounts]
      .filter((account) => account.type === 'EQUITY')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  if (!payableAccount?.id) {
    return { success: false, error: 'Akun hutang usaha tidak ditemukan. Pastikan akun 2101 sudah ada sebelum migrasi opening hutang.' }
  }

  if (!capitalAccount?.id) {
    return { success: false, error: 'Akun equity/modal tidak ditemukan. Pastikan akun 3001 atau akun equity lain tersedia sebelum migrasi opening hutang.' }
  }

  if (payableAccount.code !== '2101') {
    warnings.push(`Akun hutang memakai fallback ${payableAccount.code} karena akun 2101 belum ditemukan.`)
  }

  if (capitalAccount.code !== '3001') {
    warnings.push(`Akun lawan opening hutang memakai fallback akun equity ${capitalAccount.code} karena akun 3001 belum ditemukan.`)
  }

  warnings.push(`Jurnal opening hutang memakai tanggal sistem ${journalDate}. Tanggal bill dan due date tetap mengikuti file agar aging AP akurat.`)

  for (const row of payload.openingApRows) {
    const supplierName = String(row.values.supplier_name || '').trim()
    const billNumberInput = String(row.values.bill_number || '').trim()
    const billDate = String(row.values.bill_date || '').trim() || journalDate
    const dueDate = String(row.values.due_date || '').trim() || billDate
    const branchName = String(row.values.branch_name || '').trim()
    const notes = String(row.values.notes || '').trim()
    const outstandingAmount = Number(String(row.values.outstanding_amount || '').trim())

    if (!supplierName) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: supplier_name wajib diisi.`)
      continue
    }

    if (!Number.isFinite(outstandingAmount) || outstandingAmount <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: outstanding_amount harus lebih dari 0.`)
      continue
    }

    const supplier = supplierByName.get(normalizeLookup(supplierName))
    if (!supplier?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: supplier ${supplierName} belum ada di master data.`)
      continue
    }

    const branch = branchName ? branchByLookup.get(normalizeLookup(branchName)) || null : null
    const branchId = branch?.id || branchSelection.branchId || (branches.length === 1 ? branches[0]?.id : null)

    if (branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name ${branchName} tidak dikenali.`)
      continue
    }

    if (!branchName && !branchId && branches.length > 1) {
      warnings.push(`Baris ${row.rowNumber}: branch_name kosong pada organisasi multi-unit. Bill akan disimpan tanpa branch khusus.`)
    }

    const generatedPurchaseNumber = billNumberInput || `OPEN-AP-${new Date(billDate).toISOString().slice(0, 10).replace(/-/g, '')}-${String(row.rowNumber).padStart(4, '0')}`
    const purchaseNumber = generatedPurchaseNumber.trim()

    if (existingPurchaseNumbers.has(purchaseNumber.toUpperCase())) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: bill_number ${purchaseNumber} sudah ada di sistem.`)
      continue
    }

    const purchaseNotes = [OPENING_AP_IMPORT_TAG, notes].filter(Boolean).join('\n')

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        purchase_number: purchaseNumber,
        purchase_date: billDate,
        due_date: dueDate,
        vendor_id: supplier.id,
        total_amount: outstandingAmount,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: outstandingAmount,
        status: 'RECEIVED',
        payment_status: 'UNPAID',
        notes: purchaseNotes,
        created_by: authData.user.id,
        shariah_mode: 'CASH',
      })
      .select('id')
      .single()

    if (purchaseError || !purchase?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gagal membuat bill opening AP ${purchaseNumber}.`)
      continue
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        entry_date: journalDate,
        description: `Saldo Awal Hutang ${purchaseNumber}`,
        reference_type: 'PURCHASE',
        reference_id: purchase.id,
        status: 'DRAFT',
        is_auto: true,
        notes: OPENING_AP_IMPORT_TAG,
        created_by: authData.user.id,
      })
      .select('id')
      .single()

    if (entryError || !entry?.id) {
      await supabase.from('purchases').delete().eq('id', purchase.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: bill ${purchaseNumber} dibuat, tetapi jurnal pembukanya gagal.`)
      continue
    }

    const { error: lineError } = await supabase.from('journal_lines').insert([
      {
        entry_id: entry.id,
        account_id: capitalAccount.id,
        debit: outstandingAmount,
        credit: 0,
        memo: `Ekuitas Pembuka ${purchaseNumber}`,
      },
      {
        entry_id: entry.id,
        account_id: payableAccount.id,
        debit: 0,
        credit: outstandingAmount,
        memo: `Hutang Awal ${purchaseNumber}`,
      },
    ])

    if (lineError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('purchases').delete().eq('id', purchase.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: journal lines untuk bill ${purchaseNumber} gagal dibuat.`)
      continue
    }

    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', entry.id)
      .eq('org_id', orgId)

    if (postError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('purchases').delete().eq('id', purchase.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: jurnal bill ${purchaseNumber} gagal diposting.`)
      continue
    }

    existingPurchaseNumbers.add(purchaseNumber.toUpperCase())
    summary.created += 1
    summary.totalOutstanding += outstandingAmount
  }

  revalidatePath('/purchasing')
  revalidatePath('/accounting/aging')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Opening hutang selesai diimport dengan beberapa baris yang dilewati.'
      : 'Opening hutang berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalOutstanding: Number(summary.totalOutstanding.toFixed(2)),
    },
    metadata: {
      journalEntriesCreated: summary.created,
      journalDate,
    },
  }
}

export async function importOpeningCashBankMigration(
  payload: OpeningCashBankImportPayload
): Promise<OpeningCashBankImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi saldo awal kas & bank.' }
  }

  if (payload.openingCashBankRows.length === 0) {
    return { success: false, error: 'Sheet opening_cash_bank belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const summary = createOpeningCashBankSummary()
  const warnings: string[] = []
  const journalDate = new Date().toISOString().slice(0, 10)

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const [
    { data: branchesData, error: branchesError },
    { data: accountsData, error: accountsError },
    { data: existingBankAccountsData, error: existingBankAccountsError },
    { data: existingBankTransactionsData, error: existingBankTransactionsError },
  ] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('org_id', orgId),
    supabase
      .from('bank_accounts')
      .select('id, account_id, branch_id, bank_name, account_number')
      .eq('org_id', orgId),
    supabase
      .from('bank_transactions')
      .select('id, bank_account_id, description')
      .eq('org_id', orgId),
  ])

  if (branchesError || accountsError || existingBankAccountsError || existingBankTransactionsError) {
    return { success: false, error: 'Gagal membaca branch, akun, atau histori kas & bank sebelum migrasi dijalankan.' }
  }

  const branches = (branchesData || []) as ExistingBranchRecord[]
  const accounts = (accountsData || []) as ExistingAccountRecord[]
  const existingBankAccounts = (existingBankAccountsData || []) as ExistingBankAccountImportRecord[]
  const existingBankTransactions = (existingBankTransactionsData || []) as ExistingBankTransactionImportRecord[]

  const branchByLookup = new Map<string, ExistingBranchRecord>()
  branches.forEach((branch) => {
    const nameKey = normalizeLookup(branch.name)
    const codeKey = normalizeLookup(branch.code)
    if (nameKey) branchByLookup.set(nameKey, branch)
    if (codeKey) branchByLookup.set(codeKey, branch)
  })

  const accountByCode = new Map<string, ExistingAccountRecord>()
  const accountByName = new Map<string, ExistingAccountRecord>()
  accounts.forEach((account) => {
    const codeKey = normalizeCode(account.code)
    const nameKey = normalizeLookup(account.name)
    if (codeKey && !accountByCode.has(codeKey)) accountByCode.set(codeKey, account)
    if (nameKey && !accountByName.has(nameKey)) accountByName.set(nameKey, account)
  })

  const capitalAccount =
    accounts.find((account) => account.code === '3001') ||
    [...accounts]
      .filter((account) => account.type === 'EQUITY')
      .sort((left, right) => left.code.localeCompare(right.code))[0]

  if (!capitalAccount?.id) {
    return { success: false, error: 'Akun equity/modal tidak ditemukan. Pastikan akun 3001 atau akun equity lain tersedia sebelum migrasi kas & bank.' }
  }

  if (capitalAccount.code !== '3001') {
    warnings.push(`Akun lawan saldo awal kas & bank memakai fallback akun equity ${capitalAccount.code} karena akun 3001 belum ditemukan.`)
  }

  warnings.push(`Saldo awal kas & bank diposting memakai tanggal sistem ${journalDate} karena template belum memiliki kolom tanggal cut-off.`)
  warnings.push('Template kas & bank saat ini belum memiliki kolom bank_name, account_number, dan account_holder. Jika rekening belum ada, sistem akan membuat master bank account memakai nama akun GL sebagai label rekening.')

  const bankAccountByKey = new Map<string, ExistingBankAccountImportRecord>()
  existingBankAccounts.forEach((bankAccount) => {
    bankAccountByKey.set(`${bankAccount.account_id}::${bankAccount.branch_id}`, bankAccount)
  })

  const transactionCountByBankAccount = new Map<string, number>()
  const taggedTransactionBankAccounts = new Set<string>()
  existingBankTransactions.forEach((transaction) => {
    const bankAccountId = String(transaction.bank_account_id || '').trim()
    if (!bankAccountId) return
    transactionCountByBankAccount.set(bankAccountId, (transactionCountByBankAccount.get(bankAccountId) || 0) + 1)
    if (String(transaction.description || '').startsWith(OPENING_CASH_BANK_IMPORT_TAG)) {
      taggedTransactionBankAccounts.add(bankAccountId)
    }
  })

  const rowKeys = new Set<string>()

  for (const row of payload.openingCashBankRows) {
    const accountCode = String(row.values.account_code || '').trim()
    const accountName = String(row.values.account_name || '').trim()
    const accountType = String(row.values.account_type || '').trim().toUpperCase()
    const branchName = String(row.values.branch_name || '').trim()
    const notes = String(row.values.notes || '').trim()
    const balance = Number(String(row.values.balance || '').trim())

    if (!['CASH', 'BANK'].includes(accountType)) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: account_type harus CASH atau BANK.`)
      continue
    }

    if (!Number.isFinite(balance) || balance <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: balance harus berupa angka lebih dari 0.`)
      continue
    }

    const account =
      (accountCode ? accountByCode.get(normalizeCode(accountCode)) : null) ||
      (accountName ? accountByName.get(normalizeLookup(accountName)) : null)

    if (!account?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: akun kas/bank tidak ditemukan dari account_code/account_name.`)
      continue
    }

    if (account.type !== 'ASSET') {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: akun ${account.code} - ${account.name} bukan tipe ASSET sehingga tidak layak dipakai sebagai kas/bank.`)
      continue
    }

    const branch = branchName ? branchByLookup.get(normalizeLookup(branchName)) || null : null
    const branchId = branch?.id || branchSelection.branchId || (branches.length === 1 ? branches[0]?.id : null)

    if (branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name ${branchName} tidak dikenali.`)
      continue
    }

    if (!branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name wajib ditentukan karena organisasi memiliki lebih dari satu unit aktif.`)
      continue
    }

    const rowKey = `${account.id}::${branchId}`
    if (rowKeys.has(rowKey)) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: kombinasi akun dan unit duplikat di sheet opening_cash_bank.`)
      continue
    }
    rowKeys.add(rowKey)

    let bankAccount = bankAccountByKey.get(rowKey) || null

    if (bankAccount?.id && taggedTransactionBankAccounts.has(bankAccount.id)) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: saldo awal untuk akun ${account.code} di unit ini sudah pernah diimport sebelumnya.`)
      continue
    }

    if (bankAccount?.id && (transactionCountByBankAccount.get(bankAccount.id) || 0) > 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: akun ${account.code} sudah punya histori transaksi kas/bank, jadi import saldo awal otomatis diblok agar tidak dobel.`)
      continue
    }

    if (!bankAccount?.id) {
      const { data: insertedBankAccount, error: bankAccountError } = await supabase
        .from('bank_accounts')
        .insert({
          org_id: orgId,
          branch_id: branchId,
          account_id: account.id,
          bank_name: account.name,
          account_number: null,
          account_holder: null,
          currency: 'IDR',
          is_active: true,
        })
        .select('id, account_id, branch_id, bank_name, account_number')
        .single()

      if (bankAccountError || !insertedBankAccount?.id) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: gagal membuat master rekening untuk akun ${account.code}.`)
        continue
      }

      bankAccount = insertedBankAccount as ExistingBankAccountImportRecord
      bankAccountByKey.set(rowKey, bankAccount)
      transactionCountByBankAccount.set(bankAccount.id, 0)
      summary.bankAccountsCreated += 1
    }

    const transactionDescription = [OPENING_CASH_BANK_IMPORT_TAG, `Saldo Awal ${account.name}`, notes]
      .filter(Boolean)
      .join(' | ')

    const { error: transactionError } = await supabase
      .from('bank_transactions')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        bank_account_id: bankAccount.id,
        transaction_date: journalDate,
        description: transactionDescription,
        amount: Number(balance.toFixed(2)),
        type: 'IN',
        category_id: capitalAccount.id,
        reference_number: `OPEN-CB-${String(row.rowNumber).padStart(4, '0')}`,
        status: 'POSTED',
        created_by: authData.user.id,
      })

    if (transactionError) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gagal membuat transaksi saldo awal untuk akun ${account.code}.`)
      continue
    }

    transactionCountByBankAccount.set(bankAccount.id, (transactionCountByBankAccount.get(bankAccount.id) || 0) + 1)
    taggedTransactionBankAccounts.add(bankAccount.id)
    summary.created += 1
    summary.totalBalance += balance
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  revalidatePath('/dashboard')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Saldo awal kas & bank selesai diimport dengan beberapa baris yang dilewati.'
      : 'Saldo awal kas & bank berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalBalance: Number(summary.totalBalance.toFixed(2)),
    },
    metadata: {
      journalEntriesCreated: summary.created,
      journalDate,
    },
  }
}

export async function importFixedAssetsMigration(
  payload: FixedAssetsImportPayload
): Promise<FixedAssetsImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi aset tetap.' }
  }

  if (payload.fixedAssetRows.length === 0) {
    return { success: false, error: 'Sheet fixed_assets belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { success: false, error: 'Sesi login tidak ditemukan.' }
  }

  const orgId = orgData.org.id
  const summary = createFixedAssetsSummary()
  const warnings: string[] = []
  const journalDate = new Date().toISOString().slice(0, 10)

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const [
    { data: branchesData, error: branchesError },
    { data: accountsData, error: accountsError },
    { data: existingAssetsData, error: existingAssetsError },
  ] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('org_id', orgId),
    supabase
      .from('fixed_assets')
      .select('id, code, name')
      .eq('org_id', orgId),
  ])

  if (branchesError || accountsError || existingAssetsError) {
    return { success: false, error: 'Gagal membaca branch, akun, atau aset existing sebelum migrasi aset tetap.' }
  }

  const branches = (branchesData || []) as ExistingBranchRecord[]
  const accounts = (accountsData || []) as ExistingAccountRecord[]
  const existingAssets = (existingAssetsData || []) as ExistingFixedAssetImportRecord[]

  const branchByLookup = new Map<string, ExistingBranchRecord>()
  branches.forEach((branch) => {
    const nameKey = normalizeLookup(branch.name)
    const codeKey = normalizeLookup(branch.code)
    if (nameKey) branchByLookup.set(nameKey, branch)
    if (codeKey) branchByLookup.set(codeKey, branch)
  })

  const capitalAccount =
    accounts.find((account) => account.code === '3001') ||
    [...accounts].filter((account) => account.type === 'EQUITY').sort((a, b) => a.code.localeCompare(b.code))[0]

  const assetAccount =
    accounts.find((account) => account.code === '1500') ||
    [...accounts]
      .filter((account) => account.type === 'ASSET' && account.code.startsWith('15') && !normalizeLookup(account.name).includes('akumulasi'))
      .sort((a, b) => a.code.localeCompare(b.code))[0]

  const accumDepAccount =
    accounts.find((account) => ['1503', '1505', '1507'].includes(account.code)) ||
    [...accounts]
      .filter((account) => account.type === 'ASSET' && normalizeLookup(account.name).includes('akumulasi'))
      .sort((a, b) => a.code.localeCompare(b.code))[0]

  const depExpenseAccount =
    accounts.find((account) => account.code === '6009') ||
    [...accounts].filter((account) => account.type === 'EXPENSE').sort((a, b) => a.code.localeCompare(b.code))[0]

  if (!assetAccount?.id) {
    return { success: false, error: 'Akun aset tetap tidak ditemukan. Pastikan akun 1500 atau akun aset tetap lain tersedia.' }
  }

  if (!capitalAccount?.id) {
    return { success: false, error: 'Akun equity/modal tidak ditemukan. Pastikan akun 3001 atau akun equity lain tersedia.' }
  }

  warnings.push(`Jurnal pembuka aset tetap memakai tanggal sistem ${journalDate} karena template belum memiliki kolom tanggal cut-off.`)
  if (branches.length > 1) {
    warnings.push('Template fixed_assets belum memiliki mapping cabang yang wajib. Jika branch_name kosong, sistem akan memakai unit aktif/default saat import dijalankan.')
  }
  if (assetAccount.code !== '1500') {
    warnings.push(`Akun aset tetap pembuka memakai fallback ${assetAccount.code} karena akun 1500 belum ditemukan.`)
  }
  if (!accumDepAccount?.id) {
    warnings.push('Akun akumulasi penyusutan tidak ditemukan. Baris dengan accumulated_depreciation > 0 akan diblok agar jurnal opening tetap sehat.')
  }
  if (!depExpenseAccount?.id) {
    warnings.push('Akun biaya penyusutan tidak ditemukan. Aset tetap tetap bisa diimport, tetapi akun biaya penyusutannya belum otomatis terhubung.')
  }

  const reservedCodes = new Set(existingAssets.map((asset) => normalizeCode(asset.code)).filter(Boolean))
  const existingAssetNames = new Set(existingAssets.map((asset) => normalizeLookup(asset.name)).filter(Boolean))

  for (const row of payload.fixedAssetRows) {
    const assetName = String(row.values.asset_name || '').trim()
    const assetCodeInput = String(row.values.asset_code || '').trim()
    const acquisitionDate = normalizeDate(row.values.acquisition_date, journalDate)
    const branchName = String(row.values.branch_name || '').trim()
    const notes = String(row.values.notes || '').trim()
    const acquisitionCost = Number(String(row.values.acquisition_cost || '').trim())
    const accumulatedDepreciation = Number(String(row.values.accumulated_depreciation || '').trim() || '0')
    const residualValue = Number(String(row.values.residual_value || '').trim() || '0')
    const usefulLifeInput = Number(String(row.values.useful_life_months || '').trim() || '0')

    if (!assetName) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: asset_name wajib diisi.`)
      continue
    }

    if (!Number.isFinite(acquisitionCost) || acquisitionCost <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: acquisition_cost harus lebih dari 0.`)
      continue
    }

    if (!Number.isFinite(accumulatedDepreciation) || accumulatedDepreciation < 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: accumulated_depreciation harus berupa angka 0 atau lebih.`)
      continue
    }

    if (!Number.isFinite(residualValue) || residualValue < 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: residual_value harus berupa angka 0 atau lebih.`)
      continue
    }

    if (accumulatedDepreciation > acquisitionCost) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: accumulated_depreciation tidak boleh melebihi acquisition_cost.`)
      continue
    }

    const branch = branchName ? branchByLookup.get(normalizeLookup(branchName)) || null : null
    const branchId = branch?.id || branchSelection.branchId || (branches.length === 1 ? branches[0]?.id : null)
    if (branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name ${branchName} tidak dikenali.`)
      continue
    }

    if (!branchName && !branchId) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: branch_name wajib ditentukan karena organisasi memiliki lebih dari satu unit aktif.`)
      continue
    }

    if (existingAssetNames.has(normalizeLookup(assetName)) && !assetCodeInput) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: aset ${assetName} sudah ada. Isi asset_code jika memang asetnya berbeda.`)
      continue
    }

    if (accumulatedDepreciation > 0 && !accumDepAccount?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: akun akumulasi penyusutan belum tersedia sehingga aset dengan nilai akumulasi tidak bisa diimport.`)
      continue
    }

    const usefulLifeMonths = Number.isFinite(usefulLifeInput) && usefulLifeInput > 0
      ? Math.round(usefulLifeInput)
      : 60

    if (!(Number.isFinite(usefulLifeInput) && usefulLifeInput > 0)) {
      warnings.push(`Baris ${row.rowNumber}: useful_life_months kosong/tidak valid, sistem memakai default 60 bulan.`)
    }

    const assetCode = buildUniqueImportCode(assetCodeInput, assetName, 'AST', reservedCodes, row.rowNumber)
    const currentBookValue = Number(Math.max(0, acquisitionCost - accumulatedDepreciation).toFixed(2))

    const assetInsert: Database['public']['Tables']['fixed_assets']['Insert'] = {
      org_id: orgId,
      branch_id: branchId,
      code: assetCode,
      name: assetName,
      description: notes || null,
      category: null,
      purchase_date: acquisitionDate,
      purchase_price: Number(acquisitionCost.toFixed(2)),
      salvage_value: Number(residualValue.toFixed(2)),
      useful_life_months: usefulLifeMonths,
      asset_account_id: assetAccount.id,
      accum_dep_account_id: accumDepAccount?.id || null,
      dep_expense_account_id: depExpenseAccount?.id || null,
      depreciation_method: 'STRAIGHT_LINE',
      status: 'ACTIVE',
      accumulated_depreciation: Number(accumulatedDepreciation.toFixed(2)),
      current_book_value: currentBookValue,
      last_depreciation_date: accumulatedDepreciation > 0 ? journalDate : null,
    }

    const { data: asset, error: assetError } = await supabase
      .from('fixed_assets')
      .insert(assetInsert)
      .select('id')
      .single()

    if (assetError || !asset?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gagal membuat aset ${assetCode}.`)
      continue
    }

    const journalLines: Database['public']['Tables']['journal_lines']['Insert'][] = [
      {
        entry_id: '',
        account_id: assetAccount.id,
        debit: Number(acquisitionCost.toFixed(2)),
        credit: 0,
        memo: `Saldo Awal Aset ${assetCode}`,
      },
    ]

    if (accumulatedDepreciation > 0 && accumDepAccount?.id) {
      journalLines.push({
        entry_id: '',
        account_id: accumDepAccount.id,
        debit: 0,
        credit: Number(accumulatedDepreciation.toFixed(2)),
        memo: `Akumulasi Penyusutan Awal ${assetCode}`,
      })
    }

    if (currentBookValue > 0) {
      journalLines.push({
        entry_id: '',
        account_id: capitalAccount.id,
        debit: 0,
        credit: currentBookValue,
        memo: `Ekuitas Pembuka ${assetCode}`,
      })
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        org_id: orgId,
        branch_id: branchId,
        entry_date: journalDate,
        description: `Saldo Awal Aset ${assetCode}`,
        reference_type: 'ADJUSTMENT',
        reference_id: asset.id,
        status: 'DRAFT',
        is_auto: true,
        notes: FIXED_ASSETS_IMPORT_TAG,
        created_by: authData.user.id,
      })
      .select('id')
      .single()

    if (entryError || !entry?.id) {
      await supabase.from('fixed_assets').delete().eq('id', asset.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: aset ${assetCode} dibuat, tetapi jurnal pembukanya gagal.`)
      continue
    }

    const resolvedLines = journalLines.map((line) => ({ ...line, entry_id: entry.id }))
    const { error: lineError } = await supabase.from('journal_lines').insert(resolvedLines)
    if (lineError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('fixed_assets').delete().eq('id', asset.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: journal lines untuk aset ${assetCode} gagal dibuat.`)
      continue
    }

    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', entry.id)
      .eq('org_id', orgId)

    if (postError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id).eq('org_id', orgId)
      await supabase.from('fixed_assets').delete().eq('id', asset.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: jurnal aset ${assetCode} gagal diposting.`)
      continue
    }

    existingAssetNames.add(normalizeLookup(assetName))
    summary.created += 1
    summary.totalAcquisitionCost += acquisitionCost
    summary.totalBookValue += currentBookValue
  }

  revalidatePath('/accounting/assets')
  revalidatePath('/accounting/journal')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Aset tetap selesai diimport dengan beberapa baris yang dilewati.'
      : 'Aset tetap berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalAcquisitionCost: Number(summary.totalAcquisitionCost.toFixed(2)),
      totalBookValue: Number(summary.totalBookValue.toFixed(2)),
    },
    metadata: {
      journalEntriesCreated: summary.created,
      journalDate,
    },
  }
}

export async function importManufacturingMigration(
  payload: ManufacturingImportPayload
): Promise<ManufacturingImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi BoM.' }
  }

  if (payload.bomRows.length === 0) {
    return { success: false, error: 'Sheet bom belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const orgId = orgData.org.id
  const summary = createManufacturingSummary()
  const warnings: string[] = []

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { success: false, error: 'Pilih unit aktif terlebih dahulu untuk mengimpor BoM.' }
  }

  const [
    { data: productRows, error: productsError },
    { data: existingBomRows, error: existingBomError },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name, unit')
      .eq('org_id', orgId),
    supabase
      .from('production_boms')
      .select('id, code')
      .eq('org_id', orgId),
  ])

  if (productsError || existingBomError) {
    return { success: false, error: 'Gagal membaca produk atau BoM existing sebelum migrasi manufacturing.' }
  }

  const products = ((productRows as Array<{ id: string; sku: string | null; name: string; unit: string | null }> | null) || [])
  const existingBoms = (existingBomRows || []) as ExistingBomImportRecord[]

  const productBySku = new Map<string, { id: string; sku: string | null; name: string; unit: string | null }>()
  const productByName = new Map<string, { id: string; sku: string | null; name: string; unit: string | null }>()
  products.forEach((product) => {
    const skuKey = normalizeCode(product.sku)
    const nameKey = normalizeLookup(product.name)
    if (skuKey && !productBySku.has(skuKey)) productBySku.set(skuKey, product)
    if (nameKey && !productByName.has(nameKey)) productByName.set(nameKey, product)
  })

  const reservedBomCodes = new Set(existingBoms.map((bom) => normalizeCode(bom.code)).filter(Boolean))
  const groupedRows = new Map<string, ParsedMigrationRow[]>()

  payload.bomRows.forEach((row) => {
    const groupKey = String(row.values.bom_code || row.values.output_sku || row.values.output_name || row.rowNumber).trim()
    groupedRows.set(groupKey, [...(groupedRows.get(groupKey) || []), row])
  })

  warnings.push('Semua BoM hasil migrasi akan ditempatkan pada unit aktif saat import dijalankan, karena template belum memiliki kolom branch_name.')

  for (const rows of groupedRows.values()) {
    const firstRow = rows[0]
    const outputSku = String(firstRow.values.output_sku || '').trim()
    const outputName = String(firstRow.values.output_name || '').trim()
    const bomCodeInput = String(firstRow.values.bom_code || '').trim()
    const outputQty = Number(String(firstRow.values.output_qty || '').trim() || '1')
    const bomNotes = String(firstRow.values.notes || '').trim()

    const outputProduct =
      (outputSku ? productBySku.get(normalizeCode(outputSku)) : null) ||
      (outputName ? productByName.get(normalizeLookup(outputName)) : null)

    if (!outputProduct?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${firstRow.rowNumber}: produk output BoM tidak ditemukan dari output_sku/output_name.`)
      continue
    }

    if (!Number.isFinite(outputQty) || outputQty <= 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${firstRow.rowNumber}: output_qty harus lebih dari 0.`)
      continue
    }

    if (bomCodeInput && reservedBomCodes.has(normalizeCode(bomCodeInput))) {
      summary.skipped += 1
      summary.errors.push(`Baris ${firstRow.rowNumber}: bom_code ${bomCodeInput} sudah ada di sistem.`)
      continue
    }

    if (outputQty !== 1) {
      warnings.push(`BoM ${bomCodeInput || outputProduct.name}: output_qty ${outputQty} akan dinormalisasi ke basis 1 produk jadi per recipe.`)
    }

    const aggregatedItems = new Map<string, { product_id: string; quantity: number; unit: string | null }>()
    let hasRowError = false

    for (const row of rows) {
      const componentSku = String(row.values.component_sku || '').trim()
      const componentName = String(row.values.component_name || '').trim()
      const componentUnit = String(row.values.component_unit || '').trim() || null
      const componentQty = Number(String(row.values.component_qty || '').trim())

      const componentProduct =
        (componentSku ? productBySku.get(normalizeCode(componentSku)) : null) ||
        (componentName ? productByName.get(normalizeLookup(componentName)) : null)

      if (!componentProduct?.id) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: bahan BoM tidak ditemukan dari component_sku/component_name.`)
        hasRowError = true
        break
      }

      if (!Number.isFinite(componentQty) || componentQty <= 0) {
        summary.skipped += 1
        summary.errors.push(`Baris ${row.rowNumber}: component_qty harus lebih dari 0.`)
        hasRowError = true
        break
      }

      const normalizedQty = Number((componentQty / outputQty).toFixed(4))
      const itemKey = `${componentProduct.id}::${componentUnit || componentProduct.unit || ''}`
      const current = aggregatedItems.get(itemKey) || {
        product_id: componentProduct.id,
        quantity: 0,
        unit: componentUnit || componentProduct.unit || null,
      }
      current.quantity = Number((current.quantity + normalizedQty).toFixed(4))
      aggregatedItems.set(itemKey, current)
    }

    if (hasRowError || aggregatedItems.size === 0) {
      continue
    }

    const bomCode = buildUniqueImportCode(
      bomCodeInput,
      outputProduct.name,
      'BOM',
      reservedBomCodes,
      firstRow.rowNumber
    )

    const { data: bom, error: bomError } = await supabase
      .from('production_boms')
      .insert({
        org_id: orgId,
        branch_id: branchSelection.branchId,
        product_id: outputProduct.id,
        code: bomCode,
        description: [MANUFACTURING_IMPORT_TAG, bomNotes].filter(Boolean).join(' | ') || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (bomError || !bom?.id) {
      summary.skipped += 1
      summary.errors.push(`Baris ${firstRow.rowNumber}: gagal membuat header BoM ${bomCode}.`)
      continue
    }

    const bomItems = [...aggregatedItems.values()].map((item) => ({
      bom_id: bom.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
    }))

    const { error: itemsError } = await supabase.from('production_bom_items').insert(bomItems)
    if (itemsError) {
      await supabase.from('production_boms').delete().eq('id', bom.id).eq('org_id', orgId)
      summary.skipped += 1
      summary.errors.push(`Baris ${firstRow.rowNumber}: gagal membuat item BoM ${bomCode}.`)
      continue
    }

    summary.created += 1
    summary.componentLinesCreated += bomItems.length
  }

  revalidatePath('/factory')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'BoM selesai diimport dengan beberapa grup yang dilewati.'
      : 'BoM berhasil dimasukkan ke sistem.',
    warnings,
    summary,
    metadata: {
      bomsCreated: summary.created,
    },
  }
}

export async function importEmployeesMigration(
  payload: EmployeesImportPayload
): Promise<EmployeesImportResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { success: false, error: 'Organisasi aktif tidak ditemukan.' }
  }

  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || ''))) {
    return { success: false, error: 'Hanya owner, admin, atau manager yang boleh menjalankan migrasi karyawan.' }
  }

  if (payload.employeeRows.length === 0) {
    return { success: false, error: 'Sheet employees belum berisi data untuk dimigrasikan.' }
  }

  const supabase = await createClient()
  const orgId = orgData.org.id
  const summary = createEmployeesSummary()
  const warnings: string[] = []

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) {
    return { success: false, error: branchSelection.error }
  }

  const { data: branchesData, error: branchesError } = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const { data: existingEmployeesData, error: existingEmployeesError } = await supabase
    .from('employees')
    .select('id, nik')
    .eq('org_id', orgId)

  if (branchesError || existingEmployeesError) {
    return { success: false, error: 'Gagal membaca branch atau karyawan existing sebelum migrasi karyawan.' }
  }

  const branches = (branchesData || []) as ExistingBranchRecord[]
  const existingEmployees = (existingEmployeesData || []) as ExistingEmployeeImportRecord[]
  const assignedBranchId = branchSelection.branchId || (branches.length === 1 ? branches[0]?.id : null)

  if (!assignedBranchId) {
    return { success: false, error: 'Tidak ada branch aktif yang bisa dipakai untuk mengimpor karyawan.' }
  }

  if (branches.length > 1) {
    warnings.push('Template employees belum memiliki kolom branch_name. Semua karyawan hasil migrasi akan ditempatkan pada unit aktif/default saat import dijalankan.')
  }

  const reservedNiks = new Set(existingEmployees.map((employee) => normalizeCode(employee.nik)).filter(Boolean))

  for (const row of payload.employeeRows) {
    const employeeCode = String(row.values.employee_code || '').trim()
    const employeeName = String(row.values.employee_name || '').trim()
    const email = String(row.values.email || '').trim()
    const phone = String(row.values.phone || '').trim()
    const department = String(row.values.department || '').trim()
    const position = String(row.values.position || '').trim()
    const joinDate = normalizeDate(row.values.join_date, new Date().toISOString().slice(0, 10))
    const employmentStatusInput = String(row.values.employment_status || '').trim()
    const basicSalary = Number(String(row.values.basic_salary || '').trim() || '0')
    const isActive = parseBoolean(row.values.is_active, true)

    if (!employeeName) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: employee_name wajib diisi.`)
      continue
    }

    if (!Number.isFinite(basicSalary) || basicSalary < 0) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: basic_salary harus berupa angka 0 atau lebih.`)
      continue
    }

    const nik = buildUniqueImportCode(employeeCode, employeeName, 'EMP', reservedNiks, row.rowNumber)
    const { firstName, lastName } = splitEmployeeName(employeeName)
    const mappedEmploymentStatus = mapEmploymentStatus(employmentStatusInput, isActive)
    const jobTitle = position || 'Staff'

    if (!position) {
      warnings.push(`Baris ${row.rowNumber}: position kosong, sistem memakai fallback "Staff".`)
    }
    if (normalizeLookup(employmentStatusInput) === 'freelance') {
      warnings.push(`Baris ${row.rowNumber}: status "Freelance" dipetakan ke status sistem CONTRACT.`)
    }
    if (!employeeCode) {
      warnings.push(`Baris ${row.rowNumber}: employee_code kosong, sistem membuat NIK otomatis ${nik}.`)
    }

    const employeeInsert: Database['public']['Tables']['employees']['Insert'] = {
      org_id: orgId,
      branch_id: assignedBranchId,
      nik,
      first_name: firstName,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      job_title: jobTitle,
      department: department || null,
      join_date: joinDate,
      employment_status: mappedEmploymentStatus as Database['public']['Tables']['employees']['Row']['employment_status'],
      bank_name: null,
      bank_account_number: null,
      bank_account_holder: null,
      basic_salary: Number(basicSalary.toFixed(2)),
      registration_status: 'PENDING',
    }

    const { error: employeeError } = await supabase.from('employees').insert(employeeInsert)
    if (employeeError) {
      summary.skipped += 1
      summary.errors.push(`Baris ${row.rowNumber}: gagal membuat karyawan ${employeeName}.`)
      continue
    }

    summary.created += 1
    summary.totalBasicSalary += basicSalary
  }

  revalidatePath('/hris')
  revalidateMigrationImportTargets()

  return {
    success: true,
    hasErrors: summary.errors.length > 0,
    message: summary.errors.length > 0
      ? 'Karyawan selesai diimport dengan beberapa baris yang dilewati.'
      : 'Karyawan berhasil dimasukkan ke sistem.',
    warnings,
    summary: {
      ...summary,
      totalBasicSalary: Number(summary.totalBasicSalary.toFixed(2)),
    },
    metadata: {
      assignedBranchId,
    },
  }
}
