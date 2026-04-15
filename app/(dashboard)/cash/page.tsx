import { createAdminClient, createClient } from '@/lib/supabase/server'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { CashClient } from './CashClient'
import { checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import { getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'
import { canSelectAllBranches, getActiveBranch, getActiveOrg, getBranches, getChildOrgs } from '@/modules/organization/actions/org.actions'
import { getPendingCoaRequestCount } from '@/modules/accounting/actions/coa-request.actions'
import type {
  CashAccountOption,
  CashBankAccount,
  CashViewMode,
  ChildOrgSummary,
  PlacementAccountOption,
  RecentTransactionOption,
  TransferCategoryOption,
} from '@/modules/cash/types'

type CashBankAccountRecord = Omit<CashBankAccount, 'balances' | 'org_name' | 'branch_name'>
type NamedRelation = { name?: string | null } | Array<{ name?: string | null }> | null | undefined
type ManagedCashBankAccountRecord = CashBankAccountRecord & {
  organization?: NamedRelation
  branch?: NamedRelation
}
type ConsolidatedBalanceRow = {
  org_id?: string | null
  account_id?: string | null
  balance?: number | string | null
}
type AccountBalanceRow = {
  account_id?: string | null
  balance?: number | string | null
}
type RecentTransactionRecord = RecentTransactionOption & {
  organization?: NamedRelation
  branch?: NamedRelation
}

function isInvestingTransferAccount(account: CashAccountOption) {
  const code = String(account.code || '').trim()
  const name = String(account.name || '').toLowerCase()

  return (
    account.type === 'ASSET' &&
    (
      account.cash_flow_category === 'INVESTING' ||
      code.startsWith('16') ||
      name.includes('investasi')
    )
  )
}

function readRelationName(relation: NamedRelation): string | null {
  if (!relation) return null
  if (!Array.isArray(relation) && typeof relation.name === 'string') return relation.name
  if (Array.isArray(relation) && relation.length > 0 && typeof relation[0]?.name === 'string') {
    return relation[0].name
  }
  return null
}

function isMissingRpc(error: { code?: string | null; message?: string | null } | null | undefined, functionName: string) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const normalizedFunctionName = functionName.toLowerCase()

  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (
      message.includes(normalizedFunctionName) &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('undefined function'))
    )
  )
}

function isMissingColumnError(error: { message?: string | null } | null | undefined) {
  if (!error) return false
  const message = String(error.message || '').toLowerCase()
  return message.includes('column') && message.includes('does not exist')
}

function mapAccountsWithBalance<T extends { account_id: string }>(
  accounts: T[],
  balancesByAccountId: Map<string, number>
): Array<T & { balances: { balance: number } }> {
  return accounts.map((acc) => ({
    ...acc,
    balances: { balance: balancesByAccountId.get(String(acc.account_id)) || 0 },
  }))
}

function decorateCashAccountsWithBalance<T extends CashBankAccountRecord & {
  branch?: NamedRelation
  organization?: NamedRelation
}>(
  accounts: T[],
  balancesByAccountId: Map<string, number>
): CashBankAccount[] {
  return accounts.map((acc) => ({
    ...acc,
    balances: { balance: balancesByAccountId.get(String(acc.account_id)) || 0 },
    org_name: readRelationName(acc.organization),
    branch_name: readRelationName(acc.branch),
  }))
}

async function getCashAccountOptions(orgId: string): Promise<CashAccountOption[]> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, cash_flow_category')
    .eq('org_id', orgId)
    .order('code', { ascending: true })

  if (error || !Array.isArray(data)) return []
  return data as CashAccountOption[]
}

