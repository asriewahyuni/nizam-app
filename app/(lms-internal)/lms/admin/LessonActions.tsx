'use client'

import { useTransition } from 'react'
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { deleteLmsLesson, moveLmsLesson } from '@/modules/edu/actions/lms-commercial.actions'

export default function LessonActions({ lessonId, courseId }: { lessonId: string, courseId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('Hapus materi ini? Tindakan ini tidak dapat dibatalkan.')) return
    startTransition(async () => {
      try {
        await deleteLmsLesson(lessonId)
      } catch (err) {
        alert(String(err))
      }
    })
  }

  const handleMove = (direction: 'up' | 'down') => {
    startTransition(async () => {
      try {
        await moveLmsLesson(lessonId, courseId, direction)
      } catch (err) {
        alert(String(err))
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleMove('up')}
        disabled={isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        title="Geser ke Atas"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => handleMove('down')}
        disabled={isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        title="Geser ke Bawah"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 ml-1"
        title="Hapus Materi"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
