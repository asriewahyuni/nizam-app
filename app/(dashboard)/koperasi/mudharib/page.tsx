import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import MudharibClient from './MudharibClient'

export const dynamic = 'force-dynamic'

export default async function MudharibPage() {
  const orgData = await getActiveOrg()
  const orgId = (orgData?.org as any)?.id
  if (!orgId) return <div className="p-8 text-center text-red-400">Akses ditolak</div>
  return <MudharibClient orgId={orgId} />
}
