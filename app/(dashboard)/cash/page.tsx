import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashClient } from './CashClient'
import { getChartOfAccounts, checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import { getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'
import { getActiveBranch, getActiveOrg, getBranches, getChildOrgs } from '@/modules/organization/actions/org.actions'
import { getPendingCoaRequestCount } from '@/modules/accounting/actions/coa-request.actions'
import { Account, CashFlowCategory } from '@/types/database.types'

type PlacementAccountOption = { id: string; code: string; name: string }
type TransferCategoryOption = {
  id: string
  code: string
  name: string
  type: string
  cash_flow_category?: CashFlowCategory | null
}

function isInvestingTransferAccount(account: Account) {
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

function readRelationName(relation: any): string | null {
  if (!relation) return null
  if (typeof relation?.name === 'string') return relation.name
  if (Array.isArray(relation) && relation.length > 0 && typeof relation[0]?.name === 'string') {
    return relation[0].name
  }
  return null
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
  return data.map((entry: any) => entry.id)
}

export async function getBankAccountsWithBalance(orgId: string, branchId?: string | null) {
  const supabase = await createClient()

  // Fetch bank accounts joined with their base GL account
  let accountsQuery = supabase
    .from('bank_accounts')
    .select(`
      *,
      account:accounts(*)
    `)
    .eq('org_id', orgId)

  if (branchId) {
    accountsQuery = accountsQuery.eq('branch_id', branchId)
  }

  const { data: accounts, error: accError } = await accountsQuery.order('bank_name', { ascending: true })

  if (accError || !accounts) return []
  const accountsTyped = accounts as any[]
  if (accountsTyped.length === 0) return []

  const accountIds = accountsTyped.map(a => a.account_id)

  if (!branchId) {
    const { data: balances, error: balError } = await supabase
      .from('account_balances')
      .select('account_id, balance')
      .in('account_id', accountIds)

    if (balError) return accountsTyped.map(a => ({ ...a, balances: { balance: 0 } }))

    return accountsTyped.map((acc: any) => {
      const balData = (balances as any[])?.find(b => b.account_id === acc.account_id)
      return {
        ...acc,
        balances: balData || { balance: 0 }
      }
    })
  }

  const entryIds = await getPostedEntryIds(orgId, branchId)
  if (entryIds.length === 0) {
    return accountsTyped.map((acc: any) => ({
      ...acc,
      balances: { balance: 0 },
    }))
  }

  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit')
    .in('entry_id', entryIds)
    .in('account_id', accountIds)

  if (linesError || !Array.isArray(lines)) {
    return accountsTyped.map((acc: any) => ({ ...acc, balances: { balance: 0 } }))
  }

  const balanceMap = new Map<string, number>()
  for (const line of lines as any[]) {
    const current = balanceMap.get(line.account_id) || 0
    balanceMap.set(line.account_id, current + Number(line.debit || 0) - Number(line.credit || 0))
  }

  return accountsTyped.map((acc: any) => ({
    ...acc,
    balances: { balance: balanceMap.get(acc.account_id) || 0 },
  }))
}

async function getConsolidatedOrgIds(parentOrgId: string): Promise<string[]> {
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db.rpc('get_consolidated_org_ids', { p_parent_org_id: parentOrgId })

  if (error || !Array.isArray(data)) return [parentOrgId]

  const ids = data
    .map((row: any) => String(row?.org_id || '').trim())
    .filter((id: string) => id.length > 0)

  if (!ids.includes(parentOrgId)) ids.unshift(parentOrgId)
  return Array.from(new Set(ids))
}

async function getManagedBankAccountsForParent(parentOrgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const orgIds = await getConsolidatedOrgIds(parentOrgId)

  const { data: accounts, error: accountError } = await db
    .from('bank_accounts')
    .select(`
      *,
      account:accounts(*),
      organization:organizations(name),
      branch:branches(name)
    `)
    .in('org_id', orgIds)
    .order('bank_name', { ascending: true })

  if (accountError || !Array.isArray(accounts) || accounts.length === 0) return []

  const accountIds = Array.from(
    new Set(
      accounts
        .map((account: any) => String(account?.account_id || '').trim())
        .filter((id: string) => id.length > 0)
    )
  )

  let balanceByAccountId = new Map<string, number>()
  if (accountIds.length > 0) {
    const { data: balances, error: balanceError } = await db
      .from('account_balances')
      .select('account_id, balance')
      .in('account_id', accountIds)

    if (!balanceError && Array.isArray(balances)) {
      balanceByAccountId = new Map(
        balances.map((row: any) => [String(row.account_id), Number(row.balance || 0)])
      )
    }
  }

  return accounts.map((account: any) => ({
    ...account,
    balances: { balance: balanceByAccountId.get(String(account.account_id)) || 0 },
    org_name: readRelationName(account.organization),
    branch_name: readRelationName(account.branch),
  }))
}

export default async function CashPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const activeBranch = await getActiveBranch(orgId)

  const [bankAccounts, allAccounts, recentTransactions, { canManageDirect, isParentOrg }, pendingCoaRequests, branches, childOrgs] = await Promise.all([
    getBankAccountsWithBalance(orgId, activeBranch?.id),
    getChartOfAccounts(orgId),
    getRecentBankTransactions(orgId, 20, activeBranch?.id),
    checkCanManageCoA(orgId),
    getPendingCoaRequestCount(orgId),
    getBranches(orgId),
    getChildOrgs(orgId),
  ])

  const managedBankAccounts =
    canManageDirect && isParentOrg ? await getManagedBankAccountsForParent(orgId) : bankAccounts

  // Prepare explicit placement options for Parent users
  const placementNodes: {
    orgId: string
    orgName: string
    branches: { id: string; name: string }[]
    accounts: PlacementAccountOption[]
  }[] = []
  const interOrgSourceAccounts = allAccounts.filter(isInvestingTransferAccount)
  const transferCategoryNodes: {
    orgId: string
    orgName: string
    accounts: TransferCategoryOption[]
  }[] = []
  if (canManageDirect) {
    const parentTransferAccounts = allAccounts.filter((a: Account) =>
      ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
    )
    // 1. Add Parent
    placementNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      branches: branches,
      accounts: allAccounts.filter(a => a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))),
    });
    transferCategoryNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      accounts: parentTransferAccounts.map((a: Account) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        cash_flow_category: a.cash_flow_category ?? null,
      })),
    })
    // 2. Fetch and add all Child Orgs
    for (const child of childOrgs) {
       const [childBranches, childAccounts] = await Promise.all([
         getBranches(child.id),
         getChartOfAccounts(child.id)
       ]);
       placementNodes.push({
         orgId: child.id,
         orgName: child.name,
         branches: childBranches,
         accounts: childAccounts.filter((a: Account) => a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))),
       });
       transferCategoryNodes.push({
         orgId: child.id,
         orgName: child.name,
         accounts: childAccounts
           .filter((a: Account) => ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type))
           .map((a: Account) => ({
             id: a.id,
             code: a.code,
             name: a.name,
             type: a.type,
             cash_flow_category: a.cash_flow_category ?? null,
           })),
       })
    }
  }

  // Filter accounts that are suitable for "Category" in cash transactions (Revenue, Expense, etc.)
  // and also Asset/Liability for transfers/payments.
  const categoryAccounts = allAccounts.filter(a => 
    ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
  )

  // Default GL Accounts for the current org
  const bankGlAccounts = allAccounts.filter(a => 
    a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
  )

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
        userRole={orgData.role}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        canManageDirect={canManageDirect}
        isParentOrg={isParentOrg}
        pendingCoaRequests={pendingCoaRequests}
        branches={branches}
        placementNodes={placementNodes}
        transferCategoryNodes={transferCategoryNodes}
      />
    </div>
  )
}
