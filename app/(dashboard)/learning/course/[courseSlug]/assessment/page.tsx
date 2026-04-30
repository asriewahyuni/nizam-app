import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Search,
  Users,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { submitTrainingCourseAssessment } from '@/modules/edu/actions/training-assessment.actions'
import { getTrainingAssessmentByCourseSlug } from '@/modules/edu/lib/training-assessment-mvp'
import {
  listTrainingCourseAnswerSubmissions,
  listTrainingCourseAssessments,
  type TrainingCourseAnswerSubmission,
  summarizeTrainingAssessmentParticipants,
} from '@/modules/edu/lib/training-assessment.server'
import {
  getTrainingCourseBySlug,
  getTrainingLessonsForCourse,
} from '@/modules/edu/lib/training-center-mvp'
import { getSaasAssessorContext } from '@/modules/edu/lib/assessment-access.server'

function formatAssessmentDate(dateLike: string) {
  if (!dateLike) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(dateLike))
}

function buildAnswerSubmissionContext(submission: TrainingCourseAnswerSubmission) {
  const sections: string[] = []

  if (submission.theoryAnswers.length) {
    sections.push(
      [
        'Jawaban teori peserta:',
        ...submission.theoryAnswers.map((item, index) => `${index + 1}. ${item.prompt}\nJawaban: ${item.answer || '-'}`),
      ].join('\n\n'),
    )
  }

  if (submission.practicalAnswers.length) {
    sections.push(
      [
        'Jawaban praktik peserta:',
        ...submission.practicalAnswers.map((item, index) => `${index + 1}. ${item.prompt}\nJawaban: ${item.answer || '-'}`),
      ].join('\n\n'),
    )
  }

  if (submission.generalNotes) {
    sections.push(`Catatan peserta:\n${submission.generalNotes}`)
  }

  return sections.join('\n\n')
}

