'use client'

import { useState, useTransition } from 'react'
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  Flame,
  HandCoins,
  Link2,
  Lock,
  MousePointerClick,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  activateMemberAffiliateAction,
  requestMemberPayoutAction,
} from '@/modules/member/actions/affiliate-member.actions'
import type { PortalAffiliateDashboard } from '@/modules/member/lib/portal.server'

export function MemberAffiliatePageClient({
  orgSlug,
  tenantName,
  referralHost,
  dashboard,
}: {
  orgSlug: string
  tenantName: string
  referralHost: string
  dashboard: PortalAffiliateDashboard
}) {
  const [activeTab, setActiveTab] = useState<'courses' | 'leaderboard' | 'commissions'>('courses')
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Payout Form State
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState(dashboard.payableAmount)
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  const mainReferralUrl = dashboard.isActivated
    ? `https://${referralHost}/katalog?ref=${encodeURIComponent(dashboard.referralCode)}`
    : `https://${referralHost}/katalog`

  const handleCopy = (text: string, isCourseId?: string) => {
    navigator.clipboard.writeText(text)
    if (isCourseId) {
      setCopiedCourseId(isCourseId)
      setTimeout(() => setCopiedCourseId(null), 2000)
    } else {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleActivate = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await activateMemberAffiliateAction(orgSlug)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: `Selamat! Akun Afiliasi Anda berhasil diaktifkan dengan kode ${res.referralCode}.` })
      }
    })
  }

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const res = await requestMemberPayoutAction(
        orgSlug,
        payoutAmount,
        bankName,
        accountNumber,
        accountName,
      )
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: `Pengajuan penarikan dana ${res.payoutNumber} berhasil diproses!` })
        setShowPayoutModal(false)
      }
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Alert Notification */}
      {message && (
        <div className={`mb-6 rounded-2xl p-4 border text-sm font-medium flex items-center justify-between shadow-sm ${message.type === 'success' ? 'bg-emerald-900/10 border-emerald-500/30 text-emerald-700' : 'bg-rose-900/10 border-rose-500/30 text-rose-700'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="cursor-pointer text-xs underline font-semibold">Tutup</button>
        </div>
      )}

      {/* Hero / Shareable Card Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-6 sm:p-10 text-white shadow-2xl border border-emerald-500/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} className="text-emerald-400 animate-pulse" />
              <span>Program Afiliasi Resmi {tenantName}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Promosikan Kelas &amp; Dapatkan Komisi Hingga <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">20%+</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Bagikan tautan edukasi berkualitas kepada komunitas Anda. Dapatkan komisi transparan setiap kali ada pendaftar baru lewat rekomendasi Anda.
            </p>
          </div>

          {/* Opt-In or Code Box */}
          <div className="w-full lg:w-auto shrink-0">
            {!dashboard.isActivated ? (
              <div className="rounded-2xl bg-white/10 backdrop-blur-md p-6 border border-white/20 text-center max-w-sm">
                <Lock className="mx-auto text-emerald-400 mb-3" size={32} />
                <h3 className="font-bold text-lg text-white">Aktifkan Akun Afiliasi</h3>
                <p className="text-xs text-slate-300 mt-1 mb-4">
                  Klik di bawah ini untuk mengaktifkan kode referral Anda dan mulai membagikan kelas.
                </p>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Flame size={18} />
                  <span>{isPending ? 'Mengaktifkan...' : 'Aktifkan Akun Afiliasi Saya'}</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur-xl p-5 border border-emerald-500/30 shadow-xl min-w-[320px]">
                <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Link2 size={14} /> Tautan Referral Utama
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Aktif</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-xs font-mono text-emerald-300 border border-white/10">
                    {mainReferralUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(mainReferralUrl)}
                    className="p-2.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer shrink-0"
                    title="Salin Link"
                  >
                    {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
                  <span>Kode Unik: <strong className="text-white font-mono">{dashboard.referralCode}</strong></span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Share2 size={12} /> Shareable Card
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards (Statistik Aset & Komisi) */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Menunggu Masa Tahan</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><MousePointerClick size={18} /></div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{formatRupiah(dashboard.pendingAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">Komisi dalam verifikasi</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Siap Ditarik (Payable)</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700"><HandCoins size={18} /></div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-900">{formatRupiah(dashboard.payableAmount)}</p>
          {dashboard.payableAmount > 0 && dashboard.isActivated ? (
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer underline"
            >
              Tarik Dana Sekarang &rarr;
            </button>
          ) : (
            <p className="mt-1 text-xs text-emerald-600 font-medium">Min. penarikan Rp 50.000</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Telah Dicairkan</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><Wallet size={18} /></div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{formatRupiah(dashboard.paidAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">Total komisi dicairkan</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Pembeli</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><Users size={18} /></div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{dashboard.conversionCount} Penjualan</p>
          <p className="mt-1 text-xs text-slate-500">Konversi pendaftaran</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="mt-10 flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${activeTab === 'courses' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Sparkles size={16} />
          <span>Katalog Kelas Afiliasi ({dashboard.eligibleCourses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${activeTab === 'leaderboard' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Trophy size={16} />
          <span>Leaderboard Mitra 🏆</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${activeTab === 'commissions' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <HandCoins size={16} />
          <span>Riwayat Komisi</span>
        </button>
      </div>

      {/* Tab Content 1: Katalog Kelas Afiliasi */}
      {activeTab === 'courses' && (
        <div className="mt-6">
          <p className="text-sm text-slate-600 mb-6">
            Pilih kelas yang ingin Anda promosikan. Dapatkan komisi instan untuk setiap peserta yang mendaftar melalui link referral khusus Anda.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.eligibleCourses.map((course) => {
              const courseRefUrl = dashboard.isActivated
                ? `https://${referralHost}/course/${course.slug}?ref=${encodeURIComponent(dashboard.referralCode)}`
                : `https://${referralHost}/course/${course.slug}`
              const isCopied = copiedCourseId === course.id

              return (
                <div key={course.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                      {course.coverImageUrl ? (
                        <img src={course.coverImageUrl} alt={course.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400 font-semibold text-xs">
                          {tenantName}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                        Komisi {course.commissionType === 'PERCENTAGE' ? `${course.commissionValue}%` : formatRupiah(course.commissionValue)}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 line-clamp-2 leading-snug">{course.title}</h3>
                    
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span>Harga Kelas: <strong>{formatRupiah(course.price)}</strong></span>
                      <span className="text-emerald-700 font-bold">Est. Komisi: {formatRupiah(course.estimatedCommission)}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                    <button
                      type="button"
                      disabled={!dashboard.isActivated}
                      onClick={() => handleCopy(courseRefUrl, course.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${isCopied ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} ${!dashboard.isActivated ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{isCopied ? 'Tersalin!' : 'Salin Link Kelas'}</span>
                    </button>
                    <a
                      href={courseRefUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      title="Buka Halaman"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab Content 2: Leaderboard Afiliasi */}
      {activeTab === 'leaderboard' && (
        <div className="mt-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-2xl text-white">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Award className="text-amber-400" size={20} /> Klasemen Peringkat Mitra Afiliasi
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Peringkat diperbarui secara otomatis berdasarkan total penjualan &amp; komisi. Nama ditampilkan tersamar demi privasi.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-amber-300 shrink-0">
              <Flame size={14} /> Top 10 Performa Terbaik
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Peringkat</th>
                  <th className="py-3.5 px-5">Nama Mitra</th>
                  <th className="py-3.5 px-5 text-center">Total Penjualan</th>
                  <th className="py-3.5 px-5 text-right">Total Komisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">Belum ada data peringkat pada periode ini.</td>
                  </tr>
                ) : (
                  dashboard.leaderboard.map((entry) => {
                    const isTop1 = entry.rank === 1
                    const isTop2 = entry.rank === 2
                    const isTop3 = entry.rank === 3

                    return (
                      <tr key={entry.affiliateProfileId} className={`hover:bg-slate-50/80 transition ${isTop1 ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-4 px-5 font-bold">
                          {isTop1 && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow">🥇 1</span>}
                          {isTop2 && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-950 font-black text-xs shadow">🥈 2</span>}
                          {isTop3 && <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs shadow">🥉 3</span>}
                          {!isTop1 && !isTop2 && !isTop3 && <span className="text-slate-500 font-semibold pl-2">#{entry.rank}</span>}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900">{entry.maskedDisplayName}</div>
                          <div className="text-xs text-slate-400 font-mono">Kode: {entry.referralCode}</div>
                        </td>
                        <td className="py-4 px-5 text-center font-semibold text-slate-700">
                          {entry.totalConversions} transaksi
                        </td>
                        <td className="py-4 px-5 text-right font-black text-emerald-700">
                          {formatRupiah(entry.totalCommissionAmount)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 3: Riwayat Komisi & Penarikan */}
      {activeTab === 'commissions' && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Saldo Komisi Siap Ditarik</h3>
              <p className="text-xs text-slate-500">Saldo yang telah melewati masa tahan dan dapat ditransfer ke rekening Anda.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-black text-emerald-700">{formatRupiah(dashboard.payableAmount)}</span>
              {dashboard.payableAmount >= 50000 && dashboard.isActivated && (
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(true)}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
                >
                  Cairkan Dana
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 font-bold text-slate-900">
              Riwayat Komisi Per Transaksi ({dashboard.commissions.length})
            </div>
            <ul className="divide-y divide-slate-100">
              {dashboard.commissions.length === 0 ? (
                <li className="p-8 text-center text-slate-500 text-sm">Belum ada riwayat komisi.</li>
              ) : (
                dashboard.commissions.map((comm) => (
                  <li key={comm.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition">
                    <div>
                      <p className="font-bold text-slate-900">{comm.orderNumber || 'Komisi Penjualan Kelas'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comm.createdAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-700">{formatRupiah(comm.amount)}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${comm.status === 'PAID' ? 'bg-blue-100 text-blue-700' : comm.status === 'PAYABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {comm.status}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Modal Form Pencairan Komisi (Payout) */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Form Pengajuan Pencairan Dana</h3>
            <p className="text-xs text-slate-500 mb-5">Komisi akan ditransfer ke rekening bank resmi Anda.</p>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Penarikan (Rp)</label>
                <input
                  type="number"
                  min={50000}
                  max={dashboard.payableAmount}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Maks. saldo siap ditarik: {formatRupiah(dashboard.payableAmount)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Bank</label>
                <input
                  type="text"
                  placeholder="Contoh: BCA / Mandiri / BRI"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  placeholder="Contoh: 1234567890"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pemilik Rekening</label>
                <input
                  type="text"
                  placeholder="Nama harus sesuai dengan buku tabungan"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Memproses...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
