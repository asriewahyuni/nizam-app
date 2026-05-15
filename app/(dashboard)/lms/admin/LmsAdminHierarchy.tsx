'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus, X, Banknote, GraduationCap } from 'lucide-react'
import { createLmsBatch, createLmsSession } from '@/modules/edu/actions/lms-commercial.actions'
import { CourseActions, BatchActions, SessionActions } from './AdminCRUDActions'
import SessionQRClient from './SessionQRClient'
import CreateCourseForm from './CreateCourseForm'

type Course = {
  id: string
  slug: string
  title: string
  description?: string | null
  level_code?: string | null
  is_active: boolean
}
type Batch = {
  id: string
  course_id: string
  name: string
  status: string
  mode?: string | null
  price?: number | null
  quota?: number | null
  start_date?: any
  end_date?: any
}
type Session = {
  id: string
  batch_id: string
  title: string
  start_time: string
  end_time?: string | null
  instructor_name?: string | null
  location_url?: string | null
}

// ── Inline Batch Form ──────────────────────────────────────────────────────

function InlineBatchForm({ courseId, onSuccess }: { courseId: string; onSuccess?: () => void }) {
  const [state, action, isPending] = useActionState(createLmsBatch, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      onSuccess?.()
    }
  }, [state])

  return (
    <form ref={formRef} action={action} className="mt-4 grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
      <input type="hidden" name="courseId" value={courseId} />

      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Batch berhasil disimpan!</div>
      )}

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1">Nama Batch</div>
        <input name="name" required placeholder="Contoh: Batch 1 - 2024" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
      </label>

      <div>
        <div className="font-bold text-slate-900 mb-2 text-sm">Mode Pembelajaran</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'OFFLINE', label: 'Offline', icon: '🏢' },
            { value: 'ONLINE', label: 'Online', icon: '💻' },
            { value: 'HYBRID', label: 'Hybrid', icon: '🔀' },
          ].map((opt) => (
            <label key={opt.value} className="cursor-pointer">
              <input type="radio" name="mode" value={opt.value} defaultChecked={opt.value === 'OFFLINE'} className="sr-only peer" />
              <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-500 transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700">
                <span className="text-base">{opt.icon}</span>
                {opt.label}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Harga (Rp)</div>
          <input type="number" name="price" min="0" defaultValue="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Kuota (0 = ∞)</div>
          <input type="number" name="quota" min="0" defaultValue="0" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Tanggal Mulai</div>
          <input type="date" name="startDate" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Tanggal Selesai</div>
          <input type="date" name="endDate" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-60"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Batch'}
      </button>
    </form>
  )
}

// ── Inline Session Form ────────────────────────────────────────────────────

function InlineSessionForm({ batchId }: { batchId: string }) {
  const [state, action, isPending] = useActionState(createLmsSession, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={action} className="mt-4 grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
      <input type="hidden" name="batchId" value={batchId} />

      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Sesi berhasil dibuat!</div>
      )}

      <label className="block text-sm">
        <div className="font-bold text-slate-900 mb-1">Judul Sesi</div>
        <input name="title" required placeholder="Contoh: Sesi 1 - Pengenalan" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Waktu Mulai</div>
          <input type="datetime-local" name="startTime" required className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Waktu Selesai</div>
          <input type="datetime-local" name="endTime" required className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Instruktur</div>
          <input name="instructorName" placeholder="Nama instruktur" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1">Link / Lokasi</div>
          <input name="locationUrl" placeholder="Zoom link / Gedung" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-blue-400 bg-white text-sm" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-all disabled:opacity-60"
      >
        {isPending ? 'Menyimpan...' : 'Buat Sesi'}
      </button>
    </form>
  )
}

// ── Batch Section (with sessions inside) ──────────────────────────────────

