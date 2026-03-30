'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { normalizeSaasEntitlementList } from '@/lib/saas/module-catalog'
import {
  EXTRA_BRANCH_UNIT_PRICE,
  EXTRA_ENTITY_UNIT_PRICE,
  getOperatorAddonById,
} from '@/lib/saas/operator-pricing'

type OperatorSnapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string; modules: string[]; addons: string[] }>
  aiTokenPackages: OperatorAiTokenPackageOption[]
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
}

type PackageLookup = {
  name: string
  price: number
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

const SAAS_INVOICE_SELECT_WITH_ITEM_COLUMNS = 'id, org_id, package_id, invoice_number, item_name, item_description, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name)'
const SAAS_INVOICE_SELECT_WITH_PRICING_COLUMNS = 'id, org_id, package_id, invoice_number, item_name, item_description, discount_percent, discount_amount, tax_percent, tax_amount, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name)'
const SAAS_INVOICE_SELECT_BASE = 'id, org_id, package_id, invoice_number, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name)'

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
  return accounts.find((account) => codes.includes(String(account.code || '').trim())) || null
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
  }
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penjualan tidak valid untuk dicatat ke buku besar.' }
  }

  const accounts = await getActiveAccountsForOrg(admin, invoice.org_id)
  const receivableAccount = resolveReceivableAccount(accounts)
  const revenueAccount = resolveRevenueAccount(accounts)
  const taxAmount = Math.max(0, Number(invoice.tax_amount || 0))
  const outputTaxAccount = taxAmount > 0 ? resolveOutputTaxAccount(accounts) : null

  if (!receivableAccount) {
    return { error: 'Akun Piutang Usaha (1201) tidak ditemukan untuk organisasi ini.' }
  }
  if (!revenueAccount) {
    return { error: 'Akun Pendapatan Usaha (4001) tidak ditemukan untuk organisasi ini.' }
  }
  if (taxAmount > 0 && !outputTaxAccount) {
    return { error: 'Akun PPN Keluaran (2201) tidak ditemukan untuk organisasi ini.' }
  }

  const revenueAmount = Math.max(0, totalAmount - taxAmount)
  return createAutoPostedJournal(admin, {
    orgId: invoice.org_id,
    actorUserId,
    entryDate: toEntryDate(invoice.created_at),
    description: `Penjualan SaaS ${invoice.invoice_number}`,
    referenceType: 'SALE',
    referenceId: invoice.id,
    notes: 'Jurnal otomatis dari konversi penawaran SaaS operator.',
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
        memo: `Pendapatan ${invoice.invoice_number}`,
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
  paymentMethod: string
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penerimaan tidak valid untuk dicatat ke buku besar.' }
  }

  const accounts = await getActiveAccountsForOrg(admin, invoice.org_id)
  const receivableAccount = resolveReceivableAccount(accounts)
  const settlementAccount = resolveCashSettlementAccount(accounts, paymentMethod)

  if (!receivableAccount) {
    return { error: 'Akun Piutang Usaha (1201) tidak ditemukan untuk organisasi ini.' }
  }
  if (!settlementAccount) {
    return { error: 'Akun Kas/Bank default untuk penerimaan belum tersedia di organisasi ini.' }
  }

  return createAutoPostedJournal(admin, {
    orgId: invoice.org_id,
    actorUserId,
    entryDate: toEntryDate(invoice.updated_at),
    description: `Pelunasan Invoice SaaS ${invoice.invoice_number}`,
    referenceType: 'CASH_IN',
    referenceId: invoice.id,
    notes: `Penerimaan otomatis dari pelunasan invoice SaaS. Metode: ${paymentMethod || invoice.payment_method || 'MANUAL_TRANSFER'}`,
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

async function assertPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error('Akses ditolak. Modul ini khusus pengelola SaaS.')
  }
  return user
}

function buildQuoteNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QTN-SAAS-${Date.now()}-${rand}`
}

function buildSalesNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `INV-SAAS-${Date.now()}-${rand}`
}

export async function getOperatorSaasSnapshot(): Promise<OperatorSnapshot> {
  await assertPlatformAdmin()
  const scoped = (await createClient()) as any
  const admin = await createAdminClient()

  const [orgRes, pkgRes, invoiceRes] = await Promise.all([
    scoped.from('organizations').select('id, name').order('name', { ascending: true }),
    scoped.from('saas_packages').select('id, name, price, billing, modules, addons').order('price', { ascending: true }),
    admin
      .from('saas_invoices')
      .select(SAAS_INVOICE_SELECT_WITH_PRICING_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  let rawInvoiceRows = (invoiceRes.data || []) as Array<{
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
    organization?: { name: string } | null
    package?: { name: string } | null
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
  }))

  const quotations = invoices.filter((inv) => String(inv.invoice_number || '').startsWith('QTN-SAAS-'))
  const sales = invoices.filter((inv) => !String(inv.invoice_number || '').startsWith('QTN-SAAS-'))

  const summary = {
    totalQuotes: quotations.length,
    totalOpenSales: sales.filter((inv) => inv.status !== 'PAID').length,
    totalPaidSales: sales.filter((inv) => inv.status === 'PAID').length,
    totalSalesValue: sales.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
  }

  return { orgs, packages, aiTokenPackages, quotations, sales, summary }
}

export async function createOperatorQuotation(formData: FormData) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

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
  const addonPriceOverrides = parseNumericRecordJson(String(formData.get('addon_price_overrides_json') || ''))
  const addonAnchorOverrides = parseNumericRecordJson(String(formData.get('addon_anchor_overrides_json') || ''))
  const discountPercentRaw = String(formData.get('discount_percent') || '0').trim()
  const taxPercentRaw = String(formData.get('tax_percent') || '0').trim()

  if (!orgId || !packageId) {
    return { error: 'Organisasi dan paket wajib dipilih.' }
  }

  const { data: pkgData } = await admin
    .from('saas_packages')
    .select('name, price, modules')
    .eq('id', packageId)
    .maybeSingle()
  const pkg = pkgData as (PackageLookup & { modules?: unknown }) | null
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

    return {
      id: addonId,
      name: addon?.name || addonId,
      promoPrice,
      anchorPrice,
    }
  })

  const addonTotal = selectedAddonBreakdown.reduce((acc, addon) => acc + addon.promoPrice, 0)

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

  const extraEntityTotal = extraEntityQty * extraEntityUnitPrice
  const extraBranchTotal = extraBranchQty * extraBranchUnitPrice
  const subtotalAmount = baseAmount + addonTotal + aiTokenTotal + extraEntityTotal + extraBranchTotal
  const discountAmount = (subtotalAmount * discountPercent) / 100
  const taxableAmount = Math.max(0, subtotalAmount - discountAmount)
  const taxAmount = (taxableAmount * taxPercent) / 100
  const finalAmount = Math.max(0, taxableAmount + taxAmount)

  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    return { error: 'Total penawaran tidak valid setelah kalkulasi diskon/pajak.' }
  }

  const packageModules = normalizeSaasEntitlementList(toStringArray(pkg.modules))
  const modulesForQuote = selectedModules.length > 0 ? selectedModules : packageModules

  const detailLines = [
    `Paket dasar: ${formatCurrencyId(baseAmount)}`,
    ...selectedAddonBreakdown.map((addon) => (
      addon.anchorPrice > addon.promoPrice
        ? `Add-on ${addon.name}: ${formatCurrencyId(addon.anchorPrice)} -> ${formatCurrencyId(addon.promoPrice)}`
        : `Add-on ${addon.name}: ${formatCurrencyId(addon.promoPrice)}`
    )),
    ...(aiTokenPackageId && aiTokenLabel ? [`Token AI: ${aiTokenLabel} (${formatCurrencyId(aiTokenTotal)})`] : []),
    ...(extraEntityQty > 0 ? [`Entitas tambahan: ${extraEntityQty} x ${formatCurrencyId(extraEntityUnitPrice)} = ${formatCurrencyId(extraEntityTotal)}`] : []),
    ...(extraBranchQty > 0 ? [`Cabang tambahan: ${extraBranchQty} x ${formatCurrencyId(extraBranchUnitPrice)} = ${formatCurrencyId(extraBranchTotal)}`] : []),
    `Subtotal: ${formatCurrencyId(subtotalAmount)}`,
    ...(discountAmount > 0 || discountPercent > 0 ? [`Diskon: ${discountPercent}% (${formatCurrencyId(discountAmount)})`] : []),
    ...(taxAmount > 0 || taxPercent > 0 ? [`Pajak: ${taxPercent}% (${formatCurrencyId(taxAmount)})`] : []),
    `Grand total: ${formatCurrencyId(finalAmount)}`,
    ...(modulesForQuote.length > 0 ? [`Modul dipilih: ${modulesForQuote.join(', ')}`] : []),
    ...(note ? [`Catatan: ${note}`] : []),
  ]

  const itemDescription = detailLines.join('\n')
  const invoiceNumber = buildQuoteNumber()
  const baseInvoicePayload = {
    org_id: orgId,
    package_id: packageId,
    invoice_number: invoiceNumber,
    amount: finalAmount,
    status: 'UNPAID',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const payloadWithItemsAndPricing = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${pkg.name}`,
    item_description: itemDescription || 'Penawaran dibuat oleh operator SaaS',
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${pkg.name}`,
    item_description: itemDescription || 'Penawaran dibuat oleh operator SaaS',
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

export async function convertQuotationToSale(invoiceId: string) {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penawaran tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, org_id, invoice_number, amount, tax_amount, created_at')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'org_id' | 'invoice_number' | 'amount' | 'tax_amount' | 'created_at'> | null

  if (!invoice) return { error: 'Data penawaran tidak ditemukan.' }
  if (!String(invoice.invoice_number).startsWith('QTN-SAAS-')) {
    return { error: 'Data ini bukan penawaran yang bisa dikonversi.' }
  }

  const nextInvoiceNumber = buildSalesNumber()
  const journalResult = await ensureOperatorSaleJournal(admin, actor.id, {
    id: invoice.id,
    org_id: invoice.org_id,
    invoice_number: nextInvoiceNumber,
    amount: invoice.amount,
    tax_amount: invoice.tax_amount,
    created_at: new Date().toISOString(),
  })

  if (journalResult.error) {
    return { error: `Gagal membuat jurnal penjualan: ${journalResult.error}` }
  }

  const { error } = await (admin.from('saas_invoices') as any)
    .update({
      invoice_number: nextInvoiceNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) {
    if (journalResult.entryId && !journalResult.existed) {
      await deleteJournalById(admin, journalResult.entryId)
    }
    return { error: `Gagal konversi penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  revalidatePath('/accounting/journal')
  return { success: true }
}

