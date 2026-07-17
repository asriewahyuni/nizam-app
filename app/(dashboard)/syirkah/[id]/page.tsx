import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import {
  getSyirkahContractById,
  getSyirkahCoreJournal,
  getSyirkahContracts,
  getSyirkahMembers,
  getSyirkahWitnesses,
  getSyirkahProfitSharingHistory,
  syncSyirkahCapitalToCore,
  syncSyirkahProfitSharingToCore,
} from '@/modules/syirkah/actions/syirkah.actions'
import { redirect } from 'next/navigation'
import SyirkahDetailClient from './SyirkahDetailClient'
import SyirkahWizard from './SyirkahWizard'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getDateInTimeZone } from '@/lib/utils'
import {
  buildSyirkahDistributionContext,
  resolveSyirkahContractDistribution,
} from '@/modules/syirkah/lib/syirkah.utils'

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

  if (!hasRolePermission(activeOrgData.role, activeOrgData.permissions, 'syirkah')) {
    redirect('/dashboard?error=akses-ditolak')
  }

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
  const shouldEnsureProfitSharingSync =
    normalizedStatus === 'ACTIVE' || normalizedStatus === 'COMPLETED'
  const shouldCleanupPrematureProfitSharingSync =
    normalizedStatus !== 'ACTIVE' && normalizedStatus !== 'COMPLETED' && !!contract.profit_sharing_journal_entry_id

  let shouldRefreshContract = false
  // Auto-sync di sini selalu tanpa `period` eksplisit → selalu menyasar periode bulan berjalan,
  // supaya page load tidak diam-diam menyentuh jurnal bagi hasil periode lain.
  let currentPeriodProfitSharingEntryId: string | null = null
  if (shouldEnsureCoreSync || shouldCleanupPrematureCoreSync) {
    const syncResult = await syncSyirkahCapitalToCore(contractId, {
      skipRevalidate: true,
    })
    if (!('error' in syncResult)) {
      shouldRefreshContract = true
    }
  }

  if (shouldEnsureProfitSharingSync || shouldCleanupPrematureProfitSharingSync) {
    const syncResult = await syncSyirkahProfitSharingToCore(contractId, {
      skipRevalidate: true,
    })
    if (!('error' in syncResult)) {
      shouldRefreshContract = true
    }
    if ('entryId' in syncResult && syncResult.entryId) {
      currentPeriodProfitSharingEntryId = String(syncResult.entryId)
    }
  }

  if (shouldRefreshContract) {
    contract = await getSyirkahContractById(contractId, activeOrgData.org.id)
    if (!contract) redirect('/syirkah')
  }

  const members = await getSyirkahMembers(contractId)
  const witnesses = await getSyirkahWitnesses(contractId)
  const profitSharingJournalId =
    currentPeriodProfitSharingEntryId || contract.profit_sharing_journal_entry_id || null
  const [pnl, contracts, accounts, coreJournal, profitSharingJournal, profitSharingHistory] = await Promise.all([
    getProfitLoss(activeOrgData.org.id, '2000-01-01'),
    getSyirkahContracts(activeOrgData.org.id),
    getChartOfAccounts(activeOrgData.org.id),
    contract.core_journal_entry_id
      ? getSyirkahCoreJournal(String(contract.core_journal_entry_id), activeOrgData.org.id)
      : Promise.resolve(null),
    profitSharingJournalId
      ? getSyirkahCoreJournal(String(profitSharingJournalId), activeOrgData.org.id)
      : Promise.resolve(null),
    getSyirkahProfitSharingHistory(activeOrgData.org.id, contractId),
  ])
  const distributionContext = buildSyirkahDistributionContext(contracts, pnl.netProfit || 0)
  const contractDistribution = resolveSyirkahContractDistribution(distributionContext, contract)
  const profitSharingCurrentPeriod = getDateInTimeZone('Asia/Jakarta').slice(0, 7)

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
          netProfit={contractDistribution.baseAmount}
          profitDistribution={contractDistribution}
          accounts={accounts}
          coreJournal={coreJournal}
          profitSharingJournal={profitSharingJournal}
          profitSharingHistory={profitSharingHistory}
          profitSharingCurrentPeriod={profitSharingCurrentPeriod}
        />
      )}
    </div>
  )
}
