import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSyirkahContractById, getSyirkahMembers, getSyirkahWitnesses } from '@/modules/syirkah/actions/syirkah.actions'
import { redirect } from 'next/navigation'
import SyirkahDetailClient from './SyirkahDetailClient'
import SyirkahWizard from './SyirkahWizard'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'

export const metadata = {
  title: 'Detail Akad Syirkah | Nizam ERP',
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

  const contract = await getSyirkahContractById(contractId, activeOrgData.org.id)
  
  if (!contract) redirect('/syirkah')

  const members = await getSyirkahMembers(contractId)
  const witnesses = await getSyirkahWitnesses(contractId)
  
  const pnl = await getProfitLoss(activeOrgData.org.id)
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
        />
      )}
    </div>
  )
}
