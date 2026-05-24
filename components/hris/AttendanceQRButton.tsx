'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, X, RefreshCcw, Download } from 'lucide-react'

interface AttendanceQRButtonProps {
  orgId: string
  branchId: string
  branchName: string
}

export function AttendanceQRButton({ orgId, branchId, branchName }: AttendanceQRButtonProps) {
  const [open, setOpen] = useState(false)
  const [scanUrl, setScanUrl] = useState('')
  const [now, setNow] = useState('')

  const build = () => {
    setScanUrl(`${window.location.origin}/presensi/scan/${orgId}/${branchId}`)
    setNow(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    )
  }

  const handleOpen = () => {
    build()
    setOpen(true)
  }

  // Live clock refresh every minute
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      setNow(
        new Date().toLocaleDateString('id-ID', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      )
    }, 60_000)
    return () => clearInterval(id)
  }, [open])

  const handleDownload = () => {
    const svg = document.querySelector('#attendance-qr-svg') as SVGElement | null
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `QR-Presensi-${branchName}-${new Date().toISOString().split('T')[0]}.svg`
    a.click()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-all cursor-pointer"
      >
        <QrCode size={13} />
        QR Presensi
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm rounded-[36px] bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">QR Presensi</p>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">{branchName}</h3>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{now}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* QR Area */}
            <div className="px-7 py-7 flex flex-col items-center gap-5">
              {scanUrl && (
                <div className="rounded-[28px] border-8 border-slate-50 bg-white shadow-inner p-4">
                  <QRCodeSVG
                    id="attendance-qr-svg"
                    value={scanUrl}
                    size={220}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              )}

              {/* Instructions */}
              <div className="text-center space-y-1.5">
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Cara Presensi</p>
                <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                  Arahkan kamera HP ke QR ini.<br />
                  Scan = <span className="font-black text-emerald-600">Clock In</span> jika belum masuk,{' '}
                  atau <span className="font-black text-sky-600">Clock Out</span> jika sudah.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={build}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <RefreshCcw size={12} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <Download size={12} />
                  Unduh QR
                </button>
              </div>
            </div>

            {/* Bottom strip */}
            <div className="px-7 pb-7">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  QR aktif untuk hari ini · otomatis IN/OUT
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
