'use client'

import React, { useState } from 'react'
import { Zap, Tag, Gift, Percent, Plus, AlertCircle, Copy, CheckCircle2 } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, SafeButton } from '@/components/ui/NizamUI'

export default function PromoClient() {
  const [showModal, setShowModal] = useState(false)
  const [promos, setPromos] = useState([
     { id: 'PRM-001', code: 'RAMADHAN24', type: 'PERCENT', value: 10, status: 'ACTIVE', usage: 145 },
     { id: 'PRM-002', code: 'NEWCUSTOMER', type: 'FIXED', value: 50000, status: 'ACTIVE', usage: 32 },
     { id: 'PRM-003', code: 'HARBOLSALE', type: 'PERCENT', value: 15, status: 'EXPIRED', usage: 890 }
  ])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopy = (code: string) => {
     navigator.clipboard.writeText(code)
     setCopiedCode(code)
     setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleAddPromo = (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault()
     const formData = new FormData(e.currentTarget)
     const newPromo = {
        id: `PRM-00${promos.length + 1}`,
        code: (formData.get('code') as string).toUpperCase(),
        type: formData.get('type') as string,
        value: Number(formData.get('value')),
        status: 'ACTIVE',
        usage: 0
     }
     setPromos([newPromo, ...promos])
     setShowModal(false)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Zap />}
        title="Promo & Reward"
        subtitle="Manajemen program diskon otomatis, potongan harga spesial, dan metrik kupon."
        tag="Loyalty Program"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
             Buat Kupon Baru
          </SafeButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Diskon Berjalan" value={promos.filter(p => p.status === 'ACTIVE').length} icon={Percent} color="blue" />
        <StatCard label="Total Klaim (Bulan Ini)" value={promos.reduce((a,b) => a + b.usage, 0)} icon={Gift} color="emerald" sub="Kupon terpakai" />
        <StatCard label="Poin Tersalurkan" value="0 Pts" icon={Zap} color="amber" sub="Segera Hadir" />
        <StatCard label="Promo Berakhir" value={promos.filter(p => p.status === 'EXPIRED').length} icon={Tag} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
           <SectionCard>
              <SectionHeader title="Daftar Kupon Diskon Aktif" subtitle="Kode diskon yang bisa digunakan di faktur penjualan oleh sales." />
              <div className="space-y-4">
                 {promos.map(promo => (
                    <div key={promo.id} className="group relative flex items-center justify-between p-6 rounded-3xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all overflow-hidden">
                       <div className="flex items-center gap-5 relative z-10">
                          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed ${promo.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                             {promo.type === 'PERCENT' ? <Percent size={24} /> : <Tag size={24} />}
                          </div>
                          <div>
                             <div className="flex items-center gap-3 mb-1">
                                <h4 className={`text-xl font-black tracking-tight ${promo.status === 'ACTIVE' ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{promo.code}</h4>
                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full ${promo.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                   {promo.status}
                                </span>
                             </div>
                             <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                Potongan: <strong className="text-blue-600">{promo.type === 'PERCENT' ? `${promo.value}%` : `Rp ${new Intl.NumberFormat('id-ID').format(promo.value)}`}</strong> • Dipakai {promo.usage} kali
                             </div>
                          </div>
                       </div>
                       
                       <div className="relative z-10">
                          <button 
                            onClick={() => handleCopy(promo.code)}
                            className="bg-slate-50 p-3 rounded-xl text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:-translate-y-1"
                          >
                             {copiedCode === promo.code ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Copy size={18} />}
                          </button>
                       </div>

                       {promo.status === 'ACTIVE' && (
                         <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity -mr-16 -mt-16 pointer-events-none" />
                       )}
                    </div>
                 ))}
              </div>
           </SectionCard>
        </div>
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[32px] p-8 text-white relative shadow-2xl overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
               <Gift size={28} className="text-white/80 mb-6 drop-shadow-md" />
               <h3 className="text-xl font-black mb-2 relative z-10">Customer Loyalty Points</h3>
               <p className="text-sm font-semibold text-white/80 mb-8 relative z-10 leading-relaxed">Persiapkan program poin loyalitas untuk menjaga pelanggan setia Anda tidak kabur ke kompetitor.</p>
               <button className="relative z-10 w-full bg-white text-blue-600 font-black tracking-widest uppercase text-[10px] py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg shadow-black/10">Aktifkan Modul Loyalty</button>
           </div>
           
           <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex items-start gap-4">
              <AlertCircle size={24} className="text-amber-500 mt-1 flex-shrink-0" />
              <div className="space-y-2 text-amber-800 text-sm font-bold leading-relaxed">
                 Fitur sinkronisasi Kupon Promo otomatis saat transaksi di modul Penjualan & Aplikasi Mobile akan segera hadir pada Engine Update v2.0.
              </div>
           </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Buat Kupon Spesial</h3>
            <form onSubmit={handleAddPromo} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kode Promo (Harus Unik)</label>
                <input name="code" required minLength={4} maxLength={15} style={{ textTransform: 'uppercase' }} className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none" placeholder="Cth: HARNAS2025" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe Diskon</label>
                   <select name="type" className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none">
                      <option value="PERCENT">Persentase (%)</option>
                      <option value="FIXED">Nominal (Rp)</option>
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nilai Potongan</label>
                   <input type="number" name="value" required min={1} className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none" placeholder="10 / 50000" />
                 </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">Batal</button>
                <SafeButton variant="primary" type="submit">Terbitkan Kupon</SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
