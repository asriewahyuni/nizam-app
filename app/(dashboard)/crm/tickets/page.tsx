import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCrmTickets } from '@/modules/crm/actions/tickets.actions'
import { TicketListClient } from './TicketListClient'

export const metadata = { title: 'Keluhan & Permintaan — Nizam ERP' }

export default async function CrmTicketsPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  // Tidak filter by branch — tiket publik tidak memiliki branch, tampilkan semua
  const tickets = await getCrmTickets(orgId)

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
