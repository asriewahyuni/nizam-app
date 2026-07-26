'use client'

/**
 * Panel operasional admin/konsultan untuk sesi, catatan, rencana tindakan,
 * penyelesaian engagement, dan penerbitan lencana Consulting 360.
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react'
import type { ConsultingPortalEngagement } from '@/modules/consulting/lib/consulting'
import {
  approveConsultingCompletionAction,
  finalizeConsultingRefundAction,
  requestConsultingRefundAction,
  updateConsultingEngagementAction,
  updateConsultingSessionAction,
} from '@/modules/consulting/actions/consulting.actions'

type ConsultingOperationsClientProps = {
  orgSlug: string
  engagements: ConsultingPortalEngagement[]
  showRefundTools?: boolean
  canFinalizeRefunds?: boolean
}

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

export default function ConsultingOperationsClient({
  orgSlug,
  engagements,
  showRefundTools = false,
  canFinalizeRefunds = false,
}: ConsultingOperationsClientProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(engagements[0]?.id || '')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const selected = engagements.find((engagement) => engagement.id === selectedId) || null
  const upcoming = useMemo(
    () => engagements
      .flatMap((engagement) => engagement.sessions.map((session) => ({
        engagement,
        session,
      })))
      .filter((item) => item.session.status === 'SCHEDULED')
      .sort((left, right) => left.session.startsAt.localeCompare(right.session.startsAt)),
    [engagements],
  )

  function runAction(action: (formData: FormData) => Promise<{
    success: boolean
    error?: string
  }>, formData: FormData, successText: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await action(formData)
      setMessage(
        result.success
          ? { tone: 'success', text: successText }
          : { tone: 'error', text: result.error || 'Perubahan gagal disimpan.' },
      )
      if (result.success) router.refresh()
    })
  }

  if (engagements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <CalendarClock aria-hidden="true" size={28} className="mx-auto text-slate-400" />
        <h2 className="mt-3 font-black text-slate-950">Belum ada engagement Consulting 360</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Engagement akan muncul otomatis setelah pembayaran berhasil.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Kalender seluruh jadwal</h2>
          <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {upcoming.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                Tidak ada sesi terjadwal.
              </p>
            ) : upcoming.map(({ engagement, session }) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(engagement.id)}
                className="flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors duration-200 hover:border-teal-500 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
              >
                <Clock3 aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-teal-700" />
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    {engagement.memberName}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                    {formatDate(session.startsAt, engagement.timezone)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Semua engagement</h2>
          <div className="mt-4 space-y-2">
            {engagements.map((engagement) => (
              <button
                key={engagement.id}
                type="button"
                onClick={() => setSelectedId(engagement.id)}
                className={`min-h-11 w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ${
                  engagement.id === selectedId
                    ? 'border-teal-700 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <span className="block text-sm font-black text-slate-950">{engagement.memberName}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {engagement.productName} · {engagement.completedSessionCount}/{engagement.sessionCount} sesi
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      {selected ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
                  {selected.productName}
                </div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{selected.memberName}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {selected.memberEmail} · Order {selected.orderNumber}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                {selected.status}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <UserRoundCheck aria-hidden="true" size={18} className="text-teal-700" />
                <div className="mt-2 text-xs font-semibold text-slate-500">Konsultan</div>
                <div className="mt-1 text-sm font-black text-slate-950">{selected.consultantName}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <CalendarClock aria-hidden="true" size={18} className="text-teal-700" />
                <div className="mt-2 text-xs font-semibold text-slate-500">Progres</div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {selected.completedSessionCount}/{selected.sessionCount} sesi
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <BadgeCheck aria-hidden="true" size={18} className="text-teal-700" />
                <div className="mt-2 text-xs font-semibold text-slate-500">Lencana</div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {selected.badge ? selected.badge.status : 'Belum terbit'}
                </div>
              </div>
            </div>
            {selected.goals ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Tujuan member</div>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                  {selected.goals}
                </p>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="font-black text-slate-950">Sesi konsultasi</h2>
            {selected.sessions.map((session) => (
              <form
                key={session.id}
                action={(formData) => runAction(
                  updateConsultingSessionAction,
                  formData,
                  `Sesi ${session.sequenceNumber} berhasil diperbarui.`,
                )}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <input type="hidden" name="org_slug" value={orgSlug} />
                <input type="hidden" name="session_id" value={session.id} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      Sesi {session.sequenceNumber} · {formatDate(session.startsAt, selected.timezone)}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {session.deliveryMode} · {session.locationName || session.meetingProvider || 'Lokasi belum diisi'}
                    </div>
                  </div>
                  {session.meetingUrl ? (
                    <a
                      href={session.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                    >
                      Buka Pertemuan
                      <ExternalLink aria-hidden="true" size={16} />
                    </a>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-800">
                    Status
                    <select name="status" defaultValue={session.status === 'SCHEDULED' ? 'COMPLETED' : session.status} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100">
                      <option value="COMPLETED">Selesai</option>
                      <option value="NO_SHOW">Tidak hadir</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-800">
                    Kehadiran
                    <select name="attendance_status" defaultValue={session.attendanceStatus === 'PENDING' ? 'PRESENT' : session.attendanceStatus} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100">
                      <option value="PRESENT">Hadir</option>
                      <option value="LATE">Terlambat</option>
                      <option value="ABSENT">Tidak hadir</option>
                      <option value="EXCUSED">Izin</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-800">
                    Catatan internal
                    <textarea name="internal_notes" defaultValue={session.internalNotes} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100" />
                  </label>
                  <label className="text-sm font-bold text-slate-800">
                    Ringkasan untuk member
                    <textarea name="member_summary" defaultValue={session.memberSummary} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100" />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save aria-hidden="true" size={17} />
                  Simpan Sesi
                </button>
              </form>
            ))}
          </section>

          <form
            action={(formData) => runAction(
              updateConsultingEngagementAction,
              formData,
              'Rencana tindakan dan ringkasan berhasil disimpan.',
            )}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <input type="hidden" name="org_slug" value={orgSlug} />
            <input type="hidden" name="engagement_id" value={selected.id} />
            <h2 className="font-black text-slate-950">Hasil pendampingan</h2>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-bold text-slate-800">
                Rencana tindakan
                <textarea name="action_plan" defaultValue={selected.actionPlan} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100" />
              </label>
              <label className="text-sm font-bold text-slate-800">
                Perkembangan
                <textarea name="progress_summary" defaultValue={selected.progressSummary} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100" />
              </label>
              <label className="text-sm font-bold text-slate-800">
                Ringkasan akhir
                <textarea name="final_summary" defaultValue={selected.finalSummary} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100" />
              </label>
            </div>
            <button type="submit" disabled={isPending} className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60">
              <Save aria-hidden="true" size={17} />
              Simpan Hasil
            </button>
          </form>

          <form
            action={(formData) => runAction(
              approveConsultingCompletionAction,
              formData,
              'Penyelesaian disetujui dan lencana diterbitkan.',
            )}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"
          >
            <input type="hidden" name="org_slug" value={orgSlug} />
            <input type="hidden" name="engagement_id" value={selected.id} />
            <div className="flex items-start gap-3">
              <BadgeCheck aria-hidden="true" size={24} className="shrink-0 text-amber-700" />
              <div>
                <h2 className="font-black text-amber-950">Persetujuan akhir dan lencana</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-800">
                  Tombol ini hanya berhasil setelah seluruh kewajiban sesi dipenuhi. Lencana diterbitkan satu kali dan dapat diverifikasi publik.
                </p>
              </div>
            </div>
            <button type="submit" disabled={isPending || selected.status === 'COMPLETED'} className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 text-sm font-black text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
              <BadgeCheck aria-hidden="true" size={18} />
              {selected.status === 'COMPLETED' ? 'Sudah Disetujui' : 'Setujui dan Terbitkan Lencana'}
            </button>
          </form>

          {showRefundTools && !['CANCELLED', 'REFUNDED'].includes(selected.status) ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" size={24} className="shrink-0 text-rose-700" />
                <div>
                  <h2 className="font-black text-rose-950">Refund penuh</h2>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-rose-800">
                    Sebelum sesi pertama, refund mengikuti proses biasa. Setelah sesi dimulai,
                    owner/admin wajib memberikan override dan alasan. Penyelesaian refund
                    membalik jurnal, mencabut manfaat order, membatalkan sesi mendatang,
                    serta mencabut lencana tanpa menghapus catatan dan progres belajar.
                  </p>
                </div>
              </div>

              <form
                action={(formData) => runAction(
                  requestConsultingRefundAction,
                  formData,
                  'Permintaan refund dicatat. Jika provider menunggu proses manual, kembalikan dana lalu gunakan tombol konfirmasi.',
                )}
                className="mt-5 space-y-3"
              >
                <input type="hidden" name="org_slug" value={orgSlug} />
                <input type="hidden" name="engagement_id" value={selected.id} />
                <label className="block text-sm font-bold text-rose-950">
                  Alasan refund
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-rose-700 focus:ring-4 focus:ring-rose-200"
                    placeholder="Jelaskan alasan refund secara lengkap."
                  />
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-950">
                  <input
                    type="checkbox"
                    name="allow_started_override"
                    value="true"
                    className="size-5 cursor-pointer rounded border-rose-300 text-rose-700 focus:ring-rose-500"
                  />
                  Izinkan override jika sesi sudah dimulai
                </label>
                <label className="block text-sm font-bold text-rose-950">
                  Alasan override setelah sesi dimulai
                  <textarea
                    name="override_reason"
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-rose-700 focus:ring-4 focus:ring-rose-200"
                    placeholder="Wajib diisi jika menggunakan override."
                  />
                </label>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-black text-white transition-colors duration-200 hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw aria-hidden="true" size={18} />
                  Ajukan Refund Penuh
                </button>
              </form>

              {canFinalizeRefunds ? (
                <form
                  action={(formData) => runAction(
                    finalizeConsultingRefundAction,
                    formData,
                    'Refund selesai; transaksi ERP dibalik dan manfaat order dicabut.',
                  )}
                  className="mt-5 border-t border-rose-200 pt-5"
                >
                  <input type="hidden" name="org_slug" value={orgSlug} />
                  <input type="hidden" name="engagement_id" value={selected.id} />
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-rose-300 bg-rose-100 px-3 py-3 text-sm font-bold leading-relaxed text-rose-950">
                    <input
                      type="checkbox"
                      name="confirm_refund"
                      value="true"
                      required
                      className="mt-0.5 size-5 cursor-pointer rounded border-rose-400 text-rose-700 focus:ring-rose-500"
                    />
                    Saya memastikan dana benar-benar sudah dikembalikan kepada member.
                  </label>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-700 bg-white px-5 text-sm font-black text-rose-800 transition-colors duration-200 hover:bg-rose-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldAlert aria-hidden="true" size={18} />
                    Konfirmasi Dana dan Selesaikan Refund
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          {message ? (
            <div role={message.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
              message.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}>
              {message.tone === 'error'
                ? <CircleAlert aria-hidden="true" size={18} />
                : <Check aria-hidden="true" size={18} />}
              {message.text}
            </div>
          ) : null}
          {isPending ? (
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
              Menyimpan perubahan…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
