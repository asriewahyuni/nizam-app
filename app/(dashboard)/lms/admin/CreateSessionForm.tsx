'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsSession } from '@/modules/edu/actions/lms-commercial.actions'

type Batch = { id: string; name: string; learning_courses?: { title?: string } | null }

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

export default function CreateSessionForm({ batches }: { batches: Batch[] }) {
  const [state, action, isPending] = useActionState(createLmsSession, {})
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
          Sesi berhasil dibuat.
        </div>
      )}

      <div>
        <label className={labelCls}>Batch <span className="text-red-400">*</span></label>
        <select name="batchId" required className={inputCls}>
          <option value="">Pilih batch...</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}{b.learning_courses?.title ? ` · ${b.learning_courses.title}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Judul Sesi <span className="text-red-400">*</span></label>
        <input name="title" required placeholder="Contoh: Sesi 1 — Pengenalan" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Waktu Mulai <span className="text-red-400">*</span></label>
          <input type="datetime-local" name="startTime" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Waktu Selesai <span className="text-red-400">*</span></label>
          <input type="datetime-local" name="endTime" required className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Instruktur</label>
          <input name="instructorName" placeholder="Nama instruktur..." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Link / Lokasi</label>
          <input name="locationUrl" placeholder="Zoom link / Nama gedung" className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Buat Sesi'}
      </button>
    </form>
  )
}
