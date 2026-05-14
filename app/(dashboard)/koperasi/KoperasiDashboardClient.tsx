'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatCard, SectionCard } from '@/components/ui/NizamUI'
import { Users, Wallet, TrendingUp, BadgePercent, UserPlus, BookOpen, List } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function KoperasiDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/koperasi/dashboard')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const quickActions = [
    { label: 'Daftar Anggota', icon: UserPlus, href: '/koperasi/anggota', color: 'bg-emerald-600' },
    { label: 'Simpanan', icon: Wallet, href: '/koperasi/simpanan', color: 'bg-blue-600' },
    { label: 'Proyek Mudharabah', icon: TrendingUp, href: '/koperasi/proyek', color: 'bg-purple-600' },
    { label: 'Murabahah', icon: BadgePercent, href: '/koperasi/murabahah', color: 'bg-orange-600' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Koperasi Syariah" subtitle="Dashboard operasional koperasi serba usaha" />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Anggota" value={stats?.totalAnggota || 0} icon={Users} />
        <StatCard title="Proyek Aktif" value={stats?.proyekAktif || 0} icon={TrendingUp} />
        <StatCard title="Total Modal" value={`Rp ${(stats?.totalModal || 0).toLocaleString('id-ID')}`} icon={Wallet} />
        <StatCard title="Shahibul Maal" value={stats?.totalShahibulMaal || 0} icon={BadgePercent} />
      </div>

      <SectionCard title="Aksi Cepat">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={`${action.color} text-white p-4 rounded-2xl flex items-center gap-3 hover:opacity-90 transition-all`}
            >
              <action.icon className="w-6 h-6" />
              <span className="font-semibold text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Menu Lainnya">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Akad Wakalah', icon: BookOpen, href: '/koperasi/akad-wakalah' },
            { label: 'Shahibul Maal', icon: Users, href: '/koperasi/shahibul-maal' },
            { label: 'Mudharib', icon: Users, href: '/koperasi/mudharib' },
            { label: 'Sertifikasi DPS', icon: BadgePercent, href: '/koperasi/sertifikasi' },
            { label: 'Pengurus', icon: List, href: '/koperasi/pengurus' },
            { label: 'Laporan', icon: List, href: '/koperasi/laporan' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-3 transition-all text-left"
            >
              <item.icon className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-white/80">{item.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
