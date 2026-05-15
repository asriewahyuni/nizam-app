'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatCard, SafeButton, SectionCard, SectionHeader } from '@/components/ui/NizamUI'
import { Users, Wallet, TrendingUp, BadgePercent, UserPlus, BookOpen, List, Loader2, ArrowRight, UserCog } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Stats {
  totalAnggota: number
  anggotaAktif: number
  totalProyek: number
  proyekAktif: number
  totalModal: number
  totalSimpananPokok: number
  totalShahibulMaal: number
}

export default function KoperasiDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/koperasi/dashboard')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Koperasi Syariah" subtitle="Dashboard operasional koperasi serba usaha" />

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Anggota" value={stats?.totalAnggota || 0} icon={Users} color="emerald" />
        <StatCard label="Proyek Aktif" value={stats?.proyekAktif || 0} icon={TrendingUp} color="blue" />
        <StatCard label="Total Modal" value={`Rp ${(stats?.totalModal || 0).toLocaleString('id-ID')}`} icon={Wallet} color="amber" />
        <StatCard label="Shahibul Maal" value={stats?.totalShahibulMaal || 0} icon={BadgePercent} color="indigo" />
      </div>

      {/* Aksi Cepat */}
      <SectionCard>
        <SectionHeader title="Aksi Cepat" subtitle="Menu yang paling sering digunakan" />
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Daftar Anggota', icon: UserPlus, href: '/koperasi/anggota', gradient: 'from-emerald-500 to-emerald-600' },
              { label: 'Simpanan', icon: Wallet, href: '/koperasi/simpanan', gradient: 'from-blue-500 to-blue-600' },
              { label: 'Proyek Mudharabah', icon: TrendingUp, href: '/koperasi/proyek', gradient: 'from-purple-500 to-purple-600' },
              { label: 'Murabahah', icon: BadgePercent, href: '/koperasi/murabahah', gradient: 'from-orange-500 to-orange-600' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className={`bg-gradient-to-br ${action.gradient} text-white p-5 md:p-6 rounded-2xl flex flex-col items-start gap-3 hover:shadow-xl hover:-translate-y-0.5 transition-all group text-left`}
              >
                <action.icon className="w-7 h-7 opacity-90" />
                <span className="font-semibold text-sm leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Menu Lainnya */}
      <SectionCard>
        <SectionHeader title="Menu Lainnya" subtitle="Akses ke seluruh fitur koperasi" />
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Akad Wakalah', icon: BookOpen, href: '/koperasi/akad-wakalah' },
              { label: 'Shahibul Maal', icon: Users, href: '/koperasi/shahibul-maal' },
              { label: 'Mudharib', icon: UserCog, href: '/koperasi/mudharib' },
              { label: 'Sertifikasi DPS', icon: BadgePercent, href: '/koperasi/sertifikasi' },
              { label: 'Pengurus', icon: List, href: '/koperasi/pengurus' },
              { label: 'Laporan', icon: List, href: '/koperasi/laporan' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3 transition-all text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-500 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
