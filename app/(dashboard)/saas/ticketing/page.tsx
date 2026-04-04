import SaasTicketingClient from './SaasTicketingClient'
import { getOperatorTicketingSnapshot } from '@/modules/saas/actions/ticketing.actions'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function SaaSTicketingPage() {
  const snapshot = await getOperatorTicketingSnapshot()
  return <SaasTicketingClient snapshot={snapshot} />
}
