'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  MapPin,
  X,
  Building2,
  Phone,
  Pencil,
  Trash2,
  UserCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import {
import { useConfirm } from '@/components/ui/NizamUI'
  createBranch,
  updateBranch,
  deleteBranch,
  assignBranchPIC,
} from '@/modules/organization/actions/org.actions'

interface Branch {
  id: string
  name: string
  code: string
  address?: string | null
  phone?: string | null
  is_active: boolean
  pic_employee_id?: string | null
}

interface Employee {
  id: string
  first_name: string
  last_name?: string | null
  job_title?: string | null
}

interface BranchManagementClientProps {
  orgId: string
  branches: Branch[]
  employees: Employee[]
  canMutate?: boolean
  isAdmin?: boolean
  limits?: {
    maxBranches: number | null
    currentBranches: number
  }
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const cardAnim = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
}

export function BranchManagementClient({
  orgId,
  branches: initialBranches,
  employees,
  canMutate = true,
  isAdmin = true,
  limits,
}: BranchManagementClientProps) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const { confirm, ConfirmUI } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edit state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Delete state tidak diperlukan — menggunakan optimistic delete

  // Error modal (untuk pesan error panjang, e.g. FK violation)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  // PIC state
  const [assigningPICId, setAssigningPICId] = useState<string | null>(null)
  const [localPICMap, setLocalPICMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    initialBranches.forEach((b) => {
      if (b.id) map[b.id] = b.pic_employee_id || ''
    })
    return map
  })
  const activeUnitCount = branches.filter((branch) => branch.is_active).length
  const hasMultipleUnits = activeUnitCount > 1
  const hasSingleUnit = activeUnitCount <= 1

  const isDefaultUnit = (branch: Branch) => {
    const normalizedName = String(branch.name || '').trim().toLowerCase()
    const normalizedCode = String(branch.code || '').trim().toUpperCase()
    return normalizedCode === 'MAIN' || normalizedName === 'unit utama'
  }

  const getEmpName = (id: string) => {
    if (!id) return null
    const emp = employees.find((e) => e.id === id)
    if (!emp) return null
    return `${emp.first_name} ${emp.last_name || ''}`.trim()
  }

  /* ─── CREATE (optimistic) ─── */
  const handleAddBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()
    const code = String(fd.get('code') || '').trim().toUpperCase()
    const address = String(fd.get('address') || '').trim() || null

    // Optimistic: tambah sementara ke list
    const tempId = `temp-${Date.now()}`
    const tempBranch: Branch = { id: tempId, name, code, address, is_active: true }
    setBranches(prev => [...prev, tempBranch])
    setShowModal(false)
    setLoading(false)

    const res = await createBranch(orgId, fd) as any
    if (res?.error) {
      // Rollback
      setBranches(prev => prev.filter(b => b.id !== tempId))
      setShowModal(true)
      alert(res.error)
    } else if (res?.branch?.id) {
      // Ganti entry temp dengan data real dari server
      setBranches(prev => prev.map(b => b.id === tempId ? { ...tempBranch, id: res.branch.id } : b))
      setLocalPICMap(prev => {
        const next = { ...prev }
        delete next[tempId]
        next[res.branch.id] = ''
        return next
      })
    } else {
      // Fallback: muat ulang jika tidak dapat ID dari server
      router.refresh()
    }
  }

  /* ─── EDIT (optimistic) ─── */
  const handleEditBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingBranch) return
    setEditLoading(true)

    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()
    const code = String(fd.get('code') || '').trim().toUpperCase()
    const address = String(fd.get('address') || '').trim() || null

    // Snapshot state lama untuk rollback
    const prevBranches = branches
    // Optimistic: update local state
    setBranches(prev => prev.map(b =>
      b.id === editingBranch.id ? { ...b, name, code, address } : b
    ))
    setEditingBranch(null)
    setEditLoading(false)

    const res = await updateBranch(orgId, editingBranch.id, fd) as any
    if (res?.error) {
      // Rollback
      setBranches(prevBranches)
      setEditingBranch({ ...editingBranch, name, code, address: address ?? undefined })
      alert(res.error)
    }
  }

  /* ─── DELETE (optimistic) ─── */
  const handleDelete = async (branch: Branch) => {
    const agreed = await confirm(
      `Hapus unit "${branch.name}"?\nTindakan ini permanen.`
    )
    if (!agreed) return

    // Optimistic: langsung hilangkan dari state
    const prevBranches = branches
    setBranches(prev => prev.filter(b => b.id !== branch.id))

    const res = await deleteBranch(orgId, branch.id) as any
    if (res?.error) {
      // Rollback — kembalikan ke posisi semula
      setBranches(prevBranches)
      setErrorModal(res.error)
    }
    // Jika sukses: tidak perlu refresh, state sudah diperbarui
  }

  /* ─── ASSIGN PIC ─── */
  const handleAssignPIC = async (branchId: string, empId: string) => {
    if (assigningPICId === branchId) return
    setAssigningPICId(branchId)
    const res = await assignBranchPIC(orgId, branchId, empId || null) as any
    if (res?.error) {
      alert(res.error)
    } else {
      setLocalPICMap((prev) => ({ ...prev, [branchId]: empId }))
    }
    setAssigningPICId(null)
  }


  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-6xl mx-auto space-y-10">

      {/* ── Header ── */}
      <motion.div variants={cardAnim} className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
            <MapPin size={32} className="text-emerald-500" />
            Unit Operasional
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-xl">
            {hasMultipleUnits
              ? 'Kelola beberapa unit operasional dalam satu entitas. Unit Utama tetap menjadi konteks default internal, sedangkan unit lain dipakai saat bisnis memang multi-lokasi atau multi-divisi.'
              : 'Organisasi ini saat ini berjalan dengan satu Unit Utama. Unit tersebut adalah konteks operasional default internal, jadi tidak perlu dibaca sebagai struktur operasional terpisah.'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-col md:items-end gap-2 shrink-0">
            {limits && (
              <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                Pemakaian Kuota: <span className="text-slate-800">{limits.currentBranches}</span> / {limits.maxBranches === null ? '∞' : limits.maxBranches} Unit
              </div>
            )}
            <button type="button"
              onClick={() => setShowModal(true)}
              disabled={limits?.maxBranches !== null && limits!.currentBranches >= limits!.maxBranches}
              title={limits?.maxBranches !== null && limits!.currentBranches >= limits!.maxBranches ? 'Batas unit tercapai. Upgrade paket SaaS Anda.' : ''}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
            >
              <Plus size={18} /> Tambah Unit
            </button>
          </div>
        )}
      </motion.div>

      {hasSingleUnit && branches[0] && (
        <motion.div
          variants={cardAnim}
          className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 text-sm text-slate-600 shadow-sm"
        >
          <p className="font-semibold text-slate-800">
            <span className="font-mono">Unit Utama</span> adalah konteks default internal organisasi.
          </p>
          <p className="mt-2">
            Selama entitas ini hanya memiliki satu unit aktif, sistem tidak perlu dipahami sebagai struktur multi-unit. Tambahkan unit baru hanya jika bisnis memang memiliki lokasi atau unit operasional terpisah.
          </p>
        </motion.div>
      )}

      {/* ── Branch Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => {
          const isAssigning = assigningPICId === branch.id
          const currentPIC = localPICMap[branch.id] || ''
          const picName = getEmpName(currentPIC)
          const isMainUnit = isDefaultUnit(branch)
          const canDeleteUnit = canMutate && activeUnitCount > 1

          return (
            <motion.div
              key={branch.id}
              variants={cardAnim}
              className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 group transition-all flex flex-col"
            >
              {/* Top row: icon + status + actions */}
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                  <Building2 size={28} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 text-[10px] font-semibold rounded-full uppercase tracking-tighter border ${branch.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {branch.is_active ? 'Aktif' : 'Non-Aktif'}
                  </span>
                  {isAdmin && (
                    <>
                      <button type="button"
                        onClick={() => setEditingBranch(branch)}
                        title="Edit Unit"
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      {canDeleteUnit && (
                        <button type="button"
                          onClick={() => handleDelete(branch)}
                          title="Hapus Unit"
                          className="p-2 rounded-xl border border-rose-100 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Branch Info */}
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{branch.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">{branch.code}</p>
                    {isMainUnit && (
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        Unit Default
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <MapPin size={12} className="text-slate-300 shrink-0" />
                    <span className="line-clamp-1">{branch.address || 'Alamat belum diset'}</span>
                  </div>
                  {isMainUnit && (
                    <p className="text-xs font-medium text-slate-500">
                      Unit ini menjadi konteks operasional default untuk organisasi.
                    </p>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Phone size={12} className="text-slate-300 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── PIC Section ── */}
              <div className="mt-6 pt-6 border-t border-slate-50">
                <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-[0.15em] flex items-center gap-2 mb-2">
                  <UserCircle size={14} /> PIC Unit
                </label>

                {picName && (
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span className="truncate">{picName}</span>
                  </div>
                )}

                {employees.length > 0 ? (
                  <div className="relative">
                    <select
                      disabled={isAssigning || !isAdmin}
                      value={currentPIC}
                      onChange={(e) => handleAssignPIC(branch.id, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed appearance-none pr-8"
                    >
                      <option value="">-- Pilih PIC --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name || ''}{emp.job_title ? ` (${emp.job_title})` : ''}
                        </option>
                      ))}
                    </select>
                    {isAssigning && (
                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                        <Loader2 size={14} className="animate-spin text-emerald-500" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    Belum ada karyawan. Tambahkan via modul HRIS.
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}

        {branches.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50 flex flex-col items-center justify-center space-y-4">
            <MapPin size={48} className="text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">Belum Ada Unit</h3>
            <p className="text-sm text-slate-500">Klik tombol di atas untuk menambahkan unit operasional pertama.</p>
          </div>
        )}
      </div>

      {/* ══════════════════ CREATE MODAL ══════════════════ */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-md p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-semibold text-slate-900 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  Tambah Unit
                </h3>
                <button type="button" onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddBranch} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Nama Unit</label>
                  <input name="name" required placeholder="Cth: Unit Distribusi Jakarta" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-emerald-500 font-bold transition-all shadow-inner" />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Kode Unit</label>
                  <input name="code" required placeholder="Cth: JKT-DIST" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-emerald-500 font-bold uppercase transition-all shadow-inner" />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Alamat Lengkap</label>
                  <textarea name="address" placeholder="Tulis alamat operasional unit ini..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-emerald-500 text-sm h-24 transition-all shadow-inner resize-none" />
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white font-semibold rounded-[20px] shadow-xl hover:shadow-md transition-all relative overflow-hidden group disabled:opacity-60">
                    <span className="relative z-10">{loading ? 'Memproses...' : 'Daftarkan Unit Sekarang'}</span>
                    <div className="absolute inset-0 bg-emerald-500 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════ EDIT MODAL ══════════════════ */}
      <AnimatePresence>
        {editingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !editLoading && setEditingBranch(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-md p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-semibold text-slate-900 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Pencil size={22} />
                  </div>
                  Edit Unit
                </h3>
                <button type="button" onClick={() => setEditingBranch(null)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEditBranch} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Nama Unit</label>
                  <input name="name" required defaultValue={editingBranch.name} placeholder="Nama unit" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold transition-all shadow-inner" />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Kode Unit</label>
                  <input name="code" required defaultValue={editingBranch.code} placeholder="Kode unit" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold uppercase transition-all shadow-inner" />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Alamat Lengkap</label>
                  <textarea name="address" defaultValue={editingBranch.address || ''} placeholder="Alamat operasional..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 text-sm h-24 transition-all shadow-inner resize-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingBranch(null)} className="flex-1 py-4 rounded-xl font-semibold text-xs uppercase tracking-wide text-slate-500 hover:bg-slate-100 transition-all border border-slate-200">
                    Batal
                  </button>
                  <button type="submit" disabled={editLoading} className="flex-1 py-4 rounded-xl bg-blue-600 text-white font-semibold text-xs uppercase tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50">
                    {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════ ERROR MODAL ══════════════════ */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setErrorModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-md p-8"
            >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Tidak Dapat Menghapus Unit</h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Terdapat data yang masih terhubung</p>
                  </div>
                </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-rose-800 font-medium whitespace-pre-line leading-relaxed">{errorModal}</p>
              </div>
              <button type="button"
                onClick={() => setErrorModal(null)}
                className="w-full py-4 rounded-xl bg-slate-900 text-white font-semibold text-xs uppercase tracking-wide hover:bg-black transition-all"
              >
                Mengerti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {ConfirmUI}
    </motion.div>
  )
}
