'use client'

/**
 * Dashboard Target & Komisi reseller.
 * Menjaga komisi tetap off-invoice agar invoice customer tidak berubah dan tidak dobel.
 */
import React, { startTransition, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Building2,
  Handshake,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserCircle,
  Users,
} from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatCard } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { createReseller, deleteReseller, updateReseller } from '@/modules/sales/actions/commission.actions'
import {
  calculateCommissionAmount,
  type CommissionSaleRecord,
  getCommissionSchemeLabel,
  getResellerDisplayName,
  getResellerSubtitle,
  normalizeResellerType,
  type SalesResellerRecord,
} from '@/modules/sales/lib/commission'

type ResellerFormState = {
  resellerType: 'PERSONAL' | 'COMPANY'
  name: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  address: string
  notes: string
  targetAmount: string
  commissionType: 'PERCENT' | 'FIXED'
  commissionValue: string
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function createEmptyResellerForm(): ResellerFormState {
  return {
    resellerType: 'PERSONAL',
    name: '',
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    targetAmount: '0',
    commissionType: 'PERCENT',
    commissionValue: '2.5',
  }
}

function toResellerFormState(reseller: SalesResellerRecord): ResellerFormState {
  return {
    resellerType: normalizeResellerType(reseller?.reseller_type),
    name: reseller?.name || '',
    companyName: reseller?.company_name || '',
    contactPerson: reseller?.contact_person || '',
    email: reseller?.email || '',
    phone: reseller?.phone || '',
    address: reseller?.address || '',
    notes: reseller?.notes || '',
    targetAmount: String(Number(reseller?.target_amount || 0)),
    commissionType: String(reseller?.commission_type || 'PERCENT').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT',
    commissionValue: String(Number(reseller?.commission_value || 0)),
  }
}

function buildResellerFormData(formState: ResellerFormState) {
  const formData = new FormData()
  formData.set('reseller_type', formState.resellerType)
  formData.set('name', formState.name)
  formData.set('company_name', formState.companyName)
  formData.set('contact_person', formState.contactPerson)
  formData.set('email', formState.email)
  formData.set('phone', formState.phone)
  formData.set('address', formState.address)
  formData.set('notes', formState.notes)
  formData.set('target_amount', formState.targetAmount || '0')
  formData.set('commission_type', formState.commissionType)
  formData.set('commission_value', formState.commissionValue || '0')
  return formData
}

function getNetInvoiceAmount(sale: CommissionSaleRecord) {
  const activeReturns = (sale?.sales_returns || []).filter((item) => item?.status !== 'VOIDED')
  const returnedAmount = activeReturns.reduce((sum: number, item) => sum + Number(item?.grand_total || 0), 0)
  return Math.max(0, Number(sale?.grand_total || 0) - returnedAmount)
}

export default function CommissionClient({
  orgId,
  sales,
  resellers,
  activeBranchName,
}: {
  orgId: string
  sales: CommissionSaleRecord[]
  resellers: SalesResellerRecord[]
  activeBranchName?: string | null
}) {
  const router = useRouter()
  const [resellerItems, setResellerItems] = useState<SalesResellerRecord[]>(resellers || [])
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingReseller, setEditingReseller] = useState<SalesResellerRecord | null>(null)
  const [formState, setFormState] = useState<ResellerFormState>(createEmptyResellerForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const currentMonthLabel = useMemo(
    () => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date()),
    []
  )

  const qualifiedSales = useMemo(
    () => (sales || []).filter((sale) => sale?.status === 'ORDERED' || sale?.status === 'FINISHED'),
    [sales]
  )

  const monthlySales = useMemo(
    () => qualifiedSales.filter((sale) => String(sale?.sale_date || '').startsWith(currentMonthKey)),
    [currentMonthKey, qualifiedSales]
  )

  const resellerRows = useMemo(() => {
    return resellerItems.map((reseller) => {
      const relatedSales = monthlySales.filter((sale) => String(sale?.reseller_id || '') === String(reseller.id))
      const netSales = relatedSales.reduce((sum, sale) => sum + getNetInvoiceAmount(sale), 0)
      const invoiceCount = relatedSales.length
      const commissionAmount = relatedSales.reduce((sum, sale) => {
        const snapshotType = sale?.commission_type || reseller?.commission_type
        const snapshotValue = sale?.commission_value ?? reseller?.commission_value ?? 0
        return sum + calculateCommissionAmount(getNetInvoiceAmount(sale), snapshotType, Number(snapshotValue || 0))
      }, 0)
      const targetAmount = Number(reseller?.target_amount || 0)
      const progressPct = targetAmount > 0 ? Math.min(Math.round((netSales / targetAmount) * 100), 999) : 0

      return {
        reseller,
        relatedSales,
        invoiceCount,
        netSales,
        commissionAmount,
        progressPct,
        targetAmount,
      }
    }).sort((left, right) => right.netSales - left.netSales)
  }, [monthlySales, resellerItems])

  const topReseller = resellerRows[0] || null
  const totalResellerSales = resellerRows.reduce((sum, row) => sum + row.netSales, 0)
  const totalEstimatedCommission = resellerRows.reduce((sum, row) => sum + row.commissionAmount, 0)
  const invoicesWithoutReseller = monthlySales.filter((sale) => !sale?.reseller_id)

  const recentSales = [...monthlySales]
    .sort((left, right) => String(right?.sale_date || '').localeCompare(String(left?.sale_date || '')))
    .slice(0, 8)

  const closeFormModal = () => {
    setShowFormModal(false)
    setEditingReseller(null)
    setFormState(createEmptyResellerForm())
  }

  const openCreateModal = () => {
    setError(null)
    setEditingReseller(null)
    setFormState(createEmptyResellerForm())
    setShowFormModal(true)
  }

  const openEditModal = (reseller: SalesResellerRecord) => {
    setError(null)
    setEditingReseller(reseller)
    setFormState(toResellerFormState(reseller))
    setShowFormModal(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = buildResellerFormData(formState)
    const response = editingReseller
      ? await updateReseller(editingReseller.org_id, editingReseller.id, formData)
      : await createReseller(orgId, formData)

    if (response?.error) {
      setError(response.error)
      setLoading(false)
      return
    }

    if (response?.data) {
      setResellerItems((current) => {
        if (editingReseller) {
          return current.map((item) => (item.id === response.data.id ? response.data : item))
        }

        return [...current, response.data].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), 'id'))
      })
    }

    setSuccess(editingReseller ? 'Data reseller berhasil diperbarui.' : 'Reseller baru berhasil ditambahkan.')
    closeFormModal()
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setLoading(false)
  }

  const handleDelete = async (reseller: SalesResellerRecord) => {
    const relatedInvoiceCount = monthlySales.filter((sale) => String(sale?.reseller_id || '') === String(reseller.id)).length
    const confirmed = confirm(
      relatedInvoiceCount > 0
        ? `Nonaktifkan reseller "${getResellerDisplayName(reseller)}"? Invoice yang sudah terhubung tetap aman dan komisi historis tidak dihapus.`
        : `Nonaktifkan reseller "${getResellerDisplayName(reseller)}"?`
    )
    if (!confirmed) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const response = await deleteReseller(reseller.org_id, reseller.id)
    if (response?.error) {
      setError(response.error)
      setLoading(false)
      return
    }

    setResellerItems((current) => current.filter((item) => item.id !== reseller.id))
    setSuccess('Reseller berhasil dinonaktifkan dari daftar aktif.')
    startTransition(() => router.refresh())
    setTimeout(() => setSuccess(null), 3200)
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Target />}
        title="Target & Komisi Reseller"
        subtitle={`Pantau target channel partner, reseller personal, dan perusahaan mitra${activeBranchName ? ` untuk unit ${activeBranchName}` : ''}.`}
        tag="Off-Invoice Commission"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={openCreateModal}>
            Tambah Reseller
          </SafeButton>
        }
      />

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label={`Omzet Reseller (${currentMonthLabel})`}
          value={formatRupiah(totalResellerSales)}
          icon={TrendingUp}
          color="blue"
          sub="Net invoice setelah retur"
        />
        <StatCard
          label="Estimasi Kewajiban Komisi"
          value={formatRupiah(totalEstimatedCommission)}
          icon={Trophy}
          color="emerald"
          sub="Dihitung terpisah dari invoice customer"
        />
        <StatCard
          label="Reseller Aktif"
          value={`${resellerItems.length} Mitra`}
          icon={Users}
          color="indigo"
          sub="Personal dan perusahaan mitra"
        />
        <StatCard
          label="Invoice Tanpa Reseller"
          value={`${invoicesWithoutReseller.length} Invoice`}
          icon={AlertCircle}
          color="amber"
          sub="Transaksi direct customer"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <SectionCard>
            <SectionHeader
              title="Database Reseller & Target"
              subtitle="Setiap reseller memiliki target bulanan dan skema komisi sendiri. Snapshot komisi disimpan di invoice saat transaksi dibuat."
            />

            <div className="space-y-4">
              {resellerRows.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <Handshake size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-700">Belum ada reseller aktif.</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">
                    Tambahkan reseller personal atau perusahaan mitra, lalu hubungkan ke invoice penjualan.
                  </p>
                </div>
              )}

              {resellerRows.map(({ reseller, invoiceCount, netSales, commissionAmount, progressPct, targetAmount }) => {
                const isCompany = normalizeResellerType(reseller?.reseller_type) === 'COMPANY'
                const typeLabel = isCompany ? 'Perusahaan Mitra' : 'Reseller Personal'

                return (
                  <div key={reseller.id} className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isCompany ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {isCompany ? <Building2 size={20} /> : <UserCircle size={20} />}
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900">{getResellerDisplayName(reseller)}</div>
                            <div className="text-[11px] font-bold text-slate-400">{typeLabel} • {getResellerSubtitle(reseller)}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                            {getCommissionSchemeLabel(reseller?.commission_type, reseller?.commission_value)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            {invoiceCount} invoice bulan ini
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(reseller)}
                          className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white"
                          title="Edit reseller"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(reseller)}
                          className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-rose-600 transition-all hover:bg-rose-600 hover:text-white"
                          title="Nonaktifkan reseller"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Omzet Bulan Ini</div>
                        <div className="mt-2 text-lg font-black text-slate-900">{formatRupiah(netSales)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Bulanan</div>
                        <div className="mt-2 text-lg font-black text-slate-900">{formatRupiah(targetAmount)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimasi Komisi</div>
                        <div className="mt-2 text-lg font-black text-emerald-600">{formatRupiah(commissionAmount)}</div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Progress target</span>
                        <span className={progressPct >= 100 ? 'text-emerald-600' : 'text-slate-700'}>
                          {targetAmount > 0 ? `${progressPct}%` : 'Belum set target'}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(progressPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Invoice Channel Terbaru"
              subtitle="Monitor invoice yang sudah terhubung reseller maupun yang masih direct customer."
            />

            <div className="space-y-3">
              {recentSales.length === 0 && (
                <div className="py-8 text-center text-xs font-bold uppercase italic text-slate-400">
                  Belum ada invoice reseller bulan ini.
                </div>
              )}

              {recentSales.map((sale) => {
                const reseller = pickRelation(sale?.sales_resellers)
                const baseAmount = getNetInvoiceAmount(sale)
                const schemeType = sale?.commission_type || reseller?.commission_type
                const schemeValue = sale?.commission_value ?? reseller?.commission_value ?? 0
                const estimatedCommission = calculateCommissionAmount(baseAmount, schemeType, Number(schemeValue || 0))

                return (
                  <div key={sale.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{sale.sale_number}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500">
                          {sale.sale_date}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${reseller ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                          {reseller ? getResellerDisplayName(reseller) : 'Direct Customer'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        Customer: {pickRelation(sale?.contacts)?.name || 'Unknown'} • {getCommissionSchemeLabel(schemeType, Number(schemeValue || 0))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:w-[340px]">
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Invoice</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatRupiah(baseAmount)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Komisi</div>
                        <div className="mt-1 text-sm font-black text-emerald-600">{formatRupiah(estimatedCommission)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-8">
          <div className="rounded-[32px] bg-slate-900 p-8 text-white shadow-2xl">
            <div className="mb-6 flex items-center gap-3 text-blue-300">
              <Handshake size={22} />
              <h3 className="text-sm font-black uppercase tracking-widest">Aturan Komisi Aman</h3>
            </div>
            <div className="space-y-4 text-sm font-bold leading-relaxed text-slate-200">
              <p>Komisi reseller dihitung di luar invoice customer. Jadi nilai tagihan ke customer tetap sama.</p>
              <p>Skema komisi disnapshot saat invoice dibuat. Jika setting reseller berubah besok, invoice lama tidak ikut berubah.</p>
              <p>Tidak ada invoice kedua khusus komisi. Dashboard ini cukup untuk monitoring kewajiban komisi reseller.</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-blue-100 bg-blue-50 p-8">
            <div className="mb-3 flex items-center gap-2 text-blue-600">
              <Target size={18} />
              <h3 className="font-black">Sorotan Bulan Ini</h3>
            </div>
            {topReseller ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Top Reseller</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{getResellerDisplayName(topReseller.reseller)}</div>
                  <div className="text-sm font-bold text-slate-500">{getResellerSubtitle(topReseller.reseller)}</div>
                </div>
                <div className="rounded-[24px] bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                    <span>Omzet channel</span>
                    <span className="text-slate-900">{formatRupiah(topReseller.netSales)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-500">
                    <span>Estimasi komisi</span>
                    <span className="text-emerald-600">{formatRupiah(topReseller.commissionAmount)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-500">
                    <span>Progress target</span>
                    <span className={topReseller.progressPct >= 100 ? 'text-emerald-600' : 'text-blue-600'}>
                      {topReseller.targetAmount > 0 ? `${topReseller.progressPct}%` : 'Belum set target'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-blue-900/70">
                Belum ada transaksi reseller di {currentMonthLabel.toLowerCase()}.
              </p>
            )}
          </div>

          <SectionCard>
            <SectionHeader
              title="Checklist Implementasi"
              subtitle="Agar data komisi tetap rapi dan tidak mengganggu invoice."
            />
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                1. Tambahkan master reseller personal atau perusahaan mitra.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                2. Saat buat Sales Order, pilih reseller jika invoice berasal dari channel partner.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                3. Pantau estimasi komisi di dashboard ini tanpa perlu membuat invoice komisi terpisah.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeFormModal} />
          <div className="relative w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  {editingReseller ? 'Edit Reseller' : 'Tambah Reseller Baru'}
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-400">
                  Simpan reseller personal atau perusahaan mitra beserta target dan skema komisinya.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-500 transition-all hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe Reseller</label>
                  <select
                    value={formState.resellerType}
                    onChange={(event) => setFormState((current) => ({ ...current, resellerType: event.target.value === 'COMPANY' ? 'COMPANY' : 'PERSONAL' }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-900 outline-none transition-all focus:border-blue-500"
                  >
                    <option value="PERSONAL">Reseller Personal</option>
                    <option value="COMPANY">Perusahaan Mitra</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {formState.resellerType === 'COMPANY' ? 'Nama Tampilan / Kode Partner' : 'Nama Reseller'}
                  </label>
                  <input
                    required
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                    placeholder={formState.resellerType === 'COMPANY' ? 'Contoh: PT Sukses Jaya' : 'Contoh: Ahmad Fauzi'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perusahaan Mitra</label>
                  <input
                    value={formState.companyName}
                    onChange={(event) => setFormState((current) => ({ ...current, companyName: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                    placeholder="Opsional, terutama untuk reseller personal"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PIC / Contact Person</label>
                  <input
                    value={formState.contactPerson}
                    onChange={(event) => setFormState((current) => ({ ...current, contactPerson: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                    placeholder="Nama PIC jika perusahaan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                    placeholder="email@mitra.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">No. Telepon / WA</label>
                  <input
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Bulanan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formState.targetAmount}
                    onChange={(event) => setFormState((current) => ({ ...current, targetAmount: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe Komisi</label>
                  <select
                    value={formState.commissionType}
                    onChange={(event) => setFormState((current) => ({ ...current, commissionType: event.target.value === 'FIXED' ? 'FIXED' : 'PERCENT' }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-900 outline-none transition-all focus:border-blue-500"
                  >
                    <option value="PERCENT">Persentase dari net invoice</option>
                    <option value="FIXED">Nominal tetap per invoice</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {formState.commissionType === 'PERCENT' ? 'Nilai Komisi (%)' : 'Nominal Komisi / Invoice'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.commissionValue}
                    onChange={(event) => setFormState((current) => ({ ...current, commissionValue: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                  />
                </div>
                <div className="rounded-[24px] border border-blue-100 bg-blue-50 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Ringkasan Skema</div>
                  <div className="mt-2 text-sm font-black text-slate-900">
                    {getCommissionSchemeLabel(formState.commissionType, Number(formState.commissionValue || 0))}
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-blue-900/70">
                    Berlaku untuk invoice baru setelah reseller dipilih saat pembuatan Sales Order.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alamat</label>
                <textarea
                  value={formState.address}
                  onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))}
                  className="min-h-[84px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                  placeholder="Alamat reseller atau perusahaan mitra"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan Internal</label>
                <textarea
                  value={formState.notes}
                  onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[84px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500"
                  placeholder="Contoh: komisi dibayar tiap akhir bulan atau setelah invoice lunas"
                />
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="flex-1 rounded-2xl bg-slate-50 py-4 text-xs font-black text-slate-500 transition-all hover:bg-slate-100"
                >
                  Batal
                </button>
                <SafeButton
                  type="submit"
                  variant="primary"
                  className="flex-1 justify-center"
                  disabled={loading || !orgId}
                  isLoading={loading}
                  loadingText="Menyimpan..."
                >
                  {editingReseller ? 'Simpan Perubahan' : 'Simpan Reseller'}
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
