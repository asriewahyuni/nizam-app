'use client'

import React, { useState } from 'react'
import { Target, TrendingUp, Trophy, ArrowUpRight, UserCircle, AlertCircle, Percent, DollarSign } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, SafeButton } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'

export default function CommissionClient({ sales }: any) {
  const [showSettings, setShowSettings] = useState(false)
  const [commissionRate, setCommissionRate] = useState(2.5) // 2.5% default commission
  const [globalTarget, setGlobalTarget] = useState(100000000)

  // Aggregate sales by user (we just have user ids so let's mock the names)
  const salesByUser = sales.reduce((acc: any, s: any) => {
    const id = s.created_by || 'unknown'
    if (!acc[id]) acc[id] = { id, name: `Sales Dept (ID: ${id.slice(0,4)})`, total: 0, count: 0 }
    if (s.status === 'FINISHED' || s.status === 'ORDERED') {
      acc[id].total += s.grand_total || 0
      acc[id].count += 1
    }
    return acc
  }, {})

  const rankings = Object.values(salesByUser).sort((a: any, b: any) => b.total - a.total)
  const totalHit = rankings.reduce((sum: number, r: any) => sum + r.total, 0)
  const progressPct = Math.min(Math.round((totalHit / globalTarget) * 100), 100)

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Target />}
        title="Target & Komisi Sales"
        subtitle="Mulai tingkatkan omzet dengan memantau pencapaian KPI bulanan tim penjualan."
        tag="Sales Motivation"
        actions={
          <SafeButton variant="primary" icon={<Trophy size={18} />} onClick={() => setShowSettings(true)}>
             Atur Skema & Target
          </SafeButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Pencapaian Tim (Bln Ini)" value={formatRupiah(totalHit)} icon={TrendingUp} color="blue" />
        <StatCard label="Kewajiban Komisi" value={formatRupiah(totalHit * (commissionRate / 100))} icon={Trophy} color="emerald" sub={`Rate: ${commissionRate}%`} />
        {rankings.length > 0 ? (
          <StatCard label="Top Sales" value={(rankings[0] as any).name} icon={ArrowUpRight} color="amber" sub={formatRupiah((rankings[0] as any).total)} />
        ) : (
          <StatCard label="Top Sales" value="Belum Ada" icon={ArrowUpRight} color="amber" sub="Rp 0" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <SectionCard>
             <SectionHeader title="Leaderboard Penjualan" subtitle="Peringkat tenaga penjual (sales) bulan berjalan." />
             <div className="space-y-4">
               {rankings.map((user: any, idx: number) => (
                 <div key={user.id} className="flex items-center gap-4 p-4 rounded-3xl border border-slate-100 bg-white hover:shadow-lg transition-all">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <h4 className="font-bold text-slate-800">{user.name}</h4>
                         {idx === 0 && <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">MVP</span>}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">{user.count} Transaksi Berhasil</div>
                    </div>
                    <div className="text-right">
                       <div className="font-black text-lg text-slate-800">{formatRupiah(user.total)}</div>
                       <div className="text-xs font-bold text-emerald-600">Komisi: {formatRupiah(user.total * (commissionRate / 100))}</div>
                    </div>
                 </div>
               ))}
               {rankings.length === 0 && <div className="text-center py-10 text-slate-400 font-bold text-xs uppercase italic">Belum ada data penjualan tercatat</div>}
             </div>
           </SectionCard>
        </div>
        <div className="space-y-8">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10" />
             <Target size={24} className="text-blue-400 mb-6" />
             <h3 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Target Perusahaan</h3>
             <div className="text-3xl font-black mb-6">{formatRupiah(globalTarget)}</div>
             
             <div className="space-y-2 mb-6">
               <div className="flex justify-between text-xs font-bold">
                 <span className="text-slate-400">Pencapaian: {formatRupiah(totalHit)}</span>
                 <span className="text-emerald-400">{progressPct}%</span>
               </div>
               <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
               </div>
             </div>
             {progressPct >= 100 && (
               <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
                 <Trophy size={14} /> Target Bulan Ini Tercapai!
               </div>
             )}
           </div>

           <div className="bg-blue-50 rounded-[32px] p-8">
             <div className="flex items-center gap-2 mb-4 text-blue-600">
                <Percent size={18} /> <h3 className="font-black">Skema Komisi Aktif</h3>
             </div>
             <p className="text-sm font-bold text-blue-900/60 leading-relaxed mb-4">
               Semua tenaga penjual akan mendapatkan komisi sebesar <strong className="text-blue-700">{commissionRate}%</strong> dari nilai faktur penjualan bersih (Grand Total).
             </p>
             <button onClick={() => setShowSettings(true)} className="text-blue-600 font-black text-xs uppercase tracking-widest hover:underline">Ubah Parameter →</button>
           </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Pengaturan Target & Skema</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Target (Rp)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" value={globalTarget} onChange={e => setGlobalTarget(Number(e.target.value))} className="w-full h-12 pl-10 pr-4 border rounded-xl font-bold focus:border-blue-600 outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Persentase Komisi Flat (%)</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(Number(e.target.value))} className="w-full h-12 pl-10 pr-4 border rounded-xl font-bold focus:border-blue-600 outline-none" />
                </div>
              </div>
              <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-xs font-bold flex items-start gap-2 mt-4">
                 <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                 Fitur pembuatan komisi bertingkat (Tiering) dan target per-Sales Person akan dirilis pada fase sistem HRIS terintegrasi penuh.
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <SafeButton variant="primary" onClick={() => setShowSettings(false)}>Simpan Pengaturan Lokal</SafeButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