export default async function LearningCourseAssessmentPage(props: {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{
    saved?: string
    error?: string
    participant?: string
    submission?: string
  }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const course = getTrainingCourseBySlug(params.courseSlug)
  if (!course) notFound()

  const assessment = getTrainingAssessmentByCourseSlug(course.slug)
  if (!assessment) notFound()

  const firstLesson = getTrainingLessonsForCourse(course.slug)[0] || null
  const searchParams = await props.searchParams
  const assessorContext = await getSaasAssessorContext({ email: orgData.user?.email })
  const canManageAssessment = assessorContext.hasAccess
  if (!canManageAssessment) {
    return redirect(`/learning/course/${course.slug}/assessment/participant`)
  }
  const participantFilter = String(searchParams?.participant || '').trim()
  const selectedSubmissionId = String(searchParams?.submission || '').trim()
  const participantAnswerSubmissions = canManageAssessment
    ? await listTrainingCourseAnswerSubmissions({
        orgId: orgData.org.id,
        courseSlug: course.slug,
        limit: 100,
        search: participantFilter,
      })
    : []
  const submissions = canManageAssessment
    ? await listTrainingCourseAssessments({
        orgId: orgData.org.id,
        courseSlug: course.slug,
        limit: 100,
        search: participantFilter,
      })
    : []
  const selectedAnswerSubmission = canManageAssessment
    ? participantAnswerSubmissions.find((item) => item.id === selectedSubmissionId) || null
    : null
  const participantStatuses = canManageAssessment
    ? summarizeTrainingAssessmentParticipants(submissions)
    : []
  const competentParticipantCount = participantStatuses.filter((item) => item.latestDecision === 'COMPETENT').length
  const notYetParticipantCount = participantStatuses.filter((item) => item.latestDecision === 'NOT_YET_COMPETENT').length
  const pendingAnswerReviewCount = participantAnswerSubmissions.filter((item) => item.status === 'SUBMITTED').length
  const reviewedAnswerCount = participantAnswerSubmissions.filter((item) => item.status === 'REVIEWED').length

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href={`/learning/course/${course.slug}`}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke {course.title}
        </Link>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              <FileText className="h-3.5 w-3.5" />
              Lembar Asesmen Formal
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              {assessment.documentTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              {assessment.purpose}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                Versi {assessment.version}
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                Berlaku {assessment.effectiveDate}
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                {course.levelCode} • {course.title}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/learning/course/${course.slug}/assessment/participant`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                Lihat Halaman Peserta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Metode Penilaian</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {assessment.methods.map((method) => (
                <div key={method} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  {method}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {searchParams?.saved === '1' ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Submission asesmen berhasil disimpan. Riwayat terbaru muncul di bagian bawah halaman ini.
        </section>
      ) : null}

      {searchParams?.error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 shadow-sm">
          {searchParams.error}
        </section>
      ) : null}

      {canManageAssessment ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Peserta Terpantau</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{participantStatuses.length}</div>
            <p className="mt-2 text-sm text-slate-600">Status peserta dihitung dari submission terbaru tiap peserta.</p>
          </div>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Kompeten</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-emerald-900">{competentParticipantCount}</div>
            <p className="mt-2 text-sm text-emerald-800">Peserta dengan keputusan terbaru kompeten.</p>
          </div>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">Belum Kompeten</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-amber-900">{notYetParticipantCount}</div>
            <p className="mt-2 text-sm text-amber-800">Peserta yang masih perlu remedial atau review ulang.</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Total Submission</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{submissions.length}</div>
            <p className="mt-2 text-sm text-slate-600">Riwayat asesmen online yang tampil pada filter saat ini.</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Keputusan</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Kompeten jika</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            {assessment.competentWhen.map((item) => (
              <div key={item} className="rounded-[22px] border border-emerald-200 bg-white/90 p-4">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Remedial</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Belum kompeten jika</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            {assessment.notYetCompetentWhen.map((item) => (
              <div key={item} className="rounded-[22px] border border-amber-200 bg-white/90 p-4">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Teori</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Pertanyaan acuan assessor</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {assessment.theoryQuestions.map((question, index) => (
              <div key={question} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                  {index + 1}
                </div>
                <div className="pt-1">{question}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Kunci Acuan</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Panduan jawaban singkat</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {assessment.answerGuide.map((answer, index) => (
              <div key={answer} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                  {index + 1}
                </div>
                <div className="pt-1">{answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Praktik</div>
          <h2 className="mt-2 text-xl font-black text-slate-900">Tugas unjuk kerja</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {assessment.practicalTasks.map((task, index) => (
            <div key={task.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Tugas {index + 1}
              </div>
              <h3 className="mt-2 text-lg font-black text-slate-900">{task.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{task.instruction}</p>
              <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <span className="font-black text-slate-900">Bukti minimum:</span> {task.expectedEvidence}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Checklist</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Daftar cek unjuk kerja</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {assessment.performanceChecklist.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                  {index + 1}
                </div>
                <div className="pt-1">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Bukti</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Bukti yang dikumpulkan assessor</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {assessment.evidenceChecklist.map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Tindak Lanjut</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Panduan remedial dan kelulusan</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {assessment.followUpGuidance.map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {canManageAssessment ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Status Peserta</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Kelulusan terbaru per trainee</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              Latest only
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <form method="get" className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Cari peserta</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    name="participant"
                    defaultValue={participantFilter}
                    placeholder="Cari nama peserta, NIK, email, atau peran"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-black"
              >
                Filter
              </button>
              {participantFilter ? (
                <Link
                  href={`/learning/course/${course.slug}/assessment#submissions`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  Reset
                </Link>
              ) : null}
            </form>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
              <Users className="h-4 w-4" />
              {participantStatuses.length} peserta tampil
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Jawaban Masuk</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{participantAnswerSubmissions.length}</div>
            </div>
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">Menunggu Review</div>
              <div className="mt-2 text-2xl font-black text-amber-900">{pendingAnswerReviewCount}</div>
            </div>
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Sudah Direview</div>
              <div className="mt-2 text-2xl font-black text-emerald-900">{reviewedAnswerCount}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Submission Dipilih</div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {selectedAnswerSubmission ? selectedAnswerSubmission.participantName : 'Belum ada'}
              </div>
            </div>
          </div>

          {participantStatuses.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              {participantFilter
                ? 'Tidak ada peserta yang cocok dengan filter ini.'
                : 'Belum ada status peserta karena submission online belum masuk.'}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {participantStatuses.map((item) => (
                <div key={item.participantKey} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          item.latestDecision === 'COMPETENT'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.latestDecision === 'COMPETENT' ? 'Kompeten' : 'Belum Kompeten'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                          {item.assessmentCount} asesmen
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-900">{item.participantName}</h3>
                      <div className="mt-2 text-sm text-slate-600">
                        {item.participantRole || 'Peran belum diisi'}
                        {item.participantReference ? ` • ${item.participantReference}` : ''}
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-right">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Update</div>
                      <div className="mt-2 text-sm font-black text-slate-900">{formatAssessmentDate(item.latestAssessedAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.latestAssessorName}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Status Teori</div>
                      <div className="mt-2 text-sm font-black text-slate-900">
                        {item.latestTheoryStatus === 'UNDERSTOOD'
                          ? 'Paham'
                          : item.latestTheoryStatus === 'PARTIAL'
                            ? 'Sebagian'
                            : 'Belum Paham'}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Status Praktik</div>
                      <div className="mt-2 text-sm font-black text-slate-900">
                        {item.latestPracticeStatus === 'SUCCESS'
                          ? 'Berhasil'
                          : item.latestPracticeStatus === 'NEEDS_SUPPORT'
                            ? 'Perlu Bantuan'
                            : 'Gagal'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canManageAssessment ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Review Jawaban</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Jawaban peserta yang masuk</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Pilih submission peserta untuk ditarik ke form asesmen assessor. Saat asesmen final disimpan, submission ini otomatis ditandai sudah direview.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              Review queue
            </div>
          </div>

          {participantAnswerSubmissions.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              {participantFilter
                ? 'Belum ada submission jawaban peserta yang cocok dengan filter ini.'
                : 'Belum ada submission jawaban peserta untuk course ini.'}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {participantAnswerSubmissions.map((submission) => {
                const submissionLinkParams = new URLSearchParams()
                if (participantFilter) submissionLinkParams.set('participant', participantFilter)
                submissionLinkParams.set('submission', submission.id)
                const submissionHref = `/learning/course/${course.slug}/assessment?${submissionLinkParams.toString()}#assessor-form`

                return (
                  <div
                    key={submission.id}
                    className={`rounded-[24px] border p-5 shadow-sm ${
                      selectedAnswerSubmission?.id === submission.id
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            submission.status === 'REVIEWED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {submission.status === 'REVIEWED' ? 'Reviewed' : 'Submitted'}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                            {submission.assessmentVersion}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-900">{submission.participantName}</h3>
                        <div className="mt-2 text-sm text-slate-600">
                          {submission.participantRole || 'Peran belum diisi'}
                          {submission.participantReference ? ` • ${submission.participantReference}` : ''}
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatAssessmentDate(submission.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={submissionHref}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-black"
                        >
                          Gunakan Untuk Asesmen
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="space-y-3">
                        {submission.theoryAnswers.map((item, index) => (
                          <div key={`${submission.id}-theory-${index}`} className="rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Teori {index + 1}</div>
                            <div className="mt-2 font-bold text-slate-900">{item.prompt}</div>
                            <p className="mt-2 leading-6">{item.answer || '-'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {submission.practicalAnswers.map((item, index) => (
                          <div key={`${submission.id}-practice-${index}`} className="rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Praktik {index + 1}</div>
                            <div className="mt-2 font-bold text-slate-900">{item.prompt}</div>
                            <p className="mt-2 leading-6">{item.answer || '-'}</p>
                          </div>
                        ))}

                        {submission.generalNotes ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Catatan Peserta</div>
                            <p className="mt-2 leading-6">{submission.generalNotes}</p>
                          </div>
                        ) : null}

                        {submission.reviewerNote ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Catatan Reviewer</div>
                            <p className="mt-2 leading-6">{submission.reviewerNote}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      <section id="assessor-form" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Form Online</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Input hasil asesmen assessor</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Form ini dipakai untuk asesmen online tanpa cetak. Hasilnya tersimpan per course dan bisa dipakai sebagai arsip penilaian internal.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            {canManageAssessment ? 'Editable' : 'Read Only'}
          </div>
        </div>

        {canManageAssessment ? (
          <form action={submitTrainingCourseAssessment} className="mt-6 space-y-6">
            <input type="hidden" name="courseSlug" value={course.slug} />
            <input type="hidden" name="sourceSubmissionId" value={selectedAnswerSubmission?.id || ''} />
            <input type="hidden" name="participantQuery" value={participantFilter} />

            {selectedAnswerSubmission ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <MessageSquareText className="h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Submission Dipakai</div>
                    <h3 className="mt-1 text-lg font-black text-slate-900">{selectedAnswerSubmission.participantName}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Form assessor sekarang diprefill dari submission peserta ini. Saat asesmen final disimpan, submission akan otomatis ditandai sudah direview.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nama Peserta</span>
                <input
                  type="text"
                  name="participantName"
                  required
                  defaultValue={selectedAnswerSubmission?.participantName || ''}
                  placeholder="Contoh: Ahmad Fauzan"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Referensi Peserta</span>
                <input
                  type="text"
                  name="participantReference"
                  defaultValue={selectedAnswerSubmission?.participantReference || ''}
                  placeholder="NIK, email, atau ID peserta"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Peran/Jabatan</span>
                <input
                  type="text"
                  name="participantRole"
                  defaultValue={selectedAnswerSubmission?.participantRole || ''}
                  placeholder="Contoh: Staff Sales"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Keputusan Akhir</span>
                <select
                  name="decision"
                  defaultValue="COMPETENT"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="COMPETENT">Kompeten</option>
                  <option value="NOT_YET_COMPETENT">Belum Kompeten</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status Teori</span>
                <select
                  name="theoryStatus"
                  defaultValue="UNDERSTOOD"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="UNDERSTOOD">Paham</option>
                  <option value="PARTIAL">Sebagian</option>
                  <option value="NOT_YET">Belum Paham</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status Praktik</span>
                <select
                  name="practiceStatus"
                  defaultValue="SUCCESS"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="SUCCESS">Berhasil</option>
                  <option value="NEEDS_SUPPORT">Perlu Bantuan</option>
                  <option value="FAILED">Gagal</option>
                </select>
              </label>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Checklist Unjuk Kerja</div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {assessment.performanceChecklist.map((item, index) => (
                  <label key={item} className="space-y-2 rounded-[20px] border border-slate-200 bg-white p-4">
                    <span className="block text-sm font-bold leading-6 text-slate-800">{item}</span>
                    <select
                      name={`check_${index}`}
                      defaultValue="na"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                    >
                      <option value="na">Belum Dinilai</option>
                      <option value="yes">Ya</option>
                      <option value="no">Tidak</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bukti Yang Diamati</span>
                <textarea
                  name="evidenceSummary"
                  rows={5}
                  defaultValue={selectedAnswerSubmission ? buildAnswerSubmissionContext(selectedAnswerSubmission) : ''}
                  placeholder="Tuliskan bukti praktik, screenshot, jawaban teori, atau observasi yang mendukung keputusan."
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Kekuatan Peserta</span>
                <textarea
                  name="strengths"
                  rows={5}
                  placeholder="Contoh: cepat membedakan jalur login dan memahami letak menu Profil Saya."
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Kesalahan Berulang</span>
                <textarea
                  name="repeatedErrors"
                  rows={5}
                  placeholder="Contoh: masih tertukar antara login admin bisnis dan panel staf."
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tindak Lanjut</span>
                <textarea
                  name="followUp"
                  rows={5}
                  placeholder="Contoh: remedial lesson 2 dan 3 sebelum lanjut ke level berikutnya."
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Simpan Asesmen Online
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                Assessor aktif: {assessorContext.email || 'Tidak diketahui'}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-600">
            Hanya member SaaS yang diberi mandat assessor yang dapat mengirim asesmen online. Peserta tenant tetap bisa membaca rubrik dan kriteria penilaian di halaman ini.
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Langkah Berikutnya</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Gunakan lembar ini saat review trainer</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/learning/course/${course.slug}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Course
            </Link>
            <Link
              href={firstLesson ? `/learning/course/${course.slug}/lesson/${firstLesson.slug}` : `/learning/course/${course.slug}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              Buka Materi Acuan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {canManageAssessment ? (
        <section id="submissions" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Riwayat Online</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Submission asesmen terbaru</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              {submissions.length} data
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              {participantFilter
                ? 'Belum ada submission online yang cocok dengan filter peserta ini.'
                : 'Belum ada submission online untuk course ini.'}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {submissions.map((submission) => {
                const checklistYesCount = submission.checklistResults.filter((item) => item.status === 'yes').length
                const checklistNoCount = submission.checklistResults.filter((item) => item.status === 'no').length

                return (
                  <div key={submission.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            submission.decision === 'COMPETENT'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {submission.decision === 'COMPETENT' ? 'Kompeten' : 'Belum Kompeten'}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                            {submission.assessmentVersion}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-slate-900">{submission.participantName}</h3>
                        <div className="mt-2 text-sm text-slate-600">
                          {submission.participantRole || 'Peran belum diisi'}
                          {submission.participantReference ? ` • ${submission.participantReference}` : ''}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          <span>Assessor: {submission.assessorName}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatAssessmentDate(submission.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[320px]">
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Teori</div>
                          <div className="mt-2 text-sm font-black text-slate-900">
                            {submission.theoryStatus === 'UNDERSTOOD'
                              ? 'Paham'
                              : submission.theoryStatus === 'PARTIAL'
                                ? 'Sebagian'
                                : 'Belum Paham'}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Praktik</div>
                          <div className="mt-2 text-sm font-black text-slate-900">
                            {submission.practiceStatus === 'SUCCESS'
                              ? 'Berhasil'
                              : submission.practiceStatus === 'NEEDS_SUPPORT'
                                ? 'Perlu Bantuan'
                                : 'Gagal'}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Checklist</div>
                          <div className="mt-2 text-sm font-black text-slate-900">
                            {checklistYesCount} ya • {checklistNoCount} tidak
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="space-y-3 text-sm text-slate-600">
                        {submission.evidenceSummary ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Bukti</div>
                            <p className="mt-2 leading-6">{submission.evidenceSummary}</p>
                          </div>
                        ) : null}
                        {submission.strengths ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Kekuatan</div>
                            <p className="mt-2 leading-6">{submission.strengths}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 text-sm text-slate-600">
                        {submission.repeatedErrors ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Kesalahan Berulang</div>
                            <p className="mt-2 leading-6">{submission.repeatedErrors}</p>
                          </div>
                        ) : null}
                        {submission.followUp ? (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tindak Lanjut</div>
                            <p className="mt-2 leading-6">{submission.followUp}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
