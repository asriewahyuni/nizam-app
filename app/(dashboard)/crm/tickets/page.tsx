import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getCrmTickets } from '@/modules/crm/actions/tickets.actions'
import { TicketListClient } from './TicketListClient'

export const metadata = { title: 'Keluhan & Permintaan — Nizam ERP' }

export default async function CrmTicketsPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const branch = await getActiveBranch(orgId)

  const tickets = await getCrmTickets(orgId, branch?.id)

  const orgSlug = orgData.org.slug || orgId

  return (
    <TicketListClient
      tickets={tickets}
      orgId={orgId}
      orgSlug={orgSlug}
      orgName={orgData.org.name}
    />
  )
}
