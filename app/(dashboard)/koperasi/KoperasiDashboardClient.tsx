'use client'

import { useState, useEffect } from 'react'
import { Users, Wallet, TrendingUp, BadgePercent, UserPlus, BookOpen, List, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Stats = {
  totalAnggota: number
  anggotaAktif: number
  totalProyek: number
  proyekAktif: number
  totalModal: number
  totalSimpananPokok: number
  totalShahibulMaal: number
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/20">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-white/60">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
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
    <div className="min-h-screen bg-[#07080a] p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-white/10">
        <h1 className="text-2xl font-semibold text-white">Koperasi Syariah</h1>
        <p className="text-sm text-white/50 mt-1">Dashboard operasional koperasi serba usaha</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Anggota" value={stats?.totalAnggota || 0} icon={Users} />
        <StatCard label="Proyek Aktif" value={stats?.proyekAktif || 0} icon={TrendingUp} />
        <StatCard label="Total Modal" value={`Rp ${(stats?.totalModal || 0).toLocaleString('id-ID')}`} icon={Wallet} />
        <StatCard label="Shahibul Maal" value={stats?.totalShahibulMaal || 0} icon={BadgePercent} />
      </div>

      {/* Aksi Cepat */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={`${action.color} text-white p-4 rounded-2xl flex items-center gap-3 hover:opacity-90 transition-all`}
            >
              <action.icon className="w-5 h-5" />
              <span className="font-semibold text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Menu Lainnya */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Menu Lainnya</h2>
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
      </div>
    </div>
  )
}
