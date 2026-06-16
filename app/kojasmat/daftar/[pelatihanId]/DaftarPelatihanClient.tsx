'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { HandCoins, Calendar, MapPin, Users, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { daftarMandiriPelatihan, type PelatihanPublik } from '@/modules/kojasmat/actions/kojasmat.actions'

type State = 'idle' | 'success' | 'already' | 'error'

export default function DaftarPelatihanClient({ pelatihan }: { pelatihan: PelatihanPublik }) {
  const [kode, setKode] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const penuh = pelatihan.peserta_count >= pelatihan.kuota
  const ditutup = pelatihan.status !== 'TERJADWAL'

  function handleDaftar(e: React.FormEvent) {
    e.preventDefault()
    if (!kode.trim()) return
    setState('idle')
    startTransition(async () => {
      const res = await daftarMandiriPelatihan({
        pelatihan_id: pelatihan.id,
        kode_anggota: kode.trim().toUpperCase(),
      })
      if (res.success) {
        setState('success')
      } else if (res.sudah_terdaftar) {
        setState('already')
      } else {
        setState('error')
        setErrMsg(res.error ?? 'Terjadi kesalahan, coba lagi.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <HandCoins className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-emerald-600 mb-1">Pendaftaran Pelatihan</p>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{pelatihan.judul}</h1>
        </div>

        {/* Info card */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 text-sm text-gray-600">
            <Calendar className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{new Date(pelatihan.tanggal).toLocaleDateString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}</span>
          </div>
          {pelatihan.instruktur && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <User className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Instruktur: {pelatihan.instruktur}</span>
            </div>
          )}
          {pelatihan.lokasi && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{pelatihan.lokasi}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm">
            <Users className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className={cn(penuh ? 'text-red-600 font-medium' : 'text-gray-600')}>
              {pelatihan.peserta_count}/{pelatihan.kuota} peserta
              {penuh && ' — Kuota Penuh'}
            </span>
          </div>
          {pelatihan.deskripsi && (
            <p className="pt-1 text-sm text-gray-500 border-t border-gray-100">{pelatihan.deskripsi}</p>
          )}
        </div>

        {/* States */}
        {state === 'success' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h2 className="text-lg font-bold text-emerald-800">Pendaftaran Berhasil!</h2>
            <p className="mt-1 text-sm text-emerald-700">
              Anda telah terdaftar sebagai peserta pelatihan ini. Harap hadir tepat waktu.
            </p>
          </div>
        )}

        {state === 'already' && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-blue-500" />
            <h2 className="text-lg font-bold text-blue-800">Sudah Terdaftar</h2>
            <p className="mt-1 text-sm text-blue-700">
              Kode anggota ini sudah terdaftar pada pelatihan ini.
            </p>
          </div>
        )}

        {(state === 'idle' || state === 'error') && !ditutup && !penuh && (
          <form onSubmit={handleDaftar} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Kode Anggota
              </label>
              <input
                type="text"
                value={kode}
                onChange={e => setKode(e.target.value)}
                placeholder="Contoh: KJM-001"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm uppercase tracking-wide outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors"
                disabled={pending}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Masukkan kode anggota koperasi Anda
              </p>
            </div>

            {state === 'error' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!kode.trim() || pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : 'Daftar Sekarang'}
            </button>
          </form>
        )}

        {(ditutup || penuh) && state === 'idle' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-bold text-amber-800">
              {ditutup ? 'Pendaftaran Ditutup' : 'Kuota Penuh'}
            </h2>
            <p className="mt-1 text-sm text-amber-700">
              {ditutup
                ? 'Pelatihan ini tidak lagi menerima pendaftar baru.'
                : 'Kuota pelatihan ini sudah penuh. Silakan hubungi pengurus koperasi.'}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Didukung oleh Sistem Koperasi Digital
        </p>
      </div>
    </div>
  )
}
