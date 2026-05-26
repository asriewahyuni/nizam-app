'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

const LEVEL_OPTIONS = [
  { value: 'ALL', label: 'Semua Level' },
  { value: 'L1',  label: 'Level 1 — Staff' },
  { value: 'L2',  label: 'Level 2 — Supervisor' },
  { value: 'L3',  label: 'Level 3 — Manager' },
  { value: 'SPV', label: 'Supervisor' },
  { value: 'MGR', label: 'Manager' },
]

export default function CreateCourseForm() {
  const [state, action, isPending] = useActionState(createLmsCourse, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          Program berhasil dibuat.
        </div>
      )}

      <div>
        <label className={labelCls}>Judul Course <span className="text-red-400">*</span></label>
        <input name="title" required placeholder="Contoh: Basic Leadership" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Kode Level</label>
        <select name="levelCode" className={inputCls}>
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Deskripsi Singkat</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Materi yang akan dipelajari peserta..."
          className={inputCls + ' resize-none'}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Buat Program'}
      </button>
    </form>
  )
}
