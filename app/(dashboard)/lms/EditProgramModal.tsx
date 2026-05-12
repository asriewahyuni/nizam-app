'use client'

// Modal untuk mengedit/memperbarui program pelatihan.
// Mirip TambahProgramModal tapi field-nya pre-filled dari data course existing.

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, CheckCircle2, ChevronRight } from 'lucide-react'
import { updateLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'

const LEVEL_OPTIONS = [
  { value: 'ALL',     label: 'Semua Level',  emoji: '🌐', desc: 'Cocok untuk siapapun' },
  { value: 'BASIC',   label: 'Dasar',        emoji: '🌱', desc: 'Pemula, tidak ada prasyarat' },
  { value: 'INTER',   label: 'Menengah',     emoji: '📈', desc: 'Perlu pemahaman dasar' },
  { value: 'ADVANCE', label: 'Lanjutan',     emoji: '🚀', desc: 'Untuk yang sudah berpengalaman' },
]

type Props = {
  open: boolean
  onClose: () => void
  course: {
    id: string
    title: string
    description: string | null
    level_code: string | null
    is_active: boolean
    slug: string
  }
}

export function EditProgramModal({ open, onClose, course }: Props) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description || '')
  const [levelCode, setLevelCode] = useState(course.level_code || 'ALL')
  const [isActive, setIsActive] = useState(course.is_active)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(course.title)
      setDescription(course.description || '')
      setLevelCode(course.level_code || 'ALL')
      setIsActive(course.is_active)
      setError(null)
      setDone(false)
      setTimeout(() => titleRef.current?.focus(), 100)
    }
  }, [open, course])

  function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError('Judul program wajib diisi.'); return }
    if (title.trim().length < 3) { setError('Judul minimal 3 karakter.'); return }

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
        setError(err.message || 'Gagal menyimpan perubahan.')
      }
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <span className="text-lg">✏️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Edit Program</h2>
                  <p className="text-xs text-slate-500">{course.title.slice(0, 40)}</p>
                </div>
              </div>
              <button onClick={onClose} disabled={isPending} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Success state */}
            {done ? (
              <div className="mt-8 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <p className="mt-3 text-sm font-semibold text-slate-900">Perubahan tersimpan!</p>
              </div>
            ) : (
              <>
                {/* Title */}
                <div className="mt-6">
                  <label className="text-xs font-semibold text-slate-500">Judul Program</label>
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Misal: Pelatihan Basic ERP"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>

                {/* Description */}
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-500">Deskripsi (opsional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Jelaskan isi program..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
                  />
                </div>

                {/* Level */}
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-500">Level / Tingkat</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {LEVEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLevelCode(opt.value)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                          levelCode === opt.value
                            ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="text-base">{opt.emoji}</span>
                        <div className="mt-0.5 font-bold text-slate-900">{opt.label}</div>
                        <div className="text-[10px] text-slate-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-xs font-semibold text-slate-600">
                    {isActive ? 'Program Aktif' : 'Program Non-Aktif'}
                  </span>
                </div>

                {error && (
                  <p className="mt-4 text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isPending}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Perubahan <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
