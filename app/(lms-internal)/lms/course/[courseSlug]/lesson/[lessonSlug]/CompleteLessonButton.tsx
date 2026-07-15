'use client'

import { useTransition } from 'react'
import { markLessonCompleteAction } from '@/modules/edu/actions/lms-commercial.actions'
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function CompleteLessonButton({ 
  lessonId, 
  courseSlug,
  nextLessonSlug,
  isAlreadyCompleted
}: { 
  lessonId: string, 
  courseSlug: string,
  nextLessonSlug: string | null,
  isAlreadyCompleted: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleComplete = () => {
    startTransition(async () => {
      try {
        await markLessonCompleteAction(lessonId)
        if (nextLessonSlug) {
          router.push(`/lms/course/${courseSlug}/lesson/${nextLessonSlug}`)
        } else {
          router.push(`/lms/course/${courseSlug}`)
        }
      } catch (err) {
        alert('Gagal mencatat progress')
      }
    })
  }

  if (isAlreadyCompleted) {
    return (
      <Link
        href={nextLessonSlug ? `/lms/course/${courseSlug}/lesson/${nextLessonSlug}` : `/lms/course/${courseSlug}`}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
      >
        <CheckCircle className="h-4 w-4" />
        {nextLessonSlug ? 'Lanjut Materi Berikutnya' : 'Selesai Belajar'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    )
  }

  return (
    <button
      onClick={handleComplete}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      Tandai Selesai
      <ArrowRight className="h-4 w-4" />
    </button>
  )
}
