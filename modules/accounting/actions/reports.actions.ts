import { createClient } from '@/lib/supabase/server'
import { unstable_noStore as noStore } from 'next/cache'
import { cache } from 'react'
import { addDaysToDateString, diffDateOnlyStrings, getDateInTimeZone } from '@/lib/utils'
import { hydratePurchaseTransparencyForEntries } from '@/modules/accounting/lib/purchase-ledger-transparency'
import type { BranchSummary } from '@/modules/organization/lib/org-context'

type BranchFilter = string | null | undefined
type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING'

type CashFlowLineAccount = {
  id?: string | null
  code?: string | null
  name?: string | null
  type?: string | null
  normal_balance?: string | null
  parent_id?: string | null
  cash_flow_category?: CashFlowCategory | null
}

type CashFlowLine = {
  entry_id?: string | null
  debit?: number | string | null
  credit?: number | string | null
  accounts?: CashFlowLineAccount | null
  journal_entries?: {
    description?: string | null
    notes?: string | null
    reference_type?: string | null
    reference_id?: string | null
    entry_date?: string | null
  } | null
}

type CashFlowItemDetail = {
  entryId: string
  entryDate: string | null
  amount: number
  description: string
  notes: string | null
  referenceType: string | null
  referenceLabel: string | null
}

type CashFlowItem = {
  code: string
  name: string
  amount: number
  details: CashFlowItemDetail[]
}

type EffectiveReferenceAccount = {
  id: string | null
  org_id: string | null
  code: string | null
  name: string | null
  type: string | null
  normal_balance: string | null
  parent_id: string | null
  cash_flow_category: CashFlowCategory | null
}

type CashFlowOptions = {
  startDate?: string
  endDate?: string
}

export type DeckCashSummary = {
  cash: number
  ocf: number
  icf: number
  fcf: number
}

const getResolvedOrgIdsForReport = cache(async (orgId: string, consolidated: boolean = false) => {
  if (!consolidated) return [orgId]

  const supabase = await createClient()
  const db = supabase as any
  const { data: consolidatedOrgs, error: rpcError } = await db.rpc('get_consolidated_org_ids', { p_parent_org_id: orgId })
  if (rpcError || !Array.isArray(consolidatedOrgs)) return [orgId]

  const orgIds = consolidatedOrgs
    .map((row: any) => String(row?.org_id || '').trim())
    .filter((id: string) => id.length > 0)

  if (!orgIds.includes(orgId)) orgIds.unshift(orgId)
  return Array.from(new Set(orgIds))
})

async function resolveOrgIdsForReport(_db: any, orgId: string, consolidated: boolean = false) {
  return getResolvedOrgIdsForReport(orgId, consolidated)
}

function isMissingConsolidationMappingSchemaError(error: unknown) {
  const rawMessage = String((error as any)?.message || '').trim().toLowerCase()
  const errorCode = String((error as any)?.code || '').trim()
  return (
    errorCode === '42P01' ||
    rawMessage.includes('coa_consolidation_mappings') ||
    rawMessage.includes('relation "public.coa_consolidation_mappings" does not exist')
  )
}

async function getEffectiveReferenceAccounts(
  db: any,
  orgIdsToSearch: string[],
  rootOrgId: string,
  consolidated: boolean
): Promise<EffectiveReferenceAccount[]> {
  if (!consolidated) {
    const { data: accountRows } = await db
      .from('accounts')
      .select('id, org_id, code, name, type, normal_balance, parent_id, cash_flow_category')
      .in('org_id', orgIdsToSearch)
      .eq('is_active', true)
      .order('code', { ascending: true })

    return Array.isArray(accountRows) ? accountRows : []
  }

  const { queryPostgres } = await import('@/lib/db/postgres')

  try {
    const { rows } = await queryPostgres<Record<string, unknown>>(
      `
        SELECT
          source_accounts.org_id AS source_org_id,
          COALESCE(group_accounts.id, source_accounts.id) AS effective_account_id,
          COALESCE(group_accounts.code, source_accounts.code) AS effective_account_code,
          COALESCE(group_accounts.name, source_accounts.name) AS effective_account_name,
          COALESCE(group_accounts.type::text, source_accounts.type::text) AS effective_account_type,
          COALESCE(group_accounts.normal_balance::text, source_accounts.normal_balance::text) AS effective_normal_balance,
          COALESCE(group_accounts.parent_id, source_accounts.parent_id) AS effective_parent_id,
          COALESCE(group_accounts.cash_flow_category, source_accounts.cash_flow_category) AS effective_cash_flow_category
        FROM public.accounts source_accounts
        LEFT JOIN public.coa_consolidation_mappings mappings
          ON mappings.parent_org_id = $1::uuid
         AND mappings.child_org_id = source_accounts.org_id
         AND mappings.local_account_id = source_accounts.id
         AND mappings.is_active = TRUE
        LEFT JOIN public.accounts group_accounts
          ON group_accounts.id = mappings.group_account_id
        WHERE source_accounts.org_id = ANY($2::uuid[])
          AND source_accounts.is_active = TRUE
      `,
      [rootOrgId, orgIdsToSearch]
    )

    return rows.map((row) => ({
      id: row.effective_account_id ? String(row.effective_account_id) : null,
      org_id: row.source_org_id ? String(row.source_org_id) : null,
      code: row.effective_account_code ? String(row.effective_account_code) : null,
      name: row.effective_account_name ? String(row.effective_account_name) : null,
      type: row.effective_account_type ? String(row.effective_account_type) : null,
      normal_balance: row.effective_normal_balance ? String(row.effective_normal_balance) : null,
      parent_id: row.effective_parent_id ? String(row.effective_parent_id) : null,
      cash_flow_category: (row.effective_cash_flow_category as CashFlowCategory | null) ?? null,
    }))
  } catch (error) {
    if (!isMissingConsolidationMappingSchemaError(error)) {
      ;(console as any).error('[getEffectiveReferenceAccounts]', error)
    }

    const { data: fallbackRows } = await db
      .from('accounts')
      .select('id, org_id, code, name, type, normal_balance, parent_id, cash_flow_category')
      .in('org_id', orgIdsToSearch)
      .eq('is_active', true)
      .order('code', { ascending: true })

    return Array.isArray(fallbackRows) ? fallbackRows : []
  }
}

async function getPostedEntryIds(
  db: any,
  orgId: string,
  options: {
    branchId?: BranchFilter
    startDate?: string
    endDate?: string
    asOfDate?: string
    consolidated?: boolean
  } = {}
) {
  noStore()
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, Boolean(options.consolidated))

  let query = db
    .from('journal_entries')
    .select('id')
    .in('org_id', orgIdsToSearch)
    .eq('status', 'POSTED')

  if (options.branchId && !options.consolidated) {
    query = query.eq('branch_id', options.branchId)
  }
  if (options.startDate) {
    query = query.gte('entry_date', options.startDate)
  }
  if (options.endDate) {
    query = query.lte('entry_date', options.endDate)
  }
  if (options.asOfDate) {
    query = query.lte('entry_date', options.asOfDate)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []
  return data.map((entry: any) => entry.id)
}

