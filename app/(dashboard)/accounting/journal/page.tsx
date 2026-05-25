import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getJournalEntries } from '@/modules/accounting/actions/journal.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getFiscalPeriods } from '@/modules/accounting/actions/closing.actions'
import JournalClient from './JournalClient'

type JournalStatusFilter = 'POSTED' | 'VOIDED' | 'DRAFT'
type JournalEntryListItem = Awaited<ReturnType<typeof getJournalEntries>>[number]

const JOURNAL_STATUS_FILTERS: JournalStatusFilter[] = ['POSTED', 'VOIDED', 'DRAFT']

function normalizeStatusFilter(value?: string | string[]): JournalStatusFilter | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  const normalized = String(rawValue || '').trim().toUpperCase()

  return JOURNAL_STATUS_FILTERS.includes(normalized as JournalStatusFilter)
    ? normalized as JournalStatusFilter
    : null
}

function mergeJournalEntries(entryGroups: JournalEntryListItem[][]) {
  const entriesById = new Map<string, JournalEntryListItem>()

  for (const entries of entryGroups) {
    for (const entry of entries) {
      const id = String(entry?.id || '').trim()
      if (!id || entriesById.has(id)) continue
      entriesById.set(id, entry)
    }
  }

  return Array.from(entriesById.values())
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>
}) {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const requestedStatus = normalizeStatusFilter(resolvedSearchParams.status)

  // Parallel data fetching for performance
  const [postedEntries, voidedEntries, draftEntries, accounts, fiscalPeriods] = await Promise.all([
    getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'POSTED' }),
    getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'VOIDED' }),
    getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'DRAFT', limit: 200 }),
    getChartOfAccounts(orgData.org.id),
    getFiscalPeriods(orgData.org.id),
  ])
  const entries = mergeJournalEntries([postedEntries, voidedEntries, draftEntries])
  const initialFilterStatus = requestedStatus || (draftEntries.length > 0 ? 'DRAFT' : 'POSTED')

  return (
    <JournalClient
      orgId={orgData.org.id}
      initialEntries={entries}
      initialFilterStatus={initialFilterStatus}
      accounts={accounts}
      fiscalPeriods={fiscalPeriods}
      userRole={orgData.role}
      activeBranchId={activeBranch?.id ?? null}
      activeBranchName={activeBranch?.name ?? null}
    />
  )
}
