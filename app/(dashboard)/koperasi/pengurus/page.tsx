import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import PengurusClient from './PengurusClient'

export const dynamic = 'force-dynamic'

export default async function PengurusPage() {
  const orgData = await getActiveOrg()
  const orgId = (orgData?.org as any)?.id
  if (!orgId) return <div className="p-8 text-center text-red-400">Akses ditolak</div>
  return <PengurusClient orgId={orgId} />
}
