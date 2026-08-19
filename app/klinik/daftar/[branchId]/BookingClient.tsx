'use client'

import { useState, useTransition } from 'react'
import { Stethoscope, CalendarDays, Clock, CheckCircle2, AlertCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvailableSlots, createBookingSlot, type KlinikAvailableSlot } from '@/modules/klinik/actions/klinik-booking.actions'
import type { KlinikPoli } from '@/modules/klinik/actions/klinik.actions'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BookingClient({
  orgId, branchId, branchName, orgName, poliList,
}: {
  orgId: string
  branchId: string
  branchName: string
  orgName: string
  poliList: KlinikPoli[]
}) {
  const [pending, startTransition] = useTransition()
  const [poliId, setPoliId] = useState(poliList[0]?.id ?? '')
  const [date, setDate] = useState(todayDateString())
  const [slots, setSlots] = useState<KlinikAvailableSlot[]>([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<KlinikAvailableSlot | null>(null)
  const [form, setForm] = useState({ nama: '', kontak: '', keluhan: '' })
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ dokter: string; waktu: string } | null>(null)

  function handleCariSlot() {
    if (!poliId) {
      setError('Pilih poli terlebih dahulu.')
      return
    }
    setError(null)
    setSelectedSlot(null)
    startTransition(async () => {
      const result = await getAvailableSlots(orgId, branchId, poliId, date)
      setSlots(result)
      setSlotsLoaded(true)
    })
  }

  function handleSubmit() {
    if (!selectedSlot) return
    if (!form.nama.trim() || !form.kontak.trim()) {
      setError('Nama dan nomor kontak wajib diisi.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createBookingSlot({
        orgId, branchId, poliId,
        stafMedisId: selectedSlot.stafMedisId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        pasienNama: form.nama,
        pasienKontak: form.kontak,
        keluhan: form.keluhan || null,
      })
      if ('error' in res) {
        setError(res.error)
        // Slot mungkin baru saja diambil orang lain — muat ulang daftar slot.
        handleCariSlot()
        return
      }
      setConfirmed({ dokter: selectedSlot.stafMedisName, waktu: `${formatDateLabel(date)}, ${formatTime(selectedSlot.startsAt)}` })
    })
  }

  if (confirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cyan-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Booking Berhasil</h1>
          <p className="mt-2 text-sm text-slate-600">
            Terima kasih, <strong>{form.nama}</strong>. Jadwal Anda dengan <strong>{confirmed.dokter}</strong> pada:
          </p>
          <p className="mt-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
            {confirmed.waktu}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Mohon datang 15 menit sebelum jadwal ke {branchName}. Simpan nomor kontak Anda ({form.kontak}) untuk verifikasi saat check-in.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cyan-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-600 text-white">
            <Stethoscope className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{orgName}</h1>
            <p className="text-sm text-slate-500">Booking Kunjungan — {branchName}</p>
          </div>
        </div>

        {error && (
          <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="booking-poli" className="text-sm font-semibold text-slate-700">Poli</label>
            <select
              id="booking-poli"
              value={poliId}
              onChange={(e) => { setPoliId(e.target.value); setSlotsLoaded(false); setSelectedSlot(null) }}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {poliList.length === 0 && <option value="">Belum ada poli tersedia</option>}
              {poliList.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="booking-date" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <CalendarDays className="size-4" aria-hidden="true" />
              Tanggal
            </label>
            <input
              id="booking-date"
              type="date"
              min={todayDateString()}
              value={date}
              onChange={(e) => { setDate(e.target.value); setSlotsLoaded(false); setSelectedSlot(null) }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <button
            type="button"
            onClick={handleCariSlot}
            disabled={pending || !poliId}
            className="w-full cursor-pointer rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            {pending && !slotsLoaded ? 'Mencari jadwal...' : 'Lihat Jadwal Tersedia'}
          </button>
        </div>

        {slotsLoaded && (
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Clock className="size-4 text-cyan-600" aria-hidden="true" />
              Jadwal Tersedia — {formatDateLabel(date)}
            </p>

            {slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Tidak ada jadwal tersedia untuk tanggal ini. Coba tanggal lain.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={`${slot.stafMedisId}-${slot.startsAt}`}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'flex flex-col items-center rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors duration-150',
                      selectedSlot?.startsAt === slot.startsAt && selectedSlot?.stafMedisId === slot.stafMedisId
                        ? 'border-cyan-600 bg-cyan-600 text-white'
                        : 'cursor-pointer border-slate-200 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'
                    )}
                  >
                    <span>{formatTime(slot.startsAt)}</span>
                    <span className="mt-0.5 truncate text-[10px] font-normal opacity-80">{slot.stafMedisName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedSlot && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <User className="size-4 text-cyan-600" aria-hidden="true" />
              Data Pasien
            </p>
            <input
              type="text"
              placeholder="Nama lengkap *"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
            <input
              type="tel"
              placeholder="Nomor WhatsApp/HP *"
              value={form.kontak}
              onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
            <textarea
              placeholder="Keluhan (opsional)"
              value={form.keluhan}
              onChange={(e) => setForm((f) => ({ ...f, keluhan: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="w-full cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              {pending ? 'Memproses...' : `Konfirmasi Booking ${formatTime(selectedSlot.startsAt)}`}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
