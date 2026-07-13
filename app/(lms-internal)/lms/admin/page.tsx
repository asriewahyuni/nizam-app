import Link from 'next/link'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourses, getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'

export const metadata = {
  title: 'Katalog Kursus — Nizam LMS Admin',
  description: 'Katalog semua program pelatihan. Kelola, edit, dan publish kursus dari satu tempat.',
}

export default async function CatalogAdminPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return null

  const courses = await getLmsCourses(orgData.org.id)
  const allBatches = await getLmsBatches(orgData.org.id)

  const activeCoursesCount = courses.filter((c: any) => c.is_active).length

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            /lms/admin · Catalog
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Katalog</h1>
          <p className="mt-1 text-slate-500">
            {courses.length} program terdaftar · {activeCoursesCount} aktif
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/lms/admin/course/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            + Program Baru
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {courses.map((c: any) => {
          const category = 'Program'
          const level_code = c.level_code || 'ALL'
          const duration_hours = 0
          
          const courseBatches = allBatches.filter((b: any) => b.course_id === c.id)
          const nBatches = courseBatches.length
          const enrolled = courseBatches.reduce((a: number, b: any) => a + (Number(b.enrolled_count) || 0), 0)
          
          return (
            <div
              key={c.id}
              className="group flex flex-col md:flex-row overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              {/* Thumbnail Area */}
              <div
                className="relative h-48 md:h-auto md:w-64 shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(231 90% 60%), hsl(240 60% 40%))`,
                }}
              >
                <div className="absolute top-3 right-3 flex gap-1.5 md:hidden">
                  <span
                    className={
                      'rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ' +
                      (c.is_active
                        ? 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
                        : 'bg-white/90 text-slate-800 ring-slate-900/10')
                    }
                  >
                    {c.is_active ? 'Live' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex flex-1 flex-col p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      <span>{category}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span>{level_code}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {c.description || 'Tidak ada deskripsi singkat untuk program ini.'}
                    </p>
                  </div>
                  
                  <div className="hidden md:block">
                    <span
                      className={
                        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ring-1 ring-inset ' +
                        (c.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-slate-50 text-slate-600 ring-slate-500/20')
                      }
                    >
                      {c.is_active ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-100">
                  <div className="flex items-center gap-6 text-sm text-slate-600">
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Batches</div>
                      <div className="font-bold text-slate-900">{nBatches}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Peserta</div>
                      <div className="font-bold text-slate-900">{enrolled}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Durasi</div>
                      <div className="font-bold text-slate-900">{duration_hours} <span className="text-xs font-normal text-slate-500">jam</span></div>
                    </div>
                  </div>
                  
                  <Link
                    href={`/lms/admin/course/${c.slug}`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Kelola Program
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
