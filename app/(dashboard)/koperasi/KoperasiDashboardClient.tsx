'use client'

import { PageHeader, StatCard, SafeButton, SectionCard } from '@/components/ui/NizamUI'
import { Users, Wallet, TrendingUp, BadgePercent, ArrowRightCircle, UserPlus, BookOpen, List } from 'lucide-react'
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

export default function KoperasiDashboardClient({ stats, orgId }: { stats: Stats; orgId: string }) {
  const router = useRouter()

  const quickActions = [
    { label: 'Daftar Anggota', icon: UserPlus, href: '/koperasi/anggota', color: 'bg-emerald-600' },
    { label: 'Simpanan', icon: Wallet, href: '/koperasi/simpanan', color: 'bg-blue-600' },
    { label: 'Proyek Mudharabah', icon: TrendingUp, href: '/koperasi/proyek', color: 'bg-purple-600' },
    { label: 'Murabahah', icon: BadgePercent, href: '/koperasi/murabahah', color: 'bg-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Koperasi Syariah" subtitle="Dashboard operasional koperasi serba usaha" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Anggota" value={stats.totalAnggota.toString()} subtitle={`${stats.anggotaAktif} aktif`} icon={Users} />
        <StatCard title="Shahibul Maal" value={stats.totalShahibulMaal.toString()} subtitle="Total investor" icon={Wallet} />
        <StatCard title="Proyek" value={stats.totalProyek.toString()} subtitle={`${stats.proyekAktif} aktif`} icon={TrendingUp} />
        <StatCard title="Simpanan Pokok" value={`Rp ${(stats.totalSimpananPokok / 1000).toFixed(0)}rb`} subtitle="Terkumpul" icon={Wallet} />
      </div>

      {/* Quick Actions */}
      <SectionCard title="Menu Cepat">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{action.label}</div>
                <div className="text-xs text-white/50">Klik untuk buka</div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Info Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-800/30">
        <h3 className="text-sm font-semibold text-emerald-300 mb-2">Tentang Modul</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Koperasi Syariah mengelola simpanan (Pokok, Wajib, Sukarela), Murabahah bil Wakalah,
          Mudharabah Multi Shahibul Maal, sertifikasi DPS, dan akuntansi dua lapis syariah.
          Seluruh transaksi menggunakan akad syariah dengan pendapatan Ujrah flat (bukan bunga/profit-rate).
        </p>
      </div>
    </div>
  )
}
