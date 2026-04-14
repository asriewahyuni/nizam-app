'use client'

import React from 'react'
import { Plus, Briefcase, TrendingUp, AlertCircle, Eye, Handshake } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'

export default function SyirkahDashboardClient({ orgId, initialData }: { orgId: string; initialData: any }) {
  const { netProfit, totalDebtAllocation, totalCurrentDebt, contracts, allMembers } = initialData
  const debtPercentage = totalDebtAllocation > 0 ? Math.min((totalCurrentDebt / totalDebtAllocation) * 100, 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 border-b-4 border-blue-600 inline-block pb-1">
            Dashboard Syirkah
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Kelola kerja sama kemitraan, bagi hasil, dan eksposur hutang.
          </p>
        </div>
        <Link
          href="/syirkah/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus size={16} /> Buat Akad Baru
        </Link>
      </div>

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit Hero */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-900 p-6 flex flex-col justify-between shadow-xl shadow-blue-900/20">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <TrendingUp size={100} />
          </div>
          <div className="relative z-10">
            <h2 className="text-blue-200 text-sm font-black tracking-widest uppercase mb-1">Total Net Profit</h2>
            <div className="text-4xl lg:text-5xl font-black text-white tracking-tighter">
              {formatRupiah(netProfit)}
            </div>
            <p className="text-blue-100 text-sm mt-2 opacity-80 max-w-sm leading-tight">
              Laba Bersih yang terakumulasi. Dasar estimasi bagi hasil bagi seluruh anggota syirkah aktif.
            </p>
          </div>
        </div>

        {/* Debt Exposure Hero */}
        <div className="col-span-1 md:col-span-2 rounded-3xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-slate-500 text-sm font-black tracking-widest uppercase">Alokasi Hutang Keseluruhan</h2>
              <div className="p-2 bg-rose-50 text-rose-500 rounded-full">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tighter">{formatRupiah(totalCurrentDebt)}</span>
              <span className="text-sm font-bold text-slate-400">/ {formatRupiah(totalDebtAllocation)}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-slate-500">Kapasitas Digunakan</span>
              <span className={debtPercentage > 80 ? 'text-rose-500' : 'text-slate-700'}>{debtPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${debtPercentage > 80 ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${debtPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* SYIRKAH CONTRACTS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Briefcase size={20} className="text-blue-600" />
            Daftar Akad Syirkah
          </h3>
        </div>

        {contracts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <Handshake size={48} className="mx-auto text-slate-300 mb-4" />
            <h4 className="text-slate-700 font-bold mb-1">Belum Ada Kemitraan</h4>
            <p className="text-sm text-slate-500">Tambahkan judul akad baru di atas untuk memulai syirkah.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 font-black pl-2">Judul Akad</th>
                  <th className="pb-3 font-black">Jenis</th>
                  <th className="pb-3 font-black">Status</th>
                  <th className="pb-3 font-black text-right">Potensi Bagi Hasil Total</th>
                  <th className="pb-3 font-black text-right">Hutang Berjalan</th>
                  <th className="pb-3 font-black text-center pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {contracts.map((c: any, i: number) => {
                  const myMembers = allMembers[i]?.members || []
                  const totalEst = myMembers.reduce((sum: number, m: any) => sum + (Number(m.estimatedProfitAmount) || 0), 0)

                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">{c.title}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 whitespace-nowrap">
                          {c.contract_type || '-'}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded-lg ${
                          c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-blue-600">{formatRupiah(totalEst)}</td>
                      <td className="py-4 text-right font-medium text-slate-600">
                        {formatRupiah(c.current_debt || 0)} <br/>
                        <span className="text-xs text-slate-400">Limit: {formatRupiah(c.debt_allocation || 0)}</span>
                      </td>
                      <td className="py-4 pr-2 text-center">
                        <Link
                          href={`/syirkah/${c.id}`}
                          className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                        >
                          <Eye size={18} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
