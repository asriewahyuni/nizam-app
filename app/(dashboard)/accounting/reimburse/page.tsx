import { auth } from '@/auth'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getReimbursements } from '@/modules/accounting/actions/reimburse.actions'
import { getBankAccounts } from '@/modules/cash/actions/bank.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { redirect } from 'next/navigation'
import ReimbursementClient from './ReimbursementClient'

export default async function ReimbursePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const activeOrg = await getActiveOrg()
  if (!activeOrg) redirect('/onboarding')

  const orgId = activeOrg.org.id
  const activeBranch = await getActiveBranch(orgId)
  
  const [reimbursements, bankAccounts, allAccounts] = await Promise.all([
    getReimbursements(orgId, activeBranch?.id),
    getBankAccounts(orgId, activeBranch?.id),
    getChartOfAccounts(orgId)
  ])

  // Filter accounts for "EXPENSE" type to be used in the submission form
  const expenseAccounts = allAccounts.filter(acc => acc.type === 'EXPENSE' || acc.code.startsWith('5') || acc.code.startsWith('6'))

  return (
    <main className="p-8">
      <ReimbursementClient 
        reimbursements={reimbursements} 
        bankAccounts={bankAccounts} 
        expenseAccounts={expenseAccounts}
        orgId={orgId} 
        currentUserId={session.user.id}
      />
    </main>
  )
}
