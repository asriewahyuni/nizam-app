/**
 * Halaman Consulting 360 milik member.
 */
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getMemberConsultingEngagements } from '@/modules/consulting/lib/consulting.server'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import MemberConsultingClient from './MemberConsultingClient'

export const metadata = {
  title: 'Konsultasi Saya — Consulting 360',
}

export default async function MemberConsultingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  const requestHeaders = await headers()
  const host = String(requestHeaders.get('host') || '').toLowerCase().split(':')[0]
  const basePath = tenant.primaryHostname && host === tenant.primaryHostname.toLowerCase()
    ? ''
    : `/member/${tenant.slug}`
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`${basePath}/konsultasi`)}`)
  const engagements = await getMemberConsultingEngagements(tenant.id, member.userId)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Pendampingan privat</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Consulting 360 saya</h1>
      <p className="mt-3 max-w-3xl text-slate-600">
        Pantau tujuan, jadwal, perkembangan, rencana tindakan, dan lencana dalam satu tempat.
      </p>
      <MemberConsultingClient
        orgSlug={tenant.slug}
        basePath={basePath}
        engagements={engagements}
      />
    </div>
  )
}
