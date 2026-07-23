import { notFound, redirect } from 'next/navigation'
import { BookOpenCheck, CalendarClock, ClipboardCheck, MapPin, UsersRound } from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
  getPortalTutorDashboard,
} from '@/modules/member/lib/portal.server'
import AttendanceQrManager from './AttendanceQrManager'
import ReviewQueue from './ReviewQueue'

export default async function MemberTutorPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/tutor`)}`)
  if (!member.isTutor && !member.isAdmin) notFound()
  const dashboard = await getPortalTutorDashboard(tenant, member)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Ruang pengajar</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Panel tutor</h1>
      <p className="mt-3 text-slate-600">Pantau peserta aktif dan tugas yang menunggu penilaian.</p>

      {dashboard.courses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-white p-10 text-center">
          <BookOpenCheck aria-hidden="true" className="mx-auto text-emerald-700" size={42} />
          <h2 className="mt-4 text-lg font-semibold">Belum ada course yang ditugaskan</h2>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {dashboard.courses.map((course) => (
            <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{course.title}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <UsersRound aria-hidden="true" className="text-emerald-800" size={20} />
                  <p className="mt-3 text-2xl font-bold">{course.activeStudents}</p>
                  <p className="mt-1 text-sm text-slate-600">Peserta aktif</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-4">
                  <ClipboardCheck aria-hidden="true" className="text-orange-800" size={20} />
                  <p className="mt-3 text-2xl font-bold">{course.pendingSubmissions}</p>
                  <p className="mt-1 text-sm text-slate-600">Perlu dinilai</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <section aria-labelledby="review-heading" className="mt-12">
        <div className="flex items-center gap-2">
          <ClipboardCheck aria-hidden="true" className="text-orange-700" size={22} />
          <h2 id="review-heading" className="text-2xl font-bold text-emerald-950">
            Antrean penilaian
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Nilai yang disimpan langsung masuk gradebook. Jika seluruh syarat lulus
          terpenuhi, sistem menghitung completion dan menyiapkan sertifikat.
        </p>
        <div className="mt-5">
          <ReviewQueue
            orgSlug={orgSlug}
            initialAssignments={dashboard.pendingAssignments}
            initialQuizEssays={dashboard.pendingQuizEssays}
          />
        </div>
      </section>

      <section aria-labelledby="session-heading" className="mt-12">
        <div className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="text-emerald-700" size={22} />
          <h2 id="session-heading" className="text-2xl font-bold text-emerald-950">
            Sesi dan QR kehadiran
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          QR lama otomatis tidak berlaku saat QR baru dibuat. Tautan hanya menerima peserta
          yang masih memiliki akses aktif ke course dan batch terkait.
        </p>
        {dashboard.sessions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Belum ada sesi mendatang yang dapat dikelola.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {dashboard.sessions.map((classSession) => (
              <article
                key={classSession.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      {classSession.courseTitle} · {classSession.batchName}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      {classSession.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {new Date(classSession.startsAt).toLocaleString('id-ID')}
                      {' – '}
                      {new Date(classSession.endsAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {classSession.location && (
                      <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                        <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                        {classSession.location}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-emerald-50 px-3 text-xs font-bold text-emerald-900">
                    {classSession.attendanceCount} hadir
                  </span>
                </div>
                <AttendanceQrManager
                  orgSlug={orgSlug}
                  sessionId={classSession.id}
                  tokenActiveUntil={classSession.tokenActiveUntil}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
