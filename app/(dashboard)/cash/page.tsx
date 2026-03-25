import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashClient } from './CashClient'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'

export async function getBankAccountsWithBalance(orgId: string) {
  const supabase = await createClient()

  // Fetch bank accounts joined with their base GL account
  const { data: accounts, error: accError } = await supabase
    .from('bank_accounts')
    .select(`
      *,
      account:accounts(*)
    `)
    .eq('org_id', orgId)
    .order('bank_name', { ascending: true })

  if (accError || !accounts) return []

  // Fetch balances for these specific GL accounts from the account_balances view
  const accountIds = accounts.map(a => a.account_id)
  const { data: balances, error: balError } = await supabase
    .from('account_balances')
    .select('account_id, balance')
    .in('account_id', accountIds)

  if (balError) return accounts.map(a => ({ ...a, balances: { balance: 0 } }))

  // Map balances back to accounts
  return accounts.map((acc: any) => {
    const balData = balances?.find(b => b.account_id === acc.account_id)
    return {
      ...acc,
      balances: balData || { balance: 0 }
    }
  })
}

export default async function CashPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get current organization
  const { data: member } = (await supabase
    .from('org_members')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()) as any

  if (!member) redirect('/onboarding')

  const orgId = member.org_id
  const orgName = member.organizations?.name || 'Nizam'

  const [bankAccounts, allAccounts, recentTransactions] = await Promise.all([
    getBankAccountsWithBalance(orgId),
    getChartOfAccounts(orgId),
    getRecentBankTransactions(orgId, 20)
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
        userRole={member.role}
      />
    </div>
  )
}
