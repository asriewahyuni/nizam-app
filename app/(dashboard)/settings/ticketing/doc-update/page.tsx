import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSupportDocUpdatesForCurrentOrg } from '@/modules/saas/actions/ticketing.actions'
import TicketingDocUpdateClient from './TicketingDocUpdateClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function TicketingDocUpdatePage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const updates = await getSupportDocUpdatesForCurrentOrg()
  return <TicketingDocUpdateClient updates={updates} />
}
