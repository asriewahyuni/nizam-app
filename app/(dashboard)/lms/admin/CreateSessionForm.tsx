'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsSession } from '@/modules/edu/actions/lms-commercial.actions'

type Batch = { id: string; name: string; learning_courses?: { title?: string } | null }

export default function CreateSessionForm({ batches }: { batches: Batch[] }) {
  const [state, action, isPending] = useActionState(createLmsSession, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={action} className="mt-6 grid gap-5">
      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Sesi berhasil dibuat!
        </div>
      )}

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Pilih Batch</div>
        <select name="batchId" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50">
          <option value="">-- Pilih Batch --</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.learning_courses?.title})</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Judul Sesi</div>
        <input name="title" required placeholder="Contoh: Sesi 1 - Pengenalan" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Waktu Mulai</div>
          <input type="datetime-local" name="startTime" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Waktu Selesai</div>
          <input type="datetime-local" name="endTime" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Nama Instruktur</div>
          <input name="instructorName" placeholder="Contoh: Budi Santoso" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Link / Lokasi</div>
          <input name="locationUrl" placeholder="Zoom link / Nama Gedung" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Menyimpan...' : 'Buat Sesi'}
      </button>
    </form>
  )
}
