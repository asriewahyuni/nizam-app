'use client'

/**
 * Editor Paket Akses dengan durasi default dan pengecualian per course.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  Eye,
  Layers3,
  LoaderCircle,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AdminAccessPackageView,
  AdminLearningCourseView,
} from '@/modules/ecommerce/lib/ecommerce'
import { saveAccessPackageAction } from '@/modules/ecommerce/actions/ecommerce.actions'

type CourseDraft = {
  courseId: string
  accessDurationValue: string
  accessDurationUnit: string
}

type AccessPackageEditorProps = {
  initialPackage: AdminAccessPackageView | null
  courses: AdminLearningCourseView[]
  returnTo: string
}

const STEPS = [
  { href: '#identitas', label: 'Identitas', icon: Layers3 },
  { href: '#durasi', label: 'Durasi', icon: Clock3 },
  { href: '#course', label: 'Course', icon: BookOpen },
  { href: '#dampak', label: 'Dampak', icon: Eye },
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function AccessPackageEditor({
  initialPackage,
  courses,
  returnTo,
}: AccessPackageEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialPackage?.name || '')
  const [slug, setSlug] = useState(initialPackage?.slug || '')
  const [description, setDescription] = useState(initialPackage?.description || '')
  const [isActive, setIsActive] = useState(initialPackage?.isActive ?? true)
  const [defaultValue, setDefaultValue] = useState(
    String(initialPackage?.defaultAccessDurationValue || ''),
  )
  const [defaultUnit, setDefaultUnit] = useState(
    initialPackage?.defaultAccessDurationUnit || 'MONTH',
  )
  const [selectedCourses, setSelectedCourses] = useState<CourseDraft[]>(
    initialPackage?.courses.map((course) => ({
      courseId: course.courseId,
      accessDurationValue: String(course.accessDurationValue || ''),
      accessDurationUnit: course.accessDurationUnit || '',
    })) || [],
  )
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const removedCourseCount = initialPackage
    ? initialPackage.courses.filter(
      (course) => !selectedCourses.some((selected) => selected.courseId === course.courseId),
    ).length
    : 0

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function markDirty() {
    setDirty(true)
  }

  function toggleCourse(courseId: string) {
    markDirty()
    setSelectedCourses((current) => (
      current.some((course) => course.courseId === courseId)
        ? current.filter((course) => course.courseId !== courseId)
        : [...current, { courseId, accessDurationValue: '', accessDurationUnit: '' }]
    ))
  }

  function updateCourse(courseId: string, patch: Partial<CourseDraft>) {
    markDirty()
    setSelectedCourses((current) => current.map(
      (course) => course.courseId === courseId ? { ...course, ...patch } : course,
    ))
  }

  function leaveEditor() {
    if (dirty && !window.confirm('Perubahan Paket Akses belum disimpan. Tetap kembali?')) return
    router.push(returnTo)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim().length < 3) {
      setMessage({ tone: 'error', text: 'Nama Paket Akses minimal 3 karakter.' })
      return
    }
    if (selectedCourses.length === 0) {
      setMessage({ tone: 'error', text: 'Pilih minimal satu course.' })
      return
    }
    const formData = new FormData()
    if (initialPackage) {
      formData.set('package_id', initialPackage.id)
      formData.set('expected_version', String(initialPackage.version))
    }
    formData.set('name', name)
    formData.set('slug', slug || slugify(name))
    formData.set('description', description)
    formData.set('is_active', String(isActive))
    formData.set('default_access_duration_value', defaultValue)
    formData.set('default_access_duration_unit', defaultValue ? defaultUnit : '')
    formData.set(
      'courses',
      JSON.stringify(selectedCourses.map((course) => ({
        courseId: course.courseId,
        accessDurationValue: Number(course.accessDurationValue) > 0
          ? Number(course.accessDurationValue)
          : null,
        accessDurationUnit: Number(course.accessDurationValue) > 0
          ? course.accessDurationUnit
          : null,
      }))),
    )

    setMessage(null)
    startTransition(async () => {
      const result = await saveAccessPackageAction(formData)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Paket Akses gagal disimpan.' })
        return
      }
      setDirty(false)
      setMessage({ tone: 'success', text: 'Paket Akses berhasil disimpan.' })
      router.push(returnTo)
      router.refresh()
    })
  }

  const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'

  return (
    <form onSubmit={submit} className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
          {initialPackage ? `Paket versi ${initialPackage.version}` : 'Paket baru'}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              {initialPackage?.name || 'Buat Paket Akses'}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Satu paket dapat dipakai ulang oleh banyak produk dan subscription.
            </p>
          </div>
          <button type="button" onClick={leaveEditor} className="min-h-11 cursor-pointer rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
            Kembali ke daftar
          </button>
        </div>
        <nav aria-label="Bagian editor Paket Akses" className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <a key={step.href} href={step.href} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                <Icon aria-hidden="true" size={16} className="text-indigo-700" />
                {index + 1}. {step.label}
              </a>
            )
          })}
        </nav>
      </header>

      <div aria-live="polite">
        {message && (
          <div className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold',
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}>
            {message.tone === 'error'
              ? <CircleAlert aria-hidden="true" size={17} />
              : <Check aria-hidden="true" size={17} />}
            {message.text}
          </div>
        )}
      </div>

      <section id="identitas" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-950">1. Identitas</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Nama paket <span className="text-rose-600">*</span>
            <input required value={name} onChange={(event) => { setName(event.target.value); markDirty() }} onBlur={() => { if (!slug) setSlug(slugify(name)) }} className={inputClass} />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Slug
            <input value={slug} onChange={(event) => { setSlug(slugify(event.target.value)); markDirty() }} className={inputClass} />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Deskripsi
            <textarea rows={4} value={description} onChange={(event) => { setDescription(event.target.value); markDirty() }} className={`${inputClass} py-3`} />
          </label>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
            <input type="checkbox" checked={isActive} onChange={(event) => { setIsActive(event.target.checked); markDirty() }} className="size-5 accent-indigo-700" />
            <span>
              <span className="block text-sm font-bold text-slate-950">Paket aktif</span>
              <span className="block text-xs font-medium text-slate-500">Dapat dipilih pada editor produk.</span>
            </span>
          </label>
        </div>
      </section>

      <section id="durasi" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-950">2. Durasi default</h3>
        <p className="mt-1 text-sm font-medium text-slate-600">Kosongkan untuk akses permanen. Course tertentu dapat memakai pengecualian.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Lama akses
            <input type="number" min="1" value={defaultValue} onChange={(event) => { setDefaultValue(event.target.value); markDirty() }} className={inputClass} placeholder="Permanen" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Satuan
            <select value={defaultUnit} onChange={(event) => { setDefaultUnit(event.target.value); markDirty() }} disabled={!defaultValue} className={`${inputClass} cursor-pointer disabled:bg-slate-100`}>
              <option value="HOUR">Jam</option>
              <option value="DAY">Hari</option>
              <option value="WEEK">Minggu</option>
              <option value="MONTH">Bulan</option>
              <option value="YEAR">Tahun</option>
            </select>
          </label>
        </div>
      </section>

      <section id="course" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-950">3. Course dan pengecualian durasi</h3>
        <p className="mt-1 text-sm font-medium text-slate-600">{selectedCourses.length} course dipilih.</p>
        <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {courses.map((course) => {
            const selected = selectedCourses.find((item) => item.courseId === course.id)
            return (
              <div key={course.id} className={cn(
                'rounded-xl border p-3 transition-colors',
                selected ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200',
              )}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={Boolean(selected)} onChange={() => toggleCourse(course.id)} className="size-5 accent-indigo-700" />
                  <span className="text-sm font-bold text-slate-900">{course.title}</span>
                </label>
                {selected && (
                  <div className="ml-8 mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">
                      Pengecualian durasi
                      <input type="number" min="1" value={selected.accessDurationValue} onChange={(event) => updateCourse(course.id, { accessDurationValue: event.target.value })} className={inputClass} placeholder="Ikuti default" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Satuan
                      <select value={selected.accessDurationUnit || 'MONTH'} onChange={(event) => updateCourse(course.id, { accessDurationUnit: event.target.value })} disabled={!selected.accessDurationValue} className={`${inputClass} cursor-pointer disabled:bg-slate-100`}>
                        <option value="HOUR">Jam</option>
                        <option value="DAY">Hari</option>
                        <option value="WEEK">Minggu</option>
                        <option value="MONTH">Bulan</option>
                        <option value="YEAR">Tahun</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section id="dampak" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-950">4. Pratinjau dampak</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">Course setelah disimpan</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{selectedCourses.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">Subscription aktif terdampak</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{initialPackage?.activeSubscriptionMembers || 0}</p>
          </div>
          <div className={cn('rounded-xl p-4', removedCourseCount > 0 ? 'bg-amber-50' : 'bg-slate-50')}>
            <p className="text-xs font-bold text-slate-500">Course akan dilepas</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{removedCourseCount}</p>
          </div>
        </div>
        {removedCourseCount > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Perubahan paket aktif akan disinkronkan ke membership/subscription. Akses dari sumber lain dan progres belajar tetap dipertahankan.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedCourses.map((selected) => (
            <span key={selected.courseId} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {courseById.get(selected.courseId)?.title}
            </span>
          ))}
        </div>
      </section>

      <footer className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-2 text-xs font-semibold text-slate-500">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={leaveEditor} className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Batal</button>
          <button type="submit" disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-wait disabled:opacity-60">
            {isPending ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" size={17} />}
            Simpan Paket
          </button>
        </div>
      </footer>
    </form>
  )
}
