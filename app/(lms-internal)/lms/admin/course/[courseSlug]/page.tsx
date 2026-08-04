import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getLmsCourseBySlug,
  getLmsLessonsByCourseId,
  getLmsSectionsByCourseId,
  getLmsBatchesByCourseId,
  getLmsSessionsByCourseId,
  getLmsCourseAnalytics,
} from '@/modules/edu/actions/lms-commercial.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import CreateBatchForm from '../../CreateBatchForm'
import CreateSessionForm from '../../CreateSessionForm'
import SessionQRClient from '../../SessionQRClient'
import CreateLessonForm from '../../CreateLessonForm'
import { formatRupiah } from '@/lib/utils'
import { StatusBadge, EmptyState, modeColor, statusColor } from '../../../ui'
import AdminLessonList from './AdminLessonList'
import CourseActions from '../../CourseActions'

export default async function AdminManageCoursePage(props: {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const searchParams = await props.searchParams
  const activeTab = searchParams.tab || 'batches'

  const course = await getLmsCourseBySlug(orgData.org.id, params.courseSlug)
  if (!course) notFound()

  const learningAccess = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })
  
  if (!learningAccess.canManage) {
    return redirect('/lms')
  }

  const canManageAssessment = learningAccess.canReviewAssessments
  const canAccessParticipantAssessment = hasRolePermission(orgData.role, orgData.permissions, 'learning') || canManageAssessment

  const lessons = await getLmsLessonsByCourseId(orgData.org.id, course.id)
  const sections = await getLmsSectionsByCourseId(orgData.org.id, course.id)
  const batches = await getLmsBatchesByCourseId(orgData.org.id, course.id)
  const sessions = await getLmsSessionsByCourseId(orgData.org.id, course.id)
  
  let analyticsData: any[] = []
  if (activeTab === 'analytics') {
    const res = await getLmsCourseAnalytics(course.id)
    if (res.success) analyticsData = res.data || []
  }

  const tabs = [
    { id: 'curriculum', label: 'Kurikulum & Materi' },
    { id: 'batches', label: 'Harga & Jadwal' },
    { id: 'analytics', label: 'Analitik & Peserta' },
    { id: 'assessment', label: 'Asesmen & Penilaian' },
  ]

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-400">
        <Link href="/lms/admin" className="hover:text-slate-700">
          Catalog
        </Link>
        <span>/</span>
        <span className="text-slate-700">{course.title}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* SIDEBAR */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div
              className="h-24"
              style={{
                background: `linear-gradient(135deg, hsl(231 90% 60%), hsl(240 60% 40%))`,
              }}
            />
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-bold text-slate-900 leading-tight mb-2">{course.title}</h1>
                <CourseActions course={course} />
              </div>
              <span
                className={
                  'inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ' +
                  (course.is_active
                    ? 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
                    : 'bg-slate-100 text-slate-600 ring-slate-500/20')
                }
              >
                {course.is_active ? 'Live' : 'Draft'}
              </span>
              
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/lms/${orgData.org.slug}/course/${course.slug}`}
                  target="_blank"
                  className="w-full text-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600"
                >
                  Buka di Portal Member (As Admin)
                </Link>
                <button className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors">
                  Publish
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Pengaturan Program
            </div>
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`?tab=${t.id}`}
                className={
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ' +
                  (activeTab === t.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0">
          {activeTab === 'curriculum' && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Daftar Materi ({lessons.length})
              </h2>
            </div>

            {lessons.length === 0 ? (
              <EmptyState
                title="Belum ada materi"
                description="Mulai bangun kurikulum dengan menambahkan materi pertama di form bawah."
              />
            ) : (
              <AdminLessonList
                lessons={lessons}
                sections={sections}
                courseSlug={course.slug}
                courseId={course.id}
                orgSlug={orgData.org.slug}
              />
            )}
          </div>

          <div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <span className="size-2 rounded-full bg-indigo-600" />
                Buat Materi Baru
              </h2>
              <CreateLessonForm courseId={course.id} sections={sections} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col gap-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Daftar Batch ({batches.length})</h2>
              </div>
              {batches.length === 0 ? (
                <EmptyState
                  title="Belum ada batch"
                  description="Buat batch pertama untuk mulai menerima pendaftaran."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Batch</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Enrolled</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batches.map((b: any) => {
                        const enrolled = Number(b.enrolled_count) || 0
                        const quota = Number(b.quota) || 1
                        const pct = Math.round((enrolled / quota) * 100)
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-4">
                              <StatusBadge className={statusColor(b.status)}>
                                {b.status}
                              </StatusBadge>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-900">{b.name}</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <StatusBadge className={modeColor(b.mode)}>
                                  {b.mode}
                                </StatusBadge>
                                <span className="text-[10px] text-slate-400">
                                  {b.start_date || '-'} &rarr; {b.end_date || '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={'h-full ' + (pct >= 100 ? 'bg-slate-400' : 'bg-indigo-600')}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs">
                                  {enrolled}/{b.quota === 0 ? '∞' : b.quota}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {Array.isArray(b.linked_products) && b.linked_products.length > 0 ? (
                                <div className="space-y-1">
                                  {(b.linked_products as Array<{ storeProductId: string; name: string; price: number }>).map((linked) => (
                                    <Link
                                      key={linked.storeProductId}
                                      href={`/lms/admin/penjualan/produk/${linked.storeProductId}`}
                                      className="block cursor-pointer text-xs font-semibold text-indigo-700 hover:underline"
                                    >
                                      Terhubung produk: {linked.name} — {formatRupiah(Number(linked.price) || 0)}
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <span className="font-mono text-xs font-semibold">
                                  {b.price ? formatRupiah(b.price) : 'Gratis'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                  <span className="size-2 rounded-full bg-indigo-600" />
                  Buat Batch Baru
                </h2>
                <CreateBatchForm courses={[course]} />
                <p className="mt-4 text-center text-[10px] text-slate-400">
                  Batch akan otomatis membuat akun akuntansi di ERP Bridge.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Sesi Live</h3>
                <p className="text-xs text-slate-500">
                  Jadwalkan sesi live untuk angkatan yang ada.
                </p>
              </div>
              <div className="w-full sm:w-80">
                <CreateSessionForm batches={batches} />
              </div>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                title="Belum ada sesi terjadwal"
                description="Tambahkan sesi tatap muka atau daring, lengkap dengan instruktur."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sessions.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] text-slate-500">
                        {new Date(s.start_time).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      <p className="mt-1 truncate font-bold text-slate-900">
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Batch: {s.lms_course_batches?.name} | Instruktur: {s.instructor_name || '-'}
                      </p>
                      {s.location_url && (
                        <a
                          href={s.location_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block truncate text-[11px] text-indigo-600 hover:underline"
                        >
                          {s.location_url}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <SessionQRClient sessionId={s.id} sessionTitle={s.title} />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        QR Absen
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="animate-in fade-in duration-300">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Peserta Program</h3>
                <p className="text-sm text-slate-500 mt-1">Pantau progress pembelajaran dari seluruh peserta yang terdaftar.</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Total Peserta</p>
                <p className="text-2xl font-bold text-indigo-600">{analyticsData.length}</p>
              </div>
            </div>
            
            {analyticsData.length === 0 ? (
              <EmptyState
                title="Belum ada peserta"
                description="Belum ada yang mendaftar di program ini."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-6 py-4">Peserta</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Progress Belajar</th>
                      <th className="px-6 py-4">Tanggal Mulai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyticsData.map((a: any) => (
                      <tr key={a.enrollment_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{a.user_name || 'Tanpa Nama'}</p>
                          <p className="text-xs text-slate-500">{a.user_email || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge className={statusColor(a.status)}>{a.status}</StatusBadge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${a.progress_percentage === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                                style={{ width: `${a.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600">
                              {a.progress_percentage}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({a.completed_lessons}/{a.total_lessons})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(a.started_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assessment' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-in fade-in duration-300">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <span className="font-bold">P</span>
            </div>
            <h3 className="text-lg font-bold">Panel Penilai</h3>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Review jawaban peserta, beri feedback, dan tetapkan nilai akhir untuk
              tugas dan ujian.
            </p>
            {canManageAssessment ? (
              <Link
                href={`/lms/course/${course.slug}/assessment`}
                className="block w-full text-center rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Buka Panel Penilai &rarr;
              </Link>
            ) : (
              <p className="text-sm text-amber-600 font-medium bg-amber-50 p-3 rounded-lg border border-amber-200">
                Anda tidak memiliki akses ke Panel Penilai.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <span className="font-bold">S</span>
            </div>
            <h3 className="text-lg font-bold">Mode Peserta (Simulasi)</h3>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Coba ujian dan asesmen dari sudut pandang peserta. Berguna untuk QA
              sebelum publish.
            </p>
            <div className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
              <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
                Simulation Environment
              </p>
              <p className="mt-2">
                Data submission tidak tersimpan. Anda dapat menguji ulang tanpa
                mempengaruhi statistik peserta.
              </p>
            </div>
            {canAccessParticipantAssessment ? (
              <Link
                href={`/lms/course/${course.slug}/assessment/participant`}
                className="block w-full text-center rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Mulai Simulasi Ujian
              </Link>
            ) : null}
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  )
}
