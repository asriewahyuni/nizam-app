'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Loader2, Users } from 'lucide-react'
import { enrollUser } from '@/modules/lms/actions/enrollment.actions'
import { formatRupiah } from '@/lib/utils'

type Batch = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  quota: number | null
  price: number
  mode: string
  status: string
  enrolled_count: number
  waitlist_enabled: boolean
}

export default function BatchSelector({
  orgSlug,
  courseSlug,
  batches,
}: {
  orgSlug: string
  courseSlug: string
  batches: Batch[]
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRegister(batchId: string) {
    setLoading(batchId)
    setError(null)
    setMessage(null)

    const response = await enrollUser(orgSlug, courseSlug, batchId)
    setLoading(null)
    if (response.error) {
      setError(response.error)
      return
    }

    const data = response.data
    if (data?.requiresCheckout && data.checkoutUrl) {
      router.push(data.checkoutUrl)
      return
    }
    if (data?.waitlisted) {
      setMessage(`Kuota penuh. Anda masuk daftar tunggu posisi ${data.position || '-'}.`)
      return
    }
    if (data?.alreadyEnrolled) {
      setMessage('Akses kelas ini sudah aktif pada akun Anda.')
      return
    }
    setSuccess(batchId)
    setMessage('Pendaftaran berhasil dan akses kelas sudah aktif.')
    router.refresh()
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-semibold text-slate-600">
          Belum ada angkatan yang dibuka untuk kelas ini.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {message}
        </div>
      )}

      <div className="grid gap-3">
        {batches.map((batch) => {
          const isFull = Boolean(batch.quota && batch.enrolled_count >= batch.quota)
          return (
            <article
              key={batch.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-emerald-300 sm:flex-row sm:items-center"
            >
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    {batch.mode}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <CalendarDays aria-hidden="true" size={14} />
                    {batch.start_date
                      ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(batch.start_date))
                      : 'Jadwal menyusul'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-950">{batch.name}</h3>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Users aria-hidden="true" size={14} />
                  {batch.quota
                    ? `${batch.enrolled_count}/${batch.quota} peserta${isFull ? ' · daftar tunggu' : ''}`
                    : 'Kuota tidak dibatasi'}
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold text-slate-500">Investasi</p>
                  <p className="font-bold text-slate-950">
                    {batch.price > 0 ? formatRupiah(batch.price) : 'Gratis'}
                  </p>
                </div>

                {success === batch.id ? (
                  <span className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 aria-hidden="true" size={17} />
                    Terdaftar
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRegister(batch.id)}
                    disabled={loading !== null}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {loading === batch.id ? (
                      <>
                        <Loader2 aria-hidden="true" size={17} className="animate-spin motion-reduce:animate-none" />
                        Memproses
                      </>
                    ) : isFull && batch.waitlist_enabled ? 'Masuk antrean' : 'Daftar sekarang'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
