'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { removeAssessmentTemplate } from '@/modules/edu/actions/training-assessment-template.actions'

export function DeleteTemplateButton({ courseSlug }: { courseSlug: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const result = await removeAssessmentTemplate(courseSlug)
      if (!result.success) {
        setError(result.error || 'Gagal menghapus template')
      }
      // revalidatePath will refresh the page automatically
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {loading ? '...' : 'Yakin'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[10px] text-slate-500 hover:text-slate-700"
        >
          Batal
        </button>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 transition-colors"
    >
      <Trash2 size={12} />
    </button>
  )
}
