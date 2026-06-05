'use client'

import React, { useState, useRef } from 'react'
import { Plus, Printer, Save, Package, QrCode, User, Navigation, CreditCard, ChevronRight, X, History, FileText, Search } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createCargoShipment } from '@/modules/po-bus/actions/cargo.actions'
import { printSticker, printShiftClosing } from '@/lib/print-helper'

export function CargoPosTab({
  orgId,
  terminals,
  shipments,
  tariffs = [],
  onRefresh
}: {
  orgId: string
  terminals: any[]
  shipments: any[]
  tariffs?: any[]
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  
  // State for detail modal
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null)
  
  // States for calculator
  const [weight, setWeight] = useState(1)
  const [volume, setVolume] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)
  const [handlingFee, setHandlingFee] = useState(0)
  const [originId, setOriginId] = useState('')
  const [destId, setDestId] = useState('')

  const grandTotal = shippingCost + handlingFee

  const calculateCost = (w: number, v: number, o: string, d: string) => {
    const tariff = tariffs?.find(t => t.origin_terminal_id === o && t.destination_terminal_id === d)
    if (!tariff) {
      setShippingCost(0) // Belum ada tarif atau belum dipilih
      return
    }

    let cost = Number(tariff.base_price)
    
    // Perhitungan tambahan per kg (misal free 1kg pertama)
    if (w > 1) {
       cost += (w - 1) * Number(tariff.price_per_kg)
    }

    // Perhitungan tambahan per m3 (jika ada)
    if (v > 0 && tariff.price_per_m3 > 0) {
       cost += v * Number(tariff.price_per_m3)
    }

    setShippingCost(cost)
  }

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) || 0
    setWeight(val)
    calculateCost(val, volume, originId, destId)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) || 0
    setVolume(val)
    calculateCost(weight, val, originId, destId)
  }

  const handleOriginChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOriginId(e.target.value)
    calculateCost(weight, volume, e.target.value, destId)
  }

  const handleDestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDestId(e.target.value)
    calculateCost(weight, volume, originId, e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    formData.append('weight_kg', weight.toString())
    formData.append('volume_m3', volume.toString())
    formData.append('shipping_cost', shippingCost.toString())
    formData.append('handling_fee', handlingFee.toString())
    formData.append('grand_total', grandTotal.toString())
    
    const res = await createCargoShipment(orgId, formData)
    
    if (res.error) {
      alert(res.error)
    } else {
      alert(`Berhasil! Nomor Resi: ${res.trackingNumber}`)
      formRef.current?.reset()
      onRefresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 pb-24 md:pb-0 relative">
      
      {/* Modal Detail */}
      {selectedShipment && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
               <div>
                 <h3 className="font-bold text-lg">Detail Resi</h3>
                 <p className="text-blue-200 text-xs font-mono">{selectedShipment.tracking_number}</p>
               </div>
               <button onClick={() => setSelectedShipment(null)} className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                 <X size={18} />
               </button>
            </div>
            
            <div className="p-6 space-y-4">
               <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="text-center w-1/2">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Asal</p>
                     <p className="font-bold text-slate-800">{selectedShipment.origin?.location_name || '-'}</p>
                  </div>
                  <ChevronRight className="text-slate-300" />
                  <div className="text-center w-1/2">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Tujuan</p>
                     <p className="font-bold text-slate-800">{selectedShipment.destination?.location_name || '-'}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pengirim</p>
                    <p className="font-semibold text-sm text-slate-800">{selectedShipment.sender_name}</p>
                    <p className="text-xs text-slate-500">{selectedShipment.sender_phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Penerima</p>
                    <p className="font-semibold text-sm text-slate-800">{selectedShipment.receiver_name}</p>
                    <p className="text-xs text-slate-500">{selectedShipment.receiver_phone}</p>
                  </div>
               </div>

               <div className="pb-4 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Isi Paket</p>
                  <p className="text-sm font-medium text-slate-700">{selectedShipment.item_description || '-'}</p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Berat: {selectedShipment.weight_kg} Kg</span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Volume: {selectedShipment.volume_m3} m³</span>
                  </div>
               </div>

               <div className="flex justify-between items-center">
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Biaya & Pembayaran</p>
                   <p className="font-black text-lg text-slate-800">{formatRupiah(selectedShipment.grand_total)}</p>
                 </div>
                 <span className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase ${selectedShipment.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {selectedShipment.payment_status}
                 </span>
               </div>

               <div className="flex flex-col gap-2 w-full mt-4">
                 <div className="flex gap-2">
                   <button 
                      onClick={() => printSticker(selectedShipment)}
                      className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all"
                   >
                     <Printer size={18} /> Cetak Stiker
                   </button>
                   <a 
                      href={`/track?awb=${selectedShipment.tracking_number}`}
                      target="_blank"
                      className="flex-1 bg-blue-50 text-blue-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 active:scale-[0.98] transition-all"
                   >
                     <Search size={18} /> Lacak Kargo
                   </a>
                 </div>
                 <div className="flex gap-2">
                   <a 
                      href={`https://wa.me/${selectedShipment.sender_phone}?text=Halo%20${encodeURIComponent(selectedShipment.sender_name)}%2C%20paket%20Anda%20dengan%20resi%20*${selectedShipment.tracking_number}*%20telah%20kami%20terima%20dan%20sedang%20diproses.%0A%0ACek%20status%20paket:%20${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/track?awb=' + selectedShipment.tracking_number)}%0A%0ATerima%20kasih.`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-emerald-50 text-emerald-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 active:scale-[0.98] transition-all"
                   >
                     WA Pengirim
                   </a>
                   <a 
                      href={`https://wa.me/${selectedShipment.receiver_phone}?text=Halo%20${encodeURIComponent(selectedShipment.receiver_name)}%2C%20paket%20Anda%20dengan%20resi%20*${selectedShipment.tracking_number}*%20sedang%20dalam%20perjalanan.%20Siapkan%20KTP%20saat%20pengambilan.%0A%0ACek%20status%20paket:%20${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/track?awb=' + selectedShipment.tracking_number)}%0A%0ATerima%20kasih.`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-emerald-50 text-emerald-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 active:scale-[0.98] transition-all"
                   >
                     WA Penerima
                   </a>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* KIRI: Form Input (Mobile App View) */}
      <div className="w-full md:flex-1 space-y-4">
        
        {/* Fitur Cepat Khusus Staff */}
        <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-200">
           <div className="flex items-center justify-between mb-4">
             <div>
                <h3 className="text-xl font-bold tracking-tight">Kirim Kargo</h3>
                <p className="text-blue-200 text-sm font-medium">Buat resi baru</p>
             </div>
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Package className="text-white w-6 h-6" />
             </div>
           </div>
           
           <button type="button" className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl flex justify-center items-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all">
              <QrCode className="w-5 h-5" /> Scan Barcode / KTP Pelanggan
           </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" id="cargoPosForm">
           
           {/* Input Barcode Manual */}
           <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase">No. Resi (Opsional)</label>
                 <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">AUTO</span>
              </div>
              <input name="tracking_number" type="text" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-2xl text-base font-bold tracking-widest uppercase focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case" placeholder="Biarkan kosong untuk auto-generate" />
           </div>

           {/* Section Pengirim */}
           <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <User size={16} strokeWidth={3} />
                 </div>
                 <h4 className="font-bold text-slate-800">Detail Pengirim</h4>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Pengirim</label>
                    <input name="sender_name" required type="text" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-amber-100 outline-none transition-all" placeholder="Mis: Budi Santoso" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">No WhatsApp</label>
                    <input name="sender_phone" required type="tel" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-amber-100 outline-none transition-all" placeholder="0812..." />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Terminal Asal</label>
                    <div className="relative">
                       <select name="origin_terminal_id" value={originId} onChange={handleOriginChange} required className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-amber-100 outline-none transition-all appearance-none cursor-pointer">
                         <option value="">Pilih terminal asal</option>
                         {terminals.map(t => <option key={t.id} value={t.id}>{t.name} ({t.location_name || '-'})</option>)}
                       </select>
                       <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                    </div>
                 </div>
              </div>
           </div>

           {/* Section Penerima */}
           <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Navigation size={16} strokeWidth={3} />
                 </div>
                 <h4 className="font-bold text-slate-800">Detail Penerima</h4>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Penerima</label>
                    <input name="receiver_name" required type="text" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-emerald-100 outline-none transition-all" placeholder="Mis: Rina" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">No WhatsApp</label>
                    <input name="receiver_phone" required type="tel" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-emerald-100 outline-none transition-all" placeholder="0856..." />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Terminal Tujuan</label>
                    <div className="relative">
                       <select name="destination_terminal_id" value={destId} onChange={handleDestChange} required className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none cursor-pointer">
                         <option value="">Pilih terminal tujuan</option>
                         {terminals.map(t => <option key={t.id} value={t.id}>{t.name} ({t.location_name || '-'})</option>)}
                       </select>
                       <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                    </div>
                 </div>
              </div>
           </div>

           {/* Section Paket & Biaya */}
           <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                    <Package size={16} strokeWidth={3} />
                 </div>
                 <h4 className="font-bold text-slate-800">Data Barang & Biaya</h4>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Isi Paket</label>
                    <input name="item_description" required type="text" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-400 rounded-2xl text-base font-semibold focus:ring-4 focus:ring-purple-100 outline-none transition-all" placeholder="Deskripsikan barang..." />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Berat (Kg)</label>
                       <input type="number" min="0.1" step="0.1" value={weight} onChange={handleWeightChange} className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-400 rounded-2xl text-xl text-center font-black focus:ring-4 focus:ring-purple-100 outline-none transition-all" />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volume (m³)</label>
                       <input type="number" min="0" step="0.01" value={volume} onChange={handleVolumeChange} className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-purple-400 rounded-2xl text-xl text-center font-black focus:ring-4 focus:ring-purple-100 outline-none transition-all" />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4 pt-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jumlah Koli</label>
                       <input name="koli_count" type="number" min="1" step="1" defaultValue="1" className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-2xl text-xl text-center font-black focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Metode Pembayaran</label>
                    <div className="grid grid-cols-2 gap-3">
                       <label className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border-2 border-transparent cursor-pointer transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700">
                          <input type="radio" name="payment_status" value="PAID" className="sr-only" defaultChecked />
                          <CreditCard className="w-6 h-6" />
                          <span className="text-sm font-bold">LUNAS</span>
                       </label>

                       <label className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border-2 border-transparent cursor-pointer transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700">
                          <input type="radio" name="payment_status" value="UNPAID" className="sr-only" />
                          <CreditCard className="w-6 h-6 opacity-50" />
                          <span className="text-sm font-bold">BAYAR TUJUAN</span>
                       </label>
                    </div>
                 </div>
              </div>
           </div>
        </form>
      </div>

      {/* KANAN: Daftar Resi Hari Ini (Side panel on Desktop) */}
      <div className="w-full md:w-80 lg:w-96">
         <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:sticky md:top-6">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <History className="text-emerald-600" /> Resi Hari Ini
               </h3>
               <button 
                  onClick={() => printShiftClosing(shipments)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98]"
               >
                 <FileText size={14} /> Cetak Rekap Shift
               </button>
            </div>

            <div className="space-y-3">
               {shipments.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length === 0 ? (
                 <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-sm font-bold text-slate-400">Belum ada paket.</p>
                 </div>
               ) : (
                 shipments.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).map(shipment => (
                   <div 
                     key={shipment.id} 
                     onClick={() => setSelectedShipment(shipment)}
                     className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-300 active:scale-95 transition-all group"
                   >
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="text-sm font-black text-blue-600 tracking-wider">{shipment.tracking_number}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                               {shipment.destination?.location_name || shipment.destination?.name}
                            </p>
                         </div>
                         <span className={`px-2 py-1 text-[9px] font-bold rounded-lg uppercase ${shipment.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                           {shipment.payment_status}
                         </span>
                      </div>
                      <div className="flex justify-between items-end">
                         <div className="text-sm font-black text-slate-800">
                            {formatRupiah(shipment.grand_total)}
                         </div>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation() // Prevent opening modal when just clicking print
                             printSticker(shipment)
                           }}
                           className="text-[10px] font-bold text-slate-600 bg-white shadow-sm px-3 py-2 rounded-xl flex items-center gap-1 active:bg-slate-100 hover:text-blue-600"
                         >
                            <Printer size={14} /> Cetak
                         </button>
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>
      </div>

      {/* STICKY BOTTOM BAR FOR MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:hidden z-50">
         <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pembayaran</span>
            <span className="text-2xl font-black text-blue-600">
              {shippingCost === 0 ? <span className="text-sm font-semibold text-rose-500">Tarif belum diatur</span> : formatRupiah(grandTotal)}
            </span>
         </div>
         <button 
           form="cargoPosForm" 
           type="submit" 
           disabled={loading || shippingCost === 0} 
           className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-blue-200 active:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
         >
            {loading ? 'Memproses...' : <><Save size={20} /> Simpan & Cetak</>}
         </button>
      </div>

      {/* DESKTOP SUBMIT BUTTON (Hidden on mobile) */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50 w-80 lg:w-96">
         <div className="bg-white p-5 rounded-3xl shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
               <span className="text-2xl font-black text-blue-600">
                  {shippingCost === 0 ? <span className="text-sm font-semibold text-rose-500">Tarif belum diatur</span> : formatRupiah(grandTotal)}
               </span>
            </div>
            <button 
               form="cargoPosForm" 
               type="submit" 
               disabled={loading || shippingCost === 0} 
               className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {loading ? 'Memproses...' : <><Save size={20} /> Simpan & Cetak</>}
            </button>
         </div>
      </div>

    </div>
  )
}
