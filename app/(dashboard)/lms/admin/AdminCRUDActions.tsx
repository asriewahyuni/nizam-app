'use client'

// CRUD actions (edit/delete) for courses, batches, and sessions on the admin page.
// Each entity has its own modal for editing and a shareable delete confirmation.

import { useState, useTransition } from 'react'
import { Edit3, Trash2, Loader2, X, CheckCircle2, ChevronRight, Plus, Banknote } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  updateLmsCourse,
  deleteLmsCourse,
  updateLmsBatch,
  deleteLmsBatch,
  updateLmsSession,
  deleteLmsSession,
} from '@/modules/edu/actions/lms-commercial.actions'
import { ConfirmDeleteModal } from '../ConfirmDeleteModal'

// ── Edit Batch Modal ────────────────────────────────────────────────────────

function EditBatchModal({
  open,
  onClose,
  batch,
}: {
  open: boolean
  onClose: () => void
  batch: any
}) {
  const [name, setName] = useState(batch.name || '')
  const [quota, setQuota] = useState(batch.quota ?? 0)
  const [price, setPrice] = useState(batch.price ?? 0)
  const [startDate, setStartDate] = useState(batch.start_date ? String(batch.start_date).slice(0, 10) : '')
  const [endDate, setEndDate] = useState(batch.end_date ? String(batch.end_date).slice(0, 10) : '')
  const [description, setDescription] = useState(batch.description || '')
  const [paymentInstructions, setPaymentInstructions] = useState(batch.payment_instructions || '')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!name.trim()) { setError('Nama batch wajib diisi.'); return }
    setError(null)

    const fd = new FormData()
    fd.set('batchId', batch.id)
    fd.set('name', name.trim())
    fd.set('quota', String(quota))
    fd.set('price', String(price))
    fd.set('description', description)
    fd.set('paymentInstructions', paymentInstructions)
    if (startDate) fd.set('startDate', startDate)
    if (endDate) fd.set('endDate', endDate)

    startTransition(async () => {
      try {
        await updateLmsBatch(fd)
        setDone(true)
        setTimeout(() => onClose(), 1500)
      } catch (err: any) {
        setError(err.message || 'Gagal menyimpan perubahan.')
      }
    })
  }

  return (
    <ModalWrapper open={open} onClose={onClose} title="Edit Batch" emoji="📅">
      {done ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Batch diperbarui!</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Nama Batch</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Kuota (0=Unlimited)</label>
              <input type="number" min="0" value={quota} onChange={(e) => setQuota(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Harga (Rp)</label>
              <input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Mulai</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Selesai</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Deskripsi</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Informasi singkat tentang batch ini..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Instruksi Pembayaran</label>
            <textarea rows={3} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)}
              placeholder={'Transfer ke BCA 1234567890 a.n. PT Contoh\nKonfirmasi via WhatsApp ke 08xx-xxxx-xxxx'}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={isPending}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
            <button onClick={handleSave} disabled={isPending}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}

// ── Edit Session Modal ────────────────────────────────────────────────────

function EditSessionModal({
  open,
  onClose,
  session,
}: {
  open: boolean
  onClose: () => void
  session: any
}) {
  const [title, setTitle] = useState(session.title || '')
  const [instructorName, setInstructorName] = useState(session.instructor_name || '')
  const [locationUrl, setLocationUrl] = useState(session.location_url || '')
  const [startTime, setStartTime] = useState(session.start_time ? new Date(session.start_time).toISOString().slice(0, 16) : '')
  const [endTime, setEndTime] = useState(session.end_time ? new Date(session.end_time).toISOString().slice(0, 16) : '')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!title.trim()) { setError('Judul sesi wajib diisi.'); return }
    setError(null)

    const fd = new FormData()
    fd.set('sessionId', session.id)
    fd.set('title', title.trim())
    fd.set('instructorName', instructorName.trim())
    fd.set('locationUrl', locationUrl.trim())
    if (startTime) fd.set('startTime', startTime)
    if (endTime) fd.set('endTime', endTime)

    startTransition(async () => {
      try {
        await updateLmsSession(fd)
        setDone(true)
        setTimeout(() => onClose(), 1500)
      } catch (err: any) {
        setError(err.message || 'Gagal menyimpan perubahan.')
      }
    })
  }

  return (
    <ModalWrapper open={open} onClose={onClose} title="Edit Sesi" emoji="📆">
      {done ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Sesi diperbarui!</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Judul Sesi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Mulai</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Selesai</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Instruktur</label>
            <input value={instructorName} onChange={(e) => setInstructorName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Link / Lokasi</label>
            <input value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={isPending}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
            <button onClick={handleSave} disabled={isPending}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}

// ── Reusable Modal Wrapper ─────────────────────────────────────────────────

function ModalWrapper({
  open, onClose, title, emoji, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  emoji: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <span className="text-lg">{emoji}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Batch Action Buttons ─────────────────────────────────────────────────

export function BatchActions({ batch }: { batch: any }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [delPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteLmsBatch(batch.id)
        window.location.reload()
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus batch.')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Edit3 className="h-3 w-3" /> Edit
        </button>
        <button onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Hapus
        </button>
      </div>

      <EditBatchModal open={editOpen} onClose={() => setEditOpen(false)} batch={batch} />
      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Batch"
        message={`Yakin ingin menghapus batch "${batch.name}"? Semua data sesi terkait juga akan terhapus.`}
        isPending={delPending}
      />
    </>
  )
}

// ── Session Action Buttons ───────────────────────────────────────────────

export function SessionActions({ session }: { session: any }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [delPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteLmsSession(session.id)
        window.location.reload()
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus sesi.')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Edit3 className="h-3 w-3" /> Edit
        </button>
        <button onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Hapus
        </button>
      </div>

      <EditSessionModal open={editOpen} onClose={() => setEditOpen(false)} session={session} />
      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Sesi"
        message={`Yakin ingin menghapus sesi "${session.title}"?`}
        isPending={delPending}
      />
    </>
  )
}

// ── Course Action Buttons (Edit + Delete) ─────────────────────────────────

export function CourseActions({
  course,
}: {
  course: any
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [delPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteLmsCourse(course.id)
        window.location.reload()
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus course.')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Edit3 className="h-3 w-3" /> Edit
        </button>
        <button onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Hapus
        </button>
      </div>

      <EditProgramInlineModal open={editOpen} onClose={() => setEditOpen(false)} course={course} />
      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Program"
        message={`Yakin ingin menghapus program "${course.title}"? Semua batch dan data terkait juga akan terhapus.`}
        isPending={delPending}
      />
    </>
  )
}

// ── Edit Course (Inline version matching admin page) ─────────────────────

function EditProgramInlineModal({
  open,
  onClose,
  course,
}: {
  open: boolean
  onClose: () => void
  course: any
}) {
  const [title, setTitle] = useState(course.title || '')
  const [description, setDescription] = useState(course.description || '')
  const [levelCode, setLevelCode] = useState(course.level_code || 'ALL')
  const [isActive, setIsActive] = useState(course.is_active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!title.trim()) { setError('Judul wajib diisi.'); return }
    setError(null)

    const fd = new FormData()
    fd.set('courseId', course.id)
    fd.set('title', title.trim())
    fd.set('description', description.trim())
    fd.set('levelCode', levelCode)
    fd.set('isActive', String(isActive))

    startTransition(async () => {
      try {
        await updateLmsCourse(fd)
        setDone(true)
        setTimeout(() => onClose(), 1500)
      } catch (err: any) {
        setError(err.message || 'Gagal menyimpan.')
      }
    })
  }

  return (
    <ModalWrapper open={open} onClose={onClose} title="Edit Program" emoji="✏️">
      {done ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Program diperbarui!</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Judul</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Deskripsi</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Level</label>
            <input value={levelCode} onChange={(e) => setLevelCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs font-semibold text-slate-600">{isActive ? 'Aktif' : 'Non-Aktif'}</span>
          </div>
          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={isPending}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
            <button onClick={handleSave} disabled={isPending}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}