async function getChildOrgPlacementData(childOrgs: ChildOrgSummary[]) {
  const childOrgIds = Array.from(new Set(childOrgs.map((child) => String(child.id || '').trim()).filter(Boolean)))
  if (childOrgIds.length === 0) {
    return {
      branchesByOrgId: new Map<string, { id: string; name: string }[]>(),
      accountsByOrgId: new Map<string, CashAccountOption[]>(),
    }
  }

  const admin = (await createAdminClient()) as any

  const [{ data: branchRows, error: branchError }, { data: accountRows, error: accountError }] = await Promise.all([
    admin
      .from('branches')
      .select('org_id, id, name')
      .in('org_id', childOrgIds)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    admin
      .from('accounts')
      .select('org_id, id, code, name, type, cash_flow_category')
      .in('org_id', childOrgIds)
      .order('code', { ascending: true }),
  ])

  const branchesByOrgId = new Map<string, { id: string; name: string }[]>()
  if (!branchError && Array.isArray(branchRows)) {
    for (const row of branchRows as Array<{ org_id?: string; id?: string; name?: string }>) {
      const orgId = String(row?.org_id || '').trim()
      const id = String(row?.id || '').trim()
      const name = String(row?.name || '').trim()
      if (!orgId || !id || !name) continue
      const bucket = branchesByOrgId.get(orgId) || []
      bucket.push({ id, name })
      branchesByOrgId.set(orgId, bucket)
    }
  }

  const accountsByOrgId = new Map<string, CashAccountOption[]>()
  if (!accountError && Array.isArray(accountRows)) {
    for (const row of accountRows as Array<CashAccountOption & { org_id?: string }>) {
      const orgId = String(row?.org_id || '').trim()
      if (!orgId) continue
      const bucket = accountsByOrgId.get(orgId) || []
      bucket.push({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        type: row.type,
        cash_flow_category: row.cash_flow_category ?? null,
      })
      accountsByOrgId.set(orgId, bucket)
    }
  }

  return { branchesByOrgId, accountsByOrgId }
}

async function getPostedEntryIds(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  let query = supabase
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []
  return data.map((entry: { id: string }) => entry.id)
}

