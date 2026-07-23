/**
 * Halaman tujuan QR kehadiran peserta.
 */
import { CalendarCheck2, ShieldCheck } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import AttendanceCheckInForm from './AttendanceCheckInForm'

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ sessionId?: string; token?: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  const query = await searchParams
  const callback = `/member/${orgSlug}/kehadiran?sessionId=${encodeURIComponent(
    query.sessionId || '',
  )}&token=${encodeURIComponent(query.token || '')}`
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`)
  const validLink = Boolean(query.sessionId && query.token)

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <CalendarCheck2 aria-hidden="true" size={28} />
        </span>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-emerald-700">
          Kehadiran kelas
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">
          Konfirmasi check-in
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Masuk sebagai <strong>{member.displayName}</strong>. Kehadiran hanya
          dicatat bila akun ini memiliki akses aktif ke sesi.
        </p>
        {validLink ? (
          <AttendanceCheckInForm
            orgSlug={orgSlug}
            sessionId={query.sessionId!}
            token={query.token!}
          />
        ) : (
          <p role="alert" className="mt-7 rounded-xl bg-red-50 p-4 font-semibold text-red-900">
            Tautan QR tidak lengkap. Pindai ulang QR dari tutor.
          </p>
        )}
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck aria-hidden="true" size={17} />
          Token memiliki masa berlaku dan tidak menyimpan kata sandi.
        </p>
      </div>
    </div>
  )
}
