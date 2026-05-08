'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import {
  getSaasCapabilityDisplayLabel,
  getSaasPackageArchitecture,
  normalizeSaasEntitlementList,
} from '@/lib/saas/module-catalog'
import {
  EXTRA_BRANCH_UNIT_PRICE,
  EXTRA_ENTITY_UNIT_PRICE,
  OPERATOR_ADDON_OPTIONS,
  getOperatorAddonById,
  getOperatorMarketplaceCompatibility,
  getOperatorMarketplaceLabel,
} from '@/lib/saas/operator-pricing'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

type OperatorResellerOption = {
  id: string
  name: string
  reseller_type: string
  company_name: string | null
  commission_type: string | null
  commission_value: number | null
  is_active: boolean
}

type OperatorSnapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string; modules: string[]; addons: string[]; corePrices: Record<string, number>; operationalPrices: Record<string, number> }>
  aiTokenPackages: OperatorAiTokenPackageOption[]
  resellers: OperatorResellerOption[]
  quotations: InvoiceRecord[]
  sales: InvoiceRecord[]
  summary: {
    totalQuotes: number
    totalOpenSales: number
    totalPaidSales: number
    totalSalesValue: number
  }
}

type InvoiceRecord = {
  id: string
  org_id: string
  package_id: string | null
  reseller_id: string | null
  invoice_number: string
  item_name: string | null
  item_description: string | null
  discount_percent?: number | null
  discount_amount?: number | null
  tax_percent?: number | null
  tax_amount?: number | null
  amount: number
  status: string
  payment_method: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  organization?: { name: string } | null
  package?: { name: string } | null
  reseller?: { id: string; name: string; commission_type: string | null; commission_value: number | null } | null
}

type PackageLookup = {
  name: string
  price: number
}

type QuotationDraft = {
  orgId: string
  packageId: string
  packageName: string
  bundleLabel: string
  finalAmount: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  itemDescription: string
}

export type OperatorInvoiceDocument = {
  id: string
  org_id: string
  package_id: string | null
  invoice_number: string
  item_name: string | null
  item_description: string | null
  discount_percent?: number | null
  discount_amount?: number | null
  tax_percent?: number | null
  tax_amount?: number | null
  amount: number
  status: string
  payment_method: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  organization?: { name: string; owner_email?: string | null } | null
  package?: {
    name: string
    price?: number
    billing?: string | null
    modules?: string[]
    addons?: string[]
  } | null
}

export type OperatorAiTokenPackageOption = {
  id: string
  name: string
  description: string | null
  tokens: number
  price: number
}

export type OperatorDocumentSnapshot = {
  invoice: OperatorInvoiceDocument
  saasConfig: Record<string, unknown>
  packageModules: string[]
  packageAddons: string[]
  aiTokenPackages: OperatorAiTokenPackageOption[]
}

const SAAS_INVOICE_SELECT_WITH_ITEM_COLUMNS = 'id, org_id, package_id, reseller_id, invoice_number, item_name, item_description, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name), reseller:sales_resellers(id, name, commission_type, commission_value)'
const SAAS_INVOICE_SELECT_WITH_PRICING_COLUMNS = 'id, org_id, package_id, reseller_id, invoice_number, item_name, item_description, discount_percent, discount_amount, tax_percent, tax_amount, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name), reseller:sales_resellers(id, name, commission_type, commission_value)'
const SAAS_INVOICE_SELECT_BASE = 'id, org_id, package_id, reseller_id, invoice_number, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name), reseller:sales_resellers(id, name, commission_type, commission_value)'

function isMissingColumnError(message: string | null | undefined, column: string) {
  if (!message) return false
  return message.includes(`Could not find the '${column}' column`)
}

function hasMissingInvoiceItemColumn(message: string | null | undefined) {
  return isMissingColumnError(message, 'item_name') || isMissingColumnError(message, 'item_description')
}

function hasMissingInvoicePricingColumn(message: string | null | undefined) {
  return (
    isMissingColumnError(message, 'discount_percent') ||
    isMissingColumnError(message, 'discount_amount') ||
    isMissingColumnError(message, 'tax_percent') ||
    isMissingColumnError(message, 'tax_amount')
  )
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      }
    } catch {
      // fallback: comma-separated
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function formatCurrencyId(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function extractAddonNamesFromDescription(rawDescription: string | null | undefined) {
  const lines = String(rawDescription || '')
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const addonNames = lines.flatMap((line) => {
    const match = line.match(/^(?:Module|Add-on|Capacity Add-on)(?:\s+Single\s+Bill)?\s+(.+?):\s+/i)
    return match?.[1] ? [match[1].trim()] : []
  })

  return normalizeSaasEntitlementList(addonNames)
}

function getActiveAddonName(entry: unknown) {
  if (typeof entry === 'string') return entry.trim()
  if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
    return String((entry as { name?: string }).name || '').trim()
  }
  return ''
}

async function syncOperatorInvoiceAddons(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  invoice: { id: string; org_id: string; item_description?: string | null }
) {
  const db = admin as any
  const addonNames = extractAddonNamesFromDescription(invoice.item_description)
  if (addonNames.length === 0) return { success: true as const }

  const { data: orgData, error: orgError } = await db
    .from('organizations')
    .select('active_addons')
    .eq('id', invoice.org_id)
    .maybeSingle()

  if (orgError) {
    return { error: orgError.message }
  }

  const orgRecord = (orgData as { active_addons?: unknown[] | null } | null) ?? null
  const currentAddons: unknown[] = Array.isArray(orgRecord?.active_addons)
    ? orgRecord.active_addons
    : []
  const existingAddonNames = new Set(
    normalizeSaasEntitlementList(currentAddons.map((entry: unknown) => getActiveAddonName(entry)).filter(Boolean))
  )

  const nowIso = new Date().toISOString()
  const addonsToInsert = addonNames
    .filter((name) => !existingAddonNames.has(name))
    .map((name, index) => ({
      id: `${invoice.id}:addon:${index + 1}`,
      name,
      activated_at: nowIso,
      source: 'saas_operator',
    }))

  if (addonsToInsert.length === 0) return { success: true as const }

  const { error: updateError } = await db
    .from('organizations')
    .update({
      active_addons: [...currentAddons, ...addonsToInsert],
      updated_at: nowIso,
    })
    .eq('id', invoice.org_id)

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true as const }
}

type AccountingAccount = {
  id: string
  code?: string | null
  name?: string | null
  type?: string | null
}

type AutoJournalLine = {
  account_id: string
  debit: number
  credit: number
  memo?: string
}

type AutoJournalResult = {
  entryId?: string
  existed?: boolean
  error?: string
}

