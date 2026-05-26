'use client'

import { useState } from 'react'
import { QrCode, X, Maximize2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function SessionQRClient({
  sessionId,
  sessionTitle,
}: {
  sessionId: string
  sessionTitle: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')

  const handleOpen = () => {
    setUrl(`${window.location.origin}/lms/attend/${sessionId}`)
    setIsOpen(true)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
      >
        <QrCode className="h-4 w-4" />
        QR Presensi
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Docking Presensi</h3>
                <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-wide">{sessionTitle}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-slate-50 p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center">
              <div className="relative rounded-[32px] border-8 border-blue-50 p-6 bg-white shadow-inner">
                <QRCodeSVG
                  value={url}
                  size={240}
                  level="H"
                  includeMargin={false}
                  className="rounded-lg"
                />
              </div>
              
              <div className="mt-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-500">
                  Scan QR Code ini untuk mencatat kehadiran Anda pada sesi <strong className="text-slate-900">{sessionTitle}</strong>
                </p>
                <p className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100">
                  {url}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 flex justify-center border-t border-slate-100">
              <button 
                onClick={() => document.documentElement.requestFullscreen()}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                Layar Penuh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