async function getAccountBalancesFromEntries(
  db: any,
  entryIds: string[],
  codeFilter?: string[],
  consolidationParentOrgId?: string | null
) {
  if (entryIds.length === 0) return []

  const { queryPostgres } = await import('@/lib/db/postgres')
  let sql = consolidationParentOrgId
    ? `
      SELECT
        jl.debit,
        jl.credit,
        COALESCE(group_accounts.id, source_accounts.id) AS account_id,
        COALESCE(group_accounts.code, source_accounts.code) AS account_code,
        COALESCE(group_accounts.name, source_accounts.name) AS account_name,
        COALESCE(group_accounts.type::text, source_accounts.type::text) AS account_type,
        COALESCE(group_accounts.normal_balance::text, source_accounts.normal_balance::text) AS account_normal_balance,
        COALESCE(group_accounts.parent_id, source_accounts.parent_id) AS account_parent_id,
        COALESCE(group_accounts.cash_flow_category, source_accounts.cash_flow_category) AS account_cash_flow_category
      FROM public.journal_lines jl
      JOIN public.journal_entries je ON je.id = jl.entry_id
      JOIN public.accounts source_accounts ON source_accounts.id = jl.account_id
      LEFT JOIN public.coa_consolidation_mappings mappings
        ON mappings.parent_org_id = $2::uuid
       AND mappings.child_org_id = je.org_id
       AND mappings.local_account_id = source_accounts.id
       AND mappings.is_active = TRUE
      LEFT JOIN public.accounts group_accounts
        ON group_accounts.id = mappings.group_account_id
      WHERE jl.entry_id = ANY($1::uuid[])
    `
    : `
      SELECT
        jl.debit,
        jl.credit,
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type,
        a.normal_balance AS account_normal_balance,
        a.parent_id AS account_parent_id,
        a.cash_flow_category AS account_cash_flow_category
      FROM public.journal_lines jl
      JOIN public.accounts a ON a.id = jl.account_id
      WHERE jl.entry_id = ANY($1::uuid[])
    `
  const params: any[] = consolidationParentOrgId ? [entryIds, consolidationParentOrgId] : [entryIds]

  if (codeFilter && codeFilter.length > 0) {
    sql += consolidationParentOrgId
      ? ` AND COALESCE(group_accounts.code, source_accounts.code) = ANY($3)`
      : ` AND a.code = ANY($2)`
    params.push(codeFilter)
  }

  let data: any[] = []
  try {
    const { rows } = await queryPostgres(sql, params)
    data = rows
  } catch (e) {
    if (consolidationParentOrgId && isMissingConsolidationMappingSchemaError(e)) {
      return getAccountBalancesFromEntries(db, entryIds, codeFilter)
    }

    ;(console as any).error(e)
    return []
  }

  const accountMap: Record<string, any> = {}
  data.forEach((line: any) => {
    const code = line.account_code
    if (!code) return

    if (!accountMap[code]) {
      accountMap[code] = {
        id: line.account_id,
        code: line.account_code,
        name: line.account_name,
        type: line.account_type,
        normal_balance: line.account_normal_balance,
        parent_id: line.account_parent_id,
        cash_flow_category: line.account_cash_flow_category,
        total_debit: 0,
        total_credit: 0,
      }
    }

    accountMap[code].total_debit += Number(line.debit || 0)
    accountMap[code].total_credit += Number(line.credit || 0)
  })

  return Object.values(accountMap)
}

async function getCashAccountCodes(
  db: any,
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgIdsToSearch: string[],
  branchId?: BranchFilter,
  consolidated: boolean = false,
  consolidationParentOrgId?: string | null
): Promise<string[]> {
  const fallbackCashAccountCodes: string[] = []

  if (consolidated && consolidationParentOrgId) {
    try {
      const { queryPostgres } = await import('@/lib/db/postgres')
      const { rows } = await queryPostgres<Record<string, unknown>>(
        `
          SELECT DISTINCT COALESCE(group_accounts.code, source_accounts.code) AS effective_account_code
          FROM public.bank_accounts bank_accounts
          JOIN public.accounts source_accounts
            ON source_accounts.id = bank_accounts.account_id
          LEFT JOIN public.coa_consolidation_mappings mappings
            ON mappings.parent_org_id = $1::uuid
           AND mappings.child_org_id = bank_accounts.org_id
           AND mappings.local_account_id = source_accounts.id
           AND mappings.is_active = TRUE
          LEFT JOIN public.accounts group_accounts
            ON group_accounts.id = mappings.group_account_id
          WHERE bank_accounts.org_id = ANY($2::uuid[])
            AND bank_accounts.is_active = TRUE
        `,
        [consolidationParentOrgId, orgIdsToSearch]
      )

      const linkedCodes = rows.reduce<string[]>((codes, row) => {
        const code = String(row.effective_account_code || '').trim()
        if (code) codes.push(code)
        return codes
      }, [])

      linkedCodes.push(...fallbackCashAccountCodes)
      return Array.from(new Set(linkedCodes))
    } catch (error) {
      if (!isMissingConsolidationMappingSchemaError(error)) {
        ;(console as any).error('[getCashAccountCodes]', error)
      }
    }
  }

  let linkedAccountsQuery = (supabase as any)
    .from('bank_accounts')
    .select('account_id, accounts(code)')
    .in('org_id', orgIdsToSearch)
    .eq('is_active', true)

  if (branchId && !consolidated) {
    linkedAccountsQuery = linkedAccountsQuery.eq('branch_id', branchId)
  }

  const { data: linkedAccounts } = await linkedAccountsQuery

  const cashAccountCodes = (Array.isArray(linkedAccounts) ? linkedAccounts : []).reduce<string[]>(
    (codes, linkedAccount: { accounts?: { code?: unknown } | null }) => {
      const code = typeof linkedAccount.accounts?.code === 'string'
        ? linkedAccount.accounts.code.trim()
        : ''

      if (code) codes.push(code)
      return codes
    },
    []
  )

  cashAccountCodes.push(...fallbackCashAccountCodes)

  return Array.from(new Set(cashAccountCodes))
}

function isCashAccountCode(code: string, cashAccountCodes: string[]) {
  return cashAccountCodes.includes(code)
}

function isOperatingReceivableCode(code: string) {
  if (!code || code === '1203') return false
  return code.startsWith('12')
}

function isOperatingInventoryCode(code: string) {
  return Boolean(code) && code.startsWith('13')
}

function isOperatingPrepaidCode(code: string) {
  return Boolean(code) && code.startsWith('14')
}

