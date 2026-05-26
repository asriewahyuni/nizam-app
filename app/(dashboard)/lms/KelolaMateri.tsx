'use client'

// Komponen untuk mengelola lesson/materi dalam sebuah course.
// Menampilkan daftar lesson dengan tombol edit/hapus,
// dan form untuk menambah lesson baru.

import { useState, useTransition, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, CheckCircle2, GripVertical,
  BookOpen, FileText, Video, Edit3, Trash2, ChevronDown,
} from 'lucide-react'
import { createLmsLesson, updateLmsLesson, deleteLmsLesson } from '@/modules/edu/actions/lms-commercial.actions'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

type Lesson = {
  id: string
  title: string
  content_md: string | null
  lesson_type: string
  sort_order: number
  is_required: boolean
  slug: string
}

type Props = {
  courseSlug: string
  courseId: string
  lessons: Lesson[]
}

const LESSON_TYPES = [
  { value: 'TEXT', label: 'Teks', icon: FileText },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'QUIZ', label: 'Kuis', icon: BookOpen },
]

function emptyLesson(sortOrder: number) {
  return { id: '', title: '', content_md: '', lesson_type: 'TEXT', sort_order: sortOrder, is_required: true, slug: '' }
}

export function KelolaMateri({ courseSlug, courseId, lessons: initialLessons }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formType, setFormType] = useState('TEXT')
  const [formRequired, setFormRequired] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formPending, setFormPending] = useState(false)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  function resetForm() {
    setFormTitle(''); setFormContent(''); setFormType('TEXT')
    setFormRequired(true); setFormError(null); setFormPending(false)
  }

  function openAdd() {
    resetForm()
    setIsAdding(true)
    setEditingId(null)
  }

  function openEdit(lesson: Lesson) {
    setFormTitle(lesson.title)
    setFormContent(lesson.content_md || '')
    setFormType(lesson.lesson_type)
    setFormRequired(lesson.is_required)
    setFormError(null)
    setFormPending(false)
    setEditingId(lesson.id)
    setIsAdding(false)
  }

  function handleSave() {
    setFormError(null)
    if (!formTitle.trim()) { setFormError('Judul materi wajib diisi.'); return }

    setFormPending(true)
    const fd = new FormData()
    fd.set('courseId', courseId)
    fd.set('courseSlug', courseSlug)
    fd.set('title', formTitle.trim())
    fd.set('contentMd', formContent.trim())
    fd.set('lessonType', formType)
    fd.set('sortOrder', String(isAdding ? lessons.length : 0))
    fd.set('isRequired', String(formRequired))

    startTransition(async () => {
      try {
        if (isAdding) {
          await createLmsLesson(fd)
        } else if (editingId) {
          fd.set('lessonId', editingId)
          await updateLmsLesson(fd)
        }
        setToast({ msg: isAdding ? 'Materi ditambahkan!' : 'Materi diperbarui!', type: 'success' })
        setIsAdding(false)
        setEditingId(null)
        resetForm()
        // Refresh halaman untuk ambil data terbaru
        window.location.reload()
      } catch (err: any) {
        setFormError(err.message || 'Gagal menyimpan materi.')
        setFormPending(false)
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      try {
        await deleteLmsLesson(deleteTarget.id)
        setToast({ msg: 'Materi berhasil dihapus.', type: 'success' })
        setDeleteTarget(null)
        window.location.reload()
      } catch (err: any) {
        setToast({ msg: err.message || 'Gagal menghapus materi.', type: 'error' })
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-[60] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Materi Pembelajaran</h3>
          <p className="text-xs text-slate-500">{lessons.length} materi</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah Materi
        </button>
      </div>

      {/* Add/Edit form */}
      {(isAdding || editingId) && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              {isAdding ? 'Materi Baru' : 'Edit Materi'}
            </span>
            <button
              onClick={() => { setIsAdding(false); setEditingId(null); resetForm() }}
              className="p-1 hover:bg-blue-100 rounded-lg"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Judul</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Judul materi..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Konten (Markdown)</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={4}
              placeholder="Tulis materi di sini... Dukung format Markdown."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tipe</label>
              <div className="mt-1 flex gap-2">
                {LESSON_TYPES.map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormType(t.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        formType === t.value
                          ? 'border-blue-400 bg-blue-100 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFormRequired(!formRequired)}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  formRequired
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {formRequired ? 'Wajib' : 'Opsional'}
              </button>
            </div>
          </div>

          {formError && (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={formPending}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {formPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isAdding ? 'Tambah Materi' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}

      {/* Lesson list */}
      {lessons.length === 0 && !isAdding ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Belum ada materi</p>
          <p className="text-xs text-slate-400">Klik "Tambah Materi" untuk mulai.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 transition-all group"
            >
              <span className="text-[10px] font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{lesson.title}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    lesson.is_required ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {lesson.is_required ? 'Wajib' : 'Opt'}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {lesson.lesson_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(lesson)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all"
                  title="Edit"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(lesson)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Materi"
        message={`Yakin ingin menghapus materi "${deleteTarget?.title}"? Tindakan ini tidak bisa dibatalkan.`}
      />
    </div>
  )
}
