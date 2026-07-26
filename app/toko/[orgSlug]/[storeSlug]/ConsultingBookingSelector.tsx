'use client'

/**
 * Pemilih konsultan dan seluruh slot Consulting 360 sebelum checkout.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import type {
  ConsultingAvailabilitySlot,
  ConsultingHoldResult,
  PublicConsultingOffering,
} from '@/modules/consulting/lib/consulting'

type AvailabilityPayload = {
  sessionCount: number
  durationMinutes: number
  timezone: string
  slots: ConsultingAvailabilitySlot[]
}

type ConsultingBookingSelectorProps = {
  orgSlug: string
  storeSlug: string
  storeProductId: string
  offering: PublicConsultingOffering
  onHoldChange: (hold: ConsultingHoldResult | null) => void
}

function countdownLabel(expiresAt: string, now: number) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now)
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function ConsultingBookingSelector({
  orgSlug,
  storeSlug,
  storeProductId,
  offering,
  onHoldChange,
}: ConsultingBookingSelectorProps) {
  const [consultantId, setConsultantId] = useState(offering.consultants[0]?.id || '')
  const [availability, setAvailability] = useState<AvailabilityPayload | null>(null)
  const [selectedStarts, setSelectedStarts] = useState<string[]>([])
  const [goals, setGoals] = useState('')
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})
  const [hold, setHold] = useState<ConsultingHoldResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [holding, setHolding] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const onHoldChangeRef = useRef(onHoldChange)

  useEffect(() => {
    onHoldChangeRef.current = onHoldChange
  }, [onHoldChange])

  useEffect(() => {
    if (!consultantId) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setAvailability(null)
    setSelectedStarts([])
    setHold(null)
    onHoldChangeRef.current(null)
    const params = new URLSearchParams({
      orgSlug,
      storeSlug,
      storeProductId,
      consultantId,
    })
    fetch(`/api/ecommerce/consulting/availability?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Jadwal tidak dapat dimuat.')
        setAvailability(result.data as AvailabilityPayload)
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Jadwal tidak dapat dimuat.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [consultantId, orgSlug, storeProductId, storeSlug])

  useEffect(() => {
    if (!hold) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= new Date(hold.expiresAt).getTime()) {
        setHold(null)
        onHoldChangeRef.current(null)
        setError('Waktu penahanan jadwal habis. Pilih dan tahan jadwal kembali.')
      }
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [hold])

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, ConsultingAvailabilitySlot[]>()
    for (const slot of availability?.slots || []) {
      const bucket = groups.get(slot.dateLabel) || []
      bucket.push(slot)
      groups.set(slot.dateLabel, bucket)
    }
    return [...groups.entries()].slice(0, 30)
  }, [availability])

  function toggleSlot(startsAt: string) {
    if (hold) return
    setError('')
    setSelectedStarts((current) => {
      if (current.includes(startsAt)) return current.filter((value) => value !== startsAt)
      if (current.length >= offering.sessionCount) return current
      return [...current, startsAt].sort()
    })
  }

  async function holdSchedule() {
    if (selectedStarts.length !== offering.sessionCount) {
      setError(`Pilih tepat ${offering.sessionCount} jadwal sebelum melanjutkan.`)
      return
    }
    const missingRequired = offering.intakeFields.find(
      (field) => field.required && !String(intakeAnswers[field.key] || '').trim(),
    )
    if (missingRequired) {
      setError(`Isi dahulu: ${missingRequired.label}.`)
      return
    }
    setHolding(true)
    setError('')
    try {
      const response = await fetch('/api/ecommerce/consulting/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug,
          storeSlug,
          storeProductId,
          consultantId,
          startsAt: selectedStarts,
          goals,
          intakeAnswers,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Jadwal gagal ditahan.')
      const nextHold = result.data as ConsultingHoldResult
      setHold(nextHold)
      setNow(Date.now())
      onHoldChange(nextHold)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Jadwal gagal ditahan.')
    } finally {
      setHolding(false)
    }
  }

  const selectedConsultant = offering.consultants.find(
    (consultant) => consultant.id === consultantId,
  )

  return (
    <section
      aria-labelledby={`consulting-booking-${storeProductId}`}
      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
          <CalendarDays aria-hidden="true" size={20} />
        </div>
        <div>
          <h2
            id={`consulting-booking-${storeProductId}`}
            className="text-base font-black text-slate-950"
          >
            Pilih konsultan dan {offering.sessionCount} jadwal
          </h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
            Seluruh jadwal dipilih sekarang dan akan ditahan 15 menit saat Anda melanjutkan checkout.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Clock3 aria-hidden="true" size={17} className="text-teal-700" />
          <div className="mt-2 text-xs font-black text-slate-950">
            {offering.sessionCount} sesi × {offering.durationMinutes} menit
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <MapPin aria-hidden="true" size={17} className="text-teal-700" />
          <div className="mt-2 text-xs font-black text-slate-950">
            {offering.deliveryMode === 'ONLINE'
              ? 'Pertemuan online'
              : offering.deliveryMode === 'OFFLINE'
                ? offering.locationName || 'Pertemuan offline'
                : 'Online atau offline'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <RotateCcw aria-hidden="true" size={17} className="text-teal-700" />
          <div className="mt-2 text-xs font-black text-slate-950">
            Maks. {offering.rescheduleLimit}× ubah jadwal
          </div>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-black text-slate-950">1. Pilih konsultan</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {offering.consultants.map((consultant) => {
            const active = consultant.id === consultantId
            return (
              <button
                key={consultant.id}
                type="button"
                onClick={() => setConsultantId(consultant.id)}
                className={`min-h-11 cursor-pointer rounded-xl border p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ${
                  active
                    ? 'border-teal-700 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  {consultant.avatarUrl ? (
                    <img
                      src={consultant.avatarUrl}
                      alt=""
                      className="size-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                      <UserRoundCheck aria-hidden="true" size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-black text-slate-950">
                      <span className="truncate">{consultant.displayName}</span>
                      {active ? <Check aria-hidden="true" size={16} className="text-teal-700" /> : null}
                    </div>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                      {consultant.headline || consultant.expertise.slice(0, 3).join(' • ') || 'Konsultan Consulting 360'}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {selectedConsultant?.biography ? (
          <p className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-medium leading-relaxed text-slate-600">
            {selectedConsultant.biography}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-black text-slate-950">
          2. Pilih {offering.sessionCount} waktu pertemuan
        </legend>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Terpilih {selectedStarts.length} dari {offering.sessionCount} sesi • zona waktu {offering.timezone}
        </p>
        {loading ? (
          <div className="mt-3 flex min-h-24 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600">
            <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
            Memuat jadwal…
          </div>
        ) : (
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
            {groupedSlots.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm font-semibold text-slate-500">
                Belum ada jadwal tersedia untuk konsultan ini.
              </div>
            ) : groupedSlots.map(([date, slots]) => (
              <div key={date}>
                <div className="text-xs font-black text-slate-700">{date}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const active = selectedStarts.includes(slot.startsAt)
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={Boolean(hold)}
                        onClick={() => toggleSlot(slot.startsAt)}
                        aria-pressed={active}
                        className={`min-h-11 cursor-pointer rounded-xl border px-3 py-2 text-xs font-black transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed ${
                          active
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-800'
                        }`}
                      >
                        {slot.timeLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div className="mt-5 space-y-3">
        <label className="block text-sm font-black text-slate-950">
          3. Tujuan utama konsultasi
          <textarea
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
            disabled={Boolean(hold)}
            rows={3}
            maxLength={5000}
            placeholder="Ceritakan hasil yang ingin Anda capai."
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
          />
        </label>
        {offering.intakeFields.map((field) => (
          <label key={field.key} className="block text-sm font-black text-slate-950">
            {field.label}
            {field.required ? <span className="ml-1 text-rose-700">*</span> : null}
            <textarea
              value={intakeAnswers[field.key] || ''}
              onChange={(event) => setIntakeAnswers((current) => ({
                ...current,
                [field.key]: event.target.value,
              }))}
              disabled={Boolean(hold)}
              rows={2}
              maxLength={2000}
              placeholder={field.placeholder}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>

      {offering.badge ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <BadgeCheck aria-hidden="true" size={22} className="shrink-0 text-amber-700" />
          <div>
            <div className="text-sm font-black text-amber-950">{offering.badge.title}</div>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800">
              {offering.badge.description}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {hold ? (
        <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" size={21} className="shrink-0 text-emerald-700" />
            <div>
              <div className="text-sm font-black text-emerald-950">Seluruh jadwal berhasil ditahan</div>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Selesaikan checkout dalam {countdownLabel(hold.expiresAt, now)} agar jadwal tidak dilepas.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void holdSchedule()}
          disabled={holding || selectedStarts.length !== offering.sessionCount}
          className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-colors duration-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {holding ? (
            <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
          ) : (
            <CalendarDays aria-hidden="true" size={18} />
          )}
          {holding ? 'Menahan jadwal…' : `Tahan ${offering.sessionCount} jadwal selama 15 menit`}
        </button>
      )}
    </section>
  )
}
