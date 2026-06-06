'use client'

import React, { useState } from 'react'
import { CheckCircle, Search, CreditCard, Box } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { processCargoDelivery } from '@/modules/po-bus/actions/cargo.actions'

export function CargoDeliveryTab({
  orgId,
  shipments,
  onRefresh
}: {
  orgId: string
  shipments: any[]
  onRefresh: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Hanya tampilkan paket yang sudah ARRIVED (siap diambil)
  const readyPackages = shipments.filter(s => s.status === 'ARRIVED')
  
  const filtered = readyPackages.filter(s => 
    s.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.receiver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.receiver_phone.includes(searchQuery)
  )

  const handleDelivery = async (cargoId: string, isUnpaid: boolean) => {
    if (isUnpaid) {
       const confirm = window.confirm('Paket ini berstatus BELUM LUNAS (Bayar Tujuan). Pastikan Anda telah menerima pembayaran dari penerima. Lanjutkan serah terima?')
       if (!confirm) return
    } else {
       const confirm = window.confirm('Serahkan paket ini ke penerima?')
       if (!confirm) return
    }

    setLoading(true)
    const res = await processCargoDelivery(orgId, cargoId)
    
    if (res.error) {
       alert(res.error)
    } else {
       alert('Serah terima berhasil. Status kargo: DELIVERED.')
       onRefresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <CheckCircle className="text-blue-600" /> Loket Pengambilan (Serah Terima)
               </h3>
               <p className="text-sm text-slate-500 font-medium mt-1">Serahkan paket kepada penerima dan tagih pembayaran jika Bayar Tujuan.</p>
            </div>
            
            <div className="relative w-full md:w-72">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400" />
               </div>
               <input
                 type="text"
                 placeholder="Cari Resi / Nama / No HP..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
               />
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.length === 0 ? (
               <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-100 rounded-2xl">
                  <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400 italic">Tidak ada paket yang siap diambil.</p>
               </div>
            ) : (
               filtered.map(pkg => (
                 <div key={pkg.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between h-full group hover:border-blue-200 transition-colors">
                    <div>
                       <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-900 tracking-wider font-mono shadow-sm">
                             {pkg.tracking_number}
                          </span>
                          <span className={`px-2 py-1 text-[9px] font-bold rounded uppercase tracking-wide ${pkg.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                             {pkg.payment_status === 'UNPAID' ? 'BAYAR TUJUAN' : 'LUNAS'}
                          </span>
                       </div>

                       <div className="space-y-3">
                          <div>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Penerima</p>
                             <p className="text-sm font-bold text-slate-900">{pkg.receiver_name}</p>
                             <p className="text-xs font-semibold text-slate-500">{pkg.receiver_phone}</p>
                          </div>
                          <div>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Isi Paket</p>
                             <p className="text-xs font-semibold text-slate-700">{pkg.item_description}</p>
                          </div>
                       </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200/60">
                       {pkg.payment_status === 'UNPAID' && (
                         <div className="flex items-center justify-between mb-4 bg-rose-50 p-3 rounded-xl border border-rose-100">
                            <span className="text-[10px] font-bold text-rose-600 uppercase">Tagihan (COD)</span>
                            <span className="text-sm font-black text-rose-700">{formatRupiah(pkg.grand_total)}</span>
                         </div>
                       )}

                       <button 
                         disabled={loading}
                         onClick={() => handleDelivery(pkg.id, pkg.payment_status === 'UNPAID')}
                         className="w-full py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                       >
                          Rilis & Serahkan
                       </button>
                    </div>
                 </div>
               ))
            )}
         </div>
      </div>
    </div>
  )
}
