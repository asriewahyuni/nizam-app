'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { normalizeSaasEntitlementList } from '@/lib/saas/module-catalog'
import {
  EXTRA_BRANCH_UNIT_PRICE,
  EXTRA_ENTITY_UNIT_PRICE,
  getOperatorAddonById,
} from '@/lib/saas/operator-pricing'
import { revalidatePath } from 'next/cache'

// Operator sales backoffice actions: quotation, conversion, settlement, and document snapshot.

type JsonRecord = Record<string, unknown>
type DbClient = Prisma.TransactionClient | typeof prisma

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
  price: unknown
  modules?: unknown
}

type QuotationDraft = {
  orgId: string
  packageId: string
  packageName: string
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

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)

  if (
    value
    && typeof value === 'object'
    && 'toNumber' in value
    && typeof value.toNumber === 'function'
  ) {
    return value.toNumber()
  }

  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

function normalizeObject(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as JsonRecord) }
  }

  return {}
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
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
      // Fallback for legacy comma separated values.
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim()
    return message || fallback
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  return fallback
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

async function getActiveAccountsForOrg(db: DbClient, orgId: string): Promise<AccountingAccount[]> {
  const data = await db.accounts.findMany({
    where: {
      org_id: orgId,
      is_active: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: {
      code: 'asc',
    },
  })

  return data.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: String(account.type || ''),
  }))
}

async function getExistingJournal(db: DbClient, orgId: string, referenceType: string, referenceId: string) {
  return db.journal_entries.findFirst({
    where: {
      org_id: orgId,
      reference_type: referenceType as any,
      reference_id: referenceId,
    },
    select: {
      id: true,
      status: true,
    },
  })
}

async function deleteJournalById(db: DbClient, entryId: string) {
  await db.journal_entries.deleteMany({
    where: {
      id: entryId,
    },
  })
}

async function createAutoPostedJournal(
  db: DbClient,
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
  const existingJournal = await getExistingJournal(db, params.orgId, params.referenceType, params.referenceId)
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

  const entry = await db.journal_entries.create({
    data: {
      org_id: params.orgId,
      entry_number: '',
      entry_date: new Date(params.entryDate),
      description: params.description,
      reference_type: params.referenceType as any,
      reference_id: params.referenceId,
      notes: params.notes || null,
      status: 'POSTED',
      is_auto: true,
      created_by: params.actorUserId,
    },
    select: {
      id: true,
    },
  })

  try {
    await db.journal_lines.createMany({
      data: lines.map((line) => ({
        entry_id: entry.id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        memo: line.memo || null,
      })),
    })
  } catch (error) {
    await deleteJournalById(db, entry.id)
    return { error: getErrorMessage(error, 'Gagal membuat baris jurnal otomatis.') }
  }

  return { entryId: entry.id, existed: false }
}

async function ensureOperatorSaleJournal(
  db: DbClient,
  actorUserId: string,
  invoice: {
    id: string
    org_id: string
    invoice_number: string
    amount: unknown
    tax_amount?: unknown
    created_at?: string | null
  }
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penjualan tidak valid untuk dicatat ke buku besar.' }
  }

  const accounts = await getActiveAccountsForOrg(db, invoice.org_id)
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
  return createAutoPostedJournal(db, {
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
  db: DbClient,
  actorUserId: string,
  invoice: {
    id: string
    org_id: string
    invoice_number: string
    amount: unknown
    payment_method?: string | null
    updated_at?: string | null
  },
  paymentMethod: string
): Promise<AutoJournalResult> {
  const totalAmount = Number(invoice.amount || 0)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: 'Nominal penerimaan tidak valid untuk dicatat ke buku besar.' }
  }

  const accounts = await getActiveAccountsForOrg(db, invoice.org_id)
  const receivableAccount = resolveReceivableAccount(accounts)
  const settlementAccount = resolveCashSettlementAccount(accounts, paymentMethod)

  if (!receivableAccount) {
    return { error: 'Akun Piutang Usaha (1201) tidak ditemukan untuk organisasi ini.' }
  }
  if (!settlementAccount) {
    return { error: 'Akun Kas/Bank default untuk penerimaan belum tersedia di organisasi ini.' }
  }

  return createAutoPostedJournal(db, {
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
  const session = await auth()
  const user = session?.user
  const email = String(user?.email || '').trim()

  if (!user?.id || !email || !isPlatformAdminEmail(email)) {
    throw new Error('Akses ditolak. Modul ini khusus pengelola SaaS.')
  }

  return {
    userId: user.id,
    email,
  }
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

function buildConfigMap(rows: Array<{ key: string; value: unknown }>) {
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})
}

