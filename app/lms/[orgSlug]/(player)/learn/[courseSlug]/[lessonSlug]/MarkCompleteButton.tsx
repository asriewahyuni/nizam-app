'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { markLessonComplete } from '@/modules/lms/actions/progress.actions'

export default function MarkCompleteButton({ orgSlug, lessonId, nextLessonSlug, courseSlug }: { orgSlug: string, lessonId: string, nextLessonSlug?: string, courseSlug: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleComplete = async () => {
    setLoading(true)
    setError(null)
    const res = await markLessonComplete(orgSlug, lessonId)
    
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      if (res.fullyCompleted) {
        alert('Selamat! Anda telah menyelesaikan seluruh materi di kursus ini.')
        router.push(`/lms/${orgSlug}/course/${courseSlug}`)
      } else if (nextLessonSlug) {
        router.push(`/lms/${orgSlug}/learn/${courseSlug}/${nextLessonSlug}`)
      } else {
        router.push(`/lms/${orgSlug}/course/${courseSlug}`)
      }
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
      <button 
        type="button" 
        onClick={handleComplete}
        disabled={loading}
        className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} 
        Tandai Selesai
      </button>
    </div>
  )
}
