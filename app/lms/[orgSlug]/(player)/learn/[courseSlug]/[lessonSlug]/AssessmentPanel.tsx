'use client'

/**
 * Panel kuis dan tugas di pemutar kelas. Seluruh penyimpanan tetap melalui
 * server action yang memeriksa organisasi, akses course, enrollment, dan user.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileUp,
  LoaderCircle,
  RotateCcw,
  Send,
} from 'lucide-react'
import {
  startQuizAttempt,
  submitAssignment,
  submitQuizAttempt,
  uploadAssignmentAttachment,
  type LessonAssessmentOverview,
  type QuizAnswerInput,
} from '@/modules/lms/actions/assessment.actions'

type QuizQuestion = {
  id: string
  question_type: string
  prompt_html: string
  points: number
  options: Array<{
    id: string
    optionHtml: string
    sortOrder: number
  }>
}

type ActiveAttempt = {
  attemptId: string
  startedAt: string
  expiresAt: string | null
  questions: QuizQuestion[]
}

type QuizAnswerState = Record<string, {
  selectedOptionIds: string[]
  answerText: string
  answerOrder: string[]
}>

function formatScore(value: number | null) {
  return value == null ? 'Belum dinilai' : `${Math.round(value * 100) / 100}%`
}

function statusLabel(value: string | null) {
  const labels: Record<string, string> = {
    IN_PROGRESS: 'Sedang dikerjakan',
    SUBMITTED: 'Menunggu penilaian',
    GRADED: 'Sudah dinilai',
    EXPIRED: 'Waktu habis',
    RETURNED: 'Perlu diperbaiki',
  }
  return value ? labels[value] || value : 'Belum dikerjakan'
}

function QuizCard({
  quiz,
  orgSlug,
}: {
  quiz: LessonAssessmentOverview['quizzes'][number]
  orgSlug: string
}) {
  const [isPending, startTransition] = useTransition()
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null)
  const [answers, setAnswers] = useState<QuizAnswerState>({})
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    score: number
    passed: boolean | null
    requiresManualReview: boolean
    review: Array<{ questionId: string; explanationHtml: string }>
  } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!attempt?.expiresAt) {
      setSecondsLeft(null)
      return
    }
    const update = () => {
      setSecondsLeft(Math.max(
        0,
        Math.floor((new Date(attempt.expiresAt!).getTime() - Date.now()) / 1000),
      ))
    }
    update()
    const interval = window.setInterval(update, 1_000)
    return () => window.clearInterval(interval)
  }, [attempt?.expiresAt])

  const answerCount = useMemo(() => Object.values(answers).filter((answer) => (
    answer.selectedOptionIds.length > 0
    || answer.answerText.trim().length > 0
    || answer.answerOrder.length > 0
  )).length, [answers])

  function begin() {
    setError('')
    startTransition(async () => {
      const response = await startQuizAttempt(orgSlug, quiz.id)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      if (!response.data) {
        setError('Kuis belum dapat dimulai.')
        return
      }
      const nextAttempt = response.data as ActiveAttempt
      setAttempt(nextAttempt)
      setResult(null)
      setAnswers(Object.fromEntries(nextAttempt.questions.map((question) => [
        question.id,
        {
          selectedOptionIds: [],
          answerText: '',
          answerOrder: question.question_type === 'ORDERING'
            ? question.options.map((option) => option.id)
            : [],
        },
      ])))
    })
  }

  function selectOption(question: QuizQuestion, optionId: string) {
    setAnswers((current) => {
      const answer = current[question.id]
      const selected = answer?.selectedOptionIds || []
      const nextSelected = question.question_type === 'MULTIPLE_CHOICE'
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId]
      return {
        ...current,
        [question.id]: {
          selectedOptionIds: nextSelected,
          answerText: answer?.answerText || '',
          answerOrder: answer?.answerOrder || [],
        },
      }
    })
  }

  function moveOption(questionId: string, index: number, direction: -1 | 1) {
    setAnswers((current) => {
      const answer = current[questionId]
      const order = [...(answer?.answerOrder || [])]
      const target = index + direction
      if (target < 0 || target >= order.length) return current
      ;[order[index], order[target]] = [order[target], order[index]]
      return {
        ...current,
        [questionId]: {
          selectedOptionIds: answer?.selectedOptionIds || [],
          answerText: answer?.answerText || '',
          answerOrder: order,
        },
      }
    })
  }

  function submit() {
    if (!attempt) return
    setError('')
    const payload: QuizAnswerInput[] = attempt.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: answers[question.id]?.selectedOptionIds || [],
      answerText: answers[question.id]?.answerText || '',
      answerOrder: answers[question.id]?.answerOrder || [],
    }))
    startTransition(async () => {
      const response = await submitQuizAttempt(attempt.attemptId, payload)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      if (!response.data || 'alreadySubmitted' in response.data) {
        setError('Kuis ini sudah pernah dikirim. Muat ulang halaman untuk melihat status terbaru.')
        setAttempt(null)
        return
      }
      setResult({
        score: response.data.score,
        passed: response.data.passed,
        requiresManualReview: response.data.requiresManualReview,
        review: response.data.review,
      })
      setAttempt(null)
    })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-emerald-800">
            <ClipboardCheck aria-hidden="true" size={19} />
            <p className="text-sm font-bold uppercase tracking-wide">Kuis</p>
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-950">{quiz.title}</h3>
          {quiz.descriptionHtml && (
            <div
              className="prose prose-sm mt-2 max-w-none text-slate-600"
              dangerouslySetInnerHTML={{ __html: quiz.descriptionHtml }}
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Nilai lulus {quiz.passingScore}%
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} menit` : 'Tanpa batas waktu'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Percobaan {quiz.attemptsUsed}/{quiz.maxAttempts ?? '∞'}
            </span>
          </div>
        </div>
        {!attempt && !result && (
          <button
            type="button"
            onClick={begin}
            disabled={isPending || (
              quiz.maxAttempts != null
              && quiz.attemptsUsed >= quiz.maxAttempts
              && quiz.latestStatus !== 'IN_PROGRESS'
            )}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending
              ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              : quiz.latestStatus === 'IN_PROGRESS'
                ? <RotateCcw aria-hidden="true" size={18} />
                : <ClipboardCheck aria-hidden="true" size={18} />}
            {quiz.latestStatus === 'IN_PROGRESS' ? 'Lanjutkan' : 'Mulai kuis'}
          </button>
        )}
      </div>

      {!attempt && !result && quiz.latestStatus && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">{statusLabel(quiz.latestStatus)}</span>
          {quiz.latestScore != null && <span> · Nilai {formatScore(quiz.latestScore)}</span>}
        </div>
      )}

      {attempt && (
        <form
          className="mt-6 space-y-6 border-t border-slate-100 pt-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm">
            <span className="font-semibold text-emerald-950">
              Terjawab {answerCount} dari {attempt.questions.length} soal
            </span>
            {secondsLeft != null && (
              <span
                className={`inline-flex items-center gap-2 font-bold ${
                  secondsLeft <= 60 ? 'text-red-700' : 'text-emerald-900'
                }`}
                role="timer"
              >
                <Clock3 aria-hidden="true" size={17} />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          {attempt.questions.map((question, questionIndex) => {
            const answer = answers[question.id]
            const orderedOptions = (answer?.answerOrder || [])
              .map((id) => question.options.find((option) => option.id === id))
              .filter((option): option is QuizQuestion['options'][number] => Boolean(option))
            return (
              <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-5">
                <legend className="px-2 text-sm font-bold text-emerald-800">
                  Soal {questionIndex + 1} · {question.points} poin
                </legend>
                <div
                  className="prose prose-sm mt-2 max-w-none font-semibold text-slate-900"
                  dangerouslySetInnerHTML={{ __html: question.prompt_html }}
                />

                {question.question_type === 'ORDERING' ? (
                  <ol className="mt-4 space-y-2" aria-label="Urutan jawaban">
                    {orderedOptions.map((option, index) => (
                      <li key={option.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3">
                        <span className="w-6 text-center text-sm font-bold text-emerald-800">
                          {index + 1}
                        </span>
                        <span
                          className="min-w-0 flex-1 text-sm text-slate-700"
                          dangerouslySetInnerHTML={{ __html: option.optionHtml }}
                        />
                        <button
                          type="button"
                          onClick={() => moveOption(question.id, index, -1)}
                          disabled={index === 0}
                          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Naikkan jawaban nomor ${index + 1}`}
                        >
                          <ArrowUp aria-hidden="true" size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOption(question.id, index, 1)}
                          disabled={index === orderedOptions.length - 1}
                          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Turunkan jawaban nomor ${index + 1}`}
                        >
                          <ArrowDown aria-hidden="true" size={18} />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : ['SHORT_TEXT', 'ESSAY'].includes(question.question_type) ? (
                  <label className="mt-4 block">
                    <span className="sr-only">Jawaban soal {questionIndex + 1}</span>
                    <textarea
                      value={answer?.answerText || ''}
                      onChange={(event) => setAnswers((current) => ({
                        ...current,
                        [question.id]: {
                          selectedOptionIds: current[question.id]?.selectedOptionIds || [],
                          answerText: event.target.value,
                          answerOrder: current[question.id]?.answerOrder || [],
                        },
                      }))}
                      rows={question.question_type === 'ESSAY' ? 6 : 3}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                      placeholder={question.question_type === 'ESSAY'
                        ? 'Tulis jawaban esai Anda…'
                        : 'Tulis jawaban singkat…'}
                    />
                  </label>
                ) : (
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => {
                      const multiple = question.question_type === 'MULTIPLE_CHOICE'
                      const checked = answer?.selectedOptionIds.includes(option.id) || false
                      return (
                        <label
                          key={option.id}
                          className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${
                            checked
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <input
                            type={multiple ? 'checkbox' : 'radio'}
                            name={`question-${question.id}`}
                            checked={checked}
                            onChange={() => selectOption(question, option.id)}
                            className="mt-1 size-4 accent-emerald-700 focus:ring-emerald-500"
                          />
                          <span
                            className="min-w-0 text-sm text-slate-700"
                            dangerouslySetInnerHTML={{ __html: option.optionHtml }}
                          />
                        </label>
                      )
                    })}
                  </div>
                )}
              </fieldset>
            )
          })}

          <button
            type="submit"
            disabled={isPending || secondsLeft === 0}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isPending
              ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              : <Send aria-hidden="true" size={18} />}
            Kirim semua jawaban
          </button>
        </form>
      )}

      {result && (
        <div
          className={`mt-5 rounded-2xl border p-5 ${
            result.passed === false
              ? 'border-red-200 bg-red-50 text-red-950'
              : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            {result.passed === false
              ? <AlertCircle aria-hidden="true" className="shrink-0" />
              : <CheckCircle2 aria-hidden="true" className="shrink-0" />}
            <div>
              <p className="font-bold">
                {result.requiresManualReview
                  ? 'Jawaban terkirim dan menunggu penilaian tutor'
                  : result.passed
                    ? 'Kuis lulus'
                    : 'Nilai belum memenuhi batas lulus'}
              </p>
              <p className="mt-1 text-sm">
                Nilai sementara: {formatScore(result.score)}
              </p>
            </div>
          </div>
          {result.review.some((item) => item.explanationHtml) && (
            <details className="mt-4 rounded-xl border border-current/15 bg-white/60 p-4">
              <summary className="cursor-pointer font-semibold">Lihat pembahasan</summary>
              <div className="mt-3 space-y-3 text-sm">
                {result.review.map((item, index) => item.explanationHtml && (
                  <div key={item.questionId}>
                    <p className="font-semibold">Soal {index + 1}</p>
                    <div
                      className="prose prose-sm mt-1 max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.explanationHtml }}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          {error}
        </p>
      )}
    </article>
  )
}

function AssignmentCard({
  assignment,
  orgSlug,
}: {
  assignment: LessonAssessmentOverview['assignments'][number]
  orgSlug: string
}) {
  const [isPending, startTransition] = useTransition()
  const [answerText, setAnswerText] = useState('')
  const [uploads, setUploads] = useState<Array<{ id: string; fileName: string; size: number }>>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const attemptsExhausted = assignment.submissionsUsed >= assignment.maxAttempts
  const duePassed = assignment.dueAt
    ? new Date(assignment.dueAt).getTime() < Date.now()
    : false

  function upload(file: File | undefined) {
    if (!file) return
    setError('')
    setMessage('')
    startTransition(async () => {
      const formData = new FormData()
      formData.set('orgSlug', orgSlug)
      formData.set('assignmentId', assignment.id)
      formData.set('file', file)
      const response = await uploadAssignmentAttachment(formData)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      if (response.success && response.upload) {
        setUploads((current) => [...current, {
          id: response.upload.id,
          fileName: response.upload.fileName,
          size: response.upload.size,
        }])
        setMessage(`${response.upload.fileName} siap dikirim.`)
      }
    })
  }

  function submit() {
    setError('')
    setMessage('')
    if (!answerText.trim() && uploads.length === 0) {
      setError('Isi jawaban atau unggah minimal satu lampiran.')
      return
    }
    startTransition(async () => {
      const response = await submitAssignment({
        orgSlug,
        assignmentId: assignment.id,
        text: answerText,
        uploadIds: uploads.map((item) => item.id),
      })
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      setAnswerText('')
      setUploads([])
      setMessage(`Tugas berhasil dikirim sebagai percobaan ke-${response.data?.attemptNumber}.`)
    })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-orange-800">
        <FileUp aria-hidden="true" size={19} />
        <p className="text-sm font-bold uppercase tracking-wide">Tugas</p>
      </div>
      <h3 className="mt-2 text-lg font-bold text-slate-950">{assignment.title}</h3>
      {assignment.instructionsHtml && (
        <div
          className="prose prose-sm mt-2 max-w-none text-slate-600"
          dangerouslySetInnerHTML={{ __html: assignment.instructionsHtml }}
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          Percobaan {assignment.submissionsUsed}/{assignment.maxAttempts}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          Nilai maksimal {assignment.maxScore}
        </span>
        {assignment.dueAt && (
          <span className={`rounded-full px-3 py-1.5 ${
            duePassed ? 'bg-red-100 text-red-800' : 'bg-slate-100'
          }`}>
            Tenggat {new Date(assignment.dueAt).toLocaleString('id-ID')}
          </span>
        )}
      </div>

      {assignment.latestStatus && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">{statusLabel(assignment.latestStatus)}</span>
          {assignment.latestScore != null && (
            <span> · Nilai {assignment.latestScore}/{assignment.maxScore}</span>
          )}
          {assignment.latestFeedback && (
            <p className="mt-2 border-t border-slate-200 pt-2">
              Catatan tutor: {assignment.latestFeedback}
            </p>
          )}
        </div>
      )}

      {!attemptsExhausted && !duePassed && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Jawaban atau catatan</span>
            <textarea
              value={answerText}
              onChange={(event) => setAnswerText(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              placeholder="Tulis jawaban, penjelasan, atau tautan bukti…"
            />
          </label>
          <div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50 focus-within:ring-4 focus-within:ring-emerald-200">
              <FileUp aria-hidden="true" size={18} />
              Unggah bukti
              <input
                type="file"
                className="sr-only"
                accept={assignment.allowedMimeTypes.join(',') || undefined}
                disabled={isPending}
                onChange={(event) => {
                  upload(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Maksimal 25 MB
              {assignment.allowedMimeTypes.length > 0
                ? ` · ${assignment.allowedMimeTypes.join(', ')}`
                : ' · semua format diperbolehkan'}
            </p>
            {uploads.length > 0 && (
              <ul className="mt-3 space-y-2" aria-label="Lampiran siap dikirim">
                {uploads.map((upload) => (
                  <li key={upload.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {upload.fileName} · {(upload.size / 1024 / 1024).toFixed(2)} MB
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isPending
              ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              : <Send aria-hidden="true" size={18} />}
            Kirim tugas
          </button>
        </div>
      )}

      {message && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          {error}
        </p>
      )}
    </article>
  )
}

export default function AssessmentPanel({
  overview,
  orgSlug,
}: {
  overview: LessonAssessmentOverview
  orgSlug: string
}) {
  if (overview.quizzes.length === 0 && overview.assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <ClipboardCheck aria-hidden="true" className="mx-auto text-slate-500" size={34} />
        <p className="mt-3 font-semibold text-slate-700">Belum ada kuis atau tugas pada materi ini.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {overview.quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} orgSlug={orgSlug} />
      ))}
      {overview.assignments.map((assignment) => (
        <AssignmentCard key={assignment.id} assignment={assignment} orgSlug={orgSlug} />
      ))}
    </div>
  )
}
