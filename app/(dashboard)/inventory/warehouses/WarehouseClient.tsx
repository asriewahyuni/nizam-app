'use client'

import React, { startTransition, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, MapPin, Package, Pencil, Plus, Search, Trash2, Warehouse } from 'lucide-react'
import { PageHeader, SafeButton, SectionCard, SectionHeader, StatusBadge } from '@/components/ui/NizamUI'
import { createWarehouse, deleteWarehouse, updateWarehouse } from '@/modules/inventory/actions/warehouse.actions'

type WarehouseRecord = {
  id: string
  code: string
  name: string
  address: string | null
  is_active: boolean
}

type WarehouseFormState = {
  code: string
  name: string
  address: string
}

interface WarehouseClientProps {
  orgId: string
  initialWarehouses: any[]
  userRole: string
}

function normalizeWarehouse(warehouse: any): WarehouseRecord {
  return {
    id: warehouse.id,
    code: warehouse.code || '',
    name: warehouse.name || '-',
    address: warehouse.address || null,
    is_active: warehouse.is_active !== false,
  }
}

function sortWarehouses(items: WarehouseRecord[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'id', { sensitivity: 'base' }))
}

function createEmptyForm(): WarehouseFormState {
  return {
    code: '',
    name: '',
    address: '',
  }
}

function toFormState(warehouse: WarehouseRecord): WarehouseFormState {
  return {
    code: warehouse.code || '',
    name: warehouse.name || '',
    address: warehouse.address || '',
  }
}

export function WarehouseClient({ orgId, initialWarehouses, userRole }: WarehouseClientProps) {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => sortWarehouses((initialWarehouses || []).map(normalizeWarehouse)))
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState<WarehouseFormState>(createEmptyForm)

  useEffect(() => {
    setWarehouses(sortWarehouses((initialWarehouses || []).map(normalizeWarehouse)))
  }, [initialWarehouses])

  const isAdmin = ['owner', 'admin', 'manager'].includes(userRole)
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredWarehouses = warehouses.filter((warehouse) => {
    if (!normalizedQuery) return true

    return [warehouse.code, warehouse.name, warehouse.address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  })

  const resetFeedback = () => {
    setError(null)
    setSuccess(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingWarehouse(null)
    setFormData(createEmptyForm())
  }

  const openCreateModal = () => {
    resetFeedback()
    setEditingWarehouse(null)
    setFormData(createEmptyForm())
    setShowModal(true)
  }

  const openEditModal = (warehouse: WarehouseRecord) => {
    resetFeedback()
    setEditingWarehouse(warehouse)
    setFormData(toFormState(warehouse))
    setShowModal(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const payload = {
      code: formData.code,
      name: formData.name,
      address: formData.address,
    }

    const response = editingWarehouse
      ? await updateWarehouse(orgId, editingWarehouse.id, payload)
      : await createWarehouse(orgId, payload)

    if (response?.error) {
      setError(response.error)
      setSubmitting(false)
      return
    }

    if (response?.data) {
      const normalizedWarehouse = normalizeWarehouse(response.data)
      setWarehouses((current) => {
        if (editingWarehouse) {
          return sortWarehouses(current.map((item) => (item.id === normalizedWarehouse.id ? normalizedWarehouse : item)))
        }

        return sortWarehouses([normalizedWarehouse, ...current])
      })
    }

    setSuccess(editingWarehouse ? 'Gudang berhasil diperbarui.' : 'Gudang baru berhasil ditambahkan.')
    closeModal()
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setSubmitting(false)
  }

  const handleDelete = async (warehouse: WarehouseRecord) => {
    if (!confirm(`Hapus gudang "${warehouse.name}"? Data gudang akan dinonaktifkan dari daftar aktif.`)) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const response = await deleteWarehouse(orgId, warehouse.id)
    if (response?.error) {
      setError(response.error)
      setSubmitting(false)
      return
    }

    setWarehouses((current) => current.filter((item) => item.id !== warehouse.id))
    setSuccess('Gudang berhasil dihapus.')
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setSubmitting(false)
  }

  const modalTitle = editingWarehouse ? 'Edit Gudang' : 'Tambah Gudang Baru'

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        icon={<Warehouse />}
        title="Daftar Gudang"
        subtitle="Kelola lokasi fisik, cari gudang aktif, edit profil gudang, dan buka layout bin."
        tag="Warehouse Module"
        actions={
          isAdmin ? (
            <SafeButton variant="emerald" icon={<Plus size={18} />} onClick={openCreateModal}>
              Gudang Baru
            </SafeButton>
          ) : null
        }
      />

      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-3 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 shadow-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700 shadow-sm">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      <SectionCard>
        <SectionHeader
          title="List Gudang"
          subtitle="Cari dan buka gudang untuk mengatur bin, layout, dan distribusi stok."
          actions={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari kode, nama, atau alamat gudang..."
                className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:border-emerald-500 outline-none w-72"
              />
            </div>
          }
        />

        <div className="px-10 pt-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Menampilkan {filteredWarehouses.length} dari {warehouses.length} gudang aktif
        </div>

        <div className="p-10 pt-6">
          {filteredWarehouses.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-400">
                <Warehouse size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">
                  {warehouses.length === 0 ? 'Belum Ada Gudang' : 'Gudang Tidak Ditemukan'}
                </h3>
                <p className="text-sm text-slate-400 max-w-xs mx-auto">
                  {warehouses.length === 0
                    ? 'Tambahkan lokasi fisik untuk mulai melacak persediaan Anda.'
                    : 'Ubah kata kunci pencarian untuk menemukan gudang yang Anda cari.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWarehouses.map((warehouse) => (
                <div key={warehouse.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-emerald-100 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 font-bold border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                      {warehouse.code}
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge label={warehouse.is_active ? 'Aktif' : 'Nonaktif'} variant={warehouse.is_active ? 'success' : 'neutral'} />
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(warehouse)}
                            className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-center"
                            title="Edit gudang"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(warehouse)}
                            className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center"
                            title="Hapus gudang"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <Link href={`/inventory/warehouses/${warehouse.id}`} className="block focus:outline-none">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 truncate group-hover:text-emerald-700 transition-colors" title={warehouse.name}>
                      {warehouse.name}
                    </h3>

                    <div className="flex items-start gap-2 text-slate-500 text-sm min-h-[44px]">
                      <MapPin size={16} className="shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed">{warehouse.address || 'Alamat belum diatur'}</p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Package size={18} className="text-emerald-500" />
                        <span>Atur Bin & Layout</span>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                        Buka &rarr;
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Warehouse size={20} className="text-emerald-600" />
                {modalTitle}
              </h2>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Kode Gudang (Singkatan)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(event) => setFormData((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:font-normal"
                  placeholder="e.g., JKT-01"
                  required
                  maxLength={10}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Nama Gudang</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Gudang Distribusi Jakarta"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Alamat Fisik</label>
                <textarea
                  value={formData.address}
                  onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                  placeholder="Jl. Raya Perjuangan No.1..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <SafeButton variant="emerald" isLoading={submitting} type="submit" className="flex-1 justify-center">
                  {editingWarehouse ? 'Simpan Perubahan' : 'Simpan Gudang'}
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
