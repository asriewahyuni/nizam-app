import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getJournalEntries } from '@/modules/accounting/actions/journal.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import JournalClient from './JournalClient'

export default async function JournalPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  // Parallel data fetching for performance
  const [entries, accounts] = await Promise.all([
    getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id }),
    getChartOfAccounts(orgData.org.id)
  ])

  return (
    <JournalClient
      orgId={orgData.org.id}
      initialEntries={entries}
      accounts={accounts}
      userRole={orgData.role}
      activeBranchId={activeBranch?.id ?? null}
      activeBranchName={activeBranch?.name ?? null}
    />
  )
}
