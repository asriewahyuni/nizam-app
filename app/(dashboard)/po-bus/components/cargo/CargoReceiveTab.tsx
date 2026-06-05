'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Inbox, ScanBarcode, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { processCargoArrivalByBarcode } from '@/modules/po-bus/actions/cargo.actions'

export function CargoReceiveTab({
  orgId,
  shipments,
  onRefresh
}: {
  orgId: string
  shipments: any[]
  onRefresh: () => void
}) {
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // Tampilkan paket yang statusnya MANIFESTED atau IN_TRANSIT, artinya yang harusnya segera tiba
  const incomingPackages = shipments.filter(s => s.status === 'MANIFESTED' || s.status === 'IN_TRANSIT')
  const arrivedToday = shipments.filter(s => s.status === 'ARRIVED' && new Date(s.updated_at).toDateString() === new Date().toDateString())

  useEffect(() => {
    if (isScanning) {
      const html5QrCode = new Html5Qrcode("receive-reader")
      scannerRef.current = html5QrCode
      
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        async (decodedText) => {
           if (!loading) {
              await handleScan(decodedText)
           }
        },
        () => {}
      ).catch(err => {
        console.warn(err)
        alert("Kamera tidak dapat diakses.")
        setIsScanning(false)
      })
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [isScanning])

  const handleScan = async (trackingNumber: string) => {
    if (loading) return
    
    setLoading(true)
    const res = await processCargoArrivalByBarcode(orgId, trackingNumber)
    
    if (res.error) {
       alert(res.error)
    } else {
       onRefresh()
    }
    
    setTimeout(() => setLoading(false), 1500)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Sisi Kiri: Scanner */}
      <div className="space-y-6">
         <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <ScanBarcode className="text-blue-600" /> Penerimaan Kargo (Unloading)
               </h3>
               <p className="text-sm text-slate-500 font-medium mt-1">Scan paket yang baru turun dari bus untuk mengubah statusnya menjadi Tiba (Arrived).</p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              {!isScanning ? (
                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-full flex items-center justify-center gap-2 py-6 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all text-lg"
                >
                  <ScanBarcode size={24} /> Buka Scanner Penerimaan
                </button>
              ) : (
                <div className="space-y-4">
                   <div className="overflow-hidden rounded-2xl border-2 border-emerald-500 p-1">
                      <div id="receive-reader" className="w-full min-h-[300px] bg-slate-900 rounded-xl overflow-hidden"></div>
                   </div>
                   
                   {loading && (
                     <div className="p-4 bg-amber-50 text-amber-600 rounded-xl font-bold text-center animate-pulse">
                       Memproses Barcode...
                     </div>
                   )}

                   <button 
                     onClick={() => setIsScanning(false)}
                     className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all"
                   >
                     Tutup Scanner
                   </button>
                </div>
              )}
            </div>
         </div>
      </div>

      {/* Sisi Kanan: Daftar Paket */}
      <div className="space-y-6">
         <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[500px] flex flex-col gap-6">
            
            <div>
               <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-4">
                  <CheckCircle2 size={20} className="text-emerald-500" /> Tiba Hari Ini
               </h3>
               <div className="space-y-3">
                 {arrivedToday.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs font-bold text-slate-400">Belum ada paket tiba.</div>
                 ) : (
                    arrivedToday.map(pkg => (
                      <div key={pkg.id} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">{pkg.tracking_number}</span>
                            <span className="text-[10px] font-bold text-emerald-600">BERHASIL DITERIMA</span>
                         </div>
                         <div className="flex gap-2 w-full mt-1">
                           <a 
                              href={`/track?awb=${pkg.tracking_number}`}
                              target="_blank"
                              className="flex-[1] bg-emerald-100 text-emerald-700 font-bold py-2 rounded-lg text-[10px] flex items-center justify-center gap-1 hover:bg-emerald-200 active:scale-[0.98] transition-all"
                           >
                             Lacak
                           </a>
                           <a 
                              href={`https://wa.me/${pkg.receiver_phone}?text=Halo%20${encodeURIComponent(pkg.receiver_name)}%2C%20paket%20Anda%20dengan%20resi%20*${pkg.tracking_number}*%20telah%20tiba%20di%20${encodeURIComponent(pkg.destination?.location_name || 'Terminal Tujuan')}.%20Silakan%20ambil%20dengan%20membawa%20KTP.%0A%0ACek%20status%20paket:%20${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/track?awb=' + pkg.tracking_number)}%0A%0ATerima%20kasih.`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-[2] bg-emerald-600 text-white font-bold py-2 rounded-lg text-[10px] flex items-center justify-center gap-1 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                           >
                             Kirim WA Penerima
                           </a>
                         </div>
                      </div>
                    ))
                 )}
               </div>
            </div>

            <div className="flex-1">
               <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-4 pt-4 border-t border-slate-100">
                  <AlertTriangle size={20} className="text-amber-500" /> Sedang Menuju Ke Sini
               </h3>
               <div className="space-y-3">
                 {incomingPackages.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs font-bold text-slate-400">Tidak ada paket masuk.</div>
                 ) : (
                    incomingPackages.map(pkg => (
                      <div key={pkg.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                         <div>
                            <p className="text-xs font-black text-slate-700">{pkg.tracking_number}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Asal: {pkg.origin?.location_name}</p>
                         </div>
                         <span className="px-2 py-1 text-[9px] font-bold bg-amber-100 text-amber-700 rounded uppercase">
                           {pkg.status}
                         </span>
                      </div>
                    ))
                 )}
               </div>
            </div>

         </div>
      </div>

    </div>
  )
}
