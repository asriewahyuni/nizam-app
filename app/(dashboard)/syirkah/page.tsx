import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { getSyirkahDashboardData } from '@/modules/syirkah/actions/syirkah.actions'
import { redirect } from 'next/navigation'
import SyirkahDashboardClient from './SyirkahDashboardClient'

export const metadata = {
  title: 'Dashboard Syirkah | Nizam ERP',
}

export default async function SyirkahDashboardPage() {
  const activeOrgData = await getActiveOrg()
  if (!activeOrgData) redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(activeOrgData.org.id, 'Syirkah')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/syirkah/onboarding')
  }

  const data = await getSyirkahDashboardData(activeOrgData.org.id)

  return (
    <div className="w-full">
      <SyirkahDashboardClient 
        orgId={activeOrgData.org.id}
        initialData={data} 
      />
    </div>
  )
}
