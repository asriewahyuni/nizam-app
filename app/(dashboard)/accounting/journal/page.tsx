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
  searchParams?: Promise<{
    status?: string | string[]
    entry?: string | string[]
    voucher?: string | string[]
    accountId?: string | string[]
    accountCode?: string | string[]
    startDate?: string | string[]
    endDate?: string | string[]
    flow?: string | string[]
    min?: string | string[]
    max?: string | string[]
    counterparty?: string | string[]
    module?: string | string[]
    q?: string | string[]
    search?: string | string[]
    sort?: string | string[]
    print?: string | string[]
    compare?: string | string[]
  }>
}) {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const requestedStatus = normalizeStatusFilter(resolvedSearchParams.status)
  const requestedEntry = Array.isArray(resolvedSearchParams.entry)
    ? resolvedSearchParams.entry[0]
    : Array.isArray(resolvedSearchParams.voucher)
      ? resolvedSearchParams.voucher[0]
      : resolvedSearchParams.entry || resolvedSearchParams.voucher
  const requestedAccountId = Array.isArray(resolvedSearchParams.accountId)
    ? resolvedSearchParams.accountId[0]
    : resolvedSearchParams.accountId
  const requestedAccountCode = Array.isArray(resolvedSearchParams.accountCode)
    ? resolvedSearchParams.accountCode[0]
    : resolvedSearchParams.accountCode
  const requestedStartDate = Array.isArray(resolvedSearchParams.startDate)
    ? resolvedSearchParams.startDate[0]
    : resolvedSearchParams.startDate
  const requestedEndDate = Array.isArray(resolvedSearchParams.endDate)
    ? resolvedSearchParams.endDate[0]
    : resolvedSearchParams.endDate
  const requestedFlow = Array.isArray(resolvedSearchParams.flow)
    ? resolvedSearchParams.flow[0]
    : resolvedSearchParams.flow
  const requestedMin = Array.isArray(resolvedSearchParams.min)
    ? resolvedSearchParams.min[0]
    : resolvedSearchParams.min
  const requestedMax = Array.isArray(resolvedSearchParams.max)
    ? resolvedSearchParams.max[0]
    : resolvedSearchParams.max
  const requestedCounterparty = Array.isArray(resolvedSearchParams.counterparty)
    ? resolvedSearchParams.counterparty[0]
    : resolvedSearchParams.counterparty
  const requestedModule = Array.isArray(resolvedSearchParams.module)
    ? resolvedSearchParams.module[0]
    : resolvedSearchParams.module
  const requestedQuery = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0]
    : Array.isArray(resolvedSearchParams.search)
      ? resolvedSearchParams.search[0]
      : resolvedSearchParams.q || resolvedSearchParams.search
  const requestedSort = Array.isArray(resolvedSearchParams.sort)
    ? resolvedSearchParams.sort[0]
    : resolvedSearchParams.sort
  const requestedPrint = Array.isArray(resolvedSearchParams.print)
    ? resolvedSearchParams.print[0] === 'true' || resolvedSearchParams.print[0] === '1'
    : resolvedSearchParams.print === 'true' || resolvedSearchParams.print === '1'
  const requestedCompare = Array.isArray(resolvedSearchParams.compare)
    ? resolvedSearchParams.compare[0] === 'true' || resolvedSearchParams.compare[0] === '1'
    : resolvedSearchParams.compare === 'true' || resolvedSearchParams.compare === '1'

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
      initialAccountId={requestedAccountId}
      initialAccountCode={requestedAccountCode}
      initialStartDate={requestedStartDate}
      initialEndDate={requestedEndDate}
      initialEntryNumber={requestedEntry}
      initialFlow={requestedFlow as any}
      initialMinAmount={requestedMin}
      initialMaxAmount={requestedMax}
      initialCounterparty={requestedCounterparty}
      initialModule={requestedModule}
      initialQuery={requestedQuery}
      initialSortOrder={requestedSort === 'asc' ? 'asc' : 'desc'}
      initialPrint={requestedPrint}
      initialCompare={requestedCompare}
    />
  )
}
