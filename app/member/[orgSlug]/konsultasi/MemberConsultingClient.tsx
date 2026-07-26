'use client'

/**
 * Portal member Consulting 360: progres, jadwal, tautan pertemuan, kalender,
 * perubahan jadwal, hasil konsultasi, dan lencana.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Target,
} from 'lucide-react'
import type {
  ConsultingAvailabilitySlot,
  ConsultingPortalEngagement,
} from '@/modules/consulting/lib/consulting'
import { rescheduleConsultingSessionAction } from '@/modules/consulting/actions/consulting.actions'

type MemberConsultingClientProps = {
  orgSlug: string
  basePath: string
  engagements: ConsultingPortalEngagement[]
}

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function Countdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const difference = new Date(startsAt).getTime() - now
  if (difference <= 0) return <span>Sesi sedang/akan berlangsung</span>
  const days = Math.floor(difference / 86_400_000)
  const hours = Math.floor((difference % 86_400_000) / 3_600_000)
  const minutes = Math.floor((difference % 3_600_000) / 60_000)
  return <span>{days > 0 ? `${days} hari ` : ''}{hours} jam {minutes} menit lagi</span>
}

function ReschedulePanel({
  orgSlug,
  engagement,
  sessionId,
}: {
  orgSlug: string
  engagement: ConsultingPortalEngagement
  sessionId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<ConsultingAvailabilitySlot[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadSlots() {
    setOpen(true)
    setLoading(true)
    setMessage(null)
    try {
      const params = new URLSearchParams({
        orgSlug,
        storeSlug: engagement.storeSlug,
        storeProductId: engagement.storeProductId,
        consultantId: engagement.consultantId,
      })
      const response = await fetch(`/api/ecommerce/consulting/availability?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Jadwal tidak dapat dimuat.')
      setSlots((result.data?.slots || []) as ConsultingAvailabilitySlot[])
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Jadwal tidak dapat dimuat.',
      })
    } finally {
      setLoading(false)
    }
  }

  function submit() {
    const formData = new FormData()
    formData.set('org_slug', orgSlug)
    formData.set('session_id', sessionId)
    formData.set('starts_at', selected)
    formData.set('reason', 'Perubahan jadwal oleh member dari portal Consulting 360')
    startTransition(async () => {
      const result = await rescheduleConsultingSessionAction(formData)
      setMessage(
        result.success
          ? { tone: 'success', text: 'Jadwal berhasil diubah.' }
          : { tone: 'error', text: result.error || 'Jadwal gagal diubah.' },
      )
      if (result.success) {
        setSelected('')
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => void loadSlots()} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
        <RotateCcw aria-hidden="true" size={17} />
        Ubah Jadwal
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-black text-slate-950">Pilih waktu baru</div>
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-500">
          <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" />
          Memuat jadwal…
        </div>
      ) : (
        <select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100">
          <option value="">Pilih waktu tersedia</option>
          {slots.map((slot) => (
            <option key={slot.startsAt} value={slot.startsAt}>
              {slot.dateLabel} · {slot.timeLabel}
            </option>
          ))}
        </select>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={!selected || isPending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" /> : <Check aria-hidden="true" size={17} />}
          Simpan Jadwal Baru
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
          Batal
        </button>
      </div>
      {message ? (
        <div role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
          message.tone === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {message.tone === 'error' ? <CircleAlert aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} />}
          {message.text}
        </div>
      ) : null}
    </div>
  )
}

export default function MemberConsultingClient({
  orgSlug,
  basePath,
  engagements,
}: MemberConsultingClientProps) {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const upcomingCount = useMemo(
    () => engagements.flatMap((engagement) => engagement.sessions)
      .filter((session) => session.status === 'SCHEDULED' && new Date(session.startsAt) > new Date())
      .length,
    [engagements],
  )

  if (engagements.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-white p-10 text-center">
        <CalendarDays aria-hidden="true" size={42} className="mx-auto text-emerald-700" />
        <h2 className="mt-4 text-lg font-black">Belum ada paket Consulting 360</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Paket akan tampil di sini setelah pembayaran berhasil.
        </p>
        <Link href={`${basePath}/katalog`} className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
          Lihat katalog
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Target aria-hidden="true" size={20} className="text-emerald-700" />
          <div className="mt-3 text-2xl font-black">{engagements.length}</div>
          <div className="text-sm font-semibold text-slate-500">Program pendampingan</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Clock3 aria-hidden="true" size={20} className="text-emerald-700" />
          <div className="mt-3 text-2xl font-black">{upcomingCount}</div>
          <div className="text-sm font-semibold text-slate-500">Sesi mendatang</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <BadgeCheck aria-hidden="true" size={20} className="text-emerald-700" />
          <div className="mt-3 text-2xl font-black">{engagements.filter((item) => item.badge).length}</div>
          <div className="text-sm font-semibold text-slate-500">Lencana terbit</div>
        </div>
      </div>

      {engagements.map((engagement) => {
        const percent = Math.round(
          Math.min(100, engagement.completedSessionCount / Math.max(1, engagement.sessionCount) * 100),
        )
        return (
          <article key={engagement.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="bg-emerald-950 px-5 py-5 text-white sm:px-6">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Consulting 360
              </div>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">{engagement.productName}</h2>
                  <p className="mt-1 text-sm font-semibold text-emerald-100">
                    bersama {engagement.consultantName}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
                  {engagement.status}
                </span>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs font-bold text-emerald-100">
                  <span>{engagement.completedSessionCount}/{engagement.sessionCount} sesi terpenuhi</span>
                  <span>{percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </header>

            <div className="space-y-6 p-5 sm:p-6">
              {engagement.goals ? (
                <section>
                  <h3 className="flex items-center gap-2 font-black text-slate-950">
                    <Target aria-hidden="true" size={18} className="text-emerald-700" />
                    Tujuan konsultasi
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600">
                    {engagement.goals}
                  </p>
                </section>
              ) : null}

              <section>
                <h3 className="font-black text-slate-950">Jadwal sesi</h3>
                <div className="mt-3 space-y-3">
                  {engagement.sessions.map((session) => (
                    <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-black text-slate-950">Sesi {session.sequenceNumber}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-600">
                            {formatDate(session.startsAt, engagement.timezone)}
                          </div>
                          {session.status === 'SCHEDULED' ? (
                            <div className="mt-2 text-xs font-black text-emerald-700">
                              <Countdown startsAt={session.startsAt} />
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <MapPin aria-hidden="true" size={15} />
                            {session.locationName || session.meetingProvider || session.deliveryMode}
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                          {session.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {session.meetingUrl && session.status === 'SCHEDULED' ? (
                          <a href={session.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
                            Buka Pertemuan
                            <ExternalLink aria-hidden="true" size={16} />
                          </a>
                        ) : null}
                        <a href={`/api/consulting/sessions/${session.id}/calendar`} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
                          <CalendarDays aria-hidden="true" size={16} />
                          Tambah ke Kalender
                        </a>
                        {(session.status === 'SCHEDULED'
                          || (
                            session.status === 'NO_SHOW'
                            && !engagement.noShowConsumesSession
                          ))
                          && session.rescheduleCount < engagement.rescheduleLimit ? (
                            <ReschedulePanel
                              orgSlug={orgSlug}
                              engagement={engagement}
                              sessionId={session.id}
                            />
                          ) : null}
                      </div>
                      {session.memberSummary ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium leading-relaxed text-emerald-900">
                          {session.memberSummary}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              {(engagement.actionPlan || engagement.progressSummary || engagement.finalSummary) ? (
                <section className="grid gap-3 md:grid-cols-3">
                  {[
                    ['Rencana tindakan', engagement.actionPlan],
                    ['Perkembangan', engagement.progressSummary],
                    ['Ringkasan akhir', engagement.finalSummary],
                  ].filter((item) => item[1]).map(([title, value]) => (
                    <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">{value}</p>
                    </div>
                  ))}
                </section>
              ) : null}

              {engagement.badge ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="rounded-xl bg-white p-3">
                      {origin ? (
                        <QRCodeSVG
                          value={`${origin}/verifikasi/lencana/${engagement.badge.verificationToken}`}
                          size={104}
                          level="M"
                        />
                      ) : (
                        <div className="size-[104px] animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-amber-950">
                        <BadgeCheck aria-hidden="true" size={22} />
                        <h3 className="font-black">{engagement.badge.title}</h3>
                      </div>
                      <p className="mt-2 font-mono text-sm font-bold text-amber-900">
                        {engagement.badge.badgeNumber}
                      </p>
                      <Link href={`/verifikasi/lencana/${engagement.badge.verificationToken}`} className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-black text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
                        Verifikasi Lencana
                        <ExternalLink aria-hidden="true" size={16} />
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
