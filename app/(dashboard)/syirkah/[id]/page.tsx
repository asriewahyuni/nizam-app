import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getSyirkahContractById,
  getSyirkahCoreJournal,
  getSyirkahMembers,
  getSyirkahWitnesses,
  syncSyirkahCapitalToCore,
} from '@/modules/syirkah/actions/syirkah.actions'
import { redirect } from 'next/navigation'
import SyirkahDetailClient from './SyirkahDetailClient'
import SyirkahWizard from './SyirkahWizard'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'

export const metadata = {
  title: 'Detail Akad Syirkah | Nizam ERP',
}

function normalizeLocalContractStatus(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED'].includes(normalized)) {
    return normalized as 'DRAFT' | 'SIGNING' | 'ACTIVE' | 'COMPLETED'
  }

  return 'DRAFT' as const
}

export default async function SyirkahDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ wizard?: string }>
}) {
  const activeOrgData = await getActiveOrg()
  if (!activeOrgData) redirect('/onboarding')

  const resolvedParams = await params
  const resolvedSearch = await searchParams
  const contractId = resolvedParams.id
  const isWizardMode = resolvedSearch.wizard === '1'

  let contract = await getSyirkahContractById(contractId, activeOrgData.org.id)
  
  if (!contract) redirect('/syirkah')

  const normalizedStatus = normalizeLocalContractStatus(contract.status)
  const shouldEnsureCoreSync =
    (normalizedStatus === 'ACTIVE' || normalizedStatus === 'COMPLETED') && !contract.core_journal_entry_id
  const shouldCleanupPrematureCoreSync =
    normalizedStatus !== 'ACTIVE' && normalizedStatus !== 'COMPLETED' && !!contract.core_journal_entry_id

  if (shouldEnsureCoreSync || shouldCleanupPrematureCoreSync) {
    const syncResult = await syncSyirkahCapitalToCore(contractId, {
      skipRevalidate: true,
    })
    if (!(syncResult as any)?.error) {
      contract = await getSyirkahContractById(contractId, activeOrgData.org.id)
      if (!contract) redirect('/syirkah')
    }
  }

  const members = await getSyirkahMembers(contractId)
  const witnesses = await getSyirkahWitnesses(contractId)
  const [pnl, accounts, coreJournal] = await Promise.all([
    getProfitLoss(activeOrgData.org.id),
    getChartOfAccounts(activeOrgData.org.id),
    contract.core_journal_entry_id
      ? getSyirkahCoreJournal(String(contract.core_journal_entry_id), activeOrgData.org.id)
      : Promise.resolve(null),
  ])
  const netProfit = pnl.netProfit || 0

  return (
    <div className="w-full">
      {isWizardMode ? (
        <SyirkahWizard
          orgId={activeOrgData.org.id}
          contract={contract}
          members={members}
          witnesses={witnesses}
        />
      ) : (
        <SyirkahDetailClient 
          orgId={activeOrgData.org.id}
          contract={contract}
          members={members}
          netProfit={netProfit}
          accounts={accounts}
          coreJournal={coreJournal}
        />
      )}
    </div>
  )
}
