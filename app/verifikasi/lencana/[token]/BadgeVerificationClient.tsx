'use client'

/**
 * QR lencana dibuat di browser agar selalu mengarah ke origin yang sedang aktif.
 */
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function BadgeVerificationClient({ token }: { token: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => setUrl(`${window.location.origin}/verifikasi/lencana/${token}`), [token])
  return (
    <div className="flex size-40 items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
      {url ? (
        <QRCodeSVG value={url} size={128} level="M" />
      ) : (
        <div className="size-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      )}
    </div>
  )
}
