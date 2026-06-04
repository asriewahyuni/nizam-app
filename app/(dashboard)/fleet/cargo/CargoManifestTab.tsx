'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Truck, ScanBarcode, CheckCircle2, ChevronRight, MapPin } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { assignCargoToScheduleByBarcode } from '@/modules/fleet/actions/cargo.actions'
import { printManifest } from '@/lib/print-helper'

export function CargoManifestTab({
  orgId,
  schedules,
  shipments,
  onRefresh
}: {
  orgId: string
  schedules: any[]
  shipments: any[]
  onRefresh: () => void
}) {
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId)
  
  // Dapatkan paket yang sudah masuk ke jadwal ini
  const manifestedPackages = shipments.filter(s => s.schedule_id === selectedScheduleId)

  useEffect(() => {
    if (isScanning && selectedScheduleId) {
      const html5QrCode = new Html5Qrcode("manifest-reader")
      scannerRef.current = html5QrCode
      
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } }, // Lebih lebar untuk barcode
        async (decodedText) => {
           // Mencegah scan ganda beruntun
           if (!loading) {
              await handleScan(decodedText)
           }
        },
        () => {} // abaikan error frame scanner
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
  }, [isScanning, selectedScheduleId])

  const handleScan = async (trackingNumber: string) => {
    if (!selectedScheduleId || loading) return
    
    setLoading(true)
    const res = await assignCargoToScheduleByBarcode(orgId, trackingNumber, selectedScheduleId)
    
    if (res.error) {
       // Bip error
       alert(res.error)
    } else {
       // Bip sukses otomatis reload UI
       onRefresh()
    }
    
    // Delay sedikit agar tidak scan dobel langsung
    setTimeout(() => {
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Sisi Kiri: Scanner */}
      <div className="space-y-6">
         <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <ScanBarcode className="text-blue-600" /> Loading & Manifest
               </h3>
               <p className="text-sm text-slate-500 font-medium mt-1">Pilih jadwal bus, lalu tembak barcode paket.</p>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jadwal Keberangkatan (Bus)</label>
                  <select 
                    value={selectedScheduleId}
                    onChange={(e) => {
                      setSelectedScheduleId(e.target.value)
                      setIsScanning(false)
                    }}
                    className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">-- Pilih Jadwal --</option>
                    {schedules.map(sc => (
                      <option key={sc.id} value={sc.id}>
                        {sc.route?.name} • {sc.asset?.plate_number} ({new Date(sc.departure_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})})
                      </option>
                    ))}
                  </select>
               </div>
               
               {selectedScheduleId && (
                 <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-between">
                    <span>Siap meloading ke bus {selectedSchedule?.asset?.plate_number}</span>
                 </div>
               )}
            </div>

            {selectedScheduleId && (
               <div className="pt-4 border-t border-slate-100">
                 {!isScanning ? (
                   <button 
                     onClick={() => setIsScanning(true)}
                     className="w-full flex items-center justify-center gap-2 py-6 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all text-lg"
                   >
                     <ScanBarcode size={24} /> Buka Scanner
                   </button>
                 ) : (
                   <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border-2 border-blue-500 p-1">
                         <div id="manifest-reader" className="w-full min-h-[300px] bg-slate-900 rounded-xl overflow-hidden"></div>
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
            )}
         </div>
      </div>

      {/* Sisi Kanan: Daftar Paket yang Masuk */}
      <div className="space-y-6">
         <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[500px]">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
               <Truck size={20} className="text-slate-400" /> Kargo di Dalam Bus
            </h3>

            {!selectedScheduleId ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-2xl">
                 <p className="text-sm font-bold text-slate-400 italic">Pilih jadwal di sebelah kiri untuk melihat manifest.</p>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex gap-4">
                       <div className="text-xs font-bold text-slate-500 uppercase">Total: {manifestedPackages.length} Paket</div>
                       <div className="text-xs font-bold text-slate-500 uppercase">Berat: {manifestedPackages.reduce((acc, p) => acc + (p.weight_kg || 0), 0)} Kg</div>
                    </div>
                    {manifestedPackages.length > 0 && (
                       <button 
                         onClick={() => printManifest(selectedSchedule, manifestedPackages)}
                         className="px-4 py-2 bg-slate-900 text-white font-bold text-[10px] rounded-lg uppercase tracking-widest hover:bg-slate-800 transition-all"
                       >
                         Cetak Surat Jalan
                       </button>
                    )}
                 </div>

                 {manifestedPackages.length === 0 ? (
                   <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-sm font-bold text-slate-400 italic">Bagasi kosong.</p>
                   </div>
                 ) : (
                   manifestedPackages.map(pkg => (
                     <div key={pkg.id} className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                        <div>
                           <div className="flex items-center gap-2">
                             <CheckCircle2 size={16} className="text-emerald-500" />
                             <p className="text-xs font-black text-slate-900 font-mono tracking-wider">{pkg.tracking_number}</p>
                           </div>
                           <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 pl-6">
                              {pkg.origin?.location_name} <ChevronRight size={10} className="inline mx-0.5 text-slate-300" /> {pkg.destination?.location_name}
                           </p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-bold text-slate-700">{pkg.weight_kg} Kg</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{pkg.item_description}</p>
                        </div>
                     </div>
                   ))
                 )}
              </div>
            )}
         </div>
      </div>

    </div>
  )
}
