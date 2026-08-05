'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { AlertCircle, Loader2 } from 'lucide-react'

export function QRScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'qr-reader'

  useEffect(() => {
    let isMounted = true
    const initScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cameras && cameras.length > 0) {
          const scanner = new Html5Qrcode(containerId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          })
          scannerRef.current = scanner
          
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              if (isMounted) {
                // Pause scanner or stop it
                scanner.stop().catch(console.error)
                onScan(decodedText)
              }
            },
            (errorMessage) => {
              // Ignore standard scan errors (e.g. no QR found in current frame)
            }
          )
          if (isMounted) setLoading(false)
        } else {
          if (isMounted) {
            setError('Kamera tidak ditemukan di perangkat Anda.')
            setLoading(false)
          }
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err?.message || String(err)
          if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
            setError('Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.')
          } else if (msg.includes('NotSupportedError')) {
            setError('Koneksi tidak aman. Kamera hanya bisa diakses menggunakan HTTPS.')
          } else {
            setError('Gagal mengakses kamera: ' + msg)
          }
          setLoading(false)
        }
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [onScan])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-400" />
          <p className="text-sm">Menyiapkan kamera...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center text-white z-20">
          <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
          <p className="font-semibold text-rose-300 mb-1">Kamera Gagal Diakses</p>
          <p className="text-sm text-gray-300 mb-6">{error}</p>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/20 transition-colors cursor-pointer"
          >
            Tutup Scanner
          </button>
        </div>
      )}

      <div id={containerId} className="w-full h-full min-h-[300px]"></div>
      
      {!error && (
        <div className="absolute bottom-4 inset-x-0 flex justify-center z-10 pointer-events-none">
          <p className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm pointer-events-auto">
            Arahkan kamera ke QR Code
          </p>
        </div>
      )}
    </div>
  )
}
