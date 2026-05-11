'use client'

import React, { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
  Trophy,
  TrendingUp,
  UserCircle,
  Users,
} from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatCard } from '@/components/ui/NizamUI'
import { createContact, deleteContact, updateContact } from '@/modules/contacts/actions/contact.actions'
import { formatRupiah } from '@/lib/utils'

type ContactType = 'CUSTOMER' | 'SUPPLIER'
type ContactFilter = 'ALL' | ContactType

type ContactRecord = {
  id: string
  type: ContactType
  name: string
  email: string | null
  phone: string | null
  address: string | null
  phone_wa?: string | null
  instagram?: string | null
}

type ContactFormState = {
  type: ContactType
  name: string
  email: string
  phone: string
  address: string
  phone_wa: string
  instagram: string
}

interface ContactClientProps {
  orgId: string
  contacts: any[]
  customerPareto: any
  initialTypeFilter?: ContactFilter
}

function normalizeContact(contact: any): ContactRecord {
  return {
    id: contact.id,
    type: contact.type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER',
    name: contact.name || '-',
    email: contact.email || null,
    phone: contact.phone || null,
    address: contact.address || null,
    phone_wa: contact.phone_wa || null,
    instagram: contact.instagram || null,
  }
}

function sortContacts(items: ContactRecord[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'id', { sensitivity: 'base' }))
}

function getDefaultType(filter: ContactFilter): ContactType {
  return filter === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER'
}

function createEmptyForm(type: ContactType): ContactFormState {
  return {
    type,
    name: '',
    email: '',
    phone: '',
    address: '',
    phone_wa: '',
    instagram: '',
  }
}

function toFormState(contact: ContactRecord): ContactFormState {
  return {
    type: contact.type,
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    address: contact.address || '',
    phone_wa: contact.phone_wa || '',
    instagram: contact.instagram || '',
  }
}

function buildFormData(formState: ContactFormState, forcedType?: ContactType) {
  const formData = new FormData()
  formData.set('type', forcedType || formState.type)
  formData.set('name', formState.name)
  formData.set('email', formState.email)
  formData.set('phone', formState.phone)
  formData.set('address', formState.address)
  formData.set('phone_wa', formState.phone_wa)
  formData.set('instagram', formState.instagram)
  return formData
}

