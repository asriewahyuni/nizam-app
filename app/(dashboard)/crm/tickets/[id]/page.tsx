import { unstable_noStore as noStore } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCrmTicket } from '@/modules/crm/actions/tickets.actions'
import { TicketDetailClient } from './TicketDetailClient'

export default async function CrmTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  noStore()
  const { id } = await params
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const result = await getCrmTicket(id, orgData.org.id)
  if (!result) notFound()

  return (
    <TicketDetailClient
      ticket={result.ticket}
      notes={result.notes}
      orgId={orgData.org.id}
      currentUserName={
        (orgData.user?.user_metadata?.full_name as string | undefined) ||
        orgData.user?.email?.split('@')[0] ||
        'Staff'
      }
    />
  )
}
