import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  PlusCircle,
  Settings,
  ShieldCheck,
  Users,
  CalendarDays,
  Banknote,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { getCompetencyManagementDashboard } from '@/modules/edu/lib/competency-management.server'
import { getLmsBatches, createLmsBatch, getLmsCourses, createLmsCourse, getAllLmsSessions, createLmsSession } from '@/modules/edu/actions/lms-commercial.actions'
import {
  getTrainingLessonsForCourse,
  getTrainingCenterSummary,
} from '@/modules/edu/lib/training-center-mvp'
import SessionQRClient from './SessionQRClient'
import BatchStructureBuilder from './BatchStructureBuilder'

function StatCard({
  label,
  value,
  hint,
  colorClass = 'text-slate-900',
}: {
  label: string
  value: string
  hint: string
  colorClass?: string
}) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="text-[10px] font-semibold tracking-tight text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${colorClass}`}>{value}</div>
      <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">{hint}</p>
    </div>
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

  const summary = getTrainingCenterSummary()
  const [batches, courses, sessions] = await Promise.all([
    getLmsBatches(orgData.org.id),
    getLmsCourses(orgData.org.id),
    getAllLmsSessions(orgData.org.id)
  ])

  const totals = dashboard.courseSummaries.reduce(
    (acc, course) => {
      acc.pending += course.pendingAnswerCount
      acc.reviewed += course.reviewedAnswerCount
      acc.final += course.finalAssessmentCount
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
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
             <Settings size={32} className="text-blue-600" />
             Admin & Trainer LMS
          </h1>
          <p className="text-sm text-slate-500 font-medium">Pantau progress peserta, review submission, dan kelola angkatan untuk {orgData.org.name}.</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {accessContext.canReviewAssessments && (
            <Link
              href="/lms/assessment-center"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-black shadow-xl shadow-slate-200 transition-all"
            >
              Panel Penilai <ArrowRight size={18} />
            </Link>
          )}
          {accessContext.canManage && (
            <Link
              href="/lms#buat-pelatihan"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all"
            >
              <PlusCircle size={18} /> Buat Program
            </Link>
          )}
        </div>
      </div>

      {/* ── Stats Assessment ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending Review"
          value={String(totals.pending)}
          hint="Submission menunggu ditinjau"
          colorClass="text-amber-500"
        />
        <StatCard
          label="Sudah Direview"
          value={String(totals.reviewed)}
          hint="Jawaban ditindaklanjuti"
          colorClass="text-blue-600"
        />
        <StatCard
          label="Asesmen Final"
          value={String(totals.final)}
          hint="Keputusan akhir tersimpan"
          colorClass="text-slate-700"
        />
        <StatCard
          label="Kompeten"
          value={String(totals.competent)}
          hint="Lulus assessment"
          colorClass="text-emerald-500"
        />
      </section>

      {/* ── Course Assessment Overview ── */}
      {dashboard.courseSummaries.length > 0 ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-slate-400" />
            <div>
              <div className="text-[10px] font-semibold tracking-tight text-slate-400">
                Assessment Overview
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Status assessment per course
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {dashboard.courseSummaries.map((course) => (
              <div
                key={course.courseSlug}
                className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      {course.levelCode}
                    </div>
                    <h3 className="mt-1.5 text-base font-black text-slate-900">{course.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{course.audience}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                    {course.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: 'Pending', value: course.pendingAnswerCount },
                    { label: 'Review', value: course.reviewedAnswerCount },
                    { label: 'Final', value: course.finalAssessmentCount },
                    { label: 'Lulus', value: course.competentCount },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-center"
                    >
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-1.5 text-xl font-semibold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {accessContext.canReviewAssessments ? (
                    <Link
                      href={course.reviewerHref}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 shadow-xl shadow-blue-100"
                    >
                      Review Penilai
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <Link
                    href={course.syllabusHref}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm"
                  >
                    Lihat Materi
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Manajemen Batch / Angkatan ── */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-slate-400" />
          <div>
            <div className="text-[10px] font-semibold tracking-tight text-slate-400">
              Commercial
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Manajemen Angkatan / Batch
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">Buka Batch Baru</h3>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Buat angkatan baru untuk course tertentu dan tetapkan harganya.
            </p>
            <form action={createLmsBatch} className="mt-6 grid gap-5">
              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Pilih Course</div>
                <select name="courseSlug" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50">
                  <option value="">-- Pilih Course --</option>
                  {courses.filter((c: any) => c.is_active).map((c: any) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Nama Batch</div>
                <input name="name" required placeholder="Contoh: Batch 1 - 2024" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Tanggal Mulai</div>
                  <input type="date" name="startDate" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Tanggal Selesai</div>
                  <input type="date" name="endDate" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Kuota (0 = Unlimited)</div>
                  <input type="number" name="quota" min="0" defaultValue="0" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
              </div>

              <div className="pt-2">
                <BatchStructureBuilder />
              </div>

              <button type="submit" className="mt-2 inline-flex justify-center rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 shadow-xl shadow-blue-100">
                Simpan Batch
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-black text-slate-900">Daftar Batch Aktif</h3>
            {batches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 italic">
                Belum ada batch yang dibuat.
              </div>
            ) : (
              batches.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block">
                        {b.status}
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{b.name}</h4>
                      <p className="mt-1 text-xs font-bold text-slate-500 tracking-tight">{b.learning_courses?.title}</p>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-600">
                        <Banknote className="h-3.5 w-3.5" />
                        Rp{b.price?.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-slate-50 flex gap-6 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <span>Kuota: <span className="text-slate-900">{b.quota === 0 ? 'Unlimited' : b.quota}</span></span>
                    <span>Mulai: <span className="text-slate-900">{b.start_date ? String(b.start_date) : '-'}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Manajemen Sesi ── */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-slate-400" />
          <div>
            <div className="text-[10px] font-semibold tracking-tight text-slate-400">
              Commercial
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Manajemen Jadwal Sesi
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">Buat Sesi Baru</h3>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Tambahkan jadwal sesi belajar (Live/Offline) untuk sebuah batch.
            </p>
            <form action={createLmsSession} className="mt-6 grid gap-5">
              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Pilih Batch</div>
                <select name="batchId" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50">
                  <option value="">-- Pilih Batch --</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.learning_courses?.title})</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Judul Sesi</div>
                <input name="title" required placeholder="Contoh: Sesi 1 - Pengenalan" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Waktu Mulai</div>
                  <input type="datetime-local" name="startTime" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Waktu Selesai</div>
                  <input type="datetime-local" name="endTime" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Nama Instruktur</div>
                  <input name="instructorName" placeholder="Contoh: Budi Santoso" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
                <label className="block text-sm">
                  <div className="font-bold text-slate-900 mb-1.5">Link / Lokasi</div>
                  <input name="locationUrl" placeholder="Zoom link / Nama Gedung" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
                </label>
              </div>

              <button className="mt-2 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                Buat Sesi
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-black text-slate-900 mb-4 px-2">Daftar Sesi Terjadwal</h3>
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 italic">
                Belum ada sesi untuk batch mana pun.
              </div>
            ) : (
              sessions.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block">
                        {s.lms_course_batches?.name}
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{s.title}</h4>
                      <p className="mt-1 text-xs font-bold text-slate-500 tracking-tight">{s.instructor_name || 'Instruktur TBA'}</p>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-slate-50 flex items-center justify-between gap-6 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <span>Mulai: <span className="text-slate-900">{new Date(s.start_time).toLocaleString('id-ID')}</span></span>
                    <SessionQRClient sessionId={s.id} sessionTitle={s.title} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Katalog Course ── */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold tracking-tight text-slate-400">
              Course Catalog
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Semua course di Training Center
            </h2>
          </div>
          <div className="rounded-full bg-slate-50 border border-slate-100 px-3 py-2 text-[10px] font-semibold tracking-tight text-slate-500">
            {courses.length} course
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          {/* Form Buat Course */}
          <div id="buat-pelatihan" className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">Buat Program / Course Baru</h3>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Tambahkan materi course ke dalam katalog organisasi Anda.
            </p>
            <form action={createLmsCourse} className="mt-6 grid gap-5">
              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Judul Course</div>
                <input name="title" required placeholder="Contoh: Basic Leadership" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
              </label>

              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Kode Level</div>
                <input name="levelCode" placeholder="Contoh: L1, ALL, SPV" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
              </label>

              <label className="block text-sm">
                <div className="font-bold text-slate-900 mb-1.5">Deskripsi Singkat</div>
                <textarea name="description" rows={3} placeholder="Deskripsi materi yang akan dipelajari..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50"></textarea>
              </label>

              <button type="submit" className="mt-2 inline-flex justify-center rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-black shadow-xl shadow-slate-200">
                Simpan Course
              </button>
            </form>
          </div>

          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 italic">
                Belum ada course di katalog. Silakan buat course baru.
              </div>
            ) : (
              courses.map((course: any) => {
                const lessons = getTrainingLessonsForCourse(course.slug) || []
                const isLive = course.is_active

            return (
              <div
                key={course.slug}
                className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-semibold tracking-tight border ${
                          isLive ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}
                      >
                        {isLive ? 'Live' : 'Soon'}
                      </span>
                      <span className="text-[10px] font-semibold tracking-tight text-slate-400">
                        {course.level_code || 'ALL'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{course.title}</h3>
                    <p className="mt-1.5 text-sm font-medium text-slate-500 leading-relaxed">{course.description || '-'}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400 tracking-tight">
                      <span>{lessons.length} lesson</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/lms/course/${course.slug}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm"
                    >
                      <GraduationCap className="h-4 w-4 text-slate-400" />
                      Lihat Course
                    </Link>
                    {isLive && lessons[0] ? (
                      <Link
                        href={`/lms/course/${course.slug}/lesson/${lessons[0].slug}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 shadow-xl shadow-blue-100"
                      >
                        Buka Lesson 1
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })
          )}
          </div>
        </div>
      </section>

      {/* ── Navigasi Cepat ── */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
             <Users size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Manajemen Peserta</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Kelola program pelatihan internal, tambah peserta, dan pantau status per program.
          </p>
          <Link
            href="/lms#daftar-pelatihan"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
          >
            Buka Program
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
             <FileText size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Review Assessment</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Tinjau jawaban peserta, beri feedback, dan putuskan status kompeten.
          </p>
          {accessContext.canReviewAssessments ? (
            <Link
              href="/lms/assessment-center"
              className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
            >
              Panel Penilai
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="mt-6 block text-[11px] font-semibold tracking-tight text-slate-300">
              Tidak ada akses
            </span>
          )}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
             <ShieldCheck size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Lihat Progress</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Simulasikan view peserta untuk memastikan alur materi sudah benar.
          </p>
          <Link
            href="/lms/my-progress"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
          >
            My Progress View
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
