'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, CheckCircle2 } from 'lucide-react'
import { createLmsRegistration } from '@/modules/edu/actions/lms-registration.actions'
import { formatRupiah } from '@/lib/utils'

export default function BatchSelector({ 
  orgSlug, 
  courseSlug, 
  batches 
}: { 
  orgSlug: string, 
  courseSlug: string, 
  batches: any[] 
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async (batchId: string) => {
    setLoading(batchId)
    setError(null)
    
    // Create form data 
    const fd = new FormData()
    fd.append('batchId', batchId)
    // We pass placeholder fullName and email, because the server now overrides with logged-in user
    fd.append('fullName', 'Peserta Terdaftar')
    fd.append('email', 'peserta@internal.com')

    const res = await createLmsRegistration(null, fd)
    
    if (res.error) {
      setError(res.error)
      setLoading(null)
    } else {
      setSuccess(batchId)
      setLoading(null)
      alert('Pendaftaran Berhasil! Silakan hubungi admin untuk konfirmasi pembayaran/akses.')
      router.refresh()
    }
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">Belum ada jadwal angkatan (Batch) yang dibuka untuk kelas ini.</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {error && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100">{error}</div>}
      
      <div className="grid gap-3">
        {batches.map((b) => (
          <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors shadow-sm gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {b.mode}
                </span>
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                  <CalendarDays size={12} />
                  {b.start_date ? new Date(b.start_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : 'Segera'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{b.name}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Kuota: {b.quota === 0 ? 'Tidak Terbatas' : b.quota}
              </p>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Investasi</p>
                <p className="font-bold text-slate-800">{b.price > 0 ? formatRupiah(b.price) : 'GRATIS'}</p>
              </div>
              
              {success === b.id ? (
                <div className="px-5 py-2.5 bg-emerald-50 text-emerald-600 font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 text-sm">
                  <CheckCircle2 size={16} /> Terdaftar
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRegister(b.id)}
                  disabled={loading !== null}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  {loading === b.id ? <Loader2 size={16} className="animate-spin" /> : 'Daftar Sekarang'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