function isOperatingLiabilityCode(code: string) {
  if (!code) return false
  return code === '2101' || code.startsWith('22') || code.startsWith('23') || code.startsWith('24')
}

function isOperatingReceiptSettlementCode(code: string) {
  if (!code) return false
  return isOperatingReceivableCode(code) || code.startsWith('23')
}

function isOperatingAccrualSettlementCode(code: string) {
  if (!code) return false
  return code === '2101' || code.startsWith('22') || code.startsWith('24')
}

function isOperatingWorkingCapitalCode(code: string) {
  return (
    isOperatingReceivableCode(code) ||
    isOperatingInventoryCode(code) ||
    isOperatingPrepaidCode(code) ||
    isOperatingLiabilityCode(code)
  )
}

function isOperatingRevenueCode(code: string) {
  return Boolean(code) && code.startsWith('4')
}

function isOperatingExpenseCode(code: string) {
  return Boolean(code) && (code.startsWith('5') || code.startsWith('6') || code.startsWith('9'))
}

function isAllowedOperatingDetailCode(code: string) {
  return (
    isOperatingWorkingCapitalCode(code) ||
    isOperatingRevenueCode(code) ||
    isOperatingExpenseCode(code)
  )
}

function shouldExcludeCashFlowDetailLine(
  line: CashFlowLine,
  nonCashLines: CashFlowLine[],
  cashAccountCodes: string[]
) {
  const code = String(line?.accounts?.code || '').trim()
  if (!code) return true
  if (isCashAccountCode(code, cashAccountCodes)) return true

  const category = resolveCashFlowCategory(line.accounts)
  if (category !== 'OPERATING') return false
  if (!isAllowedOperatingDetailCode(code)) return true

  const hasReceiptSettlementLine = nonCashLines.some((candidate) =>
    isOperatingReceiptSettlementCode(String(candidate?.accounts?.code || '').trim())
  )
  const hasAccrualSettlementLine = nonCashLines.some((candidate) =>
    isOperatingAccrualSettlementCode(String(candidate?.accounts?.code || '').trim())
  )
  const hasInventoryAssetLine = nonCashLines.some((candidate) =>
    isOperatingInventoryCode(String(candidate?.accounts?.code || '').trim())
  )

  if (isOperatingRevenueCode(code) && hasReceiptSettlementLine) {
    return true
  }

  if (code === '5001' && hasInventoryAssetLine) {
    return true
  }

  if (isOperatingExpenseCode(code) && code !== '5001' && hasAccrualSettlementLine) {
    return true
  }

  return false
}

async function getCashBalance(
  db: any,
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)
  const consolidationParentOrgId = consolidated ? orgId : null
  const cashAccountCodes = await getCashAccountCodes(
    db,
    supabase,
    orgIdsToSearch,
    branchId,
    consolidated,
    consolidationParentOrgId
  )
  const entryIds = await getPostedEntryIds(db, orgId, { branchId, consolidated })
  const balances = await getAccountBalancesFromEntries(db, entryIds, cashAccountCodes, consolidationParentOrgId)

  return balances.reduce((sum: number, account: any) => {
    const totalDebit = Number(account?.total_debit || 0)
    const totalCredit = Number(account?.total_credit || 0)
    return sum + (totalDebit - totalCredit)
  }, 0)
}

export async function getCashBalanceSnapshot(
  orgId: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any
  return getCashBalance(db, supabase, orgId, branchId, consolidated)
}

function resolveCashFlowCategory(account: CashFlowLineAccount | null | undefined): CashFlowCategory {
  const mappedCategory = account?.cash_flow_category
  if (mappedCategory === 'OPERATING' || mappedCategory === 'INVESTING' || mappedCategory === 'FINANCING') {
    return mappedCategory
  }

  const code = String(account?.code || '').trim()
  if (code === '2102') return 'FINANCING'
  if (code.startsWith('15') || code.startsWith('16')) return 'INVESTING'
  if (code.startsWith('25') || code.startsWith('26') || code.startsWith('3')) return 'FINANCING'
  return 'OPERATING'
}

function resolveEntryCashFlowCategory(nonCashLines: CashFlowLine[]): CashFlowCategory {
  const categories = nonCashLines
    .map((line) => resolveCashFlowCategory(line.accounts))
    .filter((category): category is CashFlowCategory => Boolean(category))

  if (categories.includes('INVESTING')) return 'INVESTING'
  if (categories.includes('FINANCING')) return 'FINANCING'
  return 'OPERATING'
}

function findPreferredCashFlowLine(
  lines: CashFlowLine[],
  predicates: Array<(code: string, line: CashFlowLine) => boolean>
) {
  for (const predicate of predicates) {
    const match = lines.find((line) => {
      const code = String(line?.accounts?.code || '').trim()
      return Boolean(code) && predicate(code, line)
    })

    if (match) return match
  }

  return lines[0] || null
}

function resolvePrimaryCashFlowLine(
  nonCashLines: CashFlowLine[],
  cashAccountCodes: string[],
  category: CashFlowCategory,
  cashAmount: number
) {
  const preferredLines = nonCashLines.filter((line) =>
    !shouldExcludeCashFlowDetailLine(line, nonCashLines, cashAccountCodes)
  )
  const candidateLines = preferredLines.length > 0
    ? preferredLines
    : nonCashLines.filter((line) => String(line?.accounts?.code || '').trim().length > 0)

  if (candidateLines.length === 0) return null

  if (category === 'INVESTING') {
    return findPreferredCashFlowLine(candidateLines, [
      (code) => code.startsWith('15') || code.startsWith('16'),
      (_code, line) => resolveCashFlowCategory(line.accounts) === 'INVESTING',
    ])
  }

  if (category === 'FINANCING') {
    return findPreferredCashFlowLine(candidateLines, [
      (code) => code === '2102',
      (code) => code.startsWith('25') || code.startsWith('26'),
      (code) => code.startsWith('3'),
      (_code, line) => resolveCashFlowCategory(line.accounts) === 'FINANCING',
    ])
  }

  if (cashAmount >= 0) {
    return findPreferredCashFlowLine(candidateLines, [
      (code) => isOperatingReceivableCode(code),
      (code) => code === '2302',
      (code) => isOperatingRevenueCode(code),
      (code) => code.startsWith('22'),
      (code) => code.startsWith('24'),
      (code) => isOperatingPrepaidCode(code),
      (code) => isOperatingInventoryCode(code),
      (code) => isOperatingExpenseCode(code),
    ])
  }

  return findPreferredCashFlowLine(candidateLines, [
    (code) => code === '2101',
    (code) => isOperatingInventoryCode(code),
    (code) => code === '1403',
    (code) => code.startsWith('24'),
    (code) => code.startsWith('22'),
    (code) => code.startsWith('23'),
    (code) => isOperatingPrepaidCode(code),
    (code) => isOperatingExpenseCode(code),
    (code) => isOperatingRevenueCode(code),
    (code) => isOperatingReceivableCode(code),
  ])
}

