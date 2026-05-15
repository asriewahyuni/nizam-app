'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatCard, SectionCard } from '@/components/ui/NizamUI'
import {
  Users, Wallet, TrendingUp, BadgePercent, Loader2, ArrowRight, UserCog,
  CheckCircle2, BarChart3, FileText, ShieldCheck, Landmark, ShoppingCart,
  BookOpen, Target, DollarSign, Activity, Clock, AlertTriangle, PiggyBank,
  Handshake, ClipboardList, UserCheck, Star,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const BASE = '/api/koperasi/action'

async function api(action: string, params: any[] = []) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Request failed') }
  const { data } = await res.json()
  return data
}

interface Stats {
  totalAnggota: number
  anggotaAktif: number
  totalProyek: number
  proyekAktif: number
  totalModal: number
  totalSimpananPokok: number
  totalShahibulMaal: number
}

type KoperasiRole = 'KETUA' | 'SEKRETARIS' | 'BENDAHARA' | 'DPS' | 'ADMIN' | null

export default function KoperasiDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [role, setRole] = useState<KoperasiRole>(null)
  const [anggota, setAnggota] = useState<{ id: string; nama: string; kode: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/koperasi/dashboard').then(r => r.json()),
      api('getCurrentUserKoperasiRole', []),
    ]).then(([statsData, roleData]) => {
      setStats(statsData)
      setRole(roleData?.role || null)
      setAnggota(roleData?.anggota || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#003366] animate-spin" />
      </div>
    )
  }

  const s = stats || {
    totalAnggota: 0, anggotaAktif: 0, totalProyek: 0, proyekAktif: 0,
    totalModal: 0, totalSimpananPokok: 0, totalShahibulMaal: 0,
  }

  // ─── ROLE BADGE ───────────────────────────────────────────────────────────
  const roleBadges: Record<string, { label: string; color: string; icon: any }> = {
    KETUA: { label: 'Ketua', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Star },
    SEKRETARIS: { label: 'Sekretaris', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: ClipboardList },
    BENDAHARA: { label: 'Bendahara', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: DollarSign },
    DPS: { label: 'DPS', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: ShieldCheck },
    ADMIN: { label: 'Admin', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: UserCog },
  }

  const rb = role ? roleBadges[role] : null

  // ─── QUICK ACTIONS ────────────────────────────────────────────────────────
  const quickActions = [
    { label: 'Daftar Anggota', href: '/koperasi/anggota', icon: UserPlus, color: 'emerald', showFor: ['KETUA', 'SEKRETARIS', 'ADMIN'] },
    { label: 'Simpanan', href: '/koperasi/simpanan', icon: Wallet, color: 'blue', showFor: ['KETUA', 'BENDAHARA', 'ADMIN'] },
    { label: 'Shahibul Maal', href: '/koperasi/shahibul-maal', icon: BadgePercent, color: 'indigo', showFor: ['KETUA', 'ADMIN'] },
    { label: 'Buat Proyek', href: '/koperasi/proyek', icon: BookOpen, color: 'amber', showFor: ['KETUA', 'ADMIN'] },
    { label: 'Sertifikasi DPS', href: '/koperasi/sertifikasi', icon: ShieldCheck, color: 'purple', showFor: ['KETUA', 'DPS', 'SEKRETARIS'] },
    { label: 'Murabahah', href: '/koperasi/murabahah', icon: ShoppingCart, color: 'rose', showFor: ['KETUA', 'ADMIN', 'BENDAHARA'] },
  ]

  const filteredActions = quickActions.filter(a => !role || a.showFor.includes(role))

  return (
    <div className="space-y-6">
      {/* Header + Role Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader title="Koperasi Syariah" subtitle="Dashboard operasional koperasi serba usaha" />
        {rb && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${rb.color}`}>
            <rb.icon className="w-3.5 h-3.5" />
            {rb.label}
          </div>
        )}
      </div>

      {/* Anggota Greeting */}
      {anggota && !role && (
        <SectionCard>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#003366]/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-[#003366]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Selamat datang, {anggota.nama}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Anggota #{anggota.kode} — Anda terdaftar sebagai anggota koperasi
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Stats Grid — tampil untuk semua role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Anggota" value={s.totalAnggota} icon={Users} color="emerald" />
        <StatCard label="Proyek Aktif" value={s.proyekAktif} icon={TrendingUp} color="blue" />
        <StatCard label="Total Modal" value={`Rp ${(s.totalModal || 0).toLocaleString('id-ID')}`} icon={Wallet} color="amber" />
        <StatCard label="Shahibul Maal" value={s.totalShahibulMaal} icon={BadgePercent} color="indigo" />
      </div>

      {/* ─── DASHBOARD BY ROLE ─────────────────────────────────────────────── */}

      {!role && <MemberDashboard stats={s} anggota={anggota} router={router} />}
      {role === 'KETUA' && <KetuaDashboard stats={s} router={router} />}
      {role === 'BENDAHARA' && <BendaharaDashboard stats={s} router={router} />}
      {role === 'SEKRETARIS' && <SekretarisDashboard stats={s} router={router} />}
      {role === 'DPS' && <DpsDashboard stats={s} router={router} />}
      {role === 'ADMIN' && <AdminDashboard stats={s} router={router} />}

      {/* Quick Actions — untuk pengurus */}
      {role && (
        <SectionCard>
          <div className="p-5">
            <h3 className="text-sm font-black text-slate-800 mb-3 tracking-tight">Aksi Cepat</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {filteredActions.map(a => (
                <button
                  key={a.label}
                  onClick={() => router.push(a.href)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-[#003366]/30 hover:bg-[#003366]/5 transition-all"
                >
                  <a.icon className="w-5 h-5 text-[#003366]" />
                  <span className="text-[11px] font-semibold text-slate-600 text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Ringkasan Panduan — show when no data yet */}
      {s.totalAnggota === 0 && !role && (
        <SectionCard>
          <div className="p-6">
            <h3 className="text-sm font-black text-slate-800 mb-4">Mulai menggunakan Koperasi Syariah</h3>
            <div className="grid gap-3">
              {[
                { label: 'Daftar Anggota', done: s.totalAnggota > 0, href: '/koperasi/anggota', desc: 'Data anggota & status keanggotaan' },
                { label: 'Kelola Simpanan', done: s.totalSimpananPokok > 0, href: '/koperasi/simpanan', desc: 'Pokok, Wajib, Sukarela' },
                { label: 'Daftarkan Shahibul Maal', done: s.totalShahibulMaal > 0, href: '/koperasi/shahibul-maal', desc: 'Investor / penyedia modal' },
                { label: 'Buat Akad / Proyek', done: false, href: '/koperasi/proyek', desc: 'Mudharabah, Murabahah, Wakalah' },
                { label: 'Laporan & SHU', done: false, href: '/koperasi/laporan', desc: 'Sisa Hasil Usaha, Laba/Rugi' },
              ].map((step, i) => (
                <button
                  key={step.label}
                  onClick={() => router.push(step.href)}
                  className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {step.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${step.done ? 'text-emerald-700' : 'text-slate-600'}`}>{step.label}</p>
                    <p className="text-[11px] text-slate-400">{step.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ─── ROLE-SPECIFIC DASHBOARDS ─────────────────────────────────────────────────

function MemberDashboard({ stats, anggota, router }: { stats: Stats; anggota: any; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-600" /> Simpanan Saya
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Total simpanan pokok: <strong className="text-emerald-700">Rp {stats.totalSimpananPokok.toLocaleString()}</strong></p>
            <button onClick={() => router.push('/koperasi/simpanan')} className="text-xs text-[#003366] font-semibold hover:underline flex items-center gap-1">
              Lihat detail simpanan <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-blue-600" /> Proyek & Akad
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Total proyek aktif: <strong className="text-blue-700">{stats.proyekAktif}</strong></p>
            <button onClick={() => router.push('/koperasi/proyek')} className="text-xs text-[#003366] font-semibold hover:underline flex items-center gap-1">
              Lihat proyek tersedia <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function KetuaDashboard({ stats, router }: { stats: Stats; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-600" /> Ringkasan Eksekutif
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Anggota Aktif</p>
              <p className="text-lg font-black text-slate-900">{stats.anggotaAktif} / {stats.totalAnggota}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Modal</p>
              <p className="text-lg font-black text-emerald-700">Rp {(stats.totalModal || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Simpanan Pokok</p>
              <p className="text-lg font-black text-blue-700">Rp {(stats.totalSimpananPokok || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Shahibul Maal</p>
              <p className="text-lg font-black text-indigo-700">{stats.totalShahibulMaal}</p>
            </div>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" /> Laporan Cepat
          </h3>
          <div className="space-y-2">
            <button onClick={() => router.push('/koperasi/laporan')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 flex items-center gap-3">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-700">Neraca & SHU</span>
            </button>
            <button onClick={() => router.push('/koperasi/laporan/shu')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 flex items-center gap-3">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">Hitung SHU</span>
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function BendaharaDashboard({ stats, router }: { stats: Stats; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" /> Keuangan
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Simpanan Pokok</p>
              <p className="text-lg font-black text-emerald-700">Rp {(stats.totalSimpananPokok || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Modal</p>
              <p className="text-lg font-black text-blue-700">Rp {(stats.totalModal || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => router.push('/koperasi/simpanan')} className="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition">Kelola Simpanan</button>
            <button onClick={() => router.push('/koperasi/laporan')} className="px-3 py-1.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition">Laporan Keuangan</button>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Monitoring
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Proyek Aktif</span>
              <span className="text-sm font-bold text-slate-900">{stats.proyekAktif}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Shahibul Maal</span>
              <span className="text-sm font-bold text-slate-900">{stats.totalShahibulMaal}</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function SekretarisDashboard({ stats, router }: { stats: Stats; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Manajemen Anggota
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Anggota</p>
              <p className="text-lg font-black text-slate-900">{stats.totalAnggota}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Aktif</p>
              <p className="text-lg font-black text-emerald-700">{stats.anggotaAktif}</p>
            </div>
          </div>
          <button onClick={() => router.push('/koperasi/anggota')} className="mt-3 px-3 py-1.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition">Kelola Anggota</button>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Administrasi
          </h3>
          <div className="space-y-2">
            <button onClick={() => router.push('/koperasi/pengurus')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-purple-200 flex items-center gap-3">
              <Landmark className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-slate-700">Pengurus</span>
            </button>
            <button onClick={() => router.push('/koperasi/sertifikasi')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-purple-200 flex items-center gap-3">
              <BadgePercent className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-slate-700">Sertifikasi DPS</span>
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function DpsDashboard({ stats, router }: { stats: Stats; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Pengawasan Syariah
          </h3>
          <div className="space-y-2">
            <button onClick={() => router.push('/koperasi/sertifikasi')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-purple-200 flex items-center gap-3">
              <BadgePercent className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-slate-700">Sertifikasi DPS</span>
            </button>
            <button onClick={() => router.push('/koperasi/akad-wakalah')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-purple-200 flex items-center gap-3">
              <FileText className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-slate-700">Akad Wakalah</span>
            </button>
            <button onClick={() => router.push('/koperasi/murabahah')} className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-purple-200 flex items-center gap-3">
              <ShoppingCart className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-slate-700">Transaksi Murabahah</span>
            </button>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" /> Laporan
          </h3>
          <button onClick={() => router.push('/koperasi/laporan')} className="px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition">Laporan Koperasi</button>
        </div>
      </SectionCard>
    </div>
  )
}

function AdminDashboard({ stats, router }: { stats: Stats; router: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-2">Anggota</h3>
          <p className="text-2xl font-black text-slate-900">{stats.totalAnggota}</p>
          <button onClick={() => router.push('/koperasi/anggota')} className="mt-2 text-xs text-[#003366] font-semibold hover:underline">Kelola</button>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-2">Simpanan Pokok</h3>
          <p className="text-2xl font-black text-emerald-700">Rp {(stats.totalSimpananPokok || 0).toLocaleString()}</p>
          <button onClick={() => router.push('/koperasi/simpanan')} className="mt-2 text-xs text-[#003366] font-semibold hover:underline">Kelola</button>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-800 mb-2">Proyek Aktif</h3>
          <p className="text-2xl font-black text-blue-700">{stats.proyekAktif}</p>
          <button onClick={() => router.push('/koperasi/proyek')} className="mt-2 text-xs text-[#003366] font-semibold hover:underline">Lihat</button>
        </div>
      </SectionCard>
    </div>
  )
}
