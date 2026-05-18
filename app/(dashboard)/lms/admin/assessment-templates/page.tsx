import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { ClipboardCheck, Plus, ArrowRight, FileEdit, Trash2 } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { getLmsCourses } from '@/modules/edu/actions/lms-commercial.actions'
import { listAssessmentTemplatesForOrg } from '@/modules/edu/lib/training-assessment-template.server'
import { getTrainingAssessmentByCourseSlug } from '@/modules/edu/lib/training-assessment-mvp'
import { DeleteTemplateButton } from './DeleteTemplateButton'

export default async function AssessmentTemplatesPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const access = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })
  if (!access.canManage) return redirect('/lms')

  // Get all LMS courses + custom templates from DB
  const [courses, dbTemplates] = await Promise.all([
    getLmsCourses(orgData.org.id),
    listAssessmentTemplatesForOrg(orgData.org.id),
  ])

  const dbSlugs = new Set(dbTemplates.map((t) => t.courseSlug))

  // Merge: courses that have template in DB, and courses that still use hardcoded MVP
  const courseList = courses.map((c: any) => {
    const dbTemplate = dbTemplates.find((t) => t.courseSlug === c.slug)
    const mvpTemplate = getTrainingAssessmentByCourseSlug(c.slug)
    return {
      slug: c.slug,
      title: c.title,
      hasDbTemplate: !!dbTemplate,
      hasMvpTemplate: !!mvpTemplate,
      documentTitle: dbTemplate?.documentTitle || mvpTemplate?.documentTitle || '-',
      version: dbTemplate?.version || mvpTemplate?.version || '-',
      updatedAt: dbTemplate ? '-' : 'Hardcoded',
    }
  })

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold tracking-tight text-emerald-700">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Asesmen Builder
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Template Asesmen Per Course
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Atur rubrik penilaian untuk tiap course. Template dari DB akan menggantikan template bawaan.
          </p>
        </div>
        <Link
          href="/lms/admin"
          className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          ← Kembali ke Admin
        </Link>
      </div>

      {/* ── Course Table ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 px-6 py-4">
                  Course
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 px-6 py-4">
                  Dokumen Asesmen
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 px-6 py-4">
                  Versi
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 px-6 py-4">
                  Sumber
                </th>
                <th className="text-right text-[11px] font-bold uppercase tracking-widest text-slate-500 px-6 py-4">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courseList.map((course) => (
                <tr
                  key={course.slug}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{course.title}</div>
                    <div className="text-xs text-slate-400 font-mono">{course.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{course.documentTitle}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-500">{course.version}</span>
                  </td>
                  <td className="px-6 py-4">
                    {course.hasDbTemplate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        DB Custom
                      </span>
                    ) : course.hasMvpTemplate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                        Default Nizam
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/lms/admin/assessment-templates/${course.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black transition-colors"
                      >
                        {course.hasDbTemplate ? (
                          <>
                            <FileEdit size={14} /> Edit
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Buat
                          </>
                        )}
                      </Link>
                      {course.hasDbTemplate && (
                        <DeleteTemplateButton courseSlug={course.slug} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {courseList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    Belum ada course tersedia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info Card ── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
        <p className="text-sm text-blue-800 font-medium">
          💡 <strong>Cara kerja:</strong> Template yang disimpan di database akan digunakan saat assessor membuka halaman asesmen.
          Jika belum ada template custom, sistem akan menggunakan template bawaan Nizam (hardcoded).
          Template bisa diatur berbeda untuk tiap organisasi.
        </p>
      </div>
    </div>
  )
}