function formatDirectCashFlowItemName(line: CashFlowLine | null, category: CashFlowCategory, cashAmount: number) {
  const code = String(line?.accounts?.code || '').trim()
  const baseName = String(line?.accounts?.name || 'Tanpa Nama Akun').trim() || 'Tanpa Nama Akun'
  const referenceType = String(line?.journal_entries?.reference_type || '').trim().toUpperCase()
  const description = String(line?.journal_entries?.description || '').trim().toLowerCase()
  const notes = String(line?.journal_entries?.notes || '').trim().toLowerCase()
  const isInflow = cashAmount >= 0

  const isGl1201Adjustment =
    referenceType === 'ADJUSTMENT' ||
    description.includes('gl-1201-adj') ||
    description.includes('penyesuaian piutang') ||
    notes.includes('gl-1201-adj') ||
    notes.includes('penyesuaian piutang')

  if (category === 'INVESTING') {
    if (code.startsWith('15') || code.startsWith('16')) {
      return isInflow ? `Penerimaan dari Pelepasan ${baseName}` : `Pembelian ${baseName}`
    }

    return isInflow ? 'Penerimaan Kas Investasi' : 'Pengeluaran Kas Investasi'
  }

  if (category === 'FINANCING') {
    if (code.startsWith('3')) {
      return isInflow ? 'Setoran Modal Pemilik' : 'Penarikan Modal / Dividen'
    }

    if (code === '2102' || code.startsWith('25') || code.startsWith('26')) {
      return isInflow ? `Penerimaan ${baseName}` : `Pembayaran ${baseName}`
    }

    return isInflow ? 'Penerimaan Kas Pendanaan' : 'Pengeluaran Kas Pendanaan'
  }

  if (code === '1201') {
    if (referenceType === 'SAAS_CASH_IN') {
      return isInflow ? 'Penerimaan Penjualan SaaS' : 'Pengembalian Penjualan SaaS'
    }

    if (isGl1201Adjustment) {
      return isInflow
        ? 'Penerimaan Rekonsiliasi Piutang Usaha (GL 1201)'
        : 'Pengembalian / Koreksi Rekonsiliasi Piutang Usaha (GL 1201)'
    }

    return isInflow ? 'Penerimaan Piutang Usaha' : 'Pengembalian / Koreksi Piutang Usaha'
  }

  if (code === '2101') {
    return isInflow ? 'Pengembalian dari Supplier / Hutang Usaha' : 'Pembayaran Hutang Usaha'
  }

  if (code === '2201') {
    return isInflow ? 'Penerimaan / Restitusi PPN Keluaran' : 'Pembayaran PPN Keluaran'
  }

  if (code === '2202') {
    return isInflow ? 'Penerimaan / Restitusi PPh 21' : 'Pembayaran PPh 21'
  }

  if (code === '2203') {
    return isInflow ? 'Penerimaan / Restitusi PPh 23' : 'Pembayaran PPh 23'
  }

  if (code === '2204') {
    return isInflow ? 'Penerimaan / Restitusi PPh Badan' : 'Pembayaran PPh Badan'
  }

  if (code === '2301') {
    return isInflow ? 'Penerimaan Pendapatan Diterima di Muka' : 'Pengembalian Pendapatan Diterima di Muka'
  }

  if (code === '2302') {
    return isInflow ? 'Penerimaan Uang Muka Penjualan' : 'Pengembalian Uang Muka Penjualan'
  }

  if (code === '2401') {
    return isInflow ? 'Pengembalian Hutang Gaji' : 'Pembayaran Hutang Gaji'
  }

  if (code === '4001') {
    return isInflow ? 'Penerimaan dari Pelanggan / Penjualan' : 'Refund / Koreksi Penjualan Tunai'
  }

  if (code === '1301') {
    return isInflow ? 'Penerimaan terkait Persediaan Barang Dagangan' : 'Pembayaran Persediaan Barang Dagangan'
  }

  if (code === '1302') {
    return isInflow ? 'Penerimaan terkait Persediaan Barang Dalam Proses' : 'Pembayaran Persediaan Barang Dalam Proses'
  }

  if (code === '1303') {
    return isInflow ? 'Penerimaan terkait Persediaan Bahan Baku' : 'Pembayaran Persediaan Bahan Baku'
  }

  if (code === '1304') {
    return isInflow ? 'Penerimaan terkait Persediaan Barang Jadi' : 'Pembayaran Persediaan Barang Jadi'
  }

  if (code === '1402') {
    return isInflow ? 'Pengembalian Biaya Dibayar Dimuka' : 'Pembayaran Biaya Dibayar Dimuka'
  }

  if (code === '1403') {
    return isInflow ? 'Pengembalian Uang Muka Pembelian' : 'Pembayaran Uang Muka Pembelian'
  }

  if (code.startsWith('12') && code !== '1203') {
    return isInflow ? `Penerimaan ${baseName}` : `Pengembalian ${baseName}`
  }

  if (code.startsWith('13') || code.startsWith('14')) {
    return isInflow ? `Penerimaan terkait ${baseName}` : `Pembayaran ${baseName}`
  }

  if (code.startsWith('22') || code.startsWith('23') || code.startsWith('24')) {
    return isInflow ? `Penerimaan / Pengembalian ${baseName}` : `Pembayaran ${baseName}`
  }

  if (code.startsWith('4')) {
    return isInflow ? `Penerimaan ${baseName}` : `Refund / Koreksi ${baseName}`
  }

  if (code.startsWith('5') || code.startsWith('6') || code.startsWith('9')) {
    return isInflow ? `Pengembalian ${baseName}` : `Pembayaran ${baseName}`
  }

  return isInflow ? `Penerimaan ${baseName}` : `Pembayaran ${baseName}`
}

function buildCashFlowReferenceKey(
  referenceTypeRaw: string | null | undefined,
  referenceIdRaw: string | null | undefined
) {
  const referenceType = String(referenceTypeRaw || '').trim().toUpperCase()
  const referenceId = String(referenceIdRaw || '').trim()
  if (!referenceType || !referenceId) return null
  return `${referenceType}:${referenceId}`
}

function formatCashFlowReferenceLabel(parts: Array<string | null | undefined>) {
  const compactParts = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)

  return compactParts.length > 0 ? compactParts.join(' • ') : null
}

