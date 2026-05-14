import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import AkadWakalahClient from './AkadWakalahClient'

export const dynamic = 'force-dynamic'

export default async function AkadWakalahPage() {
  const orgData = await getActiveOrg()
  const orgId = (orgData?.org as any)?.id
  if (!orgId) return <div className="p-8 text-center text-red-400">Akses ditolak</div>
  return <AkadWakalahClient orgId={orgId} />
}
