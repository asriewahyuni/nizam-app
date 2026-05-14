import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getDashboardStats } from '@/modules/koperasi/actions/koperasi.actions'
import KoperasiDashboardClient from './KoperasiDashboardClient'

export const dynamic = 'force-dynamic'

export default async function KoperasiPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org) return <div className="p-8 text-center text-red-400">Akses ditolak</div>
  
  const orgId = (orgData.org as any).id
  const stats = await getDashboardStats(orgId)
  
  return <KoperasiDashboardClient stats={stats} orgId={orgId} />
}
