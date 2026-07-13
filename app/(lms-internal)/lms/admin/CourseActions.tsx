'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { updateLmsCourse, deleteLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

const LEVEL_OPTIONS = [
  { value: 'ALL', label: 'Semua Level' },
  { value: 'L1',  label: 'Level 1 — Staff' },
  { value: 'L2',  label: 'Level 2 — Supervisor' },
  { value: 'L3',  label: 'Level 3 — Manager' },
  { value: 'SPV', label: 'Supervisor' },
  { value: 'MGR', label: 'Manager' },
]

export default function CourseActions({ course }: { course: any }) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    formData.append('courseId', course.id)
    
    startTransition(async () => {
      try {
        await updateLmsCourse(formData)
        setIsEditOpen(false)
      } catch (err: any) {
        setError(err.message || 'Gagal menyimpan perubahan.')
      }
    })
  }

  const handleDelete = () => {
    setError('')
    startTransition(async () => {
      try {
        await deleteLmsCourse(course.id)
        setIsDeleteOpen(false)
      } catch (err: any) {
        setError(err.message || 'Gagal menghapus program.')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsEditOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Edit Program"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setIsDeleteOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Hapus Program"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Edit Program</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEdit} className="p-6 grid gap-4 overflow-y-auto">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className={labelCls}>Judul Course <span className="text-red-400">*</span></label>
                <input name="title" defaultValue={course.title} required className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Kode Level</label>
                <select name="levelCode" defaultValue={course.level_code || 'ALL'} className={inputCls}>
                  {LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select name="isActive" defaultValue={course.is_active ? 'true' : 'false'} className={inputCls}>
                  <option value="true">Aktif</option>
                  <option value="false">Draft (Tidak Aktif)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Deskripsi Singkat</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={course.description || ''}
                  className={inputCls + ' resize-none'}
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Program?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Apakah Anda yakin ingin menghapus <strong>{course.title}</strong>? Program yang dihapus tidak akan ditampilkan lagi.
            </p>
            
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 text-left">
                {error}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
