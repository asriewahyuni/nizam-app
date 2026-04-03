import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashClient } from './CashClient'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

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

export default async function CashPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const activeBranch = await getActiveBranch(orgId)

  const [bankAccounts, allAccounts, recentTransactions] = await Promise.all([
    getBankAccountsWithBalance(orgId, activeBranch?.id),
    getChartOfAccounts(orgId),
    getRecentBankTransactions(orgId, 20, activeBranch?.id)
  ])

  // Filter accounts that are suitable for "Category" in cash transactions (Revenue, Expense, etc.)
  // and also Asset/Liability for transfers/payments.
  const categoryAccounts = allAccounts.filter(a => 
    ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
  )

  // Filter accounts that are suitable for mapping to a Bank Account (usually under Assets -> Cash/Bank)
  const bankGlAccounts = allAccounts.filter(a => 
    a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
  )

  return (
    <div className="p-8 pb-20">
      <CashClient 
        orgId={orgId}
        orgName={orgName}
        bankAccounts={bankAccounts}
        categoryAccounts={categoryAccounts}
        bankGlAccounts={bankGlAccounts}
        recentTransactions={recentTransactions}
        userRole={orgData.role}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
      />
    </div>
  )
}
