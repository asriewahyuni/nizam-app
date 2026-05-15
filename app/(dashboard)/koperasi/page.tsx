import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import KoperasiDashboardClient from './KoperasiDashboardClient'

export default async function KoperasiPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'Koperasi Syariah')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/koperasi/onboarding')
  }

  return <KoperasiDashboardClient />
}