export async function getBankAccountsWithBalance(
  orgId: string,
  branchId?: string | null
): Promise<CashBankAccount[]> {
  const supabase = await createClient()

  // Fetch bank accounts joined with their base GL account
  let accountsQuery = supabase
    .from('bank_accounts')
    .select(`
      id,
      org_id,
      branch_id,
      account_id,
      bank_name,
      account_number,
      account:accounts(id, code, name, type, cash_flow_category),
      branch:branches(name)
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (branchId) {
    accountsQuery = accountsQuery.eq('branch_id', branchId)
  }

  const { data: accounts, error: accError } = await accountsQuery.order('bank_name', { ascending: true })

  if (accError || !accounts) return []
  const accountsTyped = accounts as Array<CashBankAccountRecord & { branch?: NamedRelation }>
  if (accountsTyped.length === 0) return []

  const accountIds = accountsTyped.map(a => a.account_id)

  const { data: scopedBalances, error: scopedBalanceError } = await (supabase as any).rpc('get_posted_account_balances', {
    p_org_id: orgId,
    p_branch_id: branchId ?? null,
    p_account_ids: accountIds,
  })

  if (!scopedBalanceError && Array.isArray(scopedBalances)) {
    const balancesByAccountId = new Map<string, number>(
      (scopedBalances as AccountBalanceRow[]).map((row) => [String(row.account_id), Number(row.balance || 0)])
    )
    return decorateCashAccountsWithBalance(accountsTyped, balancesByAccountId)
  }

  if (scopedBalanceError) {
    const fallbackReason = isMissingRpc(scopedBalanceError, 'get_posted_account_balances')
      ? 'RPC belum tersedia, pakai fallback query lama'
      : 'RPC gagal, pakai fallback query lama'
    ;(console as any).warn('getBankAccountsWithBalance:', fallbackReason, scopedBalanceError)
  }

  if (!branchId) {
    const { data: balances, error: balError } = await supabase
      .from('account_balances')
      .select('account_id, balance')
      .in('account_id', accountIds)

    if (balError) return decorateCashAccountsWithBalance(accountsTyped, new Map())

    const balancesByAccountId = new Map<string, number>(
      ((balances as AccountBalanceRow[]) || []).map((row) => [String(row.account_id), Number(row.balance || 0)])
    )
    return decorateCashAccountsWithBalance(accountsTyped, balancesByAccountId)
  }

  const entryIds = await getPostedEntryIds(orgId, branchId)
  if (entryIds.length === 0) {
    return decorateCashAccountsWithBalance(accountsTyped, new Map())
  }

  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit')
    .in('entry_id', entryIds)
    .in('account_id', accountIds)

  if (linesError || !Array.isArray(lines)) {
    return decorateCashAccountsWithBalance(accountsTyped, new Map())
  }

  const balanceMap = new Map<string, number>()
  for (const line of lines as Array<{ account_id: string; debit?: number | string | null; credit?: number | string | null }>) {
    const current = balanceMap.get(line.account_id) || 0
    balanceMap.set(line.account_id, current + Number(line.debit || 0) - Number(line.credit || 0))
  }

  return decorateCashAccountsWithBalance(accountsTyped, balanceMap)
}

async function getConsolidatedOrgIds(parentOrgId: string): Promise<string[]> {
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db.rpc('get_consolidated_org_ids', { p_parent_org_id: parentOrgId })

  if (error || !Array.isArray(data)) return [parentOrgId]

  const ids = (data as Array<{ org_id?: string | null }>)
    .map((row) => String(row?.org_id || '').trim())
    .filter((id: string) => id.length > 0)

  if (!ids.includes(parentOrgId)) ids.unshift(parentOrgId)
  return Array.from(new Set(ids))
}

async function getManagedBankAccountsForParent(parentOrgId: string): Promise<CashBankAccount[]> {
  const supabase = await createClient()
  const db = supabase as any
  const orgIds = await getConsolidatedOrgIds(parentOrgId)

  const { data: accounts, error: accountError } = await db
    .from('bank_accounts')
    .select(`
      id,
      org_id,
      branch_id,
      account_id,
      bank_name,
      account_number,
      account:accounts(id, code, name, type, cash_flow_category),
      organization:organizations(name),
      branch:branches(name)
    `)
    .in('org_id', orgIds)
    .eq('is_active', true)
    .order('bank_name', { ascending: true })

  if (accountError || !Array.isArray(accounts) || accounts.length === 0) return []
  const managedAccounts = accounts as ManagedCashBankAccountRecord[]

  const accountIds = Array.from(
    new Set(
      managedAccounts
        .map((account) => String(account?.account_id || '').trim())
        .filter((id: string) => id.length > 0)
    )
  )

  const balanceKeyFor = (orgId: string, accountId: string) => `${orgId}::${accountId}`
  let balanceByOrgAndAccountId = new Map<string, number>()
  if (accountIds.length > 0) {
    const { data: consolidatedBalances, error: consolidatedBalanceError } = await db
      .rpc('get_consolidated_posted_account_balances', {
        p_parent_org_id: parentOrgId,
        p_account_ids: accountIds,
      })

    if (!consolidatedBalanceError && Array.isArray(consolidatedBalances)) {
      balanceByOrgAndAccountId = new Map(
        (consolidatedBalances as ConsolidatedBalanceRow[]).map((row) => [
          balanceKeyFor(String(row.org_id), String(row.account_id)),
          Number(row.balance || 0),
        ])
      )
    } else {
      if (consolidatedBalanceError) {
        const fallbackReason = isMissingRpc(consolidatedBalanceError, 'get_consolidated_posted_account_balances')
          ? 'RPC konsolidasi belum tersedia, pakai snapshot account_balances'
          : 'RPC konsolidasi gagal, pakai snapshot account_balances'
        console.warn('getManagedBankAccountsForParent:', fallbackReason, consolidatedBalanceError)
      }

      const { data: balances, error: balanceError } = await db
        .from('account_balances')
        .select('account_id, balance')
        .in('account_id', accountIds)

      if (!balanceError && Array.isArray(balances)) {
        const snapshotBalanceByAccountId = new Map(
          (balances as AccountBalanceRow[]).map((row) => [String(row.account_id), Number(row.balance || 0)])
        )

        balanceByOrgAndAccountId = new Map(
          managedAccounts.map((account) => [
            balanceKeyFor(String(account.org_id), String(account.account_id)),
            snapshotBalanceByAccountId.get(String(account.account_id)) || 0,
          ])
        )
      }
    }
  }

  return managedAccounts.map((account) => ({
    ...account,
    balances: {
      balance: balanceByOrgAndAccountId.get(
        balanceKeyFor(String(account.org_id), String(account.account_id))
      ) || 0,
    },
    org_name: readRelationName(account.organization),
    branch_name: readRelationName(account.branch),
  }))
}

async function getManagedRecentTransactionsForParent(
  parentOrgId: string,
  limit = 20
): Promise<RecentTransactionOption[]> {
  const supabase = await createClient()
  const orgIds = await getConsolidatedOrgIds(parentOrgId)

  const detailedSelect = `
    id,
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    created_at,
    updated_at,
    reference_number,
    journal_entry_id,
    description,
    amount,
    type,
    status,
    bank_account:bank_accounts(bank_name, account_number),
    category:accounts(name, code),
    organization:organizations(name),
    branch:branches(name)
  `

  const legacySelect = `
    id,
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    type,
    status,
    bank_account:bank_accounts(bank_name, account_number),
    category:accounts(name, code),
    organization:organizations(name),
    branch:branches(name)
  `

  const runQuery = async (selectClause: string) => {
    return supabase
      .from('bank_transactions')
      .select(selectClause)
      .in('org_id', orgIds)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
  }

  const detailedResult = await runQuery(detailedSelect)
  let rows: RecentTransactionRecord[] = []

  if (!detailedResult.error && Array.isArray(detailedResult.data)) {
    rows = detailedResult.data as RecentTransactionRecord[]
  } else if (isMissingColumnError(detailedResult.error)) {
    const fallbackResult = await runQuery(legacySelect)
    if (fallbackResult.error || !Array.isArray(fallbackResult.data)) return []
    rows = fallbackResult.data as RecentTransactionRecord[]
  } else {
    return []
  }

  return rows.map((row) => ({
    ...row,
    org_name: readRelationName(row.organization),
    branch_name: readRelationName(row.branch),
  }))
}

export default async function CashPage({
  searchParams,
}: {
  searchParams?: Promise<{ cash_view?: string }>
}) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const orgEntity = orgData.org as typeof orgData.org & { parent_org_id?: string | null }
  const isParentOrgFromTree = !orgEntity.parent_org_id
  const [activeBranch, canAccessAllBranches, allAccounts, coaAccess, branches] = await Promise.all([
    getActiveBranch(orgId),
    canSelectAllBranches(orgId),
    getCashAccountOptions(orgId),
    checkCanManageCoA(orgId),
    getBranches(orgId),
  ])
  const { canManageDirect } = coaAccess
  const canUseHoldingView = canManageDirect && isParentOrgFromTree
  const requestedCashView = params?.cash_view === 'holding' ? 'holding' : 'parent'
  const cashViewMode: CashViewMode = canUseHoldingView ? requestedCashView : 'parent'

  const viewBranchId = canAccessAllBranches ? null : (activeBranch?.id ?? null)

  const [bankAccounts, parentRecentTransactions] = await Promise.all([
    getBankAccountsWithBalance(orgId, viewBranchId),
    getRecentBankTransactions(orgId, 20, viewBranchId),
  ])

  const [pendingCoaRequests, childOrgs, managedBankAccounts, holdingRecentTransactions]: [
    number,
    ChildOrgSummary[],
    CashBankAccount[],
    RecentTransactionOption[],
  ] = canManageDirect && isParentOrgFromTree
    ? await Promise.all([
        getPendingCoaRequestCount(orgId),
        getChildOrgs(orgId),
        getManagedBankAccountsForParent(orgId),
        getManagedRecentTransactionsForParent(orgId, 20),
      ])
    : [0, [] as ChildOrgSummary[], bankAccounts, parentRecentTransactions]

  const recentTransactions: RecentTransactionOption[] = cashViewMode === 'holding'
    ? holdingRecentTransactions
    : parentRecentTransactions

  // Prepare explicit placement options for Parent users
  const placementNodes: {
    orgId: string
    orgName: string
    branches: { id: string; name: string }[]
    accounts: PlacementAccountOption[]
  }[] = []
  const interOrgSourceAccounts = allAccounts.filter(isInvestingTransferAccount)
  const parentBankGlAccounts = allAccounts.filter(
    (account) =>
      account.type === 'ASSET' &&
      (account.code.startsWith('11') || account.name.toLowerCase().includes('kas') || account.name.toLowerCase().includes('bank'))
  )
  const parentTransferAccounts = allAccounts.filter((account) =>
    ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(account.type)
  )
  const transferCategoryNodes: {
    orgId: string
    orgName: string
    accounts: TransferCategoryOption[]
  }[] = []
  if (canManageDirect) {
    // 1. Add Parent
    placementNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      branches: branches,
      accounts: parentBankGlAccounts,
    })
    transferCategoryNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      accounts: parentTransferAccounts.map((a: CashAccountOption) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        cash_flow_category: a.cash_flow_category ?? null,
      })),
    })
    const { branchesByOrgId, accountsByOrgId } = await getChildOrgPlacementData(childOrgs)
    const childOrgNodes = childOrgs.map((child) => {
      const childBranches = branchesByOrgId.get(child.id) || []
      const childAccounts = accountsByOrgId.get(child.id) || []

      return {
        placementNode: {
          orgId: child.id,
          orgName: child.name,
          branches: childBranches,
          accounts: childAccounts.filter(
            (a: CashAccountOption) =>
              a.type === 'ASSET' &&
              (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
          ),
        },
        transferCategoryNode: {
          orgId: child.id,
          orgName: child.name,
          accounts: childAccounts
            .filter((a: CashAccountOption) => ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type))
            .map((a: CashAccountOption) => ({
              id: a.id,
              code: a.code,
              name: a.name,
              type: a.type,
              cash_flow_category: a.cash_flow_category ?? null,
            })),
        },
      }
    })

    placementNodes.push(...childOrgNodes.map((node) => node.placementNode))
    transferCategoryNodes.push(...childOrgNodes.map((node) => node.transferCategoryNode))
  }

  // Filter accounts that are suitable for "Category" in cash transactions (Revenue, Expense, etc.)
  // and also Asset/Liability for transfers/payments.
  const categoryAccounts = allAccounts.filter(a =>
    ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
  )

  // Default GL Accounts for the current org
  const bankGlAccounts = parentBankGlAccounts

  return (
    <div className="p-8 pb-20">
      <CashClient 
        orgId={orgId}
        orgName={orgName}
        bankAccounts={bankAccounts}
        managedBankAccounts={managedBankAccounts}
        categoryAccounts={categoryAccounts}
        bankGlAccounts={bankGlAccounts}
        interOrgSourceAccounts={interOrgSourceAccounts}
        recentTransactions={recentTransactions}
        cashViewMode={cashViewMode}
        userRole={orgData.role}
        isAllBranchesView={canAccessAllBranches && cashViewMode === 'parent'}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        canManageDirect={canManageDirect}
        isParentOrg={isParentOrgFromTree}
        pendingCoaRequests={pendingCoaRequests}
        branches={branches}
        placementNodes={placementNodes}
        transferCategoryNodes={transferCategoryNodes}
      />
    </div>
  )
}