function normalizeAccountText(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function toEntryDate(dateLike: string | null | undefined) {
  const date = dateLike ? new Date(dateLike) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function findAccountByCodes(accounts: AccountingAccount[], codes: string[]) {
  for (const code of codes) {
    const found = accounts.find((account) => String(account.code || '').trim() === code)
    if (found) return found
  }
  return null
}

function findAccountByName(accounts: AccountingAccount[], keywords: string[]) {
  return accounts.find((account) => {
    const normalizedName = normalizeAccountText(account.name)
    return keywords.some((keyword) => normalizedName.includes(keyword))
  }) || null
}

function resolveReceivableAccount(accounts: AccountingAccount[]) {
  return (
    findAccountByCodes(accounts, ['1201']) ||
    findAccountByName(accounts, ['piutang usaha']) ||
    accounts.find((account) => normalizeAccountText(account.type) === 'asset' && String(account.code || '').startsWith('12')) ||
    null
  )
}

function resolveRevenueAccount(accounts: AccountingAccount[]) {
  return (
    findAccountByCodes(accounts, ['4001', '4000']) ||
    findAccountByName(accounts, ['pendapatan usaha', 'pendapatan']) ||
    accounts.find((account) => normalizeAccountText(account.type) === 'revenue') ||
    null
  )
}

function resolveOutputTaxAccount(accounts: AccountingAccount[]) {
  return (
    findAccountByCodes(accounts, ['2201']) ||
    findAccountByName(accounts, ['ppn keluaran', 'pajak dipungut']) ||
    accounts.find((account) => normalizeAccountText(account.type) === 'liability' && String(account.code || '').startsWith('22')) ||
    null
  )
}

function resolveCashSettlementAccount(accounts: AccountingAccount[], paymentMethod: string) {
  const normalizedPaymentMethod = normalizeAccountText(paymentMethod)
  const prefersBank = ['transfer', 'bank', 'virtual', 'debit', 'va'].some((keyword) => normalizedPaymentMethod.includes(keyword))

  if (prefersBank) {
    return (
      findAccountByCodes(accounts, ['1103', '1105', '1104']) ||
      findAccountByName(accounts, ['bank']) ||
      findAccountByCodes(accounts, ['1101', '1102']) ||
      null
    )
  }

  return (
    findAccountByCodes(accounts, ['1101', '1102', '1103']) ||
    findAccountByName(accounts, ['kas', 'bank']) ||
    accounts.find((account) => normalizeAccountText(account.type) === 'asset' && String(account.code || '').startsWith('11')) ||
    null
  )
}

async function getActiveAccountsForOrg(admin: any, orgId: string): Promise<AccountingAccount[]> {
  const { data } = await (admin.from('accounts') as any)
    .select('id, code, name, type')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('code', { ascending: true })

  return (data || []) as AccountingAccount[]
}

async function getExistingJournal(admin: any, orgId: string, referenceType: string, referenceId: string) {
  const { data } = await (admin.from('journal_entries') as any)
    .select('id, status')
    .eq('org_id', orgId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .maybeSingle()

  return data as { id: string; status: string } | null
}

async function deleteJournalById(admin: any, entryId: string) {
  await (admin.from('journal_lines') as any).delete().eq('entry_id', entryId)
  await (admin.from('journal_entries') as any).delete().eq('id', entryId)
}

async function createAutoPostedJournal(
  admin: any,
  params: {
    orgId: string
    actorUserId: string
    entryDate: string
    description: string
    referenceType: string
    referenceId: string
    notes?: string
    lines: AutoJournalLine[]
  }
): Promise<AutoJournalResult> {
  const existingJournal = await getExistingJournal(admin, params.orgId, params.referenceType, params.referenceId)
  if (existingJournal?.status === 'VOIDED') {
    return { error: `Jurnal referensi ${params.referenceType} untuk transaksi ini sudah di-void.` }
  }
  if (existingJournal?.id) {
    return { entryId: existingJournal.id, existed: true }
  }

  const lines = params.lines.filter((line) => Math.abs(line.debit || 0) > 0.01 || Math.abs(line.credit || 0) > 0.01)
  if (lines.length < 2) {
    return { error: 'Minimal 2 baris jurnal diperlukan untuk pencatatan buku besar.' }
  }

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Jurnal tidak balance: debit ${totalDebit} ≠ credit ${totalCredit}` }
  }

  const { data: entry, error: entryError } = await (admin.from('journal_entries') as any)
    .insert({
      org_id: params.orgId,
      entry_date: params.entryDate,
      description: params.description,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      notes: params.notes || null,
      status: 'POSTED',
      is_auto: true,
      created_by: params.actorUserId,
    })
    .select('id')
    .single()

  if (entryError || !entry?.id) {
    return { error: entryError?.message || 'Gagal membuat header jurnal otomatis.' }
  }

  const { error: linesError } = await (admin.from('journal_lines') as any)
    .insert(lines.map((line) => ({
      entry_id: entry.id,
      account_id: line.account_id,
      debit: line.debit || 0,
      credit: line.credit || 0,
      memo: line.memo || null,
    })))

  if (linesError) {
    await deleteJournalById(admin, entry.id)
    return { error: linesError.message || 'Gagal membuat baris jurnal otomatis.' }
  }

  return { entryId: entry.id, existed: false }
}

/**
 * Membuat jurnal piutang & pendapatan untuk invoice SaaS.
 * Jurnal dicatat ke org operator (operatorOrgId) jika tersedia,
 * sehingga masuk ke GL/laporan keuangan operator — bukan GL tenant.
 * Jika operatorOrgId tidak tersedia, fallback ke org tenant (legacy).
 */
async function ensureOperatorSaleJournal(
  admin: any,
  actorUserId: string,
  invoice: {
    id: string
    org_id: string
    invoice_number: string
    amount: number | string
    tax_amount?: number | string | null
    created_at?: string | null
  },
  operatorOrgId?: string | null
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penjualan tidak valid untuk dicatat ke buku besar.' }
  }

  // Cari akun di org operator; jika tidak ada fallback ke org tenant (backward compat)
  const journalOrgId = operatorOrgId || invoice.org_id
  const accounts = await getActiveAccountsForOrg(admin, journalOrgId)
  const receivableAccount = resolveReceivableAccount(accounts)
  const revenueAccount = resolveRevenueAccount(accounts)
  const taxAmount = Math.max(0, Number(invoice.tax_amount || 0))
  const outputTaxAccount = taxAmount > 0 ? resolveOutputTaxAccount(accounts) : null

  if (!receivableAccount) {
    return { error: `Akun Piutang Usaha (1201) tidak ditemukan${operatorOrgId ? ' di organisasi operator' : ' untuk organisasi ini'}.` }
  }
  if (!revenueAccount) {
    return { error: `Akun Pendapatan Usaha (4001) tidak ditemukan${operatorOrgId ? ' di organisasi operator' : ' untuk organisasi ini'}.` }
  }
  if (taxAmount > 0 && !outputTaxAccount) {
    return { error: `Akun PPN Keluaran (2201) tidak ditemukan${operatorOrgId ? ' di organisasi operator' : ' untuk organisasi ini'}.` }
  }

  const revenueAmount = Math.max(0, totalAmount - taxAmount)
  return createAutoPostedJournal(admin, {
    orgId: journalOrgId,
    actorUserId,
    entryDate: toEntryDate(invoice.created_at),
    description: `Penjualan SaaS ${invoice.invoice_number}`,
    referenceType: 'SAAS_SALE',
    referenceId: invoice.id,
    notes: `Jurnal otomatis penjualan SaaS operator. Tenant: ${invoice.org_id}`,
    lines: [
      {
        account_id: receivableAccount.id,
        debit: totalAmount,
        credit: 0,
        memo: `Piutang ${invoice.invoice_number}`,
      },
      {
        account_id: revenueAccount.id,
        debit: 0,
        credit: revenueAmount,
        memo: `Pendapatan SaaS ${invoice.invoice_number}`,
      },
      ...(taxAmount > 0 && outputTaxAccount
        ? [{
            account_id: outputTaxAccount.id,
            debit: 0,
            credit: taxAmount,
            memo: `PPN ${invoice.invoice_number}`,
          }]
        : []),
    ],
  })
}

/**
 * Membuat jurnal penerimaan kas saat invoice SaaS dilunasi.
 * Jurnal dicatat ke org operator (operatorOrgId) jika tersedia.
 */
async function ensureOperatorReceiptJournal(
  admin: any,
  actorUserId: string,
  invoice: {
    id: string
    org_id: string
    invoice_number: string
    amount: number | string
    payment_method?: string | null
    updated_at?: string | null
  },
  paymentMethod: string,
  operatorOrgId?: string | null
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penerimaan tidak valid untuk dicatat ke buku besar.' }
  }

  const journalOrgId = operatorOrgId || invoice.org_id
  const accounts = await getActiveAccountsForOrg(admin, journalOrgId)
  const receivableAccount = resolveReceivableAccount(accounts)
  const settlementAccount = resolveCashSettlementAccount(accounts, paymentMethod)

  if (!receivableAccount) {
    return { error: `Akun Piutang Usaha (1201) tidak ditemukan${operatorOrgId ? ' di organisasi operator' : ' untuk organisasi ini'}.` }
  }
  if (!settlementAccount) {
    return { error: `Akun Kas/Bank default untuk penerimaan belum tersedia${operatorOrgId ? ' di organisasi operator' : ' di organisasi ini'}.` }
  }

  return createAutoPostedJournal(admin, {
    orgId: journalOrgId,
    actorUserId,
    entryDate: toEntryDate(invoice.updated_at),
    description: `Penerimaan SaaS ${invoice.invoice_number}`,
    referenceType: 'SAAS_CASH_IN',
    referenceId: invoice.id,
    notes: `Penerimaan kas otomatis dari pelunasan SaaS. Metode: ${paymentMethod || invoice.payment_method || 'MANUAL_TRANSFER'}. Tenant: ${invoice.org_id}`,
    lines: [
      {
        account_id: settlementAccount.id,
        debit: totalAmount,
        credit: 0,
        memo: `Penerimaan ${invoice.invoice_number}`,
      },
      {
        account_id: receivableAccount.id,
        debit: 0,
        credit: totalAmount,
        memo: `Pelunasan piutang ${invoice.invoice_number}`,
      },
    ],
  })
}

function parseNumericRecordJson(raw: string): Record<string, number> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const output: Record<string, number> = {}

    Object.entries(parsed || {}).forEach(([key, value]) => {
      const num = Number(value)
      if (Number.isFinite(num)) {
        output[key] = num
      }
    })

    return output
  } catch {
    return {}
  }
}

/**
 * Membuat jurnal pengeluaran kas untuk komisi reseller saat invoice SaaS dilunasi.
 * Menggunakan akun Biaya Pemasaran & Iklan (6005) untuk mencatat beban.
 */
async function ensureOperatorCommissionJournal(
  admin: any,
  actorUserId: string,
  invoice: {
    id: string
    invoice_number: string
    amount: number | string
    updated_at?: string | null
  },
  reseller: {
    name: string
    commission_type: string
    commission_value: number
  },
  paymentMethod: string,
  operatorOrgId: string
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (totalAmount <= 0) return {}

  let commAmount = 0
  if (String(reseller.commission_type).toUpperCase() === 'PERCENT') {
    commAmount = (totalAmount * Number(reseller.commission_value || 0)) / 100
  } else {
    commAmount = Number(reseller.commission_value || 0)
  }

  if (commAmount <= 0) return {}

  const accounts = await getActiveAccountsForOrg(admin, operatorOrgId)
  
  // Asumsikan komisi reseller masuk ke beban pemasaran (6005)
  const expenseAccount = accounts.find((a: any) => String(a.code) === '6005')
  const settlementAccount = resolveCashSettlementAccount(accounts, paymentMethod)

  if (!expenseAccount) {
    return { error: 'Akun Biaya Pemasaran & Iklan (6005) tidak ditemukan di organisasi operator untuk mencatat komisi.' }
  }
  if (!settlementAccount) {
    return { error: 'Akun Kas/Bank default untuk pembayaran komisi belum tersedia.' }
  }

  return createAutoPostedJournal(admin, {
    orgId: operatorOrgId,
    actorUserId,
    entryDate: toEntryDate(invoice.updated_at),
    description: `Pembayaran Komisi SaaS ${invoice.invoice_number}`,
    referenceType: 'SAAS_COMMISSION',
    referenceId: invoice.id,
    notes: `Pembayaran komisi reseller otomatis untuk mitra ${reseller.name}. Invoice: ${invoice.invoice_number}`,
    lines: [
      {
        account_id: expenseAccount.id,
        debit: commAmount,
        credit: 0,
        memo: `Beban Komisi ${reseller.name}`,
      },
      {
        account_id: settlementAccount.id,
        debit: 0,
        credit: commAmount,
        memo: `Pembayaran Komisi ${reseller.name}`,
      },
    ],
  })
}

async function assertPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error('Akses ditolak. Modul ini khusus pengelola SaaS.')
  }
  return user
}

/**
 * Mencari org_id milik operator SaaS (platform admin).
 * Jurnal keuangan SaaS harus dicatat ke GL org operator sendiri,
 * bukan ke GL org tenant — agar masuk ke laporan keuangan operator.
 */
async function getOperatorOrgId(
  admin: any,
  actorEmail: string | null | undefined
): Promise<string | null> {
  if (!actorEmail) return null
  const { data } = await (admin.from('organizations') as any)
    .select('id')
    .eq('owner_email', actorEmail.toLowerCase().trim())
    .limit(1)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

function buildQuoteNumber() {
  const stamp = buildDocumentStamp()
  return `QTN-${stamp}`
}

function buildSalesNumber() {
  const stamp = buildDocumentStamp()
  return `INV-${stamp}`
}

function buildDocumentStamp() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${datePart}-${rand}`
}

function isQuotationNumber(invoiceNumber: string | null | undefined) {
  return String(invoiceNumber || '').toUpperCase().startsWith('QTN-')
}

export async function getOperatorSaasSnapshot(): Promise<OperatorSnapshot> {
  await assertPlatformAdmin()
  const scoped = (await createClient()) as any
  const admin = await createAdminClient()

  // Ambil org operator untuk query resellers
  const operatorOrgId = await getOperatorOrgId(admin, (await (await createClient()).auth.getUser()).data.user?.email)

  const [orgRes, pkgRes, invoiceRes, resellerRes] = await Promise.all([
    scoped.from('organizations').select('id, name').order('name', { ascending: true }),
    scoped.from('saas_packages').select('id, name, price, billing, modules, addons, core_prices, operational_prices').order('price', { ascending: true }),
    admin
      .from('saas_invoices')
      .select(SAAS_INVOICE_SELECT_WITH_PRICING_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500),
    operatorOrgId
      ? admin
          .from('sales_resellers')
          .select('id, name, reseller_type, company_name, commission_type, commission_value, is_active')
          .eq('org_id', operatorOrgId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  let rawInvoiceRows = (invoiceRes.data || []) as Array<{
    id: string
    org_id: string
    package_id: string | null
    reseller_id?: string | null
    invoice_number: string
    item_name?: string | null
    item_description?: string | null
    discount_percent?: number | string | null
    discount_amount?: number | string | null
    tax_percent?: number | string | null
    tax_amount?: number | string | null
    amount: number | string
    status: string
    payment_method: string | null
    due_date: string | null
    created_at: string
    updated_at: string
    organization?: { name: string } | null
    package?: { name: string } | null
    reseller?: { id: string; name: string; commission_type: string | null; commission_value: number | null } | null
  }>

  // Backward compatibility: some environments still don't have item_name/item_description.
  if (invoiceRes.error) {
    if (hasMissingInvoicePricingColumn(invoiceRes.error.message)) {
      const invoiceWithItemsRes = await admin
        .from('saas_invoices')
        .select(SAAS_INVOICE_SELECT_WITH_ITEM_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(500)

      rawInvoiceRows = (invoiceWithItemsRes.data || []) as typeof rawInvoiceRows
    } else if (hasMissingInvoiceItemColumn(invoiceRes.error.message)) {
      const legacyInvoiceRes = await admin
        .from('saas_invoices')
        .select(SAAS_INVOICE_SELECT_BASE)
        .order('created_at', { ascending: false })
        .limit(500)

      rawInvoiceRows = (legacyInvoiceRes.data || []) as typeof rawInvoiceRows
    }
  }

  const orgRows = (orgRes.data || []) as Array<{ id: string; name: string }>
  const packageRows = (pkgRes.data || []) as Array<{
    id: string
    name: string
    price: number | string
    billing?: string | null
    modules?: unknown
    addons?: unknown
    core_prices?: unknown
    operational_prices?: unknown
  }>
  const resellerRows = (resellerRes.data || []) as Array<{
    id: string
    name: string
    reseller_type?: string | null
    company_name?: string | null
    commission_type?: string | null
    commission_value?: number | string | null
    is_active?: boolean
  }>

  const { data: aiPkgRows, error: aiPkgError } = await admin
    .from('ai_token_topup_packages')
    .select('id, name, description, tokens, price_idr, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('tokens', { ascending: true })

  const orgs = orgRows.map((org) => ({ id: org.id, name: org.name }))
  const packages = packageRows.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    price: Number(pkg.price || 0),
    billing: pkg.billing || undefined,
    modules: normalizeSaasEntitlementList(toStringArray(pkg.modules)),
    addons: normalizeSaasEntitlementList(toStringArray(pkg.addons)),
    corePrices: (pkg.core_prices as Record<string, number>) ?? {},
    operationalPrices: (pkg.operational_prices as Record<string, number>) ?? {},
  }))
  const resellers: OperatorResellerOption[] = resellerRows.map((r) => ({
    id: r.id,
    name: r.name,
    reseller_type: r.reseller_type || 'PERSONAL',
    company_name: r.company_name || null,
    commission_type: r.commission_type || null,
    commission_value: r.commission_value != null ? Number(r.commission_value) : null,
    is_active: r.is_active ?? true,
  }))
  const aiTokenPackages: OperatorAiTokenPackageOption[] = aiPkgError
    ? []
    : ((aiPkgRows || []) as Array<{
      id: string
      name: string
      description?: string | null
      tokens?: number | string
      price_idr?: number | string
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || null,
      tokens: Number(row.tokens || 0),
      price: Number(row.price_idr || 0),
    }))

  const invoices: InvoiceRecord[] = rawInvoiceRows.map((inv) => ({
    id: inv.id,
    org_id: inv.org_id,
    package_id: inv.package_id,
    reseller_id: inv.reseller_id ?? null,
    invoice_number: inv.invoice_number,
    item_name: inv.item_name ?? null,
    item_description: inv.item_description ?? null,
    discount_percent: Number(inv.discount_percent || 0),
    discount_amount: Number(inv.discount_amount || 0),
    tax_percent: Number(inv.tax_percent || 0),
    tax_amount: Number(inv.tax_amount || 0),
    amount: Number(inv.amount || 0),
    status: inv.status,
    payment_method: inv.payment_method,
    due_date: inv.due_date,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
    organization: inv.organization,
    package: inv.package,
    reseller: inv.reseller ?? null,
  }))

  const quotations = invoices.filter((inv) => isQuotationNumber(inv.invoice_number))
  const sales = invoices.filter((inv) => !isQuotationNumber(inv.invoice_number))

  const summary = {
    totalQuotes: quotations.length,
    totalOpenSales: sales.filter((inv) => inv.status !== 'PAID' && inv.status !== 'VOIDED').length,
    totalPaidSales: sales.filter((inv) => inv.status === 'PAID').length,
    totalSalesValue: sales.filter((inv) => inv.status === 'PAID').reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
  }

  return { orgs, packages, aiTokenPackages, resellers, quotations, sales, summary }
}

async function buildQuotationDraftFromFormData(admin: any, formData: FormData): Promise<{ error: string } | { data: QuotationDraft }> {
  const orgId = String(formData.get('org_id') || '')
  const packageId = String(formData.get('package_id') || '')
  const note = String(formData.get('note') || '').trim()
  const customAmountRaw = String(formData.get('amount') || '').trim()
  const selectedAddonIds = formData.getAll('selected_addons').map((value) => String(value || '').trim()).filter(Boolean)
  const selectedModules = normalizeSaasEntitlementList(
    formData.getAll('selected_modules').map((value) => String(value || '').trim()).filter(Boolean)
  )
  const aiTokenPackageId = String(formData.get('ai_token_package_id') || '').trim()
  const extraEntityQtyRaw = String(formData.get('extra_entity_qty') || '0').trim()
  const extraBranchQtyRaw = String(formData.get('extra_branch_qty') || '0').trim()
  const extraEntityUnitPriceRaw = String(formData.get('extra_entity_unit_price') || '').trim()
  const extraBranchUnitPriceRaw = String(formData.get('extra_branch_unit_price') || '').trim()
  const durationMonthsRaw = String(formData.get('duration_months') || '1').trim()
  const addonPriceOverrides = parseNumericRecordJson(String(formData.get('addon_price_overrides_json') || ''))
  const addonAnchorOverrides = parseNumericRecordJson(String(formData.get('addon_anchor_overrides_json') || ''))
  const discountPercentRaw = String(formData.get('discount_percent') || '0').trim()
  const taxPercentRaw = String(formData.get('tax_percent') || '0').trim()

  if (!orgId || !packageId) {
    return { error: 'Organisasi dan paket wajib dipilih.' }
  }

  const { data: pkgData } = await admin
    .from('saas_packages')
    .select('name, price, modules, core_prices, operational_prices')
    .eq('id', packageId)
    .maybeSingle()
  const pkg = pkgData as (PackageLookup & { modules?: unknown; core_prices?: unknown; operational_prices?: unknown }) | null
  if (!pkg) {
    return { error: 'Paket SaaS tidak ditemukan.' }
  }

  const parseNumber = (value: string, fallback = 0) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) return fallback

    const num = Number(normalizedValue)
    return Number.isFinite(num) ? num : fallback
  }

  const baseAmount = parseNumber(customAmountRaw, Number(pkg.price || 0))
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { error: 'Nominal penawaran tidak valid.' }
  }

  const extraEntityQty = Math.max(0, Math.floor(parseNumber(extraEntityQtyRaw, 0)))
  const extraBranchQty = Math.max(0, Math.floor(parseNumber(extraBranchQtyRaw, 0)))
  const durationMonths = Math.max(1, Math.floor(parseNumber(durationMonthsRaw, 1)))
  const extraEntityUnitPrice = Math.max(0, parseNumber(extraEntityUnitPriceRaw, EXTRA_ENTITY_UNIT_PRICE))
  const extraBranchUnitPrice = Math.max(0, parseNumber(extraBranchUnitPriceRaw, EXTRA_BRANCH_UNIT_PRICE))

  let discountPercent = Math.max(0, parseNumber(discountPercentRaw, 0))
  if (discountPercent > 100) discountPercent = 100

  let taxPercent = Math.max(0, parseNumber(taxPercentRaw, 0))
  if (taxPercent > 100) taxPercent = 100

  const selectedAddonBreakdown = selectedAddonIds.map((addonId) => {
    const addon = getOperatorAddonById(addonId)
    const promoPrice = Math.max(0, parseNumber(String(addonPriceOverrides[addonId] ?? addon?.price ?? 0), Number(addon?.price || 0)))
    const anchorPrice = Math.max(promoPrice, parseNumber(String(addonAnchorOverrides[addonId] ?? addon?.anchorPrice ?? promoPrice), promoPrice))
    const billing = String(addon?.billing || 'Bulan').trim()
    const isSingleBill = billing.toLowerCase().includes('single')
    const marketplaceLabel = getOperatorMarketplaceLabel({ name: addon?.name || addonId })

    return {
      id: addonId,
      name: addon?.name || addonId,
      marketplaceLabel,
      promoPrice,
      anchorPrice,
      billing,
      isSingleBill,
    }
  })

  const monthlyAddonTotal = selectedAddonBreakdown
    .filter((addon) => !addon.isSingleBill)
    .reduce((acc, addon) => acc + addon.promoPrice, 0)
  const singleBillAddonTotal = selectedAddonBreakdown
    .filter((addon) => addon.isSingleBill)
    .reduce((acc, addon) => acc + addon.promoPrice, 0)

  let aiTokenTotal = 0
  let aiTokenLabel = ''
  if (aiTokenPackageId) {
    const { data: tokenPkgData } = await admin
      .from('ai_token_topup_packages')
      .select('name, tokens, price_idr')
      .eq('id', aiTokenPackageId)
      .eq('is_active', true)
      .maybeSingle()

    if (tokenPkgData) {
      const tokenPkg = tokenPkgData as { name: string; tokens: number | string; price_idr: number | string }
      aiTokenTotal = Number(tokenPkg.price_idr || 0)
      aiTokenLabel = `${tokenPkg.name} (${Number(tokenPkg.tokens || 0).toLocaleString('id-ID')} token)`
    }
  }

  let modulesMonthlyTotal = 0
  if (selectedModules.length > 0) {
    const corePrices = (pkg.core_prices as Record<string, number>) || {}
    const operationalPrices = (pkg.operational_prices as Record<string, number>) || {}
    
    modulesMonthlyTotal = selectedModules.reduce((acc, modKey) => {
      const corePrice = corePrices[modKey] || 0
      const operationalPrice = operationalPrices[modKey] || 0
      const isAddon = OPERATOR_ADDON_OPTIONS.some((a: any) => a.name === modKey || a.name.toLowerCase().includes(modKey.toLowerCase().split(' ')[0]))
      return acc + corePrice + (isAddon ? 0 : operationalPrice)
    }, 0)
  }

  const extraEntityTotal = extraEntityQty * extraEntityUnitPrice
  const extraBranchTotal = extraBranchQty * extraBranchUnitPrice
  const monthlySubtotalAmount = baseAmount + modulesMonthlyTotal + monthlyAddonTotal + extraEntityTotal + extraBranchTotal
  const oneTimeSubtotalAmount = singleBillAddonTotal + aiTokenTotal
  const durationSubtotalAmount = monthlySubtotalAmount * durationMonths
  const subtotalAmount = durationSubtotalAmount + oneTimeSubtotalAmount
  const discountAmount = (subtotalAmount * discountPercent) / 100
  const taxableAmount = Math.max(0, subtotalAmount - discountAmount)
  const taxAmount = (taxableAmount * taxPercent) / 100
  const finalAmount = Math.max(0, taxableAmount + taxAmount)

  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    return { error: 'Total penawaran tidak valid setelah kalkulasi diskon/pajak.' }
  }

  const packageModules = normalizeSaasEntitlementList(toStringArray(pkg.modules))
  const modulesForQuote = normalizeSaasEntitlementList(selectedModules.length > 0 ? selectedModules : packageModules)
  const packageArchitecture = getSaasPackageArchitecture(modulesForQuote)
  const quoteCapabilities = normalizeSaasEntitlementList([
    ...modulesForQuote,
    ...selectedAddonBreakdown.map((addon) => addon.name),
  ])
  const incompatibleAddons = selectedAddonBreakdown
    .map((addon) => {
      const addonOption = getOperatorAddonById(addon.id)
      const compatibility = getOperatorMarketplaceCompatibility(addonOption || addon, {
        coreFamilyLevel: packageArchitecture.coreFamilyLevel,
        enabledCapabilities: quoteCapabilities,
      })

      return compatibility.isCompatible
        ? null
        : `${addon.name}: ${compatibility.reason || 'belum kompatibel dengan Core Family yang dipilih.'}`
    })
    .filter(Boolean)

  if (incompatibleAddons.length > 0) {
    return { error: `Module/Add-on belum kompatibel. ${incompatibleAddons.join(' ')}` }
  }

  const incompatibleModules: string[] = []
  modulesForQuote.forEach(modName => {
    const modDef = getModuleByKey(modName)
    if (modDef?.requires && modDef.requires.length > 0) {
      const missing = modDef.requires.filter(req => !quoteCapabilities.some(cap => cap.toLowerCase() === req.toLowerCase()))
      if (missing.length > 0) {
        incompatibleModules.push(`${modName} (Butuh: ${missing.join(', ')})`)
      }
    }
  })

  if (incompatibleModules.length > 0) {
    return { error: `Syarat modul belum terpenuhi: ${incompatibleModules.join(' | ')}. Tambahkan modul yang dibutuhkan ke dalam paket.` }
  }

  const coreScopeLabels = Array.from(new Set(
    modulesForQuote
      .map((moduleName) => getSaasCapabilityDisplayLabel(moduleName))
      .filter(Boolean)
  ))

  const detailLines = [
    `Core Family: ${pkg.name}`,
    `Core Family Layer: ${packageArchitecture.bundleLabel}`,
    `Harga Core Family: ${formatCurrencyId(baseAmount)}`,
    `Durasi: ${durationMonths} bulan`,
    ...selectedAddonBreakdown.map((addon) => (
      addon.anchorPrice > addon.promoPrice
        ? `${addon.marketplaceLabel}${addon.isSingleBill ? ' Single Bill' : ''} ${addon.name}: ${formatCurrencyId(addon.anchorPrice)} -> ${formatCurrencyId(addon.promoPrice)}`
        : `${addon.marketplaceLabel}${addon.isSingleBill ? ' Single Bill' : ''} ${addon.name}: ${formatCurrencyId(addon.promoPrice)}`
    )),
    ...(aiTokenPackageId && aiTokenLabel ? [`Token AI: ${aiTokenLabel} (${formatCurrencyId(aiTokenTotal)})`] : []),
    ...(extraEntityQty > 0 ? [`Entitas tambahan: ${extraEntityQty} x ${formatCurrencyId(extraEntityUnitPrice)} = ${formatCurrencyId(extraEntityTotal)}`] : []),
    ...(extraBranchQty > 0 ? [`Unit tambahan: ${extraBranchQty} x ${formatCurrencyId(extraBranchUnitPrice)} = ${formatCurrencyId(extraBranchTotal)}`] : []),
    `Subtotal / bulan: ${formatCurrencyId(monthlySubtotalAmount)}`,
    `Subtotal durasi (${durationMonths} bulan): ${formatCurrencyId(durationSubtotalAmount)}`,
    ...(oneTimeSubtotalAmount > 0 ? [`Subtotal one-time: ${formatCurrencyId(oneTimeSubtotalAmount)}`] : []),
    `Subtotal: ${formatCurrencyId(subtotalAmount)}`,
    ...(discountAmount > 0 || discountPercent > 0 ? [`Diskon setelah durasi: ${discountPercent}% (${formatCurrencyId(discountAmount)})`] : []),
    ...(taxAmount > 0 || taxPercent > 0 ? [`Pajak: ${taxPercent}% (${formatCurrencyId(taxAmount)})`] : []),
    `Grand total: ${formatCurrencyId(finalAmount)}`,
    ...(coreScopeLabels.length > 0 ? [`Core Family Scope: ${coreScopeLabels.join(', ')}`] : []),
    ...(note ? [`Catatan: ${note}`] : []),
  ]

  return {
    data: {
      orgId,
      packageId,
      packageName: pkg.name,
      bundleLabel: packageArchitecture.bundleLabel,
      finalAmount,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      itemDescription: detailLines.join('\n') || 'Penawaran dibuat oleh operator SaaS',
    },
  }
}

