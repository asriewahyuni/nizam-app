'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatCard, SectionCard, SectionHeader } from '@/components/ui/NizamUI'
import { Users, Wallet, TrendingUp, BadgePercent, UserPlus, BookOpen, List, Loader2, ArrowRight, UserCog, CheckCircle2, BarChart3, FileText } from 'lucide-react'
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

  const anggotaTelahDidaftar = (stats?.totalAnggota || 0) > 0
  const adaSimpanan = (stats?.totalSimpananPokok || 0) > 0
  const adaShahibulMaal = (stats?.totalShahibulMaal || 0) > 0

  const steps = [
    { 
      label: 'Daftar Anggota', 
      done: anggotaTelahDidaftar, 
      href: '/koperasi/anggota',
      desc: 'Data anggota & status keanggotaan'
    },
    { 
      label: 'Kelola Simpanan', 
      done: adaSimpanan, 
      href: '/koperasi/simpanan',
      desc: 'Pokok, Wajib, Sukarela'
    },
    { 
      label: 'Daftarkan Shahibul Maal', 
      done: adaShahibulMaal, 
      href: '/koperasi/shahibul-maal',
      desc: 'Investor / penyedia modal'
    },
    { 
      label: 'Buat Akad / Proyek', 
      done: false, 
      href: '/koperasi/proyek',
      desc: 'Mudharabah, Murabahah, Wakalah'
    },
    { 
      label: 'Laporan & SHU', 
      done: false, 
      href: '/koperasi/laporan',
      desc: 'Sisa Hasil Usaha, Laba/Rugi'
    },
  ]

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

      {/* Panduan Alur */}
      <SectionCard>
        <SectionHeader title="Panduan Langkah" subtitle="Ikuti alur ini untuk mulai menggunakan Koperasi Syariah" />
        <div className="p-6 md:p-8">
          <div className="space-y-4">
            {steps.map((step, i) => (
              <button
                key={step.label}
                onClick={() => router.push(step.href)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-md transition-all text-left group"
              >
                {/* Step Number / Status */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  step.done 
                    ? 'bg-emerald-50 text-emerald-500' 
                    : 'bg-slate-50 text-slate-400'
                }`}>
                  {step.done 
                    ? <CheckCircle2 className="w-5 h-5" />
                    : <span className="text-sm font-bold">{i + 1}</span>
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${step.done ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {step.label}
                    {step.done && <span className="ml-2 text-[10px]">✅ Selesai</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{step.desc}</div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Menu per Fitur */}
      <SectionCard>
        <SectionHeader title="Menu Lengkap" subtitle="Akses semua fitur koperasi" />
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Anggota', icon: Users, href: '/koperasi/anggota', desc: 'Data anggota' },
              { label: 'Simpanan', icon: Wallet, href: '/koperasi/simpanan', desc: 'Pokok, Wajib, Sukarela' },
              { label: 'Shahibul Maal', icon: BadgePercent, href: '/koperasi/shahibul-maal', desc: 'Investor' },
              { label: 'Mudharib', icon: UserCog, href: '/koperasi/mudharib', desc: 'Pengelola proyek' },
              { label: 'Akad Wakalah', icon: BookOpen, href: '/koperasi/akad-wakalah', desc: 'Akad wakalah' },
              { label: 'Murabahah', icon: TrendingUp, href: '/koperasi/murabahah', desc: 'Jual beli' },
              { label: 'Proyek', icon: BarChart3, href: '/koperasi/proyek', desc: 'Mudharabah' },
              { label: 'Sertifikasi DPS', icon: BadgePercent, href: '/koperasi/sertifikasi', desc: 'Sertifikasi' },
              { label: 'Pengurus', icon: List, href: '/koperasi/pengurus', desc: 'Kepengurusan' },
              { label: 'Laporan', icon: FileText, href: '/koperasi/laporan', desc: 'SHU & Rugi/Laba' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 transition-all text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                  <div className="text-[10px] text-slate-400">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
