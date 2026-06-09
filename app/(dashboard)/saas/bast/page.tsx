import { getBastDocuments } from '@/modules/saas/actions/bast.actions'
import { getUatSessions } from '@/modules/saas/actions/uat.actions'
import BastListClient from './BastListClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function BastListPage() {
  const [basts, uatSessions] = await Promise.all([
    getBastDocuments(),
    getUatSessions(),
  ])
  return <BastListClient basts={basts} uatSessions={uatSessions.filter(s => s.status === 'COMPLETED')} />
}
