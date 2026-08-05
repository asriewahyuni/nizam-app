'use client'

import React, { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { X, Camera, Loader2 } from "lucide-react"

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  title?: string
  hintText?: string
}

export const BarcodeScanner = ({ 
  onScan, 
  onClose, 
  title = "Scan QR / Barcode",
  hintText = "Arahkan kamera ke Barcode atau QR Code." 
}: BarcodeScannerProps) => {
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isComponentMounted = useRef(true)

  useEffect(() => {
    isComponentMounted.current = true

    const startScanner = async () => {
      try {
        const hasPermissions = await Html5Qrcode.getCameras()
        if (!isComponentMounted.current) return
        
        if (hasPermissions && hasPermissions.length > 0) {
          setHasCameraPermission(true)
          
          const scanner = new Html5Qrcode("nizam-scanner-reader")
          scannerRef.current = scanner
          
          setIsInitializing(false)

          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              if (isComponentMounted.current) {
                onScan(decodedText)
                if (scannerRef.current?.isScanning) {
                  scannerRef.current.stop().catch(console.error)
                }
                onClose()
              }
            },
            (errorMessage) => {
              // ignore scan errors
            }
          )
        } else {
          setHasCameraPermission(false)
          setError("Kamera tidak ditemukan di perangkat ini.")
          setIsInitializing(false)
        }
      } catch (err: any) {
        if (!isComponentMounted.current) return
        setHasCameraPermission(false)
        setError("Izin kamera ditolak atau kamera sedang digunakan aplikasi lain. Silakan izinkan akses kamera di browser Anda.")
        setIsInitializing(false)
      }
    }

    startScanner()

    return () => {
      isComponentMounted.current = false
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.error("Failed to stop scanner", e))
      }
    }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Camera size={16} className="text-blue-600" /> {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="relative overflow-hidden rounded-2xl border-4 border-slate-100 bg-slate-900 aspect-square flex items-center justify-center">
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 z-10">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                <p className="text-xs font-medium">Mempersiapkan kamera...</p>
              </div>
            )}
            
            {!isInitializing && hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 z-10 p-6 text-center">
                <Camera className="w-10 h-10 mb-3 text-rose-500 opacity-50" />
                <p className="text-sm font-medium text-white mb-1">Akses Kamera Ditolak</p>
                <p className="text-xs">Izinkan akses kamera di pengaturan browser untuk menggunakan fitur ini.</p>
              </div>
            )}

            <div id="nizam-scanner-reader" className="w-full h-full [&>video]:object-cover" />
            
            {hasCameraPermission && !isInitializing && (
              <div className="absolute inset-0 border-2 border-blue-500/50 rounded-xl m-8 shadow-[0_0_0_4000px_rgba(0,0,0,0.4)] pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br" />
              </div>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-xl text-center border border-blue-100">
            <p className="text-xs font-bold text-blue-700">{hintText}</p>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-6">
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex gap-3">
              <div className="flex-1">
                <p className="text-[11px] text-rose-700 font-medium leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