function BatchSection({ batch, sessions }: { batch: Batch; sessions: Session[] }) {
  const [showSessions, setShowSessions] = useState(false)
  const [showAddSession, setShowAddSession] = useState(false)
  const batchSessions = sessions.filter((s) => s.batch_id === batch.id)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              {batch.status}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              batch.mode === 'ONLINE' ? 'bg-sky-50 text-sky-600 border-sky-100' :
              batch.mode === 'HYBRID' ? 'bg-purple-50 text-purple-600 border-purple-100' :
              'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {batch.mode === 'ONLINE' ? '💻 Online' : batch.mode === 'HYBRID' ? '🔀 Hybrid' : '🏢 Offline'}
            </span>
            {batch.price != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <Banknote className="h-3 w-3" />
                Rp{Number(batch.price).toLocaleString('id-ID')}
              </span>
            )}
          </div>
          <h4 className="mt-2 text-base font-semibold text-slate-900">{batch.name}</h4>
          <div className="mt-1 flex gap-4 text-xs font-bold text-slate-400">
            <span>Kuota: <span className="text-slate-600">{batch.quota === 0 ? '∞' : batch.quota}</span></span>
            {batch.start_date && (
              <span>Mulai: <span className="text-slate-600">{String(batch.start_date).slice(0, 10)}</span></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/lms/daftar/${batch.id}`}
            target="_blank"
            className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            🔗 Daftar
          </Link>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {batchSessions.length} Sesi
            {showSessions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <BatchActions batch={batch} />

      {showSessions && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jadwal Sesi</span>
            <button
              onClick={() => setShowAddSession(!showAddSession)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              {showAddSession ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAddSession ? 'Tutup' : 'Buat Sesi'}
            </button>
          </div>

          {showAddSession && <InlineSessionForm batchId={batch.id} />}

          {batchSessions.length === 0 && !showAddSession ? (
            <p className="text-sm font-medium text-slate-400 italic text-center py-6">
              Belum ada sesi. Klik "Buat Sesi" untuk menambahkan jadwal.
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {batchSessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 group/session">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-900">{s.title}</h5>
                      <p className="mt-0.5 text-xs font-medium text-slate-400">
                        {new Date(s.start_time).toLocaleString('id-ID')}
                        {s.instructor_name ? ` · ${s.instructor_name}` : ''}
                      </p>
                    </div>
                    <SessionQRClient sessionId={s.id} sessionTitle={s.title} />
                  </div>
                  <SessionActions session={s} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Course Section (with batches inside) ──────────────────────────────────

function CourseSection({
  course,
  batches,
  sessions,
}: {
  course: Course
  batches: Batch[]
  sessions: Session[]
}) {
  const [showBatches, setShowBatches] = useState(true)
  const [showAddBatch, setShowAddBatch] = useState(false)
  const courseBatches = batches.filter((b) => b.course_id === course.id)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Course Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[9px] font-semibold tracking-tight border px-2.5 py-1 rounded-full ${
                course.is_active
                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}
            >
              {course.is_active ? 'Aktif' : 'Non-Aktif'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">{course.level_code || 'ALL'}</span>
          </div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{course.title}</h3>
          {course.description && (
            <p className="mt-1 text-sm font-medium text-slate-500 leading-relaxed line-clamp-2">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/lms/course/${course.slug}`}
            target="_blank"
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <GraduationCap className="h-3 w-3" /> Lihat
          </Link>
          <button
            onClick={() => setShowBatches(!showBatches)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {courseBatches.length} Batch
            {showBatches ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <CourseActions course={course} />

      {showBatches && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch / Angkatan</span>
            <button
              onClick={() => setShowAddBatch(!showAddBatch)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
            >
              {showAddBatch ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAddBatch ? 'Tutup' : 'Buat Batch'}
            </button>
          </div>

          {showAddBatch && (
            <InlineBatchForm courseId={course.id} onSuccess={() => setShowAddBatch(false)} />
          )}

          {courseBatches.length === 0 && !showAddBatch ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-400 italic">
              Belum ada batch. Klik "Buat Batch" untuk memulai.
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {courseBatches.map((batch) => (
                <BatchSection key={batch.id} batch={batch} sessions={sessions} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────

export default function LmsAdminHierarchy({
  courses,
  batches,
  sessions,
}: {
  courses: Course[]
  batches: Batch[]
  sessions: Session[]
}) {
  const [showCreateCourse, setShowCreateCourse] = useState(false)

  return (
    <div className="space-y-4">
      {/* ── Buat Program Baru ── */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900">Buat Program / Course Baru</h2>
            <p className="mt-0.5 text-sm font-medium text-slate-400">
              Tambahkan materi baru ke katalog training organisasi.
            </p>
          </div>
          <button
            onClick={() => setShowCreateCourse(!showCreateCourse)}
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 px-4 py-2.5 rounded-2xl hover:bg-blue-100 transition-colors"
          >
            {showCreateCourse ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateCourse ? 'Tutup' : 'Buat Program'}
          </button>
        </div>

        {showCreateCourse && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <CreateCourseForm />
          </div>
        )}
      </div>

      {/* ── Daftar Program ── */}
      {courses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-14 text-center">
          <GraduationCap className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-bold text-slate-400">
            Belum ada program. Klik "Buat Program" di atas untuk memulai.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <CourseSection
              key={course.id}
              course={course}
              batches={batches}
              sessions={sessions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
