import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/modules/crm/actions/tickets.actions'
import { SubmitTicketForm } from './SubmitTicketForm'

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) return { title: 'Tidak Ditemukan' }
  return {
    title: `Sampaikan Keluhan atau Permintaan — ${org.name}`,
    description: `Kirim keluhan, permintaan, atau pertanyaan langsung ke tim ${org.name}.`,
  }
}

export default async function SubmitTicketPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  return <SubmitTicketForm org={org} />
}
