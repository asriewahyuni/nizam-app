'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  TicketPercent,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  activateMemberAffiliateAction,
  cloneAffiliateTemplateCouponAction,
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'courses' | 'coupons' | 'leaderboard' | 'commissions'>('courses')
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null)
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null)
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null)
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

  const handleCopyCoupon = (code: string, couponId: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCouponId(couponId)
    setTimeout(() => setCopiedCouponId(null), 2000)
  }

  const handleCloneTemplate = (templateId: string) => {
    setMessage(null)
    setCloningTemplateId(templateId)
    startTransition(async () => {
      const res = await cloneAffiliateTemplateCouponAction(orgSlug, templateId)
      setCloningTemplateId(null)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: `Kupon ${res.coupon?.code} berhasil dibuat untuk Anda!` })
        router.refresh()
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
    <div className="px-4 py-6 font-sans">
      {/* Alert Notification */}
      {message && (
        <div className={`mb-6 rounded-2xl p-4 border text-xs font-medium flex items-center justify-between shadow-sm ${message.type === 'success' ? 'bg-emerald-900/10 border-emerald-500/30 text-emerald-700' : 'bg-rose-900/10 border-rose-500/30 text-rose-700'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="cursor-pointer text-xs underline font-semibold">Tutup</button>
        </div>
      )}

      {/* Hero / Shareable Card Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-5 text-white shadow-xl border border-emerald-500/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold uppercase tracking-wider">
              <Sparkles size={12} className="text-emerald-400 animate-pulse" />
              <span>Program Afiliasi Resmi {tenantName}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
              Promosikan Kelas &amp; Dapatkan Komisi Hingga <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">20%+</span>
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              Bagikan tautan edukasi berkualitas kepada komunitas Anda. Dapatkan komisi transparan setiap kali ada pendaftar baru lewat rekomendasi Anda.
            </p>
          </div>

          {/* Opt-In or Code Box */}
          <div className="w-full shrink-0">
            {!dashboard.isActivated ? (
              <div className="rounded-2xl bg-white/10 backdrop-blur-md p-5 border border-white/20 text-center w-full">
                <Lock className="mx-auto text-emerald-400 mb-2.5" size={28} />
                <h3 className="font-bold text-base text-white">Aktifkan Akun Afiliasi</h3>
                <p className="text-[11px] text-slate-300 mt-1 mb-4">
                  Klik di bawah ini untuk mengaktifkan kode referral Anda dan mulai membagikan kelas.
                </p>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Flame size={16} />
                  <span>{isPending ? 'Mengaktifkan...' : 'Aktifkan Akun Afiliasi Saya'}</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur-xl p-4 border border-emerald-500/30 shadow-xl w-full">
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Link2 size={12} /> Tautan Referral Utama
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Aktif</span>
                </div>
                <div className="flex items-center gap-2 mb-2.5">
                  <code className="flex-1 overflow-x-auto rounded-lg bg-black/40 px-2.5 py-2 text-xs font-mono text-emerald-300 border border-white/10">
                    {mainReferralUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(mainReferralUrl)}
                    className="p-2.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer shrink-0"
                    title="Salin Link"
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-white/10">
                  <span>Kode Unik: <strong className="text-white font-mono">{dashboard.referralCode}</strong></span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Share2 size={10} /> Shareable Card
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards (Statistik Aset & Komisi) */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Masa Tahan</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><MousePointerClick size={16} /></div>
          </div>
          <p className="mt-2 text-base font-black text-slate-900">{formatRupiah(dashboard.pendingAmount)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Dalam verifikasi</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">Siap Tarik</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"><HandCoins size={16} /></div>
          </div>
          <p className="mt-2 text-base font-black text-emerald-900">{formatRupiah(dashboard.payableAmount)}</p>
          {dashboard.payableAmount > 0 && dashboard.isActivated ? (
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="mt-1.5 block text-[10px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer underline text-left"
            >
              Tarik Dana &rarr;
            </button>
          ) : (
            <p className="mt-0.5 text-[9px] text-emerald-600 font-medium">Min. Rp 50.000</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Dicairkan</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Wallet size={16} /></div>
          </div>
          <p className="mt-2 text-base font-black text-slate-900">{formatRupiah(dashboard.paidAmount)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Total komisi</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pembeli</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600"><Users size={16} /></div>
          </div>
          <p className="mt-2 text-base font-black text-slate-900">{dashboard.conversionCount} Penjualan</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Konversi referal</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="mt-8 flex border-b border-slate-200 gap-4 overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'courses' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Sparkles size={14} />
          <span>Katalog Kelas ({dashboard.eligibleCourses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'coupons' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <TicketPercent size={14} />
          <span>Kupon Saya ({dashboard.coupons.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'leaderboard' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Trophy size={14} />
          <span>Leaderboard 🏆</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'commissions' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <HandCoins size={14} />
          <span>Riwayat Komisi</span>
        </button>
      </div>

      {/* Tab Content 1: Katalog Kelas Afiliasi */}
      {activeTab === 'courses' && (
        <div className="mt-5">
          <p className="text-xs text-slate-600 mb-5">
            Pilih kelas yang ingin Anda promosikan. Dapatkan komisi instan untuk setiap peserta yang mendaftar melalui link referral khusus Anda.
          </p>

          <div className="flex flex-col gap-4">
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
      {/* Tab Content: Kupon Afiliasi (personal + hasil clone template admin) */}
      {activeTab === 'coupons' && (
        <div className="mt-5 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Kupon Milik Saya</h3>
            <p className="text-xs text-slate-500 mb-4">
              Bagikan kode ini langsung ke calon pembeli. Setiap kali dipakai saat checkout, Anda otomatis mendapat komisi dan pembeli mendapat diskon.
            </p>
            {!dashboard.isActivated ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
                Aktifkan akun afiliasi Anda terlebih dahulu untuk mendapatkan kupon personal.
              </p>
            ) : dashboard.coupons.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
                Kupon personal Anda sedang disiapkan sistem, muat ulang halaman beberapa saat lagi.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dashboard.coupons.map((coupon) => (
                  <div key={coupon.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-bold text-slate-900">{coupon.code}</code>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${coupon.isPersonal ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {coupon.isPersonal ? 'Personal' : 'Dari Template'}
                        </span>
                        {!coupon.isActive && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Nonaktif</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Diskon {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : formatRupiah(coupon.discountValue)} untuk pembeli
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCoupon(coupon.code, coupon.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      {copiedCouponId === coupon.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCouponId === coupon.id ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dashboard.isActivated && dashboard.availableCouponTemplates.length > 0 && (
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Kupon Admin Tersedia</h3>
              <p className="text-xs text-slate-500 mb-4">
                Admin sudah menyiapkan kupon ini. Klik "Gunakan Kupon Ini" untuk mendapatkan versi kupon ini yang khusus terlacak atas nama Anda.
              </p>
              <div className="flex flex-col gap-3">
                {dashboard.availableCouponTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <code className="font-mono text-sm font-bold text-slate-900">{template.code}</code>
                      <p className="mt-1 text-xs text-slate-500">
                        Diskon {template.discountType === 'PERCENT' ? `${template.discountValue}%` : formatRupiah(template.discountValue)}
                        {template.minimumAmount > 0 ? ` · Min. belanja ${formatRupiah(template.minimumAmount)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending && cloningTemplateId === template.id}
                      onClick={() => handleCloneTemplate(template.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
                    >
                      <TicketPercent size={14} />
                      <span>{isPending && cloningTemplateId === template.id ? 'Memproses...' : 'Gunakan Kupon Ini'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Leaderboard Afiliasi */}
      {activeTab === 'leaderboard' && (
        <div className="mt-5">
          <div className="mb-5 flex flex-col gap-3 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl text-white">
            <div>
              <h3 className="font-bold text-base flex items-center gap-1.5">
                <Award className="text-amber-400" size={18} /> Klasemen Peringkat Mitra
              </h3>
              <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                Peringkat diperbarui secara otomatis berdasarkan total penjualan &amp; komisi. Nama ditampilkan tersamar demi privasi.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 text-[10px] font-semibold text-amber-300 self-start">
              <Flame size={12} /> Top 10 Performa Terbaik
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse min-w-[400px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Peringkat</th>
                  <th className="py-3 px-4">Nama Mitra</th>
                  <th className="py-3 px-4 text-center">Penjualan</th>
                  <th className="py-3 px-4 text-right">Total Komisi</th>
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
                        <td className="py-3 px-4 font-bold">
                          {isTop1 && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shadow">🥇 1</span>}
                          {isTop2 && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-[10px] shadow">🥈 2</span>}
                          {isTop3 && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-[10px] shadow">🥉 3</span>}
                          {!isTop1 && !isTop2 && !isTop3 && <span className="text-slate-500 font-semibold pl-1.5">#{entry.rank}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{entry.maskedDisplayName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Kode: {entry.referralCode}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {entry.totalConversions}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700">
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
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Saldo Komisi Siap Ditarik</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Saldo yang telah melewati masa tahan dan dapat dicairkan ke rekening Anda.</p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-lg font-black text-emerald-700">{formatRupiah(dashboard.payableAmount)}</span>
              {dashboard.payableAmount >= 50000 && dashboard.isActivated && (
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(true)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
                >
                  Cairkan Dana
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-900 text-sm">
              Riwayat Komisi Per Transaksi ({dashboard.commissions.length})
            </div>
            <ul className="divide-y divide-slate-100">
              {dashboard.commissions.length === 0 ? (
                <li className="p-6 text-center text-slate-500 text-xs">Belum ada riwayat komisi.</li>
              ) : (
                dashboard.commissions.map((comm) => (
                  <li key={comm.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{comm.orderNumber || 'Komisi Penjualan Kelas'}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comm.createdAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-700 text-xs">{formatRupiah(comm.amount)}</p>
                      <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${comm.status === 'PAID' ? 'bg-blue-100 text-blue-700' : comm.status === 'PAYABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
