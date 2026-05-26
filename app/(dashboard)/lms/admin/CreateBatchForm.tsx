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
  const [state, action, isPending] = useActionState(createLmsBatch, {})
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

      <div>
        <div className="font-bold text-slate-900 mb-2 text-sm">Mode Pembelajaran</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'OFFLINE', label: 'Offline', icon: '🏢' },
            { value: 'ONLINE', label: 'Online', icon: '💻' },
            { value: 'HYBRID', label: 'Hybrid', icon: '🔀' },
          ] as const).map((opt) => (
            <label key={opt.value} className="cursor-pointer">
              <input type="radio" name="mode" value={opt.value} defaultChecked={opt.value === 'OFFLINE'} className="sr-only peer" />
              <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-500 transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700">
                <span className="text-lg">{opt.icon}</span>
                {opt.label}
              </div>
            </label>
          ))}
        </div>
      </div>

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

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Deskripsi Batch <span className="text-slate-400 font-normal">(opsional)</span></div>
        <textarea name="description" rows={2} placeholder="Informasi singkat tentang batch ini untuk calon peserta..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50 resize-none" />
      </label>

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1.5">Instruksi Pembayaran <span className="text-slate-400 font-normal">(opsional)</span></div>
        <textarea name="paymentInstructions" rows={3} placeholder={'Contoh:\nTransfer ke BCA 1234567890 a.n. PT Contoh\nKonfirmasi via WhatsApp ke 08xx-xxxx-xxxx'} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 bg-slate-50 resize-none text-xs" />
        <p className="mt-1 text-xs text-slate-400">Akan ditampilkan ke peserta setelah mendaftar.</p>
      </label>

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
