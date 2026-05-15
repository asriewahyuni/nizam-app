'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui/NizamUI'
import { BarChart3, TrendingUp, PieChart, Calculator, FileText } from 'lucide-react'
import Link from 'next/link'
import { getProyek } from '@/modules/koperasi/actions/koperasi.actions'
import { getDashboardStats } from '@/modules/koperasi/actions/koperasi.actions'

export default function LaporanClient({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState<any>(null)
  const [proyek, setProyek] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(orgId), getProyek(orgId)]).then(([s, p]) => {
      setStats(s); setProyek(p); setLoading(false)
    })
  }, [orgId])

  if (loading) return <div className="p-8 text-slate-500">Memuat...</div>

  // Proyek selesai untuk laporan bagi hasil
  const proyekSelesai = proyek.filter(p => p.status === 'SELESAI' || p.status === 'DISTRIBUSI' || p.status === 'DITUTUP')
  const totalPendapatanUjrah = proyek.reduce((sum, p) => sum + Number(p.ujrah_koperasi || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Koperasi" subtitle="Neraca, SHU, dan laporan bagi hasil">
        <Link href="/koperasi/laporan/shu" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all">
          <Calculator className="w-4 h-4" /> Hitung SHU
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SectionCard>
          <div className="text-xs text-slate-400">Total Anggota</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{stats?.totalAnggota || 0}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Total Simpanan Pokok</div>
          <div className="text-xl font-semibold text-emerald-600 mt-1">Rp {(stats?.totalSimpananPokok || 0).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Total Modal Proyek</div>
          <div className="text-xl font-semibold text-emerald-600 mt-1">Rp {(stats?.totalModal || 0).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Pendapatan Ujrah</div>
          <div className="text-xl font-semibold text-amber-400 mt-1">Rp {totalPendapatanUjrah.toLocaleString()}</div>
        </SectionCard>
      </div>

      {/* Proyek Selesai — Bagi Hasil */}
      {proyekSelesai.length > 0 && (
        <SectionCard title="Proyek Selesai — Siap Bagi Hasil">
          <div className="space-y-2 mt-2">
            {proyekSelesai.map((p: any) => (
              <div key={p.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-slate-900">{p.nama_proyek}</span>
                    <span className="ml-2 text-[10px] text-slate-400">{p.status}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-emerald-600">Rp {Number(p.modal_terkumpul).toLocaleString()}</div>
                    <div className="text-xs text-slate-400">Nisbah SM {Number(p.nisbah_sm || 0).toFixed(0)}% : M {Number(p.nisbah_mudharib || 0).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-amber-900/20 border border-amber-800/20">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <TrendingUp className="w-4 h-4" />
              Fitur bagi hasil otomatis akan dikembangkan di Fase 2. Saat ini data proyek siap untuk kalkulasi manual.
            </div>
          </div>
        </SectionCard>
      )}

      {/* Catatan */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-800/20">
        <div className="flex items-start gap-3">
          <PieChart className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Laporan Lengkap</h4>
            <p className="text-xs text-slate-500 mt-1">
              Laporan keuangan koperasi (Neraca, Laba Rugi, SHU, Arus Kas) mengikuti siklus akuntansi 
              dua lapis: Layer 1 (proyek) dan Layer 2 (buku resmi koperasi). 
              Laporan real-time akan tersedia setelah integrasi jurnal selesai.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
