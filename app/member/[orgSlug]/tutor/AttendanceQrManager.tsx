'use client'

/**
 * Pembuat QR kehadiran untuk sesi yang boleh dikelola tutor atau admin.
 */
import { useState, useTransition } from 'react'
import { Check, Clipboard, LoaderCircle, QrCode, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createAttendanceQrToken } from '@/modules/lms/actions/attendance.actions'

export default function AttendanceQrManager({
  orgSlug,
  sessionId,
  tokenActiveUntil,
}: {
  orgSlug: string
  sessionId: string
  tokenActiveUntil: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [validityMinutes, setValidityMinutes] = useState(120)
  const [checkInUrl, setCheckInUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState(tokenActiveUntil)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function generate() {
    setError('')
    setCopied(false)
    startTransition(async () => {
      const response = await createAttendanceQrToken(orgSlug, sessionId, validityMinutes)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      setCheckInUrl(response.checkInUrl || '')
      setExpiresAt(response.expiresAt || null)
    })
  }

  async function copyLink() {
    if (!checkInUrl) return
    try {
      await navigator.clipboard.writeText(checkInUrl)
      setCopied(true)
    } catch {
      setError('Tautan tidak dapat disalin otomatis. Silakan salin dari kolom tautan.')
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {!checkInUrl ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Masa aktif QR
            </span>
            <select
              value={validityMinutes}
              onChange={(event) => setValidityMinutes(Number(event.target.value))}
              className="mt-1 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            >
              <option value={30}>30 menit</option>
              <option value={60}>1 jam</option>
              <option value={120}>2 jam</option>
              <option value={360}>6 jam</option>
              <option value={1440}>24 jam</option>
            </select>
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending
              ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              : <QrCode aria-hidden="true" size={18} />}
            {expiresAt ? 'Buat QR baru' : 'Buat QR'}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <QRCodeSVG
              value={checkInUrl}
              size={190}
              level="H"
              marginSize={1}
              title="QR check-in kehadiran"
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-emerald-950">QR siap dipindai peserta</p>
            {expiresAt && (
              <p className="mt-1 text-sm text-slate-600">
                Aktif sampai {new Date(expiresAt).toLocaleString('id-ID')}
              </p>
            )}
            <label className="mt-3 block">
              <span className="sr-only">Tautan check-in</span>
              <input
                value={checkInUrl}
                readOnly
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                {copied
                  ? <Check aria-hidden="true" size={18} />
                  : <Clipboard aria-hidden="true" size={18} />}
                {copied ? 'Tersalin' : 'Salin tautan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckInUrl('')
                  setCopied(false)
                }}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-bold text-emerald-800 transition-colors duration-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                <RefreshCw aria-hidden="true" size={18} />
                Atur ulang
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
