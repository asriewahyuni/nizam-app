import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, BookOpen, Clock3, Layers3 } from 'lucide-react'
import { getLMSCourses } from '@/modules/lms/actions/course.actions'
import { getPortalTenant } from '@/modules/member/lib/portal.server'
import { formatRupiah, stripHtml } from '@/lib/utils'

export default async function MemberCatalogPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const result = await getLMSCourses(orgSlug)
  const courses = result.data || []

  return (
    <div className="px-4 py-6">
      <div>
        <p className="text-xs font-semibold text-emerald-700">Katalog resmi</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Pilih program belajar Anda</h1>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Lihat materi, jadwal angkatan, tingkat, dan harga sebelum mendaftar.
        </p>
      </div>

      {result.error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          {result.error}
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-white p-6 text-center">
          <BookOpen aria-hidden="true" className="mx-auto text-emerald-700" size={36} />
          <h2 className="mt-3 text-sm font-semibold">Katalog belum diterbitkan</h2>
          <p className="mt-1.5 text-xs text-slate-600">Silakan kembali lagi setelah program tersedia.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {courses.map((course) => (
            <article
              key={course.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
            >
              <div className="flex aspect-[16/8] items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-600 text-emerald-50">
                <BookOpen aria-hidden="true" size={36} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-800">
                    {course.level_code || 'Semua tingkat'}
                  </span>
                  {course.is_featured && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-orange-800">Unggulan</span>
                  )}
                </div>
                <h2 className="mt-3 line-clamp-2 text-base font-bold">{course.title}</h2>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                  {stripHtml(course.description) || 'Detail program akan disampaikan pada halaman kelas.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-3.5 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Layers3 aria-hidden="true" size={14} />
                    {course.lesson_count} materi
                  </span>
                  {course.duration_minutes ? (
                    <span className="flex items-center gap-1.5">
                      <Clock3 aria-hidden="true" size={14} />
                      {Math.ceil(course.duration_minutes / 60)} jam
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500">Mulai dari</p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-900">
                      {course.starting_price == null
                        ? 'Lihat program'
                        : course.starting_price === 0
                          ? 'Gratis'
                          : formatRupiah(course.starting_price)}
                    </p>
                  </div>
                  <Link
                    href={`/lms/${tenant.slug}/course/${course.slug}`}
                    className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                    aria-label={`Lihat program ${course.title}`}
                  >
                    Detail
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
