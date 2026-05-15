'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsBatch } from '@/modules/edu/actions/lms-commercial.actions'
import BatchStructureBuilder from './BatchStructureBuilder'

type Course = {
  id: string
  slug: string
  title: string
  is_active: boolean
}

export default function CreateBatchForm({ courses }: { courses: Course[] }) {
  const [state, action, isPending] = useActionState(createLmsBatch, null)
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
          Batch berhasil disimpan!
        </div>
      )}

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Pilih Course</div>
        <select name="courseId" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50">
          <option value="">-- Pilih Course --</option>
          {courses.filter((c) => c.is_active).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Nama Batch</div>
        <input name="name" required placeholder="Contoh: Batch 1 - 2024" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Tanggal Mulai</div>
          <input type="date" name="startDate" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Tanggal Selesai</div>
          <input type="date" name="endDate" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Kuota (0 = Unlimited)</div>
          <input type="number" name="quota" min="0" defaultValue="0" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50" />
        </label>
      </div>

      <div className="pt-2">
        <BatchStructureBuilder />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex justify-center rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 shadow-xl shadow-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Batch'}
      </button>
    </form>
  )
}
