/**
 * Panel Consulting 360 yang hanya menampilkan engagement milik konsultan aktif.
 */
import { notFound, redirect } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { queryPostgres } from '@/lib/db/postgres'
import { getConsultantEngagements } from '@/modules/consulting/lib/consulting.server'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import ConsultingOperationsClient from '@/app/(lms-internal)/lms/admin/konsultasi/ConsultingOperationsClient'

export default async function TutorConsultingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/tutor/konsultasi`)}`)
  }
  if (!member.isTutor && !member.isAdmin) notFound()
  const instructor = await queryPostgres<{ id: string }>(
    `SELECT instructor.id::text
     FROM public.learning_instructor_profiles instructor
     WHERE instructor.org_id = $1::uuid
       AND instructor.is_active = TRUE
       AND (
         instructor.user_id = $2::uuid
         OR instructor.user_id = (
           SELECT legacy_user_id
           FROM public.internal_auth_users
           WHERE id = $2::uuid
           LIMIT 1
         )
       )
     LIMIT 1`,
    [tenant.id, member.userId],
  )
  const engagements = await getConsultantEngagements(
    tenant.id,
    instructor.rows[0]?.id || null,
    member.isAdmin,
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CalendarClock aria-hidden="true" size={18} />
        Ruang konsultan
      </div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Jadwal Consulting 360</h1>
      <p className="mt-3 max-w-3xl text-slate-600">
        Catat kehadiran, ringkasan member, perkembangan, rencana tindakan, dan persetujuan akhir.
      </p>
      <div className="mt-8">
        <ConsultingOperationsClient orgSlug={orgSlug} engagements={engagements} />
      </div>
    </div>
  )
}
