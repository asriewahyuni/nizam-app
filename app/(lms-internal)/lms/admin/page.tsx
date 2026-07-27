import Link from 'next/link'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourses, getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const metadata = {
  title: 'Katalog Kursus — Nizam LMS Admin',
  description: 'Katalog semua program pelatihan. Kelola, edit, dan publish kursus dari satu tempat.',
}

export default async function CatalogAdminPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return null

  const courses = await getLmsCourses(orgData.org.id)
  const allBatches = await getLmsBatches(orgData.org.id)
  
  // Get lesson counts
  const { rows: lessonCounts } = await queryPostgres(`
    SELECT course_id, COUNT(*) as count
    FROM learning_lessons
    WHERE org_id = $1
    GROUP BY course_id
  `, [orgData.org.id])

  const lessonMap = new Map<string, number>(lessonCounts.map((r: any) => [r.course_id, Number(r.count)]))

  // Participant counts: learning_enrollments is the actual source of truth for who's
  // enrolled (covers both direct/imported enrollments and batch-based ones), unlike
  // lms_registrations which only tracks the commercial batch/angkatan flow.
  const { rows: enrollmentCounts } = await queryPostgres(`
    SELECT course_id, COUNT(*) as count
    FROM learning_enrollments
    WHERE org_id = $1
    GROUP BY course_id
  `, [orgData.org.id])

  const enrollmentMap = new Map<string, number>(enrollmentCounts.map((r: any) => [r.course_id, Number(r.count)]))

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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 font-bold">ID</th>
              <th className="px-6 py-4 font-bold">Judul</th>
              <th className="whitespace-nowrap px-6 py-4 font-bold text-center">Chapter</th>
              <th className="whitespace-nowrap px-6 py-4 font-bold text-center">Lesson</th>
              <th className="px-6 py-4 font-bold">Produk Terkait</th>
              <th className="whitespace-nowrap px-6 py-4 font-bold text-center">Partisipan</th>
              <th className="whitespace-nowrap px-6 py-4 font-bold text-center">Status</th>
              <th className="whitespace-nowrap px-6 py-4 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {courses.map((c: any) => {
              const courseBatches = allBatches.filter((b: any) => b.course_id === c.id)
              const enrolled = enrollmentMap.get(c.id) || 0
              const relatedProducts = courseBatches.map((b: any) => b.name).join(', ') || '-'
              const lessonCount = lessonMap.get(c.id) || 0
              
              // We'll approximate chapter count as 1 if there are lessons, or 0.
              // If you have a real sections table later, you can map it here.
              const chapterCount = lessonCount > 0 ? 1 : 0
              const shortId = c.id.split('-')[0].toUpperCase()

              return (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                    {shortId}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/lms/admin/course/${c.slug}`} className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                      {c.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center font-medium">
                    {chapterCount}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center font-medium">
                    {lessonCount}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {relatedProducts}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center font-medium text-slate-900">
                    {enrolled}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-slate-50 text-slate-600 ring-slate-500/20'
                      }`}
                    >
                      {c.is_active ? 'Publish' : 'Draft'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/lms/admin/course/${c.slug}`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              )
            })}
            
            {courses.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  Belum ada program pelatihan yang ditambahkan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
