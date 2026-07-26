'use client'

/**
 * Form administrasi Consulting 360 yang memakai data produk, store, course,
 * paket akses, instruktur, dan karyawan yang sama dengan modul inti.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  PencilLine,
  Plus,
  Save,
  UserRoundCheck,
} from 'lucide-react'
import type { EcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce'
import type {
  ConsultingAdminOffering,
  ConsultingAdminOverview,
  ConsultingDeliveryMode,
} from '@/modules/consulting/lib/consulting'
import {
  saveConsultingAvailabilityExceptionAction,
  saveConsultingOfferingAction,
} from '@/modules/consulting/actions/consulting.actions'

type Consulting360ManagerProps = {
  dashboardData: EcommerceDashboardData
  overview: ConsultingAdminOverview
  initialOffering?: ConsultingAdminOffering | null
  showList?: boolean
  editorMode?: boolean
  returnTo?: string
}

type Draft = {
  offeringId: string
  productId: string
  storeId: string
  name: string
  price: string
  shortDescription: string
  publicDescription: string
  sessionCount: string
  durationMinutes: string
  bookingHorizonDays: string
  minimumNoticeHours: string
  rescheduleLimit: string
  rescheduleCutoffHours: string
  noShowConsumesSession: boolean
  deliveryMode: ConsultingDeliveryMode
  locationName: string
  defaultMeetingUrl: string
  meetingProvider: string
  isPublished: boolean
  consultantIds: string[]
  weekdays: number[]
  startLocal: string
  endLocal: string
  badgeTemplateId: string
  courseIds: string[]
  packageIds: string[]
  intakeQuestions: string
}

const DAY_OPTIONS = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Min' },
]

function createDefaultDraft(storeId = ''): Draft {
  return {
    offeringId: '',
    productId: '',
    storeId,
    name: 'Consulting 360 ',
    price: '0',
    shortDescription: 'Pendampingan privat terjadwal bersama konsultan pilihan.',
    publicDescription: '',
    sessionCount: '4',
    durationMinutes: '60',
    bookingHorizonDays: '90',
    minimumNoticeHours: '24',
    rescheduleLimit: '2',
    rescheduleCutoffHours: '24',
    noShowConsumesSession: true,
    deliveryMode: 'ONLINE',
    locationName: '',
    defaultMeetingUrl: '',
    meetingProvider: 'Google Meet',
    isPublished: false,
    consultantIds: [],
    weekdays: [1, 2, 3, 4, 5],
    startLocal: '09:00',
    endLocal: '10:00',
    badgeTemplateId: '',
    courseIds: [],
    packageIds: [],
    intakeQuestions: [
      'Apa tujuan utama yang ingin Anda capai?',
      'Apa kendala terbesar yang sedang dihadapi?',
      'Apa yang sudah pernah Anda coba?',
    ].join('\n'),
  }
}

function draftFromOffering(offering: ConsultingAdminOffering): Draft {
  return {
    ...createDefaultDraft(),
    offeringId: offering.id,
    productId: offering.productId,
    storeId: offering.storeId,
    name: offering.publicName,
    price: String(offering.price),
    shortDescription: offering.shortDescription,
    publicDescription: offering.publicDescription,
    sessionCount: String(offering.sessionCount),
    durationMinutes: String(offering.durationMinutes),
    bookingHorizonDays: String(offering.bookingHorizonDays),
    minimumNoticeHours: String(offering.minimumNoticeHours),
    rescheduleLimit: String(offering.rescheduleLimit),
    rescheduleCutoffHours: String(offering.rescheduleCutoffHours),
    noShowConsumesSession: offering.noShowConsumesSession,
    deliveryMode: offering.deliveryMode,
    locationName: offering.locationName,
    defaultMeetingUrl: offering.defaultMeetingUrl,
    meetingProvider: offering.meetingProvider,
    isPublished: offering.isPublished,
    consultantIds: offering.consultantIds,
    weekdays: offering.weekdays,
    startLocal: offering.startLocal,
    endLocal: offering.endLocal,
    badgeTemplateId: offering.badgeTemplateId || '',
    courseIds: offering.courseIds,
    packageIds: offering.packageIds,
    intakeQuestions: offering.intakeFields.map((field) => field.label).join('\n'),
  }
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export default function Consulting360Manager({
  dashboardData,
  overview,
  initialOffering = null,
  showList = true,
  editorMode = false,
  returnTo = '/lms/admin/penjualan/consulting-360',
}: Consulting360ManagerProps) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => (
    initialOffering
      ? draftFromOffering(initialOffering)
      : createDefaultDraft(dashboardData.stores[0]?.id)
  ))
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [exceptionPending, startExceptionTransition] = useTransition()
  const selectedStoreProduct = useMemo(
    () => dashboardData.storeProducts.find(
      (product) => product.productId === draft.productId,
    ),
    [dashboardData.storeProducts, draft.productId],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function editOffering(offering: ConsultingAdminOffering) {
    setDraft(draftFromOffering(offering))
    setMessage(null)
    document.getElementById('form-consulting-360')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  function submitOffering() {
    const formData = new FormData()
    formData.set('offering_id', draft.offeringId)
    formData.set('product_id', draft.productId)
    formData.set('store_id', draft.storeId)
    formData.set('name', draft.name)
    formData.set('price', draft.price)
    formData.set('short_description', draft.shortDescription)
    formData.set('public_description', draft.publicDescription)
    formData.set('session_count', draft.sessionCount)
    formData.set('duration_minutes', draft.durationMinutes)
    formData.set('booking_horizon_days', draft.bookingHorizonDays)
    formData.set('minimum_notice_hours', draft.minimumNoticeHours)
    formData.set('reschedule_limit', draft.rescheduleLimit)
    formData.set('reschedule_cutoff_hours', draft.rescheduleCutoffHours)
    formData.set('no_show_consumes_session', String(draft.noShowConsumesSession))
    formData.set('delivery_mode', draft.deliveryMode)
    formData.set('location_name', draft.locationName)
    formData.set('default_meeting_url', draft.defaultMeetingUrl)
    formData.set('meeting_provider', draft.meetingProvider)
    formData.set('is_published', String(draft.isPublished))
    formData.set('consultant_ids', JSON.stringify(draft.consultantIds))
    formData.set('weekdays', JSON.stringify(draft.weekdays))
    formData.set('start_local', draft.startLocal)
    formData.set('end_local', draft.endLocal)
    formData.set('badge_template_id', draft.badgeTemplateId)
    formData.set('course_ids', JSON.stringify(draft.courseIds))
    formData.set('package_ids', JSON.stringify(draft.packageIds))
    formData.set(
      'intake_form_schema',
      JSON.stringify(
        draft.intakeQuestions
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((label, index) => ({
            key: `question_${index + 1}`,
            label,
            required: index === 0,
            placeholder: 'Tuliskan jawaban Anda.',
          })),
      ),
    )
    setMessage(null)
    startTransition(async () => {
      const result = await saveConsultingOfferingAction(formData)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Gagal menyimpan paket.' })
        return
      }
      setMessage({
        tone: 'success',
        text: 'Paket Consulting 360 tersimpan. Jadwal, bonus course, dan checkout memakai data yang sama.',
      })
      setDirty(false)
      if (editorMode) {
        router.push(returnTo)
        router.refresh()
      } else if (!draft.offeringId) {
        setDraft(createDefaultDraft(dashboardData.stores[0]?.id))
      }
    })
  }

  function submitException(formData: FormData) {
    setMessage(null)
    startExceptionTransition(async () => {
      const result = await saveConsultingAvailabilityExceptionAction(formData)
      setMessage(
        result.success
          ? { tone: 'success', text: 'Cuti atau tanggal khusus berhasil disimpan.' }
          : { tone: 'error', text: result.error || 'Tanggal khusus gagal disimpan.' },
      )
    })
  }

  return (
    <section className="space-y-6" aria-labelledby="consulting-360-title">
      {showList ? (
        <>
          <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            <BriefcaseBusiness aria-hidden="true" size={16} />
            Produk jasa privat
          </div>
          <h2 id="consulting-360-title" className="mt-2 text-2xl font-black tracking-tight">
            Consulting 360
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
            Jual paket pendampingan privat tanpa stok, gudang, ongkir, atau alamat pengiriman.
            Member memilih konsultan dan seluruh jadwal sebelum membayar.
          </p>
        </div>
        <Link
          href="/lms/admin/konsultasi"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 text-sm font-black text-slate-950 transition-colors duration-200 hover:bg-teal-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
        >
          <CalendarClock aria-hidden="true" size={18} />
          Buka Operasional Konsultasi
        </Link>
          </header>

          {overview.offerings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.offerings.map((offering) => (
            <article key={offering.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-teal-700">
                    {offering.sessionCount} sesi · {offering.durationMinutes} menit
                  </div>
                  <h3 className="mt-2 text-lg font-black text-slate-950">{offering.publicName}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  offering.isPublished
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {offering.isPublished ? 'Tayang' : 'Draft'}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Konsultan</dt>
                  <dd className="mt-1 font-black text-slate-900">{offering.consultantIds.length}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Aktif</dt>
                  <dd className="mt-1 font-black text-slate-900">{offering.activeEngagements} member</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => editOffering(offering)}
                className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors duration-200 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
              >
                <PencilLine aria-hidden="true" size={17} />
                Ubah Paket
              </button>
            </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
              Belum ada paket Consulting 360. Gunakan formulir di bawah untuk membuat paket pertama.
            </div>
          )}
        </>
      ) : (
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {draft.offeringId ? 'Ubah Consulting 360' : 'Consulting 360 baru'}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="consulting-360-title" className="text-2xl font-black tracking-tight text-slate-950">
                {draft.offeringId ? draft.name : 'Buat Paket Consulting 360'}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Informasi → Konsultan/Jadwal → Kebijakan/Form Awal → Bonus LMS/Lencana
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!dirty || window.confirm('Perubahan belum disimpan. Tetap kembali?')) {
                  router.push(returnTo)
                }
              }}
              className="min-h-11 cursor-pointer rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
            >
              Kembali ke daftar
            </button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {['Informasi', 'Konsultan / Jadwal', 'Kebijakan / Form', 'Bonus LMS / Lencana'].map((label, index) => (
              <a
                key={label}
                href="#form-consulting-360"
                className="flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
              >
                {index + 1}. {label}
              </a>
            ))}
          </div>
        </header>
      )}

      <div
        id="form-consulting-360"
        onChange={() => setDirty(true)}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              {draft.offeringId
                ? <PencilLine aria-hidden="true" size={19} />
                : <Plus aria-hidden="true" size={19} />}
            </span>
            <div>
              <h3 className="font-black text-slate-950">
                {draft.offeringId ? 'Ubah paket Consulting 360' : 'Buat paket Consulting 360'}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Satu formulir untuk produk, jadwal, konsultan, bonus LMS, dan lencana.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-800">
              Store
              <select
                value={draft.storeId}
                onChange={(event) => setDraft((current) => ({ ...current, storeId: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              >
                {dashboardData.stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Nama produk
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Consulting 360 Bisnis Syariah"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-bold text-slate-800">
                Harga
                <input
                  type="number"
                  min="0"
                  value={draft.price}
                  onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block text-sm font-bold text-slate-800">
                Jumlah sesi
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={draft.sessionCount}
                  onChange={(event) => setDraft((current) => ({ ...current, sessionCount: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block text-sm font-bold text-slate-800">
                Menit/sesi
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
            </div>
            <label className="block text-sm font-bold text-slate-800">
              Ringkasan publik
              <input
                value={draft.shortDescription}
                onChange={(event) => setDraft((current) => ({ ...current, shortDescription: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Deskripsi lengkap
              <textarea
                rows={4}
                value={draft.publicDescription}
                onChange={(event) => setDraft((current) => ({ ...current, publicDescription: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Konsultan internal</legend>
              <div className="mt-2 grid gap-2">
                {overview.consultants.map((consultant) => {
                  const selected = draft.consultantIds.includes(consultant.id)
                  const unavailable = !consultant.employeeId
                  return (
                    <button
                      key={consultant.id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => setDraft((current) => ({
                        ...current,
                        consultantIds: toggleValue(current.consultantIds, consultant.id),
                      }))}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? 'border-teal-700 bg-teal-50'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <UserRoundCheck aria-hidden="true" size={18} className="text-teal-700" />
                        <span>
                          <span className="block text-sm font-black text-slate-900">{consultant.displayName}</span>
                          <span className="block text-xs font-semibold text-slate-500">
                            {unavailable ? 'Belum terhubung ke data karyawan' : consultant.employeeName}
                          </span>
                        </span>
                      </span>
                      {selected ? <Check aria-hidden="true" size={18} className="text-teal-700" /> : null}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Hari tersedia</legend>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAY_OPTIONS.map((day) => {
                  const selected = draft.weekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((current) => ({
                        ...current,
                        weekdays: toggleValue(current.weekdays, day.value),
                      }))}
                      className={`min-h-11 cursor-pointer rounded-xl border text-xs font-black transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ${
                        selected
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-800">
                Jam mulai
                <input
                  type="time"
                  value={draft.startLocal}
                  onChange={(event) => setDraft((current) => ({ ...current, startLocal: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block text-sm font-bold text-slate-800">
                Jam selesai
                <input
                  type="time"
                  value={draft.endLocal}
                  onChange={(event) => setDraft((current) => ({ ...current, endLocal: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-bold text-slate-800">
                Mode
                <select
                  value={draft.deliveryMode}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    deliveryMode: event.target.value as ConsultingDeliveryMode,
                  }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-800">
                Provider
                <input
                  value={draft.meetingProvider}
                  onChange={(event) => setDraft((current) => ({ ...current, meetingProvider: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <label className="block text-sm font-bold text-slate-800">
                Lokasi
                <input
                  value={draft.locationName}
                  onChange={(event) => setDraft((current) => ({ ...current, locationName: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </label>
            </div>
            <label className="block text-sm font-bold text-slate-800">
              Tautan pertemuan default
              <input
                type="url"
                value={draft.defaultMeetingUrl}
                onChange={(event) => setDraft((current) => ({ ...current, defaultMeetingUrl: event.target.value }))}
                placeholder="https://meet.google.com/..."
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-black text-slate-950">
              <Clock3 aria-hidden="true" size={18} className="text-teal-700" />
              Aturan pemesanan
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['bookingHorizonDays', 'Bisa dipesan sampai (hari)'],
                ['minimumNoticeHours', 'Minimal pemesanan (jam)'],
                ['rescheduleLimit', 'Batas ubah jadwal'],
                ['rescheduleCutoffHours', 'Batas waktu ubah (jam)'],
              ].map(([key, label]) => (
                <label key={key} className="block text-sm font-bold text-slate-800">
                  {label}
                  <input
                    type="number"
                    min="0"
                    value={draft[key as keyof Draft] as string}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                  />
                </label>
              ))}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={draft.noShowConsumesSession}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  noShowConsumesSession: event.target.checked,
                }))}
                className="size-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              Tidak hadir tetap dihitung sebagai satu sesi
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Pertanyaan kebutuhan awal (satu pertanyaan per baris)
              <textarea
                rows={5}
                value={draft.intakeQuestions}
                onChange={(event) => setDraft((current) => ({ ...current, intakeQuestions: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-medium outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Template lencana
              <select
                value={draft.badgeTemplateId}
                onChange={(event) => setDraft((current) => ({ ...current, badgeTemplateId: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              >
                <option value="">Buat/pakai template Consulting 360 default</option>
                {overview.badgeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="flex items-center gap-2 font-black text-slate-950">
                <BadgeCheck aria-hidden="true" size={18} className="text-teal-700" />
                Bonus LMS
              </h4>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Course dan paket yang dipilih diberikan melalui mesin akses yang sama setelah pembayaran.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Course langsung</legend>
              <div className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {dashboardData.learningCourses.map((course) => (
                  <label key={course.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draft.courseIds.includes(course.id)}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        courseIds: toggleValue(current.courseIds, course.id),
                      }))}
                      className="size-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    {course.title}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Paket akses</legend>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {dashboardData.accessPackages.map((accessPackage) => (
                  <label key={accessPackage.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={draft.packageIds.includes(accessPackage.id)}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        packageIds: toggleValue(current.packageIds, accessPackage.id),
                      }))}
                      className="size-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    {accessPackage.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  isPublished: event.target.checked,
                }))}
                className="size-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              Tampilkan produk pada toko publik
            </label>
          </div>
        </div>

        {message ? (
          <div
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`mx-5 mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold sm:mx-6 ${
              message.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {message.tone === 'error'
              ? <CircleAlert aria-hidden="true" size={18} />
              : <Check aria-hidden="true" size={18} />}
            {message.text}
          </div>
        ) : null}

        <div className={`flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
          editorMode ? 'sticky bottom-3 z-20 rounded-b-2xl shadow-xl backdrop-blur' : ''
        }`}>
          <p className="text-xs font-semibold text-slate-500">
            {selectedStoreProduct
              ? `Terhubung ke produk ${selectedStoreProduct.publicName}.`
              : 'Produk jasa dan pengaturan toko dibuat otomatis saat disimpan.'}
          </p>
          <div className="flex gap-3">
            {draft.offeringId ? (
              <button
                type="button"
                onClick={() => setDraft(createDefaultDraft(dashboardData.stores[0]?.id))}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                Batal Ubah
              </button>
            ) : null}
            <button
              type="button"
              onClick={submitOffering}
              disabled={isPending}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white transition-colors duration-200 hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
                : <Save aria-hidden="true" size={18} />}
              {isPending ? 'Menyimpan…' : 'Simpan Consulting 360'}
            </button>
          </div>
        </div>
      </div>

      {draft.offeringId ? (
        <form
        action={submitException}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <CalendarClock aria-hidden="true" size={19} />
          </span>
          <div>
            <h3 className="font-black text-slate-950">Cuti dan tanggal khusus</h3>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Blokir jadwal saat konsultan cuti, atau buka waktu tambahan di luar jadwal mingguan.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block text-sm font-bold text-slate-800">
            Konsultan
            <select name="consultant_id" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100">
              <option value="">Pilih konsultan</option>
              {overview.consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>{consultant.displayName}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Paket (opsional)
            <select name="offering_id" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100">
              <option value="">Semua paket</option>
              {overview.offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>{offering.publicName}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Jenis
            <select name="exception_type" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100">
              <option value="BLOCKED">Cuti / diblokir</option>
              <option value="AVAILABLE">Waktu tambahan</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Mulai
            <input name="starts_at" type="datetime-local" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100" />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Selesai
            <input name="ends_at" type="datetime-local" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100" />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input name="reason" placeholder="Alasan atau catatan" className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3.5 text-sm font-semibold outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100" />
          <button
            type="submit"
            disabled={exceptionPending}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white transition-colors duration-200 hover:bg-amber-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exceptionPending
              ? <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
              : <Save aria-hidden="true" size={18} />}
            Simpan Tanggal Khusus
          </button>
        </div>
        </form>
      ) : editorMode ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
          Cuti dan tanggal khusus dapat dikelola setelah paket pertama kali disimpan.
        </div>
      ) : null}
    </section>
  )
}
