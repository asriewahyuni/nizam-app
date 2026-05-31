import { redirect } from 'next/navigation'
import { XCircle, Clock, LogIn, LogOut } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { clockByQRScan } from '@/modules/hris/actions/self-service.actions'

export const dynamic = 'force-dynamic'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} menit`
  return `${h} jam ${m > 0 ? `${m} menit` : ''}`.trim()
}

export default async function PresensiScanPage(props: {
  params: Promise<{ orgId: string; branchId: string }>
}) {
  const { orgId, branchId } = await props.params

  const orgData = await getActiveOrg()
  if (!orgData) return redirect(`/login?next=/presensi/scan/${orgId}/${branchId}`)
  if (orgData.org.id !== orgId) return redirect('/')

  const result = await clockByQRScan(orgId, branchId)

  // ── Error ──
  if ('error' in result) {
    return (
      <div className="min-h-[90vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center mx-auto mb-6">
          <XCircle size={44} className="text-rose-500" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Gagal Presensi</h1>
        <p className="text-slate-500 font-medium mt-2 max-w-xs">{result.error}</p>
        <a
          href="/profil-saya"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold uppercase tracking-wider"
        >
          Ke Profil Saya
        </a>
      </div>
    )
  }

  // ── Already complete ──
  if (result.action === 'ALREADY_COMPLETE') {
    return (
      <div className="min-h-[90vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-slate-200 flex items-center justify-center mx-auto mb-6">
          <Clock size={44} className="text-slate-500" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Sudah Lengkap</p>
        <h1 className="text-2xl font-semibold text-slate-900">{result.employeeName}</h1>
        <p className="text-slate-500 font-medium mt-3">
          Anda sudah presensi penuh hari ini.
        </p>
        <div className="mt-6 flex items-center gap-6 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Masuk</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{formatTime(result.checkIn)}</p>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Keluar</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{formatTime(result.checkOut)}</p>
          </div>
        </div>
        <a
          href="/profil-saya"
          className="mt-10 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold uppercase tracking-wider"
        >
          Kembali
        </a>
      </div>
    )
  }

  // ── Clock IN ──
  if (result.action === 'IN') {
    return (
      <div className="min-h-[90vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-28 h-28 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
          <LogIn size={52} className="text-emerald-500" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mb-2">Clock In Berhasil</p>
        <h1 className="text-3xl font-semibold text-slate-900">{result.employeeName}</h1>
        <p className="text-5xl font-semibold text-emerald-600 mt-4 tabular-nums">
          {formatTime(result.time)}
        </p>
        <p className="text-slate-400 font-semibold text-sm mt-2">
          {new Date(result.time).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            timeZone: 'Asia/Jakarta',
          })}
        </p>
        <div className="mt-8 px-6 py-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-sm font-semibold text-emerald-700">Selamat bekerja! 🌟</p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">Kehadiran Anda telah tercatat.</p>
        </div>
        <a
          href="/profil-saya"
          className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition-colors"
        >
          Lihat riwayat presensi →
        </a>
      </div>
    )
  }

  // ── Clock OUT ──
  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-28 h-28 rounded-full bg-sky-50 border-4 border-sky-100 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sky-100">
        <LogOut size={52} className="text-sky-500" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 mb-2">Clock Out Berhasil</p>
      <h1 className="text-3xl font-semibold text-slate-900">{result.employeeName}</h1>
      <p className="text-5xl font-semibold text-sky-600 mt-4 tabular-nums">
        {formatTime(result.time)}
      </p>
      <p className="text-slate-400 font-semibold text-sm mt-2">
        {new Date(result.time).toLocaleDateString('id-ID', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          timeZone: 'Asia/Jakarta',
        })}
      </p>
      <div className="mt-6 px-6 py-4 rounded-xl bg-sky-50 border border-sky-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400 mb-1">Durasi Kerja</p>
        <p className="text-2xl font-semibold text-sky-700">{formatDuration(result.durationMinutes)}</p>
      </div>
      <div className="mt-4 px-6 py-3 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-sm font-semibold text-slate-600">Sampai jumpa! Istirahat yang baik. ✨</p>
      </div>
      <a
        href="/profil-saya"
        className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition-colors"
      >
        Lihat riwayat presensi →
      </a>
    </div>
  )
}