export default function ContactClient({
  orgId,
  contacts,
  customerPareto,
  initialTypeFilter = 'ALL',
}: ContactClientProps) {
  const router = useRouter()
  const [contactItems, setContactItems] = useState<ContactRecord[]>(() => sortContacts((contacts || []).map(normalizeContact)))
  const [activeType, setActiveType] = useState<ContactFilter>(initialTypeFilter)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null)
  const [formState, setFormState] = useState<ContactFormState>(() => createEmptyForm(getDefaultType(initialTypeFilter)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setContactItems(sortContacts((contacts || []).map(normalizeContact)))
  }, [contacts])

  useEffect(() => {
    setActiveType(initialTypeFilter)
  }, [initialTypeFilter])

  const customers = contactItems.filter((contact) => contact.type === 'CUSTOMER')
  const suppliers = contactItems.filter((contact) => contact.type === 'SUPPLIER')
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredContacts = contactItems.filter((contact) => {
    if (activeType !== 'ALL' && contact.type !== activeType) return false
    if (!normalizedQuery) return true

    return [contact.name, contact.phone, contact.email, contact.address, contact.phone_wa, contact.instagram]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  })

  const visibleBaseCount = activeType === 'CUSTOMER' ? customers.length : activeType === 'SUPPLIER' ? suppliers.length : contactItems.length
  const createLabel = activeType === 'SUPPLIER' ? 'Vendor Baru' : activeType === 'CUSTOMER' ? 'Customer Baru' : 'Kontak Baru'
  const sectionTitle = activeType === 'SUPPLIER' ? 'Daftar Vendor' : activeType === 'CUSTOMER' ? 'Daftar Customer' : 'Daftar Relasi Bisnis'
  const sectionSubtitle =
    activeType === 'SUPPLIER'
      ? 'Kelola vendor aktif, edit profil pemasok, hapus vendor, dan cari supplier lebih cepat.'
      : activeType === 'CUSTOMER'
        ? 'Kelola customer aktif, edit profil pelanggan, dan cari relasi penjualan dengan cepat.'
        : 'Database lengkap pelanggan dan mitra perusahaan.'
  const searchPlaceholder =
    activeType === 'SUPPLIER'
      ? 'Cari nama vendor, telepon, email, atau alamat...'
      : activeType === 'CUSTOMER'
        ? 'Cari nama customer, telepon, email, atau alamat...'
        : 'Cari nama, telepon, email, atau alamat...'
  const formType = activeType === 'ALL' ? formState.type : activeType
  const isEditing = Boolean(editingContact)
  const formTitle = isEditing ? (formType === 'SUPPLIER' ? 'Edit Vendor' : 'Edit Kontak') : (formType === 'SUPPLIER' ? 'Tambah Vendor Baru' : 'Tambah Kontak Baru')
  const formSubmitLabel = isEditing ? 'Simpan Perubahan' : (formType === 'SUPPLIER' ? 'Simpan Vendor' : 'Simpan Data')

  const isParetoVIP = (contactId: string) => {
    return customerPareto?.paretoCustomers?.some((contact: any) => contact.id === contactId)
  }

  const resetFeedback = () => {
    setError(null)
    setSuccess(null)
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    setEditingContact(null)
    setFormState(createEmptyForm(getDefaultType(activeType)))
  }

  const openCreateModal = () => {
    resetFeedback()
    setEditingContact(null)
    setFormState(createEmptyForm(getDefaultType(activeType)))
    setShowFormModal(true)
  }

  const openEditModal = (contact: ContactRecord) => {
    resetFeedback()
    setEditingContact(contact)
    setFormState(toFormState(contact))
    setShowFormModal(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = buildFormData(formState, formType)
    const response = editingContact
      ? await updateContact(orgId, editingContact.id, formData)
      : await createContact(orgId, formData)

    if (response?.error) {
      setError(response.error)
      setLoading(false)
      return
    }

    if (response?.data) {
      const normalizedContact = normalizeContact(response.data)
      setContactItems((current) => {
        if (editingContact) {
          return sortContacts(current.map((item) => (item.id === normalizedContact.id ? normalizedContact : item)))
        }

        return sortContacts([normalizedContact, ...current])
      })
    }

    setSuccess(editingContact ? `${formType === 'SUPPLIER' ? 'Vendor' : 'Kontak'} berhasil diperbarui.` : `${formType === 'SUPPLIER' ? 'Vendor' : 'Kontak'} baru berhasil ditambahkan.`)
    closeFormModal()
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setLoading(false)
  }

  const handleDelete = async (contact: ContactRecord) => {
    const label = contact.type === 'SUPPLIER' ? 'vendor' : 'kontak'
    if (!confirm(`Hapus ${label} "${contact.name}"? Riwayat transaksi lama tetap aman, data ini hanya disembunyikan dari daftar aktif.`)) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const response = await deleteContact(orgId, contact.id)
    if (response?.error) {
      setError(response.error)
      setLoading(false)
      return
    }

    setContactItems((current) => current.filter((item) => item.id !== contact.id))
    setSuccess(`${contact.type === 'SUPPLIER' ? 'Vendor' : 'Kontak'} berhasil dihapus.`)
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setLoading(false)
  }

  const filterButtons: { key: ContactFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Semua', count: contactItems.length },
    { key: 'CUSTOMER', label: 'Customer', count: customers.length },
    { key: 'SUPPLIER', label: 'Vendor', count: suppliers.length },
  ]

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Users />}
        title="Pelanggan & Pemasok (CRM)"
        subtitle="Pusat data relasi bisnis, manajemen pelanggan (Customer), dan pemasok (Supplier)."
        tag="CRM Core"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={openCreateModal}>
            {createLabel}
          </SafeButton>
        }
      />

      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 shadow-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700 shadow-sm">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Customer" value={customers.length} icon={UserCircle} color="blue" onClick={() => setActiveType('CUSTOMER')} sub="Klik untuk fokus ke daftar customer" />
        <StatCard label="Total Supplier" value={suppliers.length} icon={Building2} color="emerald" onClick={() => setActiveType('SUPPLIER')} sub="Klik untuk fokus ke daftar vendor" />
        <StatCard label="Customer Pareto (Top 20%)" value={customerPareto?.top20Count || 0} icon={Trophy} color="amber" />
        <StatCard label="Sales / Profit VIP" value={`${formatRupiah(customerPareto?.top20Revenue || 0)} / ${formatRupiah(customerPareto?.top20Profit || 0)}`} icon={TrendingUp} color="indigo" />
      </div>

      {customerPareto && activeType !== 'SUPPLIER' && (
        <div className="bg-indigo-900 rounded-2xl p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
          <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
            <Trophy size={180} />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500 text-amber-950 rounded-full text-[9px] font-semibold tracking-tight">
                <Target size={12} /> Pareto Intelligence
              </div>
              <h2 className="text-3xl font-semibold italic tracking-tighter leading-tight">Analisis 80/20 Pelanggan VIP</h2>
              <p className="text-sm font-medium text-indigo-200 leading-relaxed">
                Sistem mendeteksi bahwa <span className="text-white font-bold">{customerPareto.top20Count} pelanggan</span> Anda berkontribusi terhadap <span className="text-amber-400 font-bold">80% dari total pendapatan</span> ({formatRupiah(customerPareto.top20Revenue)}).
              </p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {customerPareto.paretoCustomers?.slice(0, 4).map((contact: any, index: number) => (
                <div key={`${contact.id || contact.name}-${index}`} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-xl flex items-center justify-between group hover:bg-white/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black">#{index + 1}</div>
                    <div>
                      <div className="text-sm font-bold text-white">{contact.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-tight">{formatRupiah(contact.revenue)}</span>
                        <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-tight leading-none">/ {formatRupiah(contact.profit || 0)} PROFIT</span>
                      </div>
                    </div>
                  </div>
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionHeader
          title={sectionTitle}
          subtitle={sectionSubtitle}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex bg-slate-100/70 p-1 rounded-2xl border border-slate-100 shadow-inner">
                {filterButtons.map((button) => (
                  <button
                    key={button.key}
                    type="button"
                    onClick={() => setActiveType(button.key)}
                    className={`px-4 py-2 text-[10px] font-semibold tracking-tight rounded-xl transition-all ${
                      activeType === button.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {button.label} ({button.count})
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:border-blue-500 outline-none w-72"
                />
              </div>
            </div>
          }
        />

        <div className="px-10 pt-6 text-[11px] font-bold text-slate-400 tracking-tight">
          Menampilkan {filteredContacts.length} dari {visibleBaseCount} data aktif
        </div>

        <div className="p-10 pt-6">
          {filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContacts.map((contact) => {
                const isSupplier = contact.type === 'SUPPLIER'
                const isVip = contact.type === 'CUSTOMER' && isParetoVIP(contact.id)

                return (
                  <div
                    key={contact.id}
                    className={`border rounded-xl p-6 hover:shadow-xl transition-all group relative overflow-hidden ${
                      isSupplier
                        ? 'bg-white border-emerald-100 hover:shadow-emerald-500/5'
                        : 'bg-white border-slate-100 hover:shadow-blue-500/5'
                    }`}
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity ${isSupplier ? 'bg-emerald-50' : 'bg-blue-50'}`} />

                    <div className="relative z-10 flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${isSupplier ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {contact.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold text-slate-800 tracking-tight truncate">{contact.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`px-3 py-1 text-[9px] font-semibold tracking-tight rounded-full border ${isSupplier ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {isSupplier ? 'VENDOR' : 'CUSTOMER'}
                            </span>
                            {isVip && (
                              <span className="px-3 py-1 text-[9px] font-semibold tracking-tight rounded-full border bg-amber-50 text-amber-600 border-amber-100 inline-flex items-center gap-1">
                                <Trophy size={10} />
                                VIP Pareto
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(contact)}
                          className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center"
                          title={isSupplier ? 'Edit vendor' : 'Edit kontak'}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(contact)}
                          className="w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center"
                          title={isSupplier ? 'Hapus vendor' : 'Hapus kontak'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="relative z-10">
                      {isSupplier ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold mb-4 uppercase">
                          <Building2 size={10} /> Vendor aktif untuk purchasing
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mb-4 uppercase">
                          <Star size={10} className="fill-amber-500" /> {isVip ? 'Pelanggan VIP (Pareto)' : 'Pelanggan Aktif'}
                        </div>
                      )}

                      <div className="space-y-3 mt-6 pt-6 border-t border-slate-100 italic">
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">{contact.phone || contact.phone_wa || '-'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                          <Mail size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">{contact.email || '-'}</span>
                        </div>
                        {contact.address && (
                          <div className="flex items-start gap-3 text-sm font-semibold text-slate-600 leading-relaxed">
                            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <span>{contact.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 font-bold text-xs uppercase italic">
              {contactItems.length === 0
                ? activeType === 'SUPPLIER'
                  ? 'Belum ada vendor aktif didaftarkan.'
                  : activeType === 'CUSTOMER'
                    ? 'Belum ada customer aktif didaftarkan.'
                    : 'Belum ada pelanggan atau pemasok didaftarkan.'
                : 'Tidak ada data yang cocok dengan pencarian atau filter saat ini.'}
            </div>
          )}
        </div>
      </SectionCard>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeFormModal} />
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{formTitle}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeType === 'ALL' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Tipe Kontak</label>
                  <select
                    value={formState.type}
                    onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value as ContactType }))}
                    required
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                  >
                    <option value="CUSTOMER">PELANGGAN (CUSTOMER)</option>
                    <option value="SUPPLIER">PEMASOK (SUPPLIER)</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Tipe Kontak</label>
                  <div className={`w-full h-12 px-4 border rounded-xl text-sm font-black flex items-center ${formType === 'SUPPLIER' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                    {formType === 'SUPPLIER' ? 'VENDOR / SUPPLIER' : 'CUSTOMER / PELANGGAN'}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Nama Lengkap / Perusahaan</label>
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                  className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                  placeholder="Contoh: PT ABC Makmur"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Nomor HP</label>
                  <input
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                    placeholder="08..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">WhatsApp</label>
                  <input
                    value={formState.phone_wa}
                    onChange={(event) => setFormState((current) => ({ ...current, phone_wa: event.target.value }))}
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                    placeholder="62..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Email</label>
                  <input
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                    type="email"
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                    placeholder="email@contoh.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Instagram</label>
                  <input
                    value={formState.instagram}
                    onChange={(event) => setFormState((current) => ({ ...current, instagram: event.target.value }))}
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                    placeholder="@supplier"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Alamat</label>
                <textarea
                  value={formState.address}
                  onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))}
                  className="w-full min-h-[96px] px-4 py-3 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                  placeholder="Alamat kantor, toko, atau gudang"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={closeFormModal} className="px-6 py-3 font-bold text-slate-400">
                  Batalkan
                </button>
                <SafeButton variant="primary" isLoading={loading} type="submit">
                  {formSubmitLabel}
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
