'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Layers, Building, Calendar, Activity, Link as LinkIcon, UserCircle, Pencil, Trash2, CheckCircle2, Loader2, Plus, ArrowRight } from 'lucide-react'
import {
  linkSubOrganization,
  assignSubOrgManager,
  updateChildOrganization,
  deleteChildOrganization,
  createOrganizationQuick,
} from '@/modules/organization/actions/org.actions'
import { formatDate } from '@/lib/utils'

type ChildOrgRecord = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
  is_active: boolean
  manager_employee_id?: string | null
}

type UnlinkedOrgRecord = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_active?: boolean
}

type EmployeeOption = {
  id: string
  first_name: string
  last_name: string | null
  job_title: string | null
}

interface Props {
  orgId: string
  childOrgs: ChildOrgRecord[]
  unlinkedOrgs: UnlinkedOrgRecord[]
  employees: EmployeeOption[]
  canMutate?: boolean
  picFeatureEnabled?: boolean
  limits?: {
    maxChildOrgs: number | null
    currentChildOrgs: number
  }
}

export default function SubOrgClient({
  orgId,
  childOrgs,
  unlinkedOrgs,
  employees,
  canMutate = true,
  picFeatureEnabled = false,
  limits,
}: Props) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingChild, setEditingChild] = useState<{ id: string; name: string } | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null)
  // Per-card PIC assignment loading + optimistic local value
  const [assigningPICChildId, setAssigningPICChildId] = useState<string | null>(null)
  const [childOrgList, setChildOrgList] = useState<ChildOrgRecord[]>(() => childOrgs)
  const [availableUnlinkedOrgs, setAvailableUnlinkedOrgs] = useState<UnlinkedOrgRecord[]>(() => unlinkedOrgs)
  const [localLimits, setLocalLimits] = useState(limits)
  const [localManagerMap, setLocalManagerMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    childOrgs.forEach((c) => { if (c.id) map[c.id] = c.manager_employee_id || '' })
    return map
  })

  const canCreateMore = localLimits?.maxChildOrgs === null || localLimits?.maxChildOrgs === undefined
    ? true
    : localLimits.currentChildOrgs < localLimits.maxChildOrgs

  const makeClientSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleLinkOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const childId = fd.get('child_id') as string
    if (childId) {
      const res: Awaited<ReturnType<typeof linkSubOrganization>> = await linkSubOrganization(orgId, childId)
      if ('error' in res) alert(res.error)
      else {
        const linkedOrg = availableUnlinkedOrgs.find((org) => org.id === childId)
        if (linkedOrg) {
          setChildOrgList((current) => [
            {
              id: linkedOrg.id,
              name: linkedOrg.name,
              slug: linkedOrg.slug,
              logo_url: linkedOrg.logo_url,
              created_at: new Date().toISOString(),
              is_active: linkedOrg.is_active ?? true,
              manager_employee_id: null,
            },
            ...current,
          ])
          setAvailableUnlinkedOrgs((current) => current.filter((org) => org.id !== childId))
          setLocalManagerMap((current) => ({ ...current, [linkedOrg.id]: '' }))
          setLocalLimits((current) => current ? ({
            ...current,
            currentChildOrgs: current.currentChildOrgs + 1,
          }) : current)
        }
        setIsLinkModalOpen(false)
      }
    }
    setLoading(false)
  }

  const handleCreateChildOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)

    const fd = new FormData(e.currentTarget)
    const childName = String(fd.get('name') || '').trim()
    fd.set('parent_org_id', orgId)
    fd.set('preserve_parent_context', 'true')

    const res: Awaited<ReturnType<typeof createOrganizationQuick>> = await createOrganizationQuick(fd)
    if ('error' in res) {
      setCreateError(res.error)
      setCreateLoading(false)
      return
    }

    const createdChild: ChildOrgRecord = res.organization ?? {
      id: String(res.orgId || crypto.randomUUID()),
      name: childName,
      slug: makeClientSlug(childName),
      logo_url: null,
      created_at: new Date().toISOString(),
      is_active: true,
      manager_employee_id: null,
    }

    setChildOrgList((current) => [createdChild, ...current])
    setLocalManagerMap((current) => ({ ...current, [createdChild.id]: createdChild.manager_employee_id || '' }))
    setLocalLimits((current) => current ? ({
      ...current,
      currentChildOrgs: current.currentChildOrgs + 1,
    }) : current)

    setIsCreateModalOpen(false)
    e.currentTarget.reset()
    setCreateLoading(false)
  }

  const handleAssignPIC = async (childId: string, empId: string) => {
    if (assigningPICChildId === childId) return
    setAssigningPICChildId(childId)
    const res: Awaited<ReturnType<typeof assignSubOrgManager>> = await assignSubOrgManager(childId, empId || null)
    if ('error' in res) {
      alert(res.error)
      // rollback optimistic
      setLocalManagerMap(prev => ({ ...prev }))
    } else {
      // Optimistic: reflect new value without full reload
      setLocalManagerMap(prev => ({ ...prev, [childId]: empId }))
    }
    setAssigningPICChildId(null)
  }

  const handleEditChild = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingChild) return

    setEditLoading(true)
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()

    const res: Awaited<ReturnType<typeof updateChildOrganization>> = await updateChildOrganization(editingChild.id, name)
    if ('error' in res) {
      alert(res.error)
      setEditLoading(false)
      return
    }

    const nextSlug = makeClientSlug(name)
    setChildOrgList((current) =>
      current.map((child) =>
        child.id === editingChild.id
          ? { ...child, name, slug: nextSlug || child.slug }
          : child
      )
    )
    setEditingChild(null)
    setEditLoading(false)
  }

  const handleDeleteChild = async (childId: string, childName: string) => {
    const agreed = window.confirm(
      `Hapus anak perusahaan "${childName}"?\nTindakan ini permanen dan seluruh data organisasi akan ikut terhapus.`
    )
    if (!agreed) return

    setDeletingChildId(childId)
    const res: Awaited<ReturnType<typeof deleteChildOrganization>> = await deleteChildOrganization(childId)
    if ('error' in res) {
      alert(res.error)
      setDeletingChildId(null)
      return
    }

    setChildOrgList((current) => current.filter((child) => child.id !== childId))
    setLocalManagerMap((current) => {
      const next = { ...current }
      delete next[childId]
      return next
    })
    setLocalLimits((current) => current ? ({
      ...current,
      currentChildOrgs: Math.max(0, current.currentChildOrgs - 1),
    }) : current)
    setDeletingChildId(null)
  }

  const getManagerName = (childId: string) => {
    const empId = localManagerMap[childId]
    if (!empId) return null
    const emp = employees.find((e) => e.id === empId)
    if (!emp) return null
    return `${emp.first_name} ${emp.last_name || ''}`.trim()
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div className="flex flex-col gap-2 max-w-xl">
           <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <Layers className="text-blue-600" size={32} />
             Anak Perusahaan / Afiliasi
           </h1>
           <p className="text-sm text-slate-500 font-medium">Kelola organisasi anak yang strukturnya berada di bawah naungan Holding ini.</p>
         </div>
         <div className="flex flex-col md:items-end gap-3 shrink-0">
           {limits && (
             <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
               Pemakaian Kuota: <span className="text-slate-800">{localLimits?.currentChildOrgs ?? 0}</span> / {localLimits?.maxChildOrgs === null || localLimits?.maxChildOrgs === undefined ? '∞' : localLimits.maxChildOrgs} Entitas
             </div>
           )}
           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
             {canMutate && (
               <button
                 type="button"
                 onClick={() => {
                   setCreateError(null)
                   setIsCreateModalOpen(true)
                 }}
                 disabled={!canCreateMore}
                 title={!canCreateMore ? 'Batas entitas tercapai.' : ''}
                 className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 flex-1 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Plus size={16} /> Tambah Anak Perusahaan
               </button>
             )}
             {canMutate && availableUnlinkedOrgs.length > 0 && (
               <button 
                 type="button"
                 onClick={() => setIsLinkModalOpen(true)}
                 disabled={!canCreateMore}
                 title={!canCreateMore ? 'Batas entitas tercapai.' : ''}
                 className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <LinkIcon size={16} /> Tautkan Entitas
               </button>
             )}
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {childOrgList.map((child) => {
          const isAssigning = assigningPICChildId === child.id
          const currentManagerId = localManagerMap[child.id] || ''
          const managerName = getManagerName(child.id)

          return (
            <div key={child.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                       {child.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={child.logo_url} alt={child.name} className="w-full h-full object-contain p-2" />
                       ) : (
                          <Building size={24} className="text-slate-400" />
                       )}
                    </div>
                    <div className="min-w-0">
                       <h3 className="text-xl font-black text-slate-900 truncate">{child.name}</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">Slug: {child.slug}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingChild({ id: child.id, name: child.name })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => handleDeleteChild(child.id, child.name)}
                        disabled={deletingChildId === child.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} />
                        {deletingChildId === child.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                   <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-slate-500 flex items-center gap-2"><Calendar size={14}/> Dibuat Pada</span>
                      <span className="text-slate-900">{formatDate(child.created_at || new Date().toISOString())}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-slate-500 flex items-center gap-2"><Activity size={14}/> Status Aktif</span>
                      <span className={child.is_active ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {child.is_active ? 'Ya' : 'Non-Aktif'}
                      </span>
                   </div>
                </div>
              </div>

              {/* PIC Section */}
              {picFeatureEnabled && employees.length > 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-4">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] flex items-center gap-2 mb-2">
                    <UserCircle size={14} /> PIC Direktur / Manager
                  </label>

                  {/* If currently assigned, show badge */}
                  {managerName && (
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span className="truncate">{managerName}</span>
                    </div>
                  )}

                  <div className="relative">
                    <select
                      disabled={isAssigning || !canMutate}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed appearance-none pr-8"
                      value={currentManagerId}
                      onChange={(e) => handleAssignPIC(child.id, e.target.value)}
                    >
                      <option value="">-- Belum Ditentukan --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name || ''} {emp.job_title ? `(${emp.job_title})` : ''}
                        </option>
                      ))}
                    </select>
                    {isAssigning && (
                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                      </div>
                    )}
                  </div>

                  {!canMutate && (
                    <p className="text-[10px] text-slate-400 mt-1">Hanya Owner yang dapat mengubah PIC.</p>
                  )}
                </div>
              ) : picFeatureEnabled && employees.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-4">
                  <p className="text-xs text-amber-700 font-semibold flex items-center gap-2">
                    <UserCircle size={14} />
                    Belum ada karyawan di organisasi induk. Tambahkan karyawan di modul HRIS terlebih dahulu.
                  </p>
                </div>
              ) : !picFeatureEnabled ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">
                  <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-2">
                    <UserCircle size={14} />
                    Fitur PIC belum aktif — jalankan migrasi 1128 dan reload schema Supabase.
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
        {childOrgList.length === 0 && (
          <div className="col-span-1 md:col-span-2 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50 p-8 md:p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <Layers size={48} className="text-slate-300" />
              <h3 className="text-lg font-black text-slate-700">Belum Ada Anak Perusahaan</h3>
              <p className="max-w-xl text-sm text-slate-500">
                Mulai dari membuat entitas anak baru langsung dari halaman ini, atau tautkan organisasi mandiri yang sudah Anda miliki.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null)
                  setIsCreateModalOpen(true)
                }}
                disabled={!canMutate || !canCreateMore}
                className="rounded-[28px] border border-blue-200 bg-white p-6 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                      <Plus size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">Tambah Anak Perusahaan</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">Buat entitas baru langsung di bawah holding ini.</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-blue-500" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsLinkModalOpen(true)}
                disabled={!canMutate || availableUnlinkedOrgs.length === 0 || !canCreateMore}
                className="rounded-[28px] border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">Tautkan Entitas Yang Sudah Ada</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {availableUnlinkedOrgs.length > 0
                          ? `${availableUnlinkedOrgs.length} organisasi siap ditautkan ke holding ini.`
                          : 'Belum ada organisasi mandiri milik Anda yang siap ditautkan.'}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400" />
                </div>
              </button>
            </div>

            {!canMutate && (
              <p className="mt-6 text-center text-xs font-semibold text-slate-400">
                Hanya Owner yang dapat menambah atau menautkan anak perusahaan.
              </p>
            )}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !createLoading && setIsCreateModalOpen(false)}
          />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Tambah Anak Perusahaan</h3>
            <p className="text-sm text-slate-500 mb-8">
              Buat organisasi anak baru yang langsung terhubung ke holding ini. Unit utama dan struktur dasarnya akan disiapkan otomatis.
            </p>

            <form onSubmit={handleCreateChildOrg} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Nama Anak Perusahaan</label>
                <input
                  required
                  name="name"
                  placeholder="Misal: PT Anak Sukses Abadi"
                  className="w-full px-5 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
                />
              </div>

              {createError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {createLoading ? 'Membuat...' : 'Buat Anak Perusahaan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !loading && setIsLinkModalOpen(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Tautkan Entitas Afiliasi</h3>
            <p className="text-sm text-slate-500 mb-8">Pilih organisasi yang sudah Anda miliki untuk digabungkan konterks laporannya di bawah Holding ini.</p>
            
            <form onSubmit={handleLinkOrg} className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Pilih Organisasi (Owner)</label>
                 <select required name="child_id" className="w-full px-5 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold bg-white text-slate-900">
                   <option value="">-- Pilih Organisasi --</option>
                   {availableUnlinkedOrgs.map((org) => (
                     <option key={org.id} value={org.id}>{org.name}</option>
                   ))}
                 </select>
               </div>
               
               <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Batal</button>
                  <button type="submit" disabled={loading} className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50">
                     {loading ? 'Menyimpan...' : 'Tautkan Sekarang'}
                  </button>
               </div>
            </form>
          </motion.div>
        </div>
      )}

      {editingChild && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !editLoading && setEditingChild(null)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Edit Anak Perusahaan</h3>
            <p className="text-sm text-slate-500 mb-8">Perbarui nama organisasi anak. Slug akan disesuaikan otomatis.</p>

            <form onSubmit={handleEditChild} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Nama Organisasi Anak</label>
                <input
                  required
                  name="name"
                  defaultValue={editingChild.name}
                  placeholder="Misal: PT Anak Sukses Abadi"
                  className="w-full px-5 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingChild(null)}
                  className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
