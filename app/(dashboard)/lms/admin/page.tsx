import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  PlusCircle,
  Settings2,
  Users,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { getCompetencyManagementDashboard } from '@/modules/edu/lib/competency-management.server'
import { getLmsBatches, getLmsCourses, getAllLmsSessions } from '@/modules/edu/actions/lms-commercial.actions'
import {
  getTrainingLessonsForCourse,
  getTrainingCenterSummary,
} from '@/modules/edu/lib/training-center-mvp'
import SessionQRClient from './SessionQRClient'
import CreateBatchForm from './CreateBatchForm'
import CreateCourseForm from './CreateCourseForm'
import CreateSessionForm from './CreateSessionForm'
import { formatRupiah } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function batchStatusBadge(status: string) {
  const map: Record<string, string> = {
    OPEN:      'bg-emerald-50 text-emerald-700 border-emerald-200 ring-0',
    ONGOING:   'bg-blue-50 text-blue-700 border-blue-200',
    CLOSED:    'bg-slate-100 text-slate-500 border-slate-200',
    COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200'
}

function SectionHeader({
  icon: Icon,
  label,
  title,
  count,
}: {
  icon: React.ElementType
  label: string
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        </div>
      </div>
      {count !== undefined && (
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {count}
        </span>
      )}
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="py-10 text-center text-sm text-slate-400">
        {message}
      </td>
    </tr>
  )
}

export default async function LearningAdminPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canManage && !accessContext.canReviewAssessments) {
    return redirect('/lms')
  }

  const dashboard = await getCompetencyManagementDashboard({
    id: orgData.org.id,
    name: orgData.org.name,
    parent_org_id: orgData.org.parent_org_id,
  })

  getTrainingCenterSummary()
  const [batches, courses, sessions] = await Promise.all([
    getLmsBatches(orgData.org.id),
    getLmsCourses(orgData.org.id),
    getAllLmsSessions(orgData.org.id),
  ])

  const totals = dashboard.courseSummaries.reduce(
    (acc, course) => {
      acc.pending  += course.pendingAnswerCount
      acc.reviewed += course.reviewedAnswerCount
      acc.final    += course.finalAssessmentCount
      acc.competent += course.competentCount
      return acc
    },
    { pending: 0, reviewed: 0, final: 0, competent: 0 },
  )

  const sourceLabelMap: Record<string, string> = {
    'internal+saas': 'Internal + SaaS Assessor',
    saas: 'SaaS Assessor',
    internal: 'Internal Trainer',
  }
  const sourceLabel = accessContext.source ? sourceLabelMap[accessContext.source] : 'Trainer'

  return (
    <div className="space-y-5">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb */}
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>LMS</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">Admin</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Learning Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {orgData.org.name} &middot; {sourceLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {accessContext.canReviewAssessments && (
            <Link
              href="/lms/assessment-center"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
            >
              <ListChecks className="h-4 w-4" />
              Panel Penilai
            </Link>
          )}
          {accessContext.canManage && (
            <Link
              href="#buat-pelatihan"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800"
            >
              <PlusCircle className="h-4 w-4" />
              Buat Program
            </Link>
          )}
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-4">
        {[
          { label: 'Pending Review',  value: totals.pending,  color: 'text-amber-600',   icon: Clock },
          { label: 'Sudah Direview',  value: totals.reviewed, color: 'text-blue-600',    icon: ListChecks },
          { label: 'Asesmen Final',   value: totals.final,    color: 'text-slate-700',   icon: Settings2 },
          { label: 'Kompeten',        value: totals.competent,color: 'text-emerald-600', icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 px-6 py-5">
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{label}</p>
              <p className={`mt-0.5 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Assessment per Course ─────────────────────────────────────────────── */}
      {dashboard.courseSummaries.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 pt-5 pb-4">
            <SectionHeader
              icon={ListChecks}
              label="Assessment"
              title="Status per Course"
              count={dashboard.courseSummaries.length}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Course</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Pending</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Review</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Final</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Kompeten</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.courseSummaries.map((course) => (
                  <tr key={course.courseSlug} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <GraduationCap className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{course.title}</p>
                          <p className="text-xs text-slate-400">{course.levelCode} &middot; {course.audience}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block min-w-[28px] rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${course.pendingAnswerCount > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}>
                        {course.pendingAnswerCount}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium tabular-nums text-slate-700">{course.reviewedAnswerCount}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium tabular-nums text-slate-700">{course.finalAssessmentCount}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block min-w-[28px] rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${course.competentCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                        {course.competentCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {accessContext.canReviewAssessments && (
                          <Link
                            href={course.reviewerHref}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                          >
                            Review
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <Link
                          href={course.syllabusHref}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          Materi
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Batch / Angkatan ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 pt-5 pb-4">
          <SectionHeader icon={CalendarDays} label="Commercial" title="Manajemen Angkatan / Batch" count={batches.length} />
        </div>

        <div className="grid xl:grid-cols-[380px_1fr] divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
          {/* Form */}
          <div className="p-6">
            <p className="mb-4 text-xs font-medium text-slate-500">
              Buat angkatan baru, tetapkan tanggal, kuota, dan mode pembelajaran.
            </p>
            <CreateBatchForm courses={courses} />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Nama Batch</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Mode</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Harga</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Kuota</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Mulai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 ? (
                  <EmptyRow message="Belum ada batch. Buat batch pertama di panel kiri." />
                ) : (
                  batches.map((b: any) => (
                    <tr key={b.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800">{b.name}</p>
                        <p className="text-xs text-slate-400">{b.learning_courses?.title}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${batchStatusBadge(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-slate-500">{b.mode ?? 'OFFLINE'}</td>
                      <td className="px-3 py-3.5 text-right text-sm font-medium tabular-nums text-slate-700">
                        {b.price ? formatRupiah(b.price) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-right text-sm tabular-nums text-slate-500">
                        {b.quota === 0 ? '∞' : b.quota}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                        {b.start_date ? String(b.start_date) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Jadwal Sesi ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 pt-5 pb-4">
          <SectionHeader icon={CalendarDays} label="Sesi Live" title="Jadwal Sesi Pembelajaran" count={sessions.length} />
        </div>

        <div className="grid xl:grid-cols-[380px_1fr] divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
          {/* Form */}
          <div className="p-6">
            <p className="mb-4 text-xs font-medium text-slate-500">
              Tambahkan jadwal sesi live/offline untuk suatu batch.
            </p>
            <CreateSessionForm batches={batches} />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Sesi</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Batch</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Instruktur</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Waktu Mulai</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <EmptyRow message="Belum ada sesi terjadwal." />
                ) : (
                  sessions.map((s: any) => (
                    <tr key={s.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800">{s.title}</p>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-slate-500">{s.lms_course_batches?.name}</td>
                      <td className="px-3 py-3.5 text-xs text-slate-500">{s.instructor_name || <span className="text-slate-300">TBA</span>}</td>
                      <td className="px-3 py-3.5 text-xs text-slate-600">
                        {new Date(s.start_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <SessionQRClient sessionId={s.id} sessionTitle={s.title} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Katalog Course ────────────────────────────────────────────────────── */}
      <section id="buat-pelatihan" className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 pt-5 pb-4">
          <SectionHeader icon={BookOpen} label="Course Catalog" title="Program Pelatihan" count={courses.length} />
        </div>

        <div className="grid xl:grid-cols-[380px_1fr] divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
          {/* Form */}
          <div className="p-6">
            <p className="mb-4 text-xs font-medium text-slate-500">
              Tambahkan course baru ke dalam katalog pelatihan organisasi.
            </p>
            <CreateCourseForm />
          </div>

          {/* Course list */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Course</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Level</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.length === 0 ? (
                  <EmptyRow message="Belum ada course. Buat program pertama di panel kiri." />
                ) : (
                  courses.map((course: any) => {
                    const lessons = getTrainingLessonsForCourse(course.slug) || []
                    return (
                      <tr key={course.slug} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{course.title}</p>
                          <p className="text-xs text-slate-400 line-clamp-1">{course.description || '—'}</p>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {course.level_code || 'ALL'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${course.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                            {course.is_active ? 'Aktif' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/lms/course/${course.slug}`}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              <LayoutGrid className="h-3.5 w-3.5" />
                              Detail
                            </Link>
                            {course.is_active && lessons[0] && (
                              <Link
                                href={`/lms/course/${course.slug}/lesson/${lessons[0].slug}`}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                              >
                                Lesson 1
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Quick Links ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Shortcut</span>
        <Link href="/lms" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <Users className="h-4 w-4" /> Tampilan Peserta
        </Link>
        {accessContext.canReviewAssessments && (
          <Link href="/lms/assessment-center" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            <ListChecks className="h-4 w-4" /> Panel Penilai
          </Link>
        )}
        <Link href="/lms/my-progress" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <GraduationCap className="h-4 w-4" /> My Progress
        </Link>
        <Link href="/lms/admin/assessment-templates" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <BookOpen className="h-4 w-4" /> Template Assessment
        </Link>
      </div>

    </div>
  )
}