async function getJournalLinesForEntries(
  db: any,
  entryIds: string[],
  cashAccountCodes?: string[],
  consolidationParentOrgId?: string | null
): Promise<CashFlowLine[]> {
  if (entryIds.length === 0) return []

  const { queryPostgres } = await import('@/lib/db/postgres')

  let sql = consolidationParentOrgId
    ? `
      SELECT
        jl.entry_id,
        jl.debit,
        jl.credit,
        COALESCE(group_accounts.id, source_accounts.id) AS account_id,
        COALESCE(group_accounts.code, source_accounts.code) AS account_code,
        COALESCE(group_accounts.name, source_accounts.name) AS account_name,
        COALESCE(group_accounts.type::text, source_accounts.type::text) AS account_type,
        COALESCE(group_accounts.normal_balance::text, source_accounts.normal_balance::text) AS account_normal_balance,
        COALESCE(group_accounts.parent_id, source_accounts.parent_id) AS account_parent_id,
        COALESCE(group_accounts.cash_flow_category, source_accounts.cash_flow_category) AS account_cash_flow_category,
        je.entry_date AS je_entry_date,
        je.description AS je_description,
        je.notes AS je_notes,
        je.reference_type AS je_reference_type,
        je.reference_id AS je_reference_id
      FROM public.journal_lines jl
      JOIN public.journal_entries je ON je.id = jl.entry_id
      JOIN public.accounts source_accounts ON source_accounts.id = jl.account_id
      LEFT JOIN public.coa_consolidation_mappings mappings
        ON mappings.parent_org_id = $2::uuid
       AND mappings.child_org_id = je.org_id
       AND mappings.local_account_id = source_accounts.id
       AND mappings.is_active = TRUE
      LEFT JOIN public.accounts group_accounts
        ON group_accounts.id = mappings.group_account_id
      WHERE jl.entry_id = ANY($1::uuid[])
    `
    : `
      SELECT
        jl.entry_id,
        jl.debit,
        jl.credit,
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type,
        a.normal_balance AS account_normal_balance,
        a.parent_id AS account_parent_id,
        a.cash_flow_category AS account_cash_flow_category,
        je.entry_date AS je_entry_date,
        je.description AS je_description,
        je.notes AS je_notes,
        je.reference_type AS je_reference_type,
        je.reference_id AS je_reference_id
      FROM public.journal_lines jl
      JOIN public.accounts a ON a.id = jl.account_id
      JOIN public.journal_entries je ON je.id = jl.entry_id
      WHERE jl.entry_id = ANY($1::uuid[])
    `
  const params: any[] = consolidationParentOrgId ? [entryIds, consolidationParentOrgId] : [entryIds]

  if (Array.isArray(cashAccountCodes) && cashAccountCodes.length > 0) {
    sql += consolidationParentOrgId
      ? ` AND COALESCE(group_accounts.code, source_accounts.code) = ANY($3)`
      : ` AND a.code = ANY($2)`
    params.push(cashAccountCodes)
  }

  try {
    const { rows } = await queryPostgres<Record<string, unknown>>(sql, params)
    return rows.map(r => ({
      entry_id: String(r.entry_id ?? ''),
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      accounts: r.account_code ? {
        id: r.account_id ? String(r.account_id) : undefined,
        code: String(r.account_code),
        name: r.account_name ? String(r.account_name) : undefined,
        type: r.account_type ? String(r.account_type) : undefined,
        normal_balance: r.account_normal_balance ? String(r.account_normal_balance) : undefined,
        parent_id: r.account_parent_id ? String(r.account_parent_id) : undefined,
        cash_flow_category: r.account_cash_flow_category as CashFlowCategory | undefined
      } : null,
      journal_entries: {
        entry_date: r.je_entry_date ? String(r.je_entry_date) : undefined,
        description: r.je_description ? String(r.je_description) : undefined,
        notes: r.je_notes ? String(r.je_notes) : undefined,
        reference_type: r.je_reference_type ? String(r.je_reference_type) : undefined,
        reference_id: r.je_reference_id ? String(r.je_reference_id) : undefined,
      }
    }))
  } catch (err) {
    if (consolidationParentOrgId && isMissingConsolidationMappingSchemaError(err)) {
      return getJournalLinesForEntries(db, entryIds, cashAccountCodes)
    }

    ;(console as any).error('[getJournalLinesForEntries]', err)
    return []
  }
}

async function getCashFlowReferenceLabels(lines: CashFlowLine[]) {
  const referenceIdsByType = new Map<string, Set<string>>()

  for (const line of lines) {
    const referenceType = String(line?.journal_entries?.reference_type || '').trim().toUpperCase()
    const referenceId = String(line?.journal_entries?.reference_id || '').trim()
    if (!referenceType || !referenceId) continue

    const existing = referenceIdsByType.get(referenceType) || new Set<string>()
    existing.add(referenceId)
    referenceIdsByType.set(referenceType, existing)
  }

  if (referenceIdsByType.size === 0) {
    return new Map<string, string>()
  }

  const { queryPostgres } = await import('@/lib/db/postgres')
  const labelMap = new Map<string, string>()

  const saleIds = Array.from(referenceIdsByType.get('SALE') || [])
  if (saleIds.length > 0) {
    try {
      const { rows } = await queryPostgres<Record<string, unknown>>(
        `
          SELECT id, sale_number
          FROM public.sales
          WHERE id = ANY($1::uuid[])
        `,
        [saleIds]
      )

      rows.forEach((row) => {
        const referenceId = String(row.id || '').trim()
        if (!referenceId) return
        const label = formatCashFlowReferenceLabel([String(row.sale_number || '').trim()])
        if (!label) return
        labelMap.set(`SALE:${referenceId}`, label)
      })
    } catch (err) {
      ;(console as any).error('[getCashFlowReferenceLabels:sales]', err)
    }
  }

  const purchaseIds = Array.from(referenceIdsByType.get('PURCHASE') || [])
  if (purchaseIds.length > 0) {
    try {
      const { rows } = await queryPostgres<Record<string, unknown>>(
        `
          SELECT id, purchase_number
          FROM public.purchases
          WHERE id = ANY($1::uuid[])
        `,
        [purchaseIds]
      )

      rows.forEach((row) => {
        const referenceId = String(row.id || '').trim()
        if (!referenceId) return
        const label = formatCashFlowReferenceLabel([String(row.purchase_number || '').trim()])
        if (!label) return
        labelMap.set(`PURCHASE:${referenceId}`, label)
      })
    } catch (err) {
      ;(console as any).error('[getCashFlowReferenceLabels:purchases]', err)
    }
  }

  const paymentInIds = Array.from(referenceIdsByType.get('PAYMENT_IN') || [])
  if (paymentInIds.length > 0) {
    try {
      const { rows } = await queryPostgres<Record<string, unknown>>(
        `
          SELECT
            sp.id,
            sp.payment_number,
            s.sale_number
          FROM public.sales_payments sp
          LEFT JOIN public.sales s ON s.id = sp.sale_id
          WHERE sp.id = ANY($1::uuid[])
        `,
        [paymentInIds]
      )

      rows.forEach((row) => {
        const referenceId = String(row.id || '').trim()
        if (!referenceId) return
        const label = formatCashFlowReferenceLabel([
          String(row.payment_number || '').trim(),
          String(row.sale_number || '').trim(),
        ])
        if (!label) return
        labelMap.set(`PAYMENT_IN:${referenceId}`, label)
      })
    } catch (err) {
      ;(console as any).error('[getCashFlowReferenceLabels:sales_payments]', err)
    }
  }

  const purchasePaymentIds = Array.from(new Set([
    ...Array.from(referenceIdsByType.get('PURCHASE_PAYMENT') || []),
    ...Array.from(referenceIdsByType.get('PAYMENT_OUT') || []),
  ]))
  if (purchasePaymentIds.length > 0) {
    const purchasePaymentIdSet = referenceIdsByType.get('PURCHASE_PAYMENT') || new Set<string>()
    const paymentOutIdSet = referenceIdsByType.get('PAYMENT_OUT') || new Set<string>()

    try {
      const { rows } = await queryPostgres<Record<string, unknown>>(
        `
          SELECT
            pp.id,
            pp.payment_number,
            p.purchase_number
          FROM public.purchase_payments pp
          LEFT JOIN public.purchases p ON p.id = pp.purchase_id
          WHERE pp.id = ANY($1::uuid[])
        `,
        [purchasePaymentIds]
      )

      rows.forEach((row) => {
        const referenceId = String(row.id || '').trim()
        if (!referenceId) return
        const label = formatCashFlowReferenceLabel([
          String(row.payment_number || '').trim(),
          String(row.purchase_number || '').trim(),
        ])
        if (!label) return
        if (purchasePaymentIdSet.has(referenceId)) {
          labelMap.set(`PURCHASE_PAYMENT:${referenceId}`, label)
        }
        if (paymentOutIdSet.has(referenceId)) {
          labelMap.set(`PAYMENT_OUT:${referenceId}`, label)
        }
      })
    } catch (err) {
      ;(console as any).error('[getCashFlowReferenceLabels:purchase_payments]', err)
    }
  }

  return labelMap
}

