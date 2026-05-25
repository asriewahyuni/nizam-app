import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSyirkahDashboardData } from '@/modules/syirkah/actions/syirkah.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { redirect } from 'next/navigation'
import SyirkahDashboardClient from './SyirkahDashboardClient'

export const metadata = {
  title: 'Dashboard Syirkah | Nizam ERP',
}

export default async function SyirkahDashboardPage() {
  const activeOrgData = await getActiveOrg()
  if (!activeOrgData) redirect('/onboarding')

  if (!hasRolePermission(activeOrgData.role, activeOrgData.permissions, 'syirkah')) {
    redirect('/dashboard?error=akses-ditolak')
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