export async function getOperatorSaasSnapshot(): Promise<OperatorSnapshot> {
  await assertPlatformAdmin()

  const [orgRows, packageRows, invoiceRows, aiPkgRows] = await Promise.all([
    prisma.organizations.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.saas_packages.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        billing: true,
        modules: true,
        addons: true,
      },
      orderBy: {
        price: 'asc',
      },
    }),
    prisma.saas_invoices.findMany({
      select: {
        id: true,
        org_id: true,
        package_id: true,
        invoice_number: true,
        item_name: true,
        item_description: true,
        discount_percent: true,
        discount_amount: true,
        tax_percent: true,
        tax_amount: true,
        amount: true,
        status: true,
        payment_method: true,
        due_date: true,
        created_at: true,
        updated_at: true,
        organizations: {
          select: {
            name: true,
          },
        },
        saas_packages: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 500,
    }),
    prisma.ai_token_topup_packages.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        tokens: true,
        price_idr: true,
      },
      orderBy: [
        { sort_order: 'asc' },
        { tokens: 'asc' },
      ],
    }),
  ])

  const orgs = orgRows.map((org) => ({ id: org.id, name: org.name }))
  const packages = packageRows.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    price: toNumber(pkg.price),
    billing: pkg.billing || undefined,
    modules: normalizeSaasEntitlementList(toStringArray(pkg.modules)),
    addons: normalizeSaasEntitlementList(toStringArray(pkg.addons)),
  }))
  const aiTokenPackages: OperatorAiTokenPackageOption[] = aiPkgRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || null,
    tokens: toNumber(row.tokens),
    price: toNumber(row.price_idr),
  }))

  const invoices: InvoiceRecord[] = invoiceRows.map((inv) => ({
    id: inv.id,
    org_id: String(inv.org_id || ''),
    package_id: inv.package_id,
    invoice_number: inv.invoice_number,
    item_name: inv.item_name ?? null,
    item_description: inv.item_description ?? null,
    discount_percent: toNumber(inv.discount_percent),
    discount_amount: toNumber(inv.discount_amount),
    tax_percent: toNumber(inv.tax_percent),
    tax_amount: toNumber(inv.tax_amount),
    amount: toNumber(inv.amount),
    status: String(inv.status || 'UNPAID'),
    payment_method: inv.payment_method ?? null,
    due_date: toIsoString(inv.due_date),
    created_at: toIsoString(inv.created_at) || '',
    updated_at: toIsoString(inv.updated_at) || '',
    organization: inv.organizations ? { name: inv.organizations.name } : null,
    package: inv.saas_packages ? { name: inv.saas_packages.name } : null,
  }))

  const quotations = invoices.filter((inv) => isQuotationNumber(inv.invoice_number))
  const sales = invoices.filter((inv) => !isQuotationNumber(inv.invoice_number))

  const summary = {
    totalQuotes: quotations.length,
    totalOpenSales: sales.filter((inv) => inv.status !== 'PAID').length,
    totalPaidSales: sales.filter((inv) => inv.status === 'PAID').length,
    totalSalesValue: sales.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
  }

  return { orgs, packages, aiTokenPackages, quotations, sales, summary }
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

  const pkg = await prisma.saas_packages.findUnique({
    where: {
      id: packageId,
    },
    select: {
      name: true,
      price: true,
      modules: true,
    },
  })

  if (!pkg) {
    return { error: 'Paket SaaS tidak ditemukan.' }
  }

  const parseNumber = (value: string, fallback = 0) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) return fallback

    const num = Number(normalizedValue)
    return Number.isFinite(num) ? num : fallback
  }

  const baseAmount = parseNumber(customAmountRaw, toNumber(pkg.price))
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

    return {
      id: addonId,
      name: addon?.name || addonId,
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
    const tokenPkg = await prisma.ai_token_topup_packages.findFirst({
      where: {
        id: aiTokenPackageId,
        is_active: true,
      },
      select: {
        name: true,
        tokens: true,
        price_idr: true,
      },
    })

    if (tokenPkg) {
      aiTokenTotal = toNumber(tokenPkg.price_idr)
      aiTokenLabel = `${tokenPkg.name} (${toNumber(tokenPkg.tokens).toLocaleString('id-ID')} token)`
    }
  }

  const extraEntityTotal = extraEntityQty * extraEntityUnitPrice
  const extraBranchTotal = extraBranchQty * extraBranchUnitPrice
  const monthlySubtotalAmount = baseAmount + monthlyAddonTotal + extraEntityTotal + extraBranchTotal
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

  const packageModules = normalizeSaasEntitlementList(toStringArray((pkg as PackageLookup).modules))
  const modulesForQuote = selectedModules.length > 0 ? selectedModules : packageModules

  const detailLines = [
    `Paket dasar: ${formatCurrencyId(baseAmount)}`,
    `Durasi: ${durationMonths} bulan`,
    ...selectedAddonBreakdown.map((addon) => (
      addon.anchorPrice > addon.promoPrice
        ? `${addon.isSingleBill ? 'Add-on Single Bill' : 'Add-on'} ${addon.name}: ${formatCurrencyId(addon.anchorPrice)} -> ${formatCurrencyId(addon.promoPrice)}`
        : `${addon.isSingleBill ? 'Add-on Single Bill' : 'Add-on'} ${addon.name}: ${formatCurrencyId(addon.promoPrice)}`
    )),
    ...(aiTokenPackageId && aiTokenLabel ? [`Token AI: ${aiTokenLabel} (${formatCurrencyId(aiTokenTotal)})`] : []),
    ...(extraEntityQty > 0 ? [`Entitas tambahan: ${extraEntityQty} x ${formatCurrencyId(extraEntityUnitPrice)} = ${formatCurrencyId(extraEntityTotal)}`] : []),
    ...(extraBranchQty > 0 ? [`Cabang tambahan: ${extraBranchQty} x ${formatCurrencyId(extraBranchUnitPrice)} = ${formatCurrencyId(extraBranchTotal)}`] : []),
    `Subtotal / bulan: ${formatCurrencyId(monthlySubtotalAmount)}`,
    `Subtotal durasi (${durationMonths} bulan): ${formatCurrencyId(durationSubtotalAmount)}`,
    ...(oneTimeSubtotalAmount > 0 ? [`Subtotal one-time: ${formatCurrencyId(oneTimeSubtotalAmount)}`] : []),
    `Subtotal: ${formatCurrencyId(subtotalAmount)}`,
    ...(discountAmount > 0 || discountPercent > 0 ? [`Diskon setelah durasi: ${discountPercent}% (${formatCurrencyId(discountAmount)})`] : []),
    ...(taxAmount > 0 || taxPercent > 0 ? [`Pajak: ${taxPercent}% (${formatCurrencyId(taxAmount)})`] : []),
    `Grand total: ${formatCurrencyId(finalAmount)}`,
    ...(modulesForQuote.length > 0 ? [`Modul dipilih: ${modulesForQuote.join(', ')}`] : []),
    ...(note ? [`Catatan: ${note}`] : []),
  ]

  return {
    data: {
      orgId,
      packageId,
      packageName: pkg.name,
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
  const baseInvoicePayload = {
    org_id: draft.orgId,
    package_id: draft.packageId,
    invoice_number: invoiceNumber,
    amount: draft.finalAmount,
    status: 'UNPAID',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const payloadWithItemsAndPricing = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseInvoicePayload,
    item_name: `Penawaran SaaS: ${draft.packageName}`,
    item_description: draft.itemDescription,
  }

  try {
    await prisma.saas_invoices.create({
      data: {
        org_id: orgId,
        package_id: packageId,
        invoice_number: invoiceNumber,
        amount: finalAmount,
        status: 'UNPAID',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        item_name: `Penawaran SaaS: ${pkg.name}`,
        item_description: itemDescription || 'Penawaran dibuat oleh operator SaaS',
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
      },
    })
  } catch (error) {
    return { error: `Gagal membuat penawaran: ${getErrorMessage(error, 'Unknown error')}` }
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
    .select('id, invoice_number, status, due_date')
    .eq('id', quoteId)
    .maybeSingle()
  const currentQuote = currentQuoteData as Pick<InvoiceRecord, 'id' | 'invoice_number' | 'status' | 'due_date'> | null

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

  const baseUpdatePayload = {
    org_id: currentSale.org_id,
    package_id: draft.packageId,
    amount: draft.finalAmount,
    due_date: currentQuote.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  const payloadWithItemsAndPricing = {
    ...baseUpdatePayload,
    item_name: `Penawaran SaaS: ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseUpdatePayload,
    item_name: `Penawaran SaaS: ${draft.packageName}`,
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
    item_name: `Invoice SaaS: ${draft.packageName}`,
    item_description: draft.itemDescription,
    discount_percent: draft.discountPercent,
    discount_amount: draft.discountAmount,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
  }
  const payloadWithItemsOnly = {
    ...baseUpdatePayload,
    item_name: `Invoice SaaS: ${draft.packageName}`,
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

  const trimmedInvoiceId = String(invoiceId || '').trim()
  if (!trimmedInvoiceId) return { error: 'Invoice penawaran tidak valid.' }

  const invoice = await prisma.saas_invoices.findUnique({
    where: {
      id: trimmedInvoiceId,
    },
    select: {
      id: true,
      org_id: true,
      invoice_number: true,
      amount: true,
      tax_amount: true,
      created_at: true,
    },
  })

  if (!invoice) return { error: 'Data penawaran tidak ditemukan.' }
  if (!isQuotationNumber(invoice.invoice_number)) {
    return { error: 'Data ini bukan penawaran yang bisa dikonversi.' }
  }

  const orgId = invoice.org_id
  const nextInvoiceNumber = buildSalesNumber()

  try {
    await prisma.$transaction(async (tx) => {
      const journalResult = await ensureOperatorSaleJournal(tx, actor.userId, {
        id: invoice.id,
        org_id: orgId,
        invoice_number: nextInvoiceNumber,
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        created_at: new Date().toISOString(),
      })

      if (journalResult.error) {
        throw new Error(`Gagal membuat jurnal penjualan: ${journalResult.error}`)
      }

      await tx.saas_invoices.update({
        where: {
          id: trimmedInvoiceId,
        },
        data: {
          invoice_number: nextInvoiceNumber,
          updated_at: new Date(),
        },
      })
    })
  } catch (error) {
    return { error: getErrorMessage(error, 'Gagal konversi penawaran.') }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  revalidatePath('/accounting/journal')
  revalidatePath(`/saas/dokumen/${trimmedInvoiceId}`)
  return { success: true }
}

export async function markOperatorSalePaid(invoiceId: string, paymentMethod: string = 'MANUAL_TRANSFER') {
  const actor = await assertPlatformAdmin()

  const trimmedInvoiceId = String(invoiceId || '').trim()
  if (!trimmedInvoiceId) return { error: 'Invoice penjualan tidak valid.' }

  const invoice = await prisma.saas_invoices.findUnique({
    where: {
      id: trimmedInvoiceId,
    },
    include: {
      saas_packages: {
        select: {
          name: true,
        },
      },
      organizations: {
        select: {
          settings: true,
        },
      },
    },
  })

  if (!invoice) return { error: 'Data penjualan tidak ditemukan.' }
  if (!invoice.org_id) return { error: 'Organisasi invoice tidak valid.' }
  if (String(invoice.status || 'UNPAID') === 'PAID') return { success: true }

  const orgId = invoice.org_id
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const saleJournalResult = await ensureOperatorSaleJournal(tx, actor.userId, {
        id: invoice.id,
        org_id: orgId,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        created_at: invoice.created_at?.toISOString() ?? now.toISOString(),
      })

      if (saleJournalResult.error) {
        throw new Error(`Gagal sinkronisasi jurnal penjualan: ${saleJournalResult.error}`)
      }

      const receiptJournalResult = await ensureOperatorReceiptJournal(tx, actor.userId, {
        id: invoice.id,
        org_id: orgId,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        payment_method: invoice.payment_method,
        updated_at: now.toISOString(),
      }, paymentMethod)

      if (receiptJournalResult.error) {
        throw new Error(`Gagal membuat jurnal pelunasan: ${receiptJournalResult.error}`)
      }

      await tx.saas_invoices.update({
        where: {
          id: trimmedInvoiceId,
        },
        data: {
          status: 'PAID',
          payment_method: paymentMethod,
          updated_at: now,
        },
      })

      if (invoice.package_id && invoice.saas_packages?.name) {
        const currentSettings = normalizeObject(invoice.organizations?.settings)
        await tx.organizations.update({
          where: {
            id: orgId,
          },
          data: {
            settings: toInputJson({
              ...currentSettings,
              plan: invoice.saas_packages.name,
              updated_at: now.toISOString(),
            }),
            updated_at: now,
          },
        })
      }
    })
  } catch (error) {
    return { error: getErrorMessage(error, 'Gagal update status pembayaran.') }
  }

  revalidatePath('/saas/penjualan')
  revalidatePath('/billing')
  revalidatePath('/accounting/journal')
  revalidatePath(`/saas/dokumen/${trimmedInvoiceId}`)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getOperatorInvoiceDocument(invoiceId: string): Promise<OperatorDocumentSnapshot | null> {
  await assertPlatformAdmin()

  const trimmedInvoiceId = String(invoiceId || '').trim()
  if (!trimmedInvoiceId) return null

  const [invoice, configRows, aiPkgRows] = await Promise.all([
    prisma.saas_invoices.findUnique({
      where: {
        id: trimmedInvoiceId,
      },
      include: {
        organizations: {
          select: {
            name: true,
            owner_email: true,
          },
        },
        saas_packages: {
          select: {
            name: true,
            price: true,
            billing: true,
            modules: true,
            addons: true,
          },
        },
      },
    }),
    prisma.saas_config.findMany({
      select: {
        key: true,
        value: true,
      },
    }),
    prisma.ai_token_topup_packages.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        tokens: true,
        price_idr: true,
      },
      orderBy: [
        { sort_order: 'asc' },
        { tokens: 'asc' },
      ],
    }),
  ])

  if (!invoice) {
    return null
  }

  const packageModules = normalizeSaasEntitlementList(toStringArray(invoice.saas_packages?.modules))
  const packageAddons = normalizeSaasEntitlementList(toStringArray(invoice.saas_packages?.addons))

  const normalizedInvoice: OperatorInvoiceDocument = {
    id: invoice.id,
    org_id: String(invoice.org_id || ''),
    package_id: invoice.package_id,
    invoice_number: invoice.invoice_number,
    item_name: invoice.item_name ?? null,
    item_description: invoice.item_description ?? null,
    discount_percent: toNumber(invoice.discount_percent),
    discount_amount: toNumber(invoice.discount_amount),
    tax_percent: toNumber(invoice.tax_percent),
    tax_amount: toNumber(invoice.tax_amount),
    amount: toNumber(invoice.amount),
    status: String(invoice.status || 'UNPAID'),
    payment_method: invoice.payment_method ?? null,
    due_date: toIsoString(invoice.due_date),
    created_at: toIsoString(invoice.created_at) || '',
    updated_at: toIsoString(invoice.updated_at) || '',
    organization: invoice.organizations
      ? {
          name: invoice.organizations.name,
          owner_email: invoice.organizations.owner_email ?? null,
        }
      : null,
    package: invoice.saas_packages
      ? {
          name: invoice.saas_packages.name,
          price: toNumber(invoice.saas_packages.price),
          billing: invoice.saas_packages.billing || null,
          modules: packageModules,
          addons: packageAddons,
        }
      : null,
  }

  const saasConfig = buildConfigMap(configRows)
  const aiTokenPackages: OperatorAiTokenPackageOption[] = aiPkgRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || null,
    tokens: toNumber(row.tokens),
    price: toNumber(row.price_idr),
  }))

  return {
    invoice: normalizedInvoice,
    saasConfig,
    packageModules,
    packageAddons,
    aiTokenPackages,
  }
}