function buildCashFlowItemDetail(
  line: CashFlowLine | null,
  amount: number,
  fallbackDescription: string,
  referenceLabels: Map<string, string>
): CashFlowItemDetail {
  const entryId = String(line?.entry_id || '').trim() || fallbackDescription
  const entryDate = String(line?.journal_entries?.entry_date || '').trim() || null
  const description = String(line?.journal_entries?.description || '').trim() || fallbackDescription
  const notes = String(line?.journal_entries?.notes || '').trim() || null
  const referenceType = String(line?.journal_entries?.reference_type || '').trim().toUpperCase() || null
  const referenceId = String(line?.journal_entries?.reference_id || '').trim() || null
  const referenceKey = buildCashFlowReferenceKey(referenceType, referenceId)

  return {
    entryId,
    entryDate,
    amount,
    description,
    notes,
    referenceType,
    referenceLabel: referenceKey ? referenceLabels.get(referenceKey) || null : null,
  }
}

function summarizeCashFlowFromLines(
  lines: CashFlowLine[],
  cashAccountCodes: string[],
  referenceLabels: Map<string, string> = new Map()
) {
  if (lines.length === 0) {
    return {
      ocf: 0,
      icf: 0,
      fcf: 0,
      netChange: 0,
      ocfItems: [] as CashFlowItem[],
      icfItems: [] as CashFlowItem[],
      fcfItems: [] as CashFlowItem[],
    }
  }

  const linesByEntryId = new Map<string, CashFlowLine[]>()
  lines.forEach((line) => {
    const entryId = String(line?.entry_id || '').trim()
    if (!entryId) return
    const existing = linesByEntryId.get(entryId) || []
    existing.push(line)
    linesByEntryId.set(entryId, existing)
  })

  let ocf = 0
  let icf = 0
  let fcf = 0
  const itemMap = new Map<string, CashFlowItem>()

  for (const entryLines of linesByEntryId.values()) {
    const cashLines = entryLines.filter((line) => cashAccountCodes.includes(String(line?.accounts?.code || '')))
    if (cashLines.length === 0) continue

    const nonCashLines = entryLines.filter((line) => !cashAccountCodes.includes(String(line?.accounts?.code || '')))
    if (nonCashLines.length === 0) continue

    const cashAmount = cashLines.reduce(
      (sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0),
      0
    )
    if (Math.abs(cashAmount) < 0.01) continue

    const category = resolveEntryCashFlowCategory(nonCashLines)
    const primaryLine = resolvePrimaryCashFlowLine(nonCashLines, cashAccountCodes, category, cashAmount)
    const code = String(primaryLine?.accounts?.code || category.slice(0, 3)).trim() || category.slice(0, 3)
    const itemName = formatDirectCashFlowItemName(primaryLine, category, cashAmount)
    const detail = buildCashFlowItemDetail(primaryLine, cashAmount, itemName, referenceLabels)
    const itemKey = `${category}:${code}:${itemName}`
    const existingItem = itemMap.get(itemKey)
    if (existingItem) {
      existingItem.amount += cashAmount
      existingItem.details.push(detail)
    } else {
      itemMap.set(itemKey, {
        code,
        name: itemName,
        amount: cashAmount,
        details: [detail],
      })
    }

    if (category === 'OPERATING') ocf += cashAmount
    else if (category === 'INVESTING') icf += cashAmount
    else fcf += cashAmount
  }

  const toSortedItems = (category: CashFlowCategory) =>
    Array.from(itemMap.entries())
      .filter(([key]) => key.startsWith(`${category}:`))
      .map(([, item]) => ({
        ...item,
        details: item.details
          .filter((detail) => Math.abs(detail.amount) > 0.01)
          .sort((left, right) => {
            const byDate = String(right.entryDate || '').localeCompare(String(left.entryDate || ''))
            if (byDate !== 0) return byDate

            const byMagnitude = Math.abs(right.amount) - Math.abs(left.amount)
            if (byMagnitude !== 0) return byMagnitude

            return left.description.localeCompare(right.description, 'id-ID')
          }),
      }))
      .filter((item) => Math.abs(item.amount) > 0.01)
      .sort((a, b) => a.code.localeCompare(b.code))

  return {
    ocf,
    icf,
    fcf,
    netChange: ocf + icf + fcf,
    ocfItems: toSortedItems('OPERATING'),
    icfItems: toSortedItems('INVESTING'),
    fcfItems: toSortedItems('FINANCING'),
  }
}

