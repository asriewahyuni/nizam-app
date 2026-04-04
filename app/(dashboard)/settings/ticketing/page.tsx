import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSupportTicketsForCurrentOrg } from '@/modules/saas/actions/ticketing.actions'
import TicketingClient from './TicketingClient'

export default async function SettingsTicketingPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const tickets = await getSupportTicketsForCurrentOrg()
  return <TicketingClient tickets={tickets} />
}
