import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { ArrowRight, BookOpenCheck } from 'lucide-react'
import {
  getPortalDashboard,
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberCoursesPage({
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
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`${basePath}/kelas`)}`)
  const data = await getPortalDashboard(tenant, member)

  return (
    <div className="px-4 py-6">
      <p className="text-xs font-semibold text-emerald-700">Ruang belajar</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Kelas saya</h1>
      <p className="mt-2 text-xs text-slate-600">Seluruh hak akses aktif Anda, termasuk hasil migrasi, tampil di sini.</p>

      {data.courses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-white p-6 text-center">
          <BookOpenCheck aria-hidden="true" className="mx-auto text-emerald-700" size={36} />
          <h2 className="mt-3 text-sm font-semibold">Belum ada kelas aktif</h2>
          <Link
            href={`${basePath}/katalog`}
            className="mt-4 inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          >
            Buka katalog
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {data.courses.map((course) => (
            <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <BookOpenCheck aria-hidden="true" size={19} />
              </span>
              <h2 className="mt-4 line-clamp-2 text-base font-bold">{course.title}</h2>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-slate-600">
                  <span>{course.completedLessons}/{course.totalLessons} materi</span>
                  <strong className="text-emerald-800">{Math.round(course.progressPercent)}%</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.max(0, Math.min(100, course.progressPercent))}%` }}
                  />
                </div>
              </div>
              <Link
                href={`/lms/${tenant.slug}/course/${course.slug}`}
                className="mt-4 flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                Lanjutkan
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
