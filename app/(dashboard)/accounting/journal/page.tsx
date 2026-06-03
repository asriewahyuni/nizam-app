import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getJournalEntries } from '@/modules/accounting/actions/journal.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getFiscalPeriods } from '@/modules/accounting/actions/closing.actions'
import JournalClient from './JournalClient'

type JournalStatusFilter = 'POSTED' | 'VOIDED' | 'DRAFT'
type JournalEntryListItem = Awaited<ReturnType<typeof getJournalEntries>>[number]

const JOURNAL_STATUS_FILTERS: JournalStatusFilter[] = ['POSTED', 'VOIDED', 'DRAFT']
const JOURNAL_INITIAL_PAGE_SIZE = 100

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
  searchParams?: Promise<{ status?: string | string[]; entry?: string | string[] }>
}) {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const requestedStatus = normalizeStatusFilter(resolvedSearchParams.status)
  const requestedEntry = Array.isArray(resolvedSearchParams.entry)
    ? resolvedSearchParams.entry[0]
    : resolvedSearchParams.entry

  // Fetch master data first (lightweight)
  const [accounts, fiscalPeriods] = await Promise.all([
    getChartOfAccounts(orgData.org.id),
    getFiscalPeriods(orgData.org.id),
  ])

  // Fetch journal entries sequentially to avoid PostgreSQL connection pool exhaustion (max 10 by default)
  // especially when Next.js prefetching triggers multiple page loads concurrently.
  const targetedEntries = requestedEntry
    ? await getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, entry: requestedEntry, limit: 1 })
    : []
  
  const draftEntries = await getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'DRAFT', limit: JOURNAL_INITIAL_PAGE_SIZE })
  const postedEntries = await getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'POSTED', limit: JOURNAL_INITIAL_PAGE_SIZE })
  const voidedEntries = await getJournalEntries(orgData.org.id, { branch_id: activeBranch?.id, status: 'VOIDED', limit: JOURNAL_INITIAL_PAGE_SIZE })

  const entries = mergeJournalEntries([targetedEntries, postedEntries, voidedEntries, draftEntries])
  const targetedStatus = normalizeStatusFilter(String(targetedEntries[0]?.status || ''))
  const initialFilterStatus = requestedStatus || targetedStatus || (draftEntries.length > 0 ? 'DRAFT' : 'POSTED')

  return (
    <JournalClient
      orgId={orgData.org.id}
      initialEntries={entries}
      initialFilterStatus={initialFilterStatus}
      initialLoadedCounts={{
        POSTED: postedEntries.length,
        VOIDED: voidedEntries.length,
        DRAFT: draftEntries.length,
      }}
      accounts={accounts}
      fiscalPeriods={fiscalPeriods}
      userRole={orgData.role}
      activeBranchId={activeBranch?.id ?? null}
      activeBranchName={activeBranch?.name ?? null}
    />
  )
}