export async function createOperatorQuotation(formData: FormData) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  const draftResult = await buildQuotationDraftFromFormData(admin, formData)
  if ('error' in draftResult) {
    return { error: draftResult.error }
  }
  const draft = draftResult.data
  const invoiceNumber = buildQuoteNumber()
  const resellerId = String(formData.get('reseller_id') || '').trim() || null

  const baseInvoicePayload = {
    org_id: draft.orgId,
    package_id: draft.packageId,
    invoice_number: invoiceNumber,
    amount: draft.finalAmount,
    status: 'UNPAID',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reseller_id: resellerId,
  }

  const payloadWithItemsAndPricing = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
  }

  let error: { message: string } | null = null
  const insertAttempts = [payloadWithItemsAndPricing, payloadWithItemsOnly, baseInvoicePayload]

  for (const payload of insertAttempts) {
    const insertRes = await (admin.from('saas_invoices') as any).insert(payload)
    if (!insertRes.error) {
      error = null
      break
    }

    error = { message: insertRes.error.message }
    if (!insertRes.error.message.includes('Could not find the')) {
      break
    }
  }

  if (error) {
    return { error: `Gagal membuat penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  return { success: true, invoiceNumber }
}

export async function updateOperatorQuotation(formData: FormData) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  const quoteId = String(formData.get('quote_id') || '').trim()
  if (!quoteId) return { error: 'ID penawaran tidak valid.' }

  const { data: currentQuoteData } = await admin
    .from('saas_invoices')
    .select('id, org_id, invoice_number, status, due_date')
    .eq('id', quoteId)
    .maybeSingle()
  const currentQuote = currentQuoteData as Pick<InvoiceRecord, 'id' | 'org_id' | 'invoice_number' | 'status' | 'due_date'> | null

  if (!currentQuote) return { error: 'Data penawaran tidak ditemukan.' }
  if (!isQuotationNumber(currentQuote.invoice_number)) {
    return { error: 'Data ini bukan penawaran yang bisa diubah.' }
  }
  if (currentQuote.status === 'PAID') {
    return { error: 'Penawaran yang sudah PAID tidak bisa diedit.' }
  }

  const draftResult = await buildQuotationDraftFromFormData(admin, formData)
  if ('error' in draftResult) {
    return { error: draftResult.error }
  }
  const draft = draftResult.data

  const resellerId = String(formData.get('reseller_id') || '').trim() || null

  const baseUpdatePayload = {
    org_id: currentQuote.org_id,
    package_id: draft.packageId,
    amount: draft.finalAmount,
    due_date: currentQuote.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reseller_id: resellerId,
    updated_at: new Date().toISOString(),
  }
  const payloadWithItemsAndPricing = {
    ...baseUpdatePayload,
    item_name: `Penawaran SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseUpdatePayload,
    item_name: `Penawaran SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
  }

  let error: { message: string } | null = null
  const updateAttempts = [payloadWithItemsAndPricing, payloadWithItemsOnly, baseUpdatePayload]

  for (const payload of updateAttempts) {
    const updateRes = await (admin.from('saas_invoices') as any)
      .update(payload)
      .eq('id', quoteId)
    if (!updateRes.error) {
      error = null
      break
    }

    error = { message: updateRes.error.message }
    if (!updateRes.error.message.includes('Could not find the')) {
      break
    }
  }

  if (error) {
    return { error: `Gagal mengubah penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  revalidatePath(`/saas/dokumen/${quoteId}`)
  return { success: true, invoiceNumber: currentQuote.invoice_number }
}

export async function updateOperatorSaleInvoice(formData: FormData) {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  const invoiceId = String(formData.get('invoice_id') || '').trim()
  if (!invoiceId) return { error: 'ID invoice penjualan tidak valid.' }

  const { data: currentSaleData } = await admin
    .from('saas_invoices')
    .select('id, org_id, package_id, invoice_number, status, due_date, created_at, amount, tax_amount')
    .eq('id', invoiceId)
    .maybeSingle()
  const currentSale = currentSaleData as Pick<InvoiceRecord, 'id' | 'org_id' | 'package_id' | 'invoice_number' | 'status' | 'due_date' | 'created_at' | 'amount' | 'tax_amount'> | null

  if (!currentSale) return { error: 'Data invoice penjualan tidak ditemukan.' }
  if (isQuotationNumber(currentSale.invoice_number)) {
    return { error: 'Data ini adalah penawaran. Gunakan menu edit penawaran.' }
  }
  if (currentSale.status === 'PAID') {
    return { error: 'Invoice penjualan yang sudah PAID tidak bisa diedit.' }
  }

  const draftResult = await buildQuotationDraftFromFormData(admin, formData)
  if ('error' in draftResult) {
    return { error: draftResult.error }
  }
  const draft = draftResult.data

  const preflightJournal = await ensureOperatorSaleJournal(admin, actor.id, {
    id: currentSale.id,
    org_id: currentSale.org_id,
    invoice_number: currentSale.invoice_number,
    amount: draft.finalAmount,
    tax_amount: draft.taxAmount,
    created_at: currentSale.created_at,
  })
  if (preflightJournal.error) {
    return { error: `Gagal validasi jurnal penjualan: ${preflightJournal.error}` }
  }

  const baseUpdatePayload = {
    org_id: draft.orgId,
    package_id: draft.packageId,
    amount: draft.finalAmount,
    due_date: currentSale.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  const payloadWithItemsAndPricing = {
    ...baseUpdatePayload,
    item_name: `Invoice SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseUpdatePayload,
    item_name: `Invoice SaaS: ${draft.bundleLabel} - ${draft.packageName}`,
    item_description: draft.itemDescription,
  }

  let error: { message: string } | null = null
  const updateAttempts = [payloadWithItemsAndPricing, payloadWithItemsOnly, baseUpdatePayload]

  for (const payload of updateAttempts) {
    const updateRes = await (admin.from('saas_invoices') as any)
      .update(payload)
      .eq('id', invoiceId)
    if (!updateRes.error) {
      error = null
      break
    }

    error = { message: updateRes.error.message }
    if (!updateRes.error.message.includes('Could not find the')) {
      break
    }
  }

  if (error) {
    return { error: `Gagal mengubah invoice penjualan: ${error.message}` }
  }

  if (preflightJournal.entryId && preflightJournal.existed) {
    await deleteJournalById(admin, preflightJournal.entryId)

    const recreatedJournal = await ensureOperatorSaleJournal(admin, actor.id, {
      id: currentSale.id,
      org_id: currentSale.org_id,
      invoice_number: currentSale.invoice_number,
      amount: draft.finalAmount,
      tax_amount: draft.taxAmount,
      created_at: currentSale.created_at,
    })

    if (recreatedJournal.error) {
      // best effort rollback journal dengan nominal sebelumnya
      await ensureOperatorSaleJournal(admin, actor.id, {
        id: currentSale.id,
        org_id: currentSale.org_id,
        invoice_number: currentSale.invoice_number,
        amount: currentSale.amount,
        tax_amount: currentSale.tax_amount,
        created_at: currentSale.created_at,
      })
      return { error: `Invoice tersimpan, tetapi sinkronisasi jurnal gagal: ${recreatedJournal.error}. Cek jurnal penjualan secara manual.` }
    }
  }

  revalidatePath('/saas/penjualan')
  revalidatePath('/saas/penawaran')
  revalidatePath('/accounting/journal')
  revalidatePath(`/saas/dokumen/${invoiceId}`)
  return { success: true, invoiceNumber: currentSale.invoice_number }
}

export async function deleteOperatorQuotation(invoiceId: string) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'ID penawaran tidak valid.' }

  const { data: quoteData } = await admin
    .from('saas_invoices')
    .select('id, invoice_number, status')
    .eq('id', invoiceId)
    .maybeSingle()
  const quote = quoteData as Pick<InvoiceRecord, 'id' | 'invoice_number' | 'status'> | null

  if (!quote) return { error: 'Data penawaran tidak ditemukan.' }
  if (!isQuotationNumber(quote.invoice_number)) {
    return { error: 'Data ini bukan penawaran yang bisa dihapus.' }
  }
  if (quote.status === 'PAID') {
    return { error: 'Penawaran yang sudah PAID tidak bisa dihapus.' }
  }

  const { error } = await (admin.from('saas_invoices') as any)
    .delete()
    .eq('id', invoiceId)

  if (error) {
    return { error: `Gagal menghapus penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  return { success: true }
}

export async function convertQuotationToSale(invoiceId: string) {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penawaran tidak valid.' }

  let invoiceRes = await admin
    .from('saas_invoices')
    .select('id, org_id, invoice_number, item_name, amount, tax_amount, created_at')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceRes.error && hasMissingInvoiceItemColumn(invoiceRes.error.message)) {
    invoiceRes = await admin
      .from('saas_invoices')
      .select('id, org_id, invoice_number, amount, tax_amount, created_at')
      .eq('id', invoiceId)
      .maybeSingle()
  }

  const invoice = invoiceRes.data as (Pick<InvoiceRecord, 'id' | 'org_id' | 'invoice_number' | 'amount' | 'tax_amount' | 'created_at'> & {
    item_name?: string | null
  }) | null

  if (!invoice) return { error: 'Data penawaran tidak ditemukan.' }
  if (!isQuotationNumber(invoice.invoice_number)) {
    return { error: 'Data ini bukan penawaran yang bisa dikonversi.' }
  }

  const nextInvoiceNumber = buildSalesNumber()

  // Cari org operator untuk mencatat jurnal ke GL operator (bukan tenant)
  const operatorOrgId = await getOperatorOrgId(admin, actor.email)

  // Pencatatan jurnal bersifat best-effort: jika akun COA belum tersedia,
  // konversi tetap dilanjutkan. Jurnal bisa dicatat manual kemudian.
  const journalResult = await ensureOperatorSaleJournal(admin, actor.id, {
    id: invoice.id,
    org_id: invoice.org_id,
    invoice_number: nextInvoiceNumber,
    amount: invoice.amount,
    tax_amount: invoice.tax_amount,
    created_at: new Date().toISOString(),
  }, operatorOrgId)
  const journalWarning = journalResult.error
    ? `(Jurnal otomatis dilewati: ${journalResult.error})`
    : null

  const baseUpdatePayload = {
    invoice_number: nextInvoiceNumber,
    updated_at: new Date().toISOString(),
  }
  const payloadWithItemName = {
    ...baseUpdatePayload,
    item_name: String(invoice.item_name || '').replace(/^Penawaran SaaS:/i, 'Invoice SaaS:') || invoice.item_name || null,
  }

  let error: { message: string } | null = null
  const updateAttempts = [payloadWithItemName, baseUpdatePayload]

  for (const payload of updateAttempts) {
    const updateRes = await (admin.from('saas_invoices') as any)
      .update(payload)
      .eq('id', invoiceId)
    if (!updateRes.error) {
      error = null
      break
    }

    error = { message: updateRes.error.message }
    if (!updateRes.error.message.includes('Could not find the')) {
      break
    }
  }

  if (error) {
    // Jika update gagal, rollback jurnal yang sudah terbuat (jika ada)
    if (journalResult.entryId && !journalResult.existed && !journalWarning) {
      await deleteJournalById(admin, journalResult.entryId)
    }
    return { error: `Gagal konversi penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  revalidatePath('/accounting/journal')
  return { success: true, warning: journalWarning ?? undefined }
}

export async function markOperatorSalePaid(invoiceId: string, paymentMethod: string = 'MANUAL_TRANSFER') {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penjualan tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, org_id, package_id, reseller_id, invoice_number, item_description, amount, tax_amount, status, payment_method, created_at, updated_at')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'org_id' | 'package_id' | 'reseller_id' | 'invoice_number' | 'item_description' | 'amount' | 'tax_amount' | 'status' | 'payment_method' | 'created_at' | 'updated_at'> | null

  if (!invoice) return { error: 'Data penjualan tidak ditemukan.' }
  if (invoice.status === 'PAID') {
    const addonSyncResult = await syncOperatorInvoiceAddons(admin, invoice)
    if (addonSyncResult.error) {
      return { error: `Invoice sudah PAID, tetapi sinkronisasi add-on gagal: ${addonSyncResult.error}` }
    }
    return { success: true }
  }

  // Cari org operator untuk mencatat jurnal ke GL operator (bukan tenant)
  const operatorOrgId = await getOperatorOrgId(admin, actor.email)

  const saleJournalResult = await ensureOperatorSaleJournal(admin, actor.id, {
    id: invoice.id,
    org_id: invoice.org_id,
    invoice_number: invoice.invoice_number,
    amount: invoice.amount,
    tax_amount: invoice.tax_amount,
    created_at: invoice.created_at,
  }, operatorOrgId)

  if (saleJournalResult.error) {
    return { error: `Gagal sinkronisasi jurnal penjualan: ${saleJournalResult.error}` }
  }

  const receiptJournalResult = await ensureOperatorReceiptJournal(admin, actor.id, {
    id: invoice.id,
    org_id: invoice.org_id,
    invoice_number: invoice.invoice_number,
    amount: invoice.amount,
    payment_method: invoice.payment_method,
    updated_at: new Date().toISOString(),
  }, paymentMethod, operatorOrgId)

  if (receiptJournalResult.error) {
    return { error: `Gagal membuat jurnal pelunasan: ${receiptJournalResult.error}` }
  }

  // Jurnal Komisi Reseller jika ada
  let commJournalResult: AutoJournalResult = {}
  if (invoice.reseller_id) {
    const { data: resellerData } = await (admin.from('sales_resellers') as any)
      .select('name, commission_type, commission_value')
      .eq('id', invoice.reseller_id)
      .maybeSingle()
    
    if (resellerData) {
      commJournalResult = await ensureOperatorCommissionJournal(admin, actor.id, {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        updated_at: new Date().toISOString(),
      }, resellerData, paymentMethod, operatorOrgId || '')
      
      if (commJournalResult.error) {
        return { error: `Gagal membuat jurnal komisi reseller: ${commJournalResult.error}` }
      }
    }
  }

  const { error: invoiceUpdateError } = await (admin.from('saas_invoices') as any)
    .update({
      status: 'PAID',
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (invoiceUpdateError) {
    if (receiptJournalResult.entryId && !receiptJournalResult.existed) {
      await deleteJournalById(admin, receiptJournalResult.entryId)
    }
    return { error: `Gagal update status pembayaran: ${invoiceUpdateError.message}` }
  }

  if (invoice.package_id) {
    const [{ data: pkgData }, { data: orgData }] = await Promise.all([
      admin.from('saas_packages').select('name').eq('id', invoice.package_id).maybeSingle(),
      admin.from('organizations').select('settings, enabled_modules').eq('id', invoice.org_id).maybeSingle(),
    ])
    const pkg = pkgData as { name: string } | null
    const org = orgData as { settings?: Record<string, unknown> | null, enabled_modules?: string[] | null } | null

    if (pkg?.name) {
      let customModules: string[] = []
      if (invoice.item_description) {
        const coreScopeLine = invoice.item_description.split('\n').find(l => l.startsWith('Core Family Scope:'))
        if (coreScopeLine) {
          customModules = coreScopeLine.replace('Core Family Scope:', '').split(',').map(s => s.trim()).filter(Boolean)
        }
      }

      const currentSettings = (org?.settings && typeof org.settings === 'object') ? org.settings : {}
      const isCustom = customModules.length > 0

      await (admin.from('organizations') as any)
        .update({
          enabled_modules: isCustom ? customModules : org?.enabled_modules,
          settings: {
            ...currentSettings,
            plan: pkg.name,
            use_custom_modules: isCustom ? true : currentSettings.use_custom_modules,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', invoice.org_id)
    }
  }

  const addonSyncResult = await syncOperatorInvoiceAddons(admin, invoice)
  if (addonSyncResult.error) {
    revalidatePath('/saas/penjualan')
    revalidatePath('/billing')
    revalidatePath('/accounting/journal')
    revalidatePath('/', 'layout')
    return { error: `Invoice sudah PAID, tetapi aktivasi add-on gagal: ${addonSyncResult.error}` }
  }

  revalidatePath('/saas/penjualan')
  revalidatePath('/billing')
  revalidatePath('/accounting/journal')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getOperatorInvoiceDocument(invoiceId: string): Promise<OperatorDocumentSnapshot | null> {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return null

  const detailSelectWithPricing = 'id, org_id, package_id, invoice_number, item_name, item_description, discount_percent, discount_amount, tax_percent, tax_amount, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name, owner_email), package:saas_packages(name, price, billing, modules, addons)'
  const detailSelectWithItems = 'id, org_id, package_id, invoice_number, item_name, item_description, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name, owner_email), package:saas_packages(name, price, billing, modules, addons)'
  const detailSelectLegacy = 'id, org_id, package_id, invoice_number, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name, owner_email), package:saas_packages(name, price, billing, modules, addons)'

  let invoiceRes = await admin
    .from('saas_invoices')
    .select(detailSelectWithPricing)
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceRes.error) {
    if (hasMissingInvoicePricingColumn(invoiceRes.error.message)) {
      invoiceRes = await admin
        .from('saas_invoices')
        .select(detailSelectWithItems)
        .eq('id', invoiceId)
        .maybeSingle()
    } else if (hasMissingInvoiceItemColumn(invoiceRes.error.message)) {
      invoiceRes = await admin
        .from('saas_invoices')
        .select(detailSelectLegacy)
        .eq('id', invoiceId)
        .maybeSingle()
    }
  }

  if (invoiceRes.error || !invoiceRes.data) {
    return null
  }

  const rawInvoice = invoiceRes.data as {
    id: string
    org_id: string
    package_id: string | null
    invoice_number: string
    item_name?: string | null
    item_description?: string | null
    discount_percent?: number | string | null
    discount_amount?: number | string | null
    tax_percent?: number | string | null
    tax_amount?: number | string | null
    amount: number | string
    status: string
    payment_method: string | null
    due_date: string | null
    created_at: string
    updated_at: string
    organization?: { name: string; owner_email?: string | null } | null
    package?: {
      name: string
      price?: number | string | null
      billing?: string | null
      modules?: unknown
      addons?: unknown
    } | null
  }

  const packageModules = normalizeSaasEntitlementList(toStringArray(rawInvoice.package?.modules))
  const packageAddons = normalizeSaasEntitlementList(toStringArray(rawInvoice.package?.addons))

  const normalizedInvoice: OperatorInvoiceDocument = {
    id: rawInvoice.id,
    org_id: rawInvoice.org_id,
    package_id: rawInvoice.package_id,
    invoice_number: rawInvoice.invoice_number,
    item_name: rawInvoice.item_name ?? null,
    item_description: rawInvoice.item_description ?? null,
    discount_percent: Number(rawInvoice.discount_percent || 0),
    discount_amount: Number(rawInvoice.discount_amount || 0),
    tax_percent: Number(rawInvoice.tax_percent || 0),
    tax_amount: Number(rawInvoice.tax_amount || 0),
    amount: Number(rawInvoice.amount || 0),
    status: rawInvoice.status,
    payment_method: rawInvoice.payment_method,
    due_date: rawInvoice.due_date,
    created_at: rawInvoice.created_at,
    updated_at: rawInvoice.updated_at,
    organization: rawInvoice.organization ?? null,
    package: rawInvoice.package
      ? {
          name: rawInvoice.package.name,
          price: Number(rawInvoice.package.price || 0),
          billing: rawInvoice.package.billing || null,
          modules: packageModules,
          addons: packageAddons,
        }
      : null,
  }

  const { data: configRows } = await (admin.from('saas_config') as any)
    .select('key, value')

  const saasConfig = ((configRows || []) as Array<{ key?: string | null; value?: unknown }>).reduce<Record<string, unknown>>((acc, row) => {
    const key = typeof row?.key === 'string' ? row.key : null
    if (!key) return acc
    acc[key] = row.value
    return acc
  }, {})

  let aiTokenPackages: OperatorAiTokenPackageOption[] = []
  const { data: aiPkgRows, error: aiPkgError } = await admin
    .from('ai_token_topup_packages')
    .select('id, name, description, tokens, price_idr, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('tokens', { ascending: true })

  if (!aiPkgError) {
    aiTokenPackages = ((aiPkgRows || []) as Array<{
      id: string
      name: string
      description?: string | null
      tokens?: number | string
      price_idr?: number | string
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || null,
      tokens: Number(row.tokens || 0),
      price: Number(row.price_idr || 0),
    }))
  }

  return {
    invoice: normalizedInvoice,
    saasConfig,
    packageModules,
    packageAddons,
    aiTokenPackages,
  }
}

/**
 * Void invoice penjualan SaaS yang belum PAID.
 * - Update status invoice menjadi VOIDED
 * - Void semua jurnal GL yang terkait (referenceId = invoice.id)
 * - Invoice yang sudah PAID tidak bisa di-void (harus melalui retur/refund manual)
 */
export async function voidOperatorSale(invoiceId: string, reason?: string) {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'ID invoice penjualan tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, org_id, invoice_number, status, amount')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'org_id' | 'invoice_number' | 'status' | 'amount'> | null

  if (!invoice) return { error: 'Data penjualan tidak ditemukan.' }
  if (isQuotationNumber(invoice.invoice_number)) {
    return { error: 'Data ini adalah penawaran, bukan penjualan. Gunakan tombol Hapus di tabel penawaran.' }
  }
  if (invoice.status === 'VOIDED') {
    return { success: true, message: 'Invoice sudah berstatus VOIDED.' }
  }
  if (invoice.status === 'PAID') {
    return { error: 'Invoice yang sudah PAID tidak dapat di-void. Proses retur/refund secara manual.' }
  }

  const voidedAt = new Date().toISOString()
  const voidReason = reason || 'Void oleh operator SaaS'

  // Void semua jurnal GL yang mengacu ke invoice ini (termasuk SAAS_COMMISSION)
  const journalReferenceTypes = ['SAAS_SALE', 'SAAS_CASH_IN', 'SAAS_COMMISSION', 'SALE', 'CASH_IN']
  for (const refType of journalReferenceTypes) {
    await (admin.from('journal_entries') as any)
      .update({
        status: 'VOIDED',
        void_reason: voidReason,
        voided_by: actor.id,
        voided_at: voidedAt,
        updated_at: voidedAt,
      })
      .eq('reference_type', refType)
      .eq('reference_id', invoiceId)
      .neq('status', 'VOIDED')
  }

  // Update status invoice
  const { error: updateError } = await (admin.from('saas_invoices') as any)
    .update({
      status: 'VOIDED',
      updated_at: voidedAt,
    })
    .eq('id', invoiceId)

  if (updateError) {
    return { error: `Gagal void invoice: ${updateError.message}` }
  }

  revalidatePath('/saas/penjualan')
  revalidatePath('/saas/penawaran')
  revalidatePath('/accounting/journal')
  revalidatePath('/accounting/ledgers')
  return { success: true }
}

/**
 * Perbarui reseller pada invoice SaaS (penawaran atau penjualan) yang sudah ada.
 * Berguna untuk koreksi retroaktif ketika reseller belum diisi saat transaksi terjadi.
 */
export async function updateOperatorInvoiceReseller(invoiceId: string, resellerId: string | null) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'ID invoice tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, invoice_number, status')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'invoice_number' | 'status'> | null

  if (!invoice) return { error: 'Invoice tidak ditemukan.' }
  if (invoice.status === 'VOIDED') return { error: 'Invoice yang sudah VOIDED tidak dapat diubah.' }

  // Validasi reseller_id jika diisi
  if (resellerId) {
    const { data: resellerData } = await (admin.from('sales_resellers') as any)
      .select('id, name, is_active')
      .eq('id', resellerId)
      .maybeSingle()
    if (!resellerData) return { error: 'Reseller tidak ditemukan.' }
    if (!resellerData.is_active) return { error: 'Reseller tidak aktif.' }
  }

  const { error: updateError } = await (admin.from('saas_invoices') as any)
    .update({
      reseller_id: resellerId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (updateError) {
    return { error: `Gagal memperbarui reseller: ${updateError.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  return { success: true }
}

/**
 * Fetch SaaS sales data and map to CommissionSaleRecord format for reseller dashboard.
 * This is used to display NIZAM APP SaaS sales in the commission module.
 */
export async function getSaasSalesForCommission(operatorOrgId: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')

  let invoices: any[] = []
  try {
    const result = await queryPostgres(`
      SELECT
        si.id,
        si.org_id AS tenant_org_id,
        si.invoice_number,
        si.created_at,
        si.amount,
        si.status,
        si.reseller_id,
        o.name AS organization_name,
        sr.id AS r_id,
        sr.name AS r_name,
        sr.reseller_type AS r_type,
        sr.company_name AS r_company,
        sr.contact_person AS r_contact,
        sr.commission_type AS r_comm_type,
        sr.commission_value AS r_comm_val
      FROM saas_invoices si
      JOIN sales_resellers sr ON sr.id = si.reseller_id
      LEFT JOIN organizations o ON o.id = si.org_id
      WHERE sr.org_id = $1
        AND si.invoice_number NOT ILIKE 'QUOTE-%'
    `, [operatorOrgId])
    invoices = result.rows
  } catch (err) {
    return []
  }

  // Map to CommissionSaleRecord shape
  return invoices.map((inv: any) => ({
    id: inv.id,
    org_id: operatorOrgId,
    sale_number: inv.invoice_number,
    sale_date: inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : null,
    grand_total: Number(inv.amount || 0),
    status: inv.status === 'PAID' ? 'FINISHED' : inv.status === 'VOIDED' ? 'VOIDED' : 'ORDERED',
    reseller_id: inv.reseller_id,
    commission_type: inv.r_comm_type || null,
    commission_value: Number(inv.r_comm_val || 0),
    contacts: inv.organization_name ? { name: inv.organization_name } : null,
    sales_resellers: {
      id: inv.r_id,
      name: inv.r_name,
      reseller_type: inv.r_type,
      company_name: inv.r_company,
      contact_person: inv.r_contact,
      commission_type: inv.r_comm_type,
      commission_value: Number(inv.r_comm_val || 0)
    },
    sales_returns: []
  }))
}