export async function markOperatorSalePaid(invoiceId: string, paymentMethod: string = 'MANUAL_TRANSFER') {
  const actor = await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penjualan tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, org_id, package_id, invoice_number, amount, tax_amount, status, payment_method, created_at, updated_at')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'org_id' | 'package_id' | 'invoice_number' | 'amount' | 'tax_amount' | 'status' | 'payment_method' | 'created_at' | 'updated_at'> | null

  if (!invoice) return { error: 'Data penjualan tidak ditemukan.' }
  if (invoice.status === 'PAID') return { success: true }

  const saleJournalResult = await ensureOperatorSaleJournal(admin, actor.id, {
    id: invoice.id,
    org_id: invoice.org_id,
    invoice_number: invoice.invoice_number,
    amount: invoice.amount,
    tax_amount: invoice.tax_amount,
    created_at: invoice.created_at,
  })

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
  }, paymentMethod)

  if (receiptJournalResult.error) {
    return { error: `Gagal membuat jurnal pelunasan: ${receiptJournalResult.error}` }
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
      admin.from('organizations').select('settings').eq('id', invoice.org_id).maybeSingle(),
    ])
    const pkg = pkgData as { name: string } | null
    const org = orgData as { settings?: Record<string, unknown> | null } | null

    if (pkg?.name) {
      const currentSettings = (org?.settings && typeof org.settings === 'object') ? org.settings : {}
      await (admin.from('organizations') as any)
        .update({
          settings: {
            ...currentSettings,
            plan: pkg.name,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', invoice.org_id)
    }
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