export async function getGeneralLedger(orgId: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any

  const entryIds = await getPostedEntryIds(db, orgId, { branchId, consolidated })
  if (entryIds.length === 0) return []

  const { queryPostgres } = await import('@/lib/db/postgres')

  let entryRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT *
      FROM   public.journal_entries
      WHERE  id = ANY($1::uuid[])
      ORDER  BY entry_date ASC
    `, [entryIds])
    entryRows = result.rows
  } catch (err) {
    ;(console as any).error('[getGeneralLedger] raw SQL error:', err)
    return []
  }

  // Fetch journal lines with account info
  const linesByEntryId: Record<string, any[]> = {}
  if (entryRows.length > 0) {
    try {
      const linesResult = await queryPostgres<Record<string, unknown>>(`
        SELECT
          jl.*,
          a.code AS account_code,
          a.name AS account_name,
          a.type AS account_type
        FROM   public.journal_lines jl
        LEFT JOIN public.accounts a ON a.id = jl.account_id
        WHERE  jl.entry_id = ANY($1::uuid[])
      `, [entryIds])

      for (const line of linesResult.rows) {
        const eid = String(line.entry_id ?? '')
        if (!linesByEntryId[eid]) linesByEntryId[eid] = []
        linesByEntryId[eid].push({
          ...line,
          accounts: line.account_name
            ? { code: line.account_code, name: line.account_name, type: line.account_type }
            : null,
        })
      }
    } catch (err) {
      ;(console as any).error('[getGeneralLedger] lines SQL error:', err)
    }
  }

  const entries = entryRows.map((row) => ({
    ...row,
    journal_lines: linesByEntryId[String(row.id ?? '')] ?? []
  }))

  try {
    return await hydratePurchaseTransparencyForEntries(entries, queryPostgres)
  } catch (err) {
    ;(console as any).error('[getGeneralLedger] purchase transparency hydrate error:', err)
    return entries.map((entry) => ({ ...entry, purchase_transparency: null }))
  }
}


export async function getBalanceSheet(
  orgId: string,
  asOfDate?: string,
  branchId?: BranchFilter,
  consolidated: boolean = false
) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any
  const finalAsOfDate = asOfDate || getDateInTimeZone('Asia/Jakarta')

  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)
  const consolidationParentOrgId = consolidated ? orgId : null

  // 1. Fetch reference accounts from selected org scope
  const accountRows = await getEffectiveReferenceAccounts(db, orgIdsToSearch, orgId, consolidated)

  const dedupedByCode = new Map<string, any>()
  const sortedRows = (Array.isArray(accountRows) ? accountRows : []).sort((a: any, b: any) => {
    const byCode = String(a?.code || '').localeCompare(String(b?.code || ''))
    if (byCode !== 0) return byCode
    if (a?.org_id === orgId && b?.org_id !== orgId) return -1
    if (a?.org_id !== orgId && b?.org_id === orgId) return 1
    return String(a?.name || '').localeCompare(String(b?.name || ''))
  })
  for (const account of sortedRows) {
    const code = String(account?.code || '').trim()
    if (!code || dedupedByCode.has(code)) continue
    dedupedByCode.set(code, account)
  }
  const accounts = Array.from(dedupedByCode.values())

  const entryIds = await getPostedEntryIds(db, orgId, { branchId, asOfDate: finalAsOfDate, consolidated })

  const balances = entryIds.length > 0
    ? await getAccountBalancesFromEntries(db, entryIds, undefined, consolidationParentOrgId)
    : []
  const balancesByCode = new Map<string, any>(balances.map((b: any) => [b.code, b]))

  const mapBalance = (account: any, positiveSide: 'DEBIT' | 'CREDIT') => {
    const existing = balancesByCode.get(account.code)
    const totalDebit = Number(existing?.total_debit || 0)
    const totalCredit = Number(existing?.total_credit || 0)
    const balance = positiveSide === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit
    return {
      ...account,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance,
    }
  }

  const assets = accounts
    .filter((a: any) => a.type === 'ASSET')
    .map((a: any) => mapBalance(a, 'DEBIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const liabilities = accounts
    .filter((a: any) => a.type === 'LIABILITY')
    .map((a: any) => mapBalance(a, 'CREDIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const equity = accounts
    .filter((a: any) => a.type === 'EQUITY')
    .map((a: any) => mapBalance(a, 'CREDIT'))
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  const fiscalYearStart = `${finalAsOfDate.slice(0, 4)}-01-01`
  const { data: latestClosedPeriod } = await db
    .from('fiscal_periods')
    .select('end_date')
    .eq('org_id', orgId)
    .eq('is_closed', true)
    .lte('end_date', finalAsOfDate)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestClosedEnd = String(latestClosedPeriod?.end_date || '').trim() || null
  const nextOpenDate = latestClosedEnd ? addDaysToDateString(latestClosedEnd, 1) : null
  const currentPeriodStart = nextOpenDate && nextOpenDate > fiscalYearStart ? nextOpenDate : fiscalYearStart
  const retainedEarningsEnd = addDaysToDateString(currentPeriodStart, -1)

  // ── Optimasi: hitung laba tanpa manggil getProfitLoss() ──
  // Sebelumnya getBalanceSheet manggil getProfitLoss 2× (masing2 bikin query sendiri).
  // Sekarang pake getPostedEntryIds + getAccountBalancesFromEntries langsung,
  // lebih ringan karena gak perlu auth check & setup client ulang.

  let retainedProfit = 0
  let currentProfit = 0

  if (retainedEarningsEnd >= '1970-01-01') {
    const retainedEntryIds = await getPostedEntryIds(db, orgId, {
      branchId,
      startDate: '1970-01-01',
      endDate: retainedEarningsEnd,
      consolidated,
    })
    if (retainedEntryIds.length > 0) {
      const retainedBalances = await getAccountBalancesFromEntries(db, retainedEntryIds, undefined, consolidationParentOrgId)
      const revBal = retainedBalances.filter((b: any) => b.type === 'REVENUE').reduce((s: number, b: any) => s + (b.total_credit - b.total_debit), 0)
      const expBal = retainedBalances.filter((b: any) => b.type === 'EXPENSE').reduce((s: number, b: any) => s + (b.total_debit - b.total_credit), 0)
      retainedProfit = revBal - expBal
    }
  }

  if (currentPeriodStart <= finalAsOfDate) {
    const currentEntryIds = await getPostedEntryIds(db, orgId, {
      branchId,
      startDate: currentPeriodStart,
      endDate: finalAsOfDate,
      consolidated,
    })
    if (currentEntryIds.length > 0) {
      const currentBalances = await getAccountBalancesFromEntries(db, currentEntryIds, undefined, consolidationParentOrgId)
      const revBal = currentBalances.filter((b: any) => b.type === 'REVENUE').reduce((s: number, b: any) => s + (b.total_credit - b.total_debit), 0)
      const expBal = currentBalances.filter((b: any) => b.type === 'EXPENSE').reduce((s: number, b: any) => s + (b.total_debit - b.total_credit), 0)
      currentProfit = revBal - expBal
    }
  }

  const referenceByCode = new Map<string, any>(accounts.map((account: any) => [String(account?.code || ''), account]))
  const equityParent = referenceByCode.get('3000')
  const upsertDerivedEquity = (code: string, fallbackName: string, balanceDelta: number) => {
    const existingIndex = equity.findIndex((row: any) => String(row?.code || '').trim() === code)
    if (existingIndex >= 0) {
      equity[existingIndex] = {
        ...equity[existingIndex],
        balance: Number(equity[existingIndex]?.balance || 0) + balanceDelta,
        isSystemComputed: true,
      }
      return
    }

    const referenceAccount = referenceByCode.get(code)
    equity.push({
      ...(referenceAccount || {}),
      code,
      name: referenceAccount?.name || fallbackName,
      type: 'EQUITY',
      parent_id: referenceAccount?.parent_id || equityParent?.id || null,
      balance: balanceDelta,
      isSystemComputed: true,
    })
  }

  upsertDerivedEquity('3002', 'Laba Ditahan', retainedProfit)
  upsertDerivedEquity('3003', 'Laba Periode Berjalan', currentProfit)
  equity.sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || '')))

  return { assets, liabilities, equity }
}

export async function getProfitLoss(orgId: string, startDate?: string, endDate?: string, branchId?: BranchFilter, consolidated: boolean = false) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const sDate = startDate || `${todayInJakarta.slice(0, 7)}-01`
  const eDate = endDate || todayInJakarta
  const consolidationParentOrgId = consolidated ? orgId : null

  const entryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: sDate,
    endDate: eDate,
    consolidated,
  })

  if (entryIds.length === 0) {
    return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }
  }

  const balances = await getAccountBalancesFromEntries(db, entryIds, undefined, consolidationParentOrgId)
  if (balances.length === 0) return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 }

  const results = balances.map((a: any) => ({
    ...a,
    balance: ['REVENUE', 'LIABILITY', 'EQUITY'].includes(a.type)
      ? a.total_credit - a.total_debit
      : a.total_debit - a.total_credit
  }))

  const revenue = results.filter((a: any) => a.type === 'REVENUE').sort((a: any, b: any) => a.code.localeCompare(b.code))
  const expenses = results.filter((a: any) => a.type === 'EXPENSE').sort((a: any, b: any) => a.code.localeCompare(b.code))

  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (r.balance || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.balance || 0), 0)

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses }
}

export async function getCashFlow(
  orgId: string,
  branchId?: BranchFilter,
  consolidated: boolean = false,
  options: CashFlowOptions = {}
) {
  noStore()
  const supabase = await createClient()
  const db = supabase as any
  const orgIdsToSearch = await resolveOrgIdsForReport(db, orgId, consolidated)
  const consolidationParentOrgId = consolidated ? orgId : null

  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const startDate = options.startDate || `${todayInJakarta.slice(0, 7)}-01`
  const endDate = options.endDate || todayInJakarta
  const periodLengthDays = Math.max(diffDateOnlyStrings(endDate, startDate), 0) + 1
  const previousEndDate = addDaysToDateString(startDate, -1)
  const previousStartDate = addDaysToDateString(previousEndDate, -(periodLengthDays - 1))

  const cashAccountCodes = await getCashAccountCodes(
    db,
    supabase,
    orgIdsToSearch,
    branchId,
    consolidated,
    consolidationParentOrgId
  )

  const currentEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate,
    endDate,
    consolidated,
  })

  const previousEntryIds = await getPostedEntryIds(db, orgId, {
    branchId,
    startDate: previousStartDate,
    endDate: previousEndDate,
    consolidated,
  })

  const [currentLines, previousCashLines] = await Promise.all([
    getJournalLinesForEntries(db, currentEntryIds, undefined, consolidationParentOrgId),
    getJournalLinesForEntries(db, previousEntryIds, cashAccountCodes, consolidationParentOrgId),
  ])

  const referenceLabels = await getCashFlowReferenceLabels(currentLines)
  const currentSummary = summarizeCashFlowFromLines(currentLines, cashAccountCodes, referenceLabels)
  const previousChangeTotal = previousCashLines.reduce(
    (sum: number, line: CashFlowLine) => sum + (Number(line.debit || 0) - Number(line.credit || 0)),
    0
  )
  const netChangeTrend = currentSummary.netChange >= previousChangeTotal ? 'UP' : 'DOWN'

  // Percent change based on real bank movements if available, otherwise 0
  let changePercent = 0
  if (previousChangeTotal !== 0) {
    changePercent = ((currentSummary.netChange - previousChangeTotal) / Math.abs(previousChangeTotal)) * 100
  } else if (currentSummary.netChange !== 0) {
    changePercent = 100
  }

  return { 
    ocf: currentSummary.ocf,
    icf: currentSummary.icf,
    fcf: currentSummary.fcf,
    netChange: currentSummary.netChange,
    ocfItems: currentSummary.ocfItems,
    icfItems: currentSummary.icfItems,
    fcfItems: currentSummary.fcfItems,
    netChangeTrend: netChangeTrend as 'UP' | 'DOWN',
    changePercent
  }
}

export async function getDeckCashSummaries(
  orgIds: string[],
  branchesByOrgId: Record<string, BranchSummary[]>
): Promise<{
  orgSummaries: Record<string, DeckCashSummary>
  branchSummaries: Record<string, DeckCashSummary>
}> {
  const normalizedOrgIds = Array.from(new Set(orgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean)))
  if (normalizedOrgIds.length === 0) {
    return { orgSummaries: {}, branchSummaries: {} }
  }

  const supabase = await createClient()
  const db = supabase as any

  const orgEntries = await Promise.all(
    normalizedOrgIds.map(async (orgId) => {
      const [cashFlow, cash] = await Promise.all([
        getCashFlow(orgId, null, false),
        getCashBalance(db, supabase, orgId, null, false),
      ])

      return [orgId, {
        cash,
        ocf: Number(cashFlow?.ocf || 0),
        icf: Number(cashFlow?.icf || 0),
        fcf: Number(cashFlow?.fcf || 0),
      }] as const
    })
  )

  const branchEntries = await Promise.all(
    normalizedOrgIds.flatMap((orgId) =>
      (branchesByOrgId[orgId] || []).map(async (branch) => {
        const [cashFlow, cash] = await Promise.all([
          getCashFlow(orgId, branch.id, false),
          getCashBalance(db, supabase, orgId, branch.id, false),
        ])

        return [`${orgId}:${branch.id}`, {
          cash,
          ocf: Number(cashFlow?.ocf || 0),
          icf: Number(cashFlow?.icf || 0),
          fcf: Number(cashFlow?.fcf || 0),
        }] as const
      })
    )
  )

  return {
    orgSummaries: Object.fromEntries(orgEntries),
    branchSummaries: Object.fromEntries(branchEntries),
  }
}
