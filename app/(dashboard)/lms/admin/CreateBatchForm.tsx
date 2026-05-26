'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsBatch } from '@/modules/edu/actions/lms-commercial.actions'
import BatchStructureBuilder from './BatchStructureBuilder'
import { Monitor, Building2, GitMerge } from 'lucide-react'

type Course = {
  id: string
  slug: string
  title: string
  is_active: boolean
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

export default function CreateBatchForm({ courses }: { courses: Course[] }) {
  const [state, action, isPending] = useActionState(createLmsBatch, {})
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
          Batch berhasil disimpan.
        </div>
      )}

      {/* Course */}
      <div>
        <label className={labelCls}>Course <span className="text-red-400">*</span></label>
        <select name="courseId" required className={inputCls}>
          <option value="">Pilih course...</option>
          {courses.filter((c) => c.is_active).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {/* Nama Batch */}
      <div>
        <label className={labelCls}>Nama Batch <span className="text-red-400">*</span></label>
        <input name="name" required placeholder="Contoh: Batch 1 · Mei 2025" className={inputCls} />
      </div>

      {/* Mode */}
      <div>
        <label className={labelCls}>Mode Pembelajaran</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'OFFLINE', label: 'Offline',  Icon: Building2 },
            { value: 'ONLINE',  label: 'Online',   Icon: Monitor },
            { value: 'HYBRID',  label: 'Hybrid',   Icon: GitMerge },
          ] as const).map(({ value, label, Icon }) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="mode" value={value} defaultChecked={value === 'OFFLINE'} className="sr-only peer" />
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-xs font-semibold text-slate-500 transition-all duration-150 cursor-pointer peer-checked:border-slate-800 peer-checked:bg-slate-900 peer-checked:text-white hover:border-slate-300">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Tanggal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tanggal Mulai</label>
          <input type="date" name="startDate" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tanggal Selesai</label>
          <input type="date" name="endDate" className={inputCls} />
        </div>
      </div>

      {/* Kuota */}
      <div>
        <label className={labelCls}>Kuota Peserta</label>
        <input type="number" name="quota" min="0" defaultValue="0" className={inputCls} />
        <p className="mt-1 text-[11px] text-slate-400">Isi 0 untuk unlimited.</p>
      </div>

      {/* Deskripsi */}
      <div>
        <label className={labelCls}>Deskripsi <span className="font-normal text-slate-400">(opsional)</span></label>
        <textarea name="description" rows={2} placeholder="Informasi singkat untuk calon peserta..." className={inputCls + ' resize-none'} />
      </div>

      {/* Instruksi Pembayaran */}
      <div>
        <label className={labelCls}>Instruksi Pembayaran <span className="font-normal text-slate-400">(opsional)</span></label>
        <textarea name="paymentInstructions" rows={2} placeholder="Transfer ke BCA 123456 a.n. PT Contoh..." className={inputCls + ' resize-none'} />
      </div>

      {/* Fee & Cost Structure */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <BatchStructureBuilder />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Batch'}
      </button>
    </form>
  )
}
