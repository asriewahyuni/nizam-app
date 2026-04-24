import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { submitTrainingCourseAnswerSubmission } from '@/modules/edu/actions/training-assessment.actions'
import { getTrainingAssessmentByCourseSlug } from '@/modules/edu/lib/training-assessment-mvp'
import { listTrainingCourseAnswerSubmissions } from '@/modules/edu/lib/training-assessment.server'
import {
  getTrainingCourseBySlug,
  getTrainingLessonsForCourse,
} from '@/modules/edu/lib/training-center-mvp'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'

function formatAssessmentDate(dateLike: string) {
  if (!dateLike) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(dateLike))
}

export default async function LearningCourseParticipantAssessmentPage(props: {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{
    answerSaved?: string
    answerError?: string
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

  const searchParams = await props.searchParams
  const firstLesson = getTrainingLessonsForCourse(course.slug)[0] || null
  const canManageAssessment = hasRolePermission(orgData.role, orgData.permissions, 'learning:write')
  const canAccessLearning = hasRolePermission(orgData.role, orgData.permissions, 'learning')

  if (!canAccessLearning && !canManageAssessment) {
    return redirect(`/learning/course/${course.slug}`)
  }

  const ownAnswerSubmissions = orgData.user?.id
    ? await listTrainingCourseAnswerSubmissions({
        orgId: orgData.org.id,
        courseSlug: course.slug,
        participantUserId: orgData.user.id,
        limit: 8,
      })
    : []

  const participantNameDefault = String(
    orgData.user?.user_metadata?.full_name
    || orgData.user?.user_metadata?.name
    || orgData.user?.email
    || 'Peserta NIZAM',
  )
    .trim()
    .slice(0, 120)
  const participantReferenceDefault = String(orgData.user?.email || '').trim()
  const participantRoleDefault = String(orgData.jobTitle || '').trim()

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
              <MessageSquareText className="h-3.5 w-3.5" />
              Halaman Peserta
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Jawaban Asesmen Peserta
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Peserta mengisi jawaban teori dan bukti praktik di halaman ini. Assessor akan meninjau submission yang masuk dari panel assessor.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                {course.levelCode} • {course.title}
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                Versi {assessment.version}
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                {assessment.theoryQuestions.length} teori • {assessment.practicalTasks.length} praktik
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {canManageAssessment ? (
                <Link
                  href={`/learning/course/${course.slug}/assessment`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  Buka Panel Assessor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              {firstLesson ? (
                <Link
                  href={`/learning/course/${course.slug}/lesson/${firstLesson.slug}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  Buka Materi Acuan
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cara Mengisi</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                Jawab pertanyaan teori dengan singkat, jelas, dan sesuai lesson yang sudah dipelajari.
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                Jelaskan langkah praktik yang Anda lakukan atau bukti yang sudah Anda siapkan.
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                Setelah dikirim, assessor akan meninjau submission dan memberi keputusan akhir.
              </div>
            </div>
          </div>
        </div>
      </section>

      {searchParams?.answerSaved === '1' ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Jawaban peserta berhasil dikirim. Tunggu assessor meninjau submission Anda.
        </section>
      ) : null}

      {searchParams?.answerError ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 shadow-sm">
          {searchParams.answerError}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Pertanyaan Teori</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{assessment.theoryQuestions.length}</div>
          <p className="mt-2 text-sm text-slate-600">Jawab secukupnya sesuai pemahaman dan istilah kerja yang Anda pakai.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tugas Praktik</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{assessment.practicalTasks.length}</div>
          <p className="mt-2 text-sm text-slate-600">Tuliskan langkah, hasil, atau bukti minimal yang sudah Anda siapkan.</p>
        </div>
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Sudah Dikirim</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-emerald-900">{ownAnswerSubmissions.length}</div>
          <p className="mt-2 text-sm text-emerald-800">Riwayat submission Anda untuk course ini.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Status Terbaru</div>
          <div className="mt-3 text-sm font-black text-slate-900">
            {!ownAnswerSubmissions[0]
              ? 'Belum Ada'
              : ownAnswerSubmissions[0].status === 'REVIEWED'
                ? 'Sudah Direview'
                : 'Menunggu Review'}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {ownAnswerSubmissions[0]
              ? `Update terakhir ${formatAssessmentDate(ownAnswerSubmissions[0].updatedAt)}`
              : 'Belum ada jawaban yang dikirim.'}
          </p>
        </div>
      </section>

      <section id="participant-answer-form" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Form Peserta</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Isi jawaban sebelum direview assessor</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Gunakan form ini untuk menjawab pertanyaan teori dan menjelaskan bukti praktik. Tidak harus panjang, yang penting jelas dan bisa ditelusuri.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            Online
          </div>
        </div>

        <form action={submitTrainingCourseAnswerSubmission} className="mt-6 space-y-6">
          <input type="hidden" name="courseSlug" value={course.slug} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nama Peserta</span>
              <input
                type="text"
                name="participantName"
                required
                defaultValue={participantNameDefault}
                placeholder="Contoh: Ahmad Fauzan"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Referensi Peserta</span>
              <input
                type="text"
                name="participantReference"
                defaultValue={participantReferenceDefault}
                placeholder="NIK, email, atau ID peserta"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Peran/Jabatan</span>
              <input
                type="text"
                name="participantRole"
                defaultValue={participantRoleDefault}
                placeholder="Contoh: Staff Sales"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Pertanyaan Teori</div>
                <h3 className="mt-1 text-lg font-black text-slate-900">Jawab singkat dan jelas</h3>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {assessment.theoryQuestions.map((question, index) => (
                <label key={question} className="block rounded-[20px] border border-slate-200 bg-white p-4">
                  <span className="block text-sm font-bold leading-6 text-slate-800">
                    {index + 1}. {question}
                  </span>
                  <textarea
                    name={`theoryAnswer_${index}`}
                    rows={4}
                    placeholder="Tulis jawaban Anda dengan singkat dan jelas."
                    className="mt-3 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Bukti Praktik</div>
                <h3 className="mt-1 text-lg font-black text-slate-900">Jelaskan apa yang Anda lakukan</h3>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {assessment.practicalTasks.map((task, index) => (
                <label key={task.title} className="block rounded-[20px] border border-slate-200 bg-white p-4">
                  <span className="block text-sm font-bold leading-6 text-slate-800">
                    {index + 1}. {task.title}
                  </span>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.instruction}</p>
                  <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <span className="font-black text-slate-900">Bukti minimum:</span> {task.expectedEvidence}
                  </div>
                  <textarea
                    name={`practicalAnswer_${index}`}
                    rows={4}
                    placeholder="Jelaskan langkah yang Anda lakukan, hasil yang muncul, atau screenshot yang Anda siapkan."
                    className="mt-3 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Catatan Tambahan Peserta</span>
            <textarea
              name="generalNotes"
              rows={5}
              placeholder="Tuliskan kendala, hal yang masih membingungkan, atau penjelasan tambahan untuk assessor."
              className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              Kirim Jawaban Ke Assessor
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              Isi minimal satu jawaban sebelum mengirim.
            </div>
          </div>
        </form>
      </section>

      <section id="participant-submissions" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Riwayat Peserta</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Submission jawaban saya</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            {ownAnswerSubmissions.length} data
          </div>
        </div>

        {ownAnswerSubmissions.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Anda belum mengirim jawaban untuk course ini.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {ownAnswerSubmissions.map((submission) => (
              <div key={submission.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        submission.status === 'REVIEWED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {submission.status === 'REVIEWED' ? 'Sudah Direview' : 'Menunggu Review'}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                        {submission.assessmentVersion}
                      </span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 text-sm font-black text-slate-900">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      {formatAssessmentDate(submission.createdAt)}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {submission.participantRole || 'Peran belum diisi'}
                      {submission.participantReference ? ` • ${submission.participantReference}` : ''}
                    </div>
                  </div>

                  {submission.reviewedAt ? (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Direview Oleh</div>
                      <div className="mt-2 font-black text-slate-900">{submission.reviewerName || 'Assessor'}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatAssessmentDate(submission.reviewedAt)}</div>
                    </div>
                  ) : null}
                </div>

                {submission.reviewerNote ? (
                  <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Catatan Review</div>
                    <p className="mt-2 leading-6">{submission.reviewerNote}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Langkah Berikutnya</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Lanjutkan belajar sambil menunggu review</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/learning/course/${course.slug}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Course
            </Link>
            {firstLesson ? (
              <Link
                href={`/learning/course/${course.slug}/lesson/${firstLesson.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Buka Materi Acuan
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Tips Peserta
            </div>
            <p className="mt-2 leading-6">
              Jika submission Anda belum direview, lanjutkan penguatan lesson terkait dan siapkan bukti tambahan bila assessor memintanya.
            </p>
          </div>
          {canManageAssessment ? (
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Akses Tambahan</div>
              <p className="mt-2 leading-6">
                Akun Anda juga memiliki akses assessor. Gunakan panel assessor untuk review submission peserta dan menetapkan keputusan akhir.
              </p>
              <Link
                href={`/learning/course/${course.slug}/assessment`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Buka Panel Assessor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
