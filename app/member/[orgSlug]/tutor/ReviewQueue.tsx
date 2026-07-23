'use client'

/**
 * Antrean penilaian tutor untuk tugas dan jawaban esai.
 */
import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Download,
  FileCheck2,
  LoaderCircle,
  MessageSquareText,
  Save,
} from 'lucide-react'
import {
  reviewAssignmentSubmission,
  reviewQuizEssayAnswers,
} from '@/modules/lms/actions/assessment.actions'
import type { PortalTutorDashboard } from '@/modules/member/lib/portal.server'

function AssignmentReviewCard({
  orgSlug,
  submission,
  onReviewed,
}: {
  orgSlug: string
  submission: PortalTutorDashboard['pendingAssignments'][number]
  onReviewed: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [rubricScores, setRubricScores] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  function save() {
    setError('')
    startTransition(async () => {
      const response = await reviewAssignmentSubmission({
        orgSlug,
        submissionId: submission.submissionId,
        score: Number(score),
        feedback,
        rubricScores: submission.rubric.map((criterion) => ({
          key: criterion.key,
          title: criterion.title,
          score: Number(rubricScores[criterion.key] || 0),
          maxScore: criterion.maxScore,
        })),
      })
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      onReviewed()
    })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {submission.courseTitle}
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">
            {submission.assignmentTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {submission.participantName} · Percobaan {submission.attemptNumber}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dikirim {new Date(submission.submittedAt).toLocaleString('id-ID')}
          </p>
        </div>
        <FileCheck2 aria-hidden="true" className="shrink-0 text-orange-700" size={24} />
      </div>

      {submission.answerText && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {submission.answerText}
        </div>
      )}
      {submission.attachments.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Lampiran tugas">
          {submission.attachments.map((attachment) => (
            <li key={attachment.uploadId}>
              <a
                href={`/api/lms/assignments/submissions/${submission.submissionId}/attachments/${attachment.uploadId}`}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                <span className="truncate">{attachment.fileName}</span>
                <Download aria-label="Unduh lampiran" className="shrink-0" size={18} />
              </a>
            </li>
          ))}
        </ul>
      )}

      {submission.rubric.length > 0 && (
        <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold text-slate-800">Rubrik</legend>
          <div className="space-y-3">
            {submission.rubric.map((criterion) => (
              <label key={criterion.key} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-center">
                <span className="text-sm text-slate-700">
                  {criterion.title} <span className="text-slate-500">(maks. {criterion.maxScore})</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={criterion.maxScore}
                  step="0.01"
                  value={rubricScores[criterion.key] || ''}
                  onChange={(event) => setRubricScores((current) => ({
                    ...current,
                    [criterion.key]: event.target.value,
                  }))}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  aria-label={`Nilai ${criterion.title}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-[150px_1fr]">
        <label>
          <span className="text-sm font-bold text-slate-800">
            Nilai total
          </span>
          <span className="relative mt-2 block">
            <input
              type="number"
              min={0}
              max={submission.maxScore}
              step="0.01"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 pr-12 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
            <span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-500">
              /{submission.maxScore}
            </span>
          </span>
        </label>
        <label>
          <span className="text-sm font-bold text-slate-800">Umpan balik tutor</span>
          <textarea
            rows={3}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={isPending || score === ''}
        className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        {isPending
          ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
          : <Save aria-hidden="true" size={18} />}
        Simpan penilaian
      </button>
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

function EssayReviewCard({
  orgSlug,
  attempt,
  onReviewed,
}: {
  orgSlug: string
  attempt: PortalTutorDashboard['pendingQuizEssays'][number]
  onReviewed: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const complete = attempt.answers.every((answer) => scores[answer.questionId] !== undefined)

  function save() {
    setError('')
    startTransition(async () => {
      const response = await reviewQuizEssayAnswers({
        orgSlug,
        attemptId: attempt.attemptId,
        answers: attempt.answers.map((answer) => ({
          questionId: answer.questionId,
          awardedPoints: Number(scores[answer.questionId] || 0),
          feedback: feedback[answer.questionId] || '',
        })),
      })
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      onReviewed()
    })
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {attempt.courseTitle}
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">{attempt.quizTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">{attempt.participantName}</p>
          <p className="mt-1 text-xs text-slate-500">
            Dikirim {new Date(attempt.submittedAt).toLocaleString('id-ID')}
          </p>
        </div>
        <MessageSquareText aria-hidden="true" className="shrink-0 text-emerald-700" size={24} />
      </div>
      <div className="mt-5 space-y-4">
        {attempt.answers.map((answer, index) => (
          <fieldset key={answer.questionId} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-emerald-800">
              Esai {index + 1} · maksimal {answer.points} poin
            </legend>
            <div
              className="prose prose-sm mt-2 max-w-none font-semibold text-slate-900"
              dangerouslySetInnerHTML={{ __html: answer.promptHtml }}
            />
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {answer.answerText || 'Peserta tidak menulis jawaban.'}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
              <label>
                <span className="text-xs font-bold text-slate-600">Poin</span>
                <input
                  type="number"
                  min={0}
                  max={answer.points}
                  step="0.01"
                  value={scores[answer.questionId] || ''}
                  onChange={(event) => setScores((current) => ({
                    ...current,
                    [answer.questionId]: event.target.value,
                  }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">Catatan</span>
                <input
                  value={feedback[answer.questionId] || ''}
                  onChange={(event) => setFeedback((current) => ({
                    ...current,
                    [answer.questionId]: event.target.value,
                  }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={isPending || !complete}
        className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        {isPending
          ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
          : <Save aria-hidden="true" size={18} />}
        Simpan nilai esai
      </button>
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

export default function ReviewQueue({
  orgSlug,
  initialAssignments,
  initialQuizEssays,
}: {
  orgSlug: string
  initialAssignments: PortalTutorDashboard['pendingAssignments']
  initialQuizEssays: PortalTutorDashboard['pendingQuizEssays']
}) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [quizEssays, setQuizEssays] = useState(initialQuizEssays)

  if (assignments.length === 0 && quizEssays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center text-emerald-950">
        <CheckCircle2 aria-hidden="true" className="mx-auto" size={34} />
        <p className="mt-3 font-bold">Semua penilaian sudah selesai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {assignments.map((submission) => (
        <AssignmentReviewCard
          key={submission.submissionId}
          orgSlug={orgSlug}
          submission={submission}
          onReviewed={() => setAssignments((current) => (
            current.filter((item) => item.submissionId !== submission.submissionId)
          ))}
        />
      ))}
      {quizEssays.map((attempt) => (
        <EssayReviewCard
          key={attempt.attemptId}
          orgSlug={orgSlug}
          attempt={attempt}
          onReviewed={() => setQuizEssays((current) => (
            current.filter((item) => item.attemptId !== attempt.attemptId)
          ))}
        />
      ))}
    </div>
  )
}
