'use client'

import { useActionState, useEffect } from 'react'
import { createLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'
import { useRouter } from 'next/navigation'
import MarkdownEditor from '../../MarkdownEditor'

const inputCls = 'w-full rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-600 focus:ring-0 hover:border-slate-300'
const labelCls = 'block text-sm font-bold text-slate-900 mb-1.5'

export default function CreateCourseForm() {
  const router = useRouter()
  const [state, action, isPending] = useActionState(createLmsCourse, {})

  useEffect(() => {
    if (state?.success) {
      router.push('/lms/admin')
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </div>
      )}

      <div>
        <label className={labelCls}>Judul Program <span className="text-red-500">*</span></label>
        <input 
          name="title" 
          required 
          placeholder="Contoh: Meta Ads untuk Pemula" 
          className={inputCls} 
        />
        <p className="mt-1 text-xs text-slate-500">Buat judul yang menarik dan jelas tentang apa yang diajarkan.</p>
      </div>

      <div>
        <label className={labelCls}>Deskripsi</label>
        <MarkdownEditor name="description" />
      </div>

      <div>
        <label className={labelCls}>Level Kesulitan</label>
        <select name="levelCode" className={inputCls} defaultValue="ALL">
          <option value="ALL">Semua Level</option>
          <option value="BEGINNER">Pemula (Beginner)</option>
          <option value="INTERMEDIATE">Menengah (Intermediate)</option>
          <option value="ADVANCED">Mahir (Advanced)</option>
        </select>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button
          type="submit"
          disabled={isPending}
          className="w-full md:w-auto md:px-8 inline-flex items-center justify-center rounded-md bg-slate-900 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Menyimpan...' : 'Buat Program'}
        </button>
      </div>
    </form>
  )
}
