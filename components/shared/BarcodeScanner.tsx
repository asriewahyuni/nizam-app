'use client'

import React, { useEffect, useRef, useState } from "react"
import { Html5QrcodeScanner } from "html5-qrcode"
import { X, Camera } from "lucide-react"

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  title?: string
}

export const BarcodeScanner = ({ onScan, onClose, title = "Scan Barcode" }: BarcodeScannerProps) => {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
    }

    const scanner = new Html5QrcodeScanner("scanner-reader", config, false)
    scannerRef.current = scanner

    scanner.render(
      (decodedText) => {
        onScan(decodedText)
        scanner.clear()
        onClose()
      },
      (errorMessage) => {
        // Silently handle errors or show only critical ones
        // console.error(errorMessage)
      }
    )

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e))
      }
    }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Camera size={16} className="text-blue-600" /> {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div id="scanner-reader" className="overflow-hidden rounded-2xl border-4 border-slate-100" />
          
          <div className="mt-6 p-4 bg-blue-50 rounded-xl text-center">
            <p className="text-xs font-bold text-blue-600">Arahkan kamera ke Barcode produk atau kode rak (Bin).</p>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-6">
            <p className="text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded-lg">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
