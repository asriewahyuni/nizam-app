'use client'

// Daftar program pelatihan dengan aksi CRUD (edit & hapus) per baris.
// Dipasang di LMS Dashboard sebagai client component agar bisa mengelola state modal.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { BookOpen, GraduationCap, Pencil, Trash2 } from 'lucide-react'
import { deleteLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'
import { EditProgramModal } from './EditProgramModal'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

type Course = {
  id: string
  slug: string
  title: string
  description: string | null
  level_code: string | null
  is_active: boolean
}

export function ProgramListClient({ courses }: { courses: Course[] }) {
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()

  const deletingCourse = courses.find((c) => c.id === deletingCourseId)

  function handleDelete() {
    if (!deletingCourseId) return
    startDeleteTransition(async () => {
      await deleteLmsCourse(deletingCourseId)
      setDeletingCourseId(null)
    })
  }

  return (
    <>
      <div className="mt-6 space-y-3">
        {courses.slice(0, 5).map((c) => (
          <div
            key={c.slug}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white/15 transition-colors border border-white/5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-300 shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{c.title}</h3>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-1">
                Level: {c.level_code || 'ALL'} &middot;{' '}
                <span className={c.is_active ? 'text-emerald-400' : 'text-slate-500'}>
                  {c.is_active ? 'Aktif' : 'Non-aktif'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => setEditingCourse(c)}
                title="Edit program"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-blue-300 hover:bg-blue-500/30 hover:text-white transition-all"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setDeletingCourseId(c.id)}
                title="Hapus program"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {courses.length === 0 && (
          <div className="p-6 text-center border border-dashed border-slate-700 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <GraduationCap size={22} className="text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">Belum ada program</p>
              <p className="text-xs text-slate-600 mt-1">
                Klik &ldquo;Tambah Program&rdquo; untuk mulai.
              </p>
            </div>
          </div>
        )}
      </div>

      {courses.length > 5 && (
        <Link
          href="/lms/admin"
          className="mt-4 block text-center text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
        >
          Lihat Semua Program ({courses.length})
        </Link>
      )}

      {editingCourse && (
        <EditProgramModal
          open={true}
          onClose={() => setEditingCourse(null)}
          course={editingCourse}
        />
      )}

      <ConfirmDeleteModal
        open={!!deletingCourseId}
        onClose={() => setDeletingCourseId(null)}
        onConfirm={handleDelete}
        title="Hapus Program?"
        message={`Program "${deletingCourse?.title}" akan dihapus permanen. Semua batch dan data terkait ikut terhapus.`}
        labelConfirm="Ya, Hapus Program"
        isPending={isPendingDelete}
      />
    </>
  )
}
