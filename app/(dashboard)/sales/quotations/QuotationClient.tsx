'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, Send, AlertCircle, Trash2, Printer, ArrowRight, XCircle, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton, useConfirm} from '@/components/ui/NizamUI'
import { createQuotation, convertQuotationToOrder } from '@/modules/sales/actions/sales.actions'
import { createContact } from '@/modules/contacts/actions/contact.actions'
import { getUsableSalesPromoByCode } from '@/modules/sales/actions/promo.actions'
import { formatRupiah } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import type { SalesPromoRecord } from '@/modules/sales/lib/sales-promos'

type MaybeRelation<T> = T | T[] | null | undefined

type ContactOption = {
  id: string
  name: string
}

type ProductOption = {
  id: string
  name: string
  selling_price?: number | null
  unit?: string | null
}

type CustomerFormState = {
  name: string
  email: string
  phone: string
  phone_wa: string
  instagram: string
  address: string
}

type QuotationLine = {
  id: string | number
  description?: string | null
  quantity?: number | null
  unit_price?: number | null
  discount_amount?: number | null
  products?: MaybeRelation<{ unit?: string | null }>
}

type QuotationRecord = {
  id: string
  sale_number?: string | null
  sale_date?: string | null
  due_date?: string | null
  notes?: string | null
  status?: string | null
  total_amount?: number | null
  tax_amount?: number | null
  discount_amount?: number | null
  grand_total?: number | null
  contacts?: MaybeRelation<{ name?: string | null }>
  branches?: MaybeRelation<{ name?: string | null; code?: string | null }>
  sales_items?: QuotationLine[] | null
}

type QuotationClientProps = {
  orgId: string
  orgName?: string | null
  orgSettings?: Record<string, string | null | undefined>
  activeBranchName?: string | null
  quotations: QuotationRecord[]
  customers: ContactOption[]
  products: ProductOption[]
}

type DraftLine = {
  id: number
  product_name: string
  product_id: string
  quantity: number
  unit_price: number
  discount_amount: number
}

type HeaderDiscountMode = 'FIXED' | 'PERCENT'

function sanitizeDraftNumber(value: string | number, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getSafeLineNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0
}

function pickRelation<T>(value: MaybeRelation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getQuotationTotals(quotation: QuotationRecord) {
  const items = quotation.sales_items || []
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  )
  const lineDiscount = items.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.discount_amount || 0)),
    0
  )
  const headerDiscount = Number(quotation.discount_amount || 0)
  const taxAmount = Number(quotation.tax_amount || 0)
  const hasLineTotals = items.length > 0
  const effectiveSubtotal = hasLineTotals ? subtotal : Number(quotation.total_amount || 0)
  const effectiveLineDiscount = hasLineTotals ? lineDiscount : 0
  const computedGrandTotal = effectiveSubtotal - effectiveLineDiscount - headerDiscount + taxAmount

  return {
    subtotal: effectiveSubtotal,
    lineDiscount: effectiveLineDiscount,
    headerDiscount,
    taxAmount,
    grandTotal: hasLineTotals ? computedGrandTotal : Number(quotation.grand_total || 0),
  }
}

function createDraftLine(): DraftLine {
  return {
    id: Date.now(),
    product_name: '',
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
  }
}

function sortContactOptions(items: ContactOption[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'id', { sensitivity: 'base' }))
}

function createEmptyCustomerForm(): CustomerFormState {
  return {
    name: '',
    email: '',
    phone: '',
    phone_wa: '',
    instagram: '',
    address: '',
  }
}

function calculateHeaderDiscount(baseAmount: number, mode: HeaderDiscountMode, value: number): number {
  const normalizedBase = Math.max(0, sanitizeDraftNumber(baseAmount))
  const normalizedValue = Math.max(0, sanitizeDraftNumber(value))
  if (normalizedBase <= 0 || normalizedValue <= 0) return 0

  if (mode === 'PERCENT') {
    return Math.min(
      normalizedBase,
      Math.round(normalizedBase * (Math.min(100, normalizedValue) / 100))
    )
  }

  return Math.min(normalizedBase, Math.round(normalizedValue))
}

export default function QuotationClient({
  orgId,
  orgName,
  orgSettings = {},
  activeBranchName,
  quotations,
  customers,
  products,
}: QuotationClientProps) {
  const [showModal, setShowModal] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [customerError, setCustomerError] = useState<string | null>(null)
  const [viewQuotation, setViewQuotation] = useState<QuotationRecord | null>(null)
  const [customerOptions, setCustomerOptions] = useState<ContactOption[]>(() => sortContactOptions(customers))
  const [sortOrderQ, setSortOrderQ] = useState<'desc' | 'asc'>('desc')
  const [searchQ, setSearchQ] = useState('')
  const sortedQuotations = [...quotations]
    .filter(q => {
      if (!searchQ.trim()) return true
      const query = searchQ.toLowerCase()
      const num = (q.sale_number || '').toLowerCase()
      const cust = (pickRelation(q.contacts) as any)?.name?.toLowerCase() || ''
      return num.includes(query) || cust.includes(query)
    })
    .sort((a, b) => {
      const da = String((a as any).sale_date || (a as any).created_at || '')
      const db = String((b as any).sale_date || (b as any).created_at || '')
      return sortOrderQ === 'desc' ? db.localeCompare(da) : da.localeCompare(db)
    })
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => createEmptyCustomerForm())

  const [customerId, setCustomerId] = useState('')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [manualDiscountMode, setManualDiscountMode] = useState<HeaderDiscountMode>('FIXED')
  const [manualDiscountValue, setManualDiscountValue] = useState(0)
  const [appliedPromo, setAppliedPromo] = useState<SalesPromoRecord | null>(null)
  const [lines, setLines] = useState<DraftLine[]>(() => [createDraftLine()])

  useEffect(() => {
    setCustomerOptions(sortContactOptions(customers))
  }, [customers])

  const companyProfile = {
    name: orgSettings.brand_name || orgName || 'Perusahaan',
    logo: orgSettings.logo_url || '/logo.png',
    address: orgSettings.company_address || 'Alamat perusahaan belum diatur (Silakan update di Pengaturan -> Bisnis).',
    hotline: orgSettings.hotline || '',
    email: orgSettings.email || '',
    website: orgSettings.website || '',
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + (getSafeLineNumber(line.quantity) * getSafeLineNumber(line.unit_price)),
    0
  )
  const totalLineDiscount = lines.reduce(
    (sum, line) => sum + (getSafeLineNumber(line.quantity) * getSafeLineNumber(line.discount_amount)),
    0
  )
  const promoDiscount = appliedPromo
    ? calculateHeaderDiscount(subtotal, appliedPromo.type, appliedPromo.value)
    : 0
  const manualDiscount = calculateHeaderDiscount(subtotal, manualDiscountMode, manualDiscountValue)
  const maxHeaderDiscount = Math.max(0, subtotal - totalLineDiscount)
  const headerDiscount = Math.min(maxHeaderDiscount, promoDiscount + manualDiscount)
  const isHeaderDiscountClamped = (promoDiscount + manualDiscount) > maxHeaderDiscount
  const grandTotal = Math.max(0, subtotal - totalLineDiscount - headerDiscount)

  const handleApplyPromo = async () => {
    const code = promoCode.toUpperCase().trim()
    if (!code) return

    const promoResult = await getUsableSalesPromoByCode(orgId, code)
    if ('error' in promoResult) {
      alert(promoResult.error)
      return
    }

    setAppliedPromo(promoResult.promo)
    setPromoCode('')
  }

  const handleAddLine = () => {
    setLines((current) => [...current, createDraftLine()])
  }

  const resetCustomerForm = () => {
    setCustomerForm(createEmptyCustomerForm())
    setCustomerError(null)
  }

  const openCustomerModal = () => {
    resetCustomerForm()
    setShowCustomerModal(true)
  }

  const closeCustomerModal = () => {
    setShowCustomerModal(false)
    resetCustomerForm()
  }

  const handleLineChange = (id: number, field: keyof DraftLine, value: string | number) => {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line
      const nextValue = field === 'product_name' || field === 'product_id'
        ? String(value)
        : sanitizeDraftNumber(value)
      const updatedLine = { ...line, [field]: nextValue } as DraftLine
      if (field === 'product_name') {
        const product = products.find((item) => item.name === value)
        if (product) {
          updatedLine.product_id = product.id
          updatedLine.unit_price = Number(product.selling_price || 0)
        }
      }
      return updatedLine
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const usableLines = lines.filter((line) => String(line.product_name || '').trim().length > 0)

    if (!customerId) {
      setError('Customer harus dipilih!')
      return
    }

    if (usableLines.length === 0) {
      setError('Tambahkan minimal 1 item penawaran sebelum menyimpan.')
      return
    }

    if (usableLines.some((line) => Number(line.quantity || 0) <= 0 || Number(line.unit_price || 0) < 0)) {
      setError('Lengkapi detail barang, kuantitas, dan harga pada setiap baris penawaran.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const finalNotes = appliedPromo
      ? `${notes}\n\n[MENGGUNAKAN VOUCHER: ${appliedPromo.code} - Diskon Ekstra ${formatRupiah(promoDiscount)}]`
      : notes

    const res = await createQuotation(orgId, {
      customer_id: customerId,
      sale_date: quoteDate,
      notes: finalNotes,
      discount_amount: manualDiscount,
      manual_discount_mode: manualDiscountMode,
      manual_discount_value: manualDiscountValue,
      promo_code: appliedPromo?.code || null,
      lines: usableLines.map((line) => ({
        product_id: line.product_id || undefined,
        product_name: line.product_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: line.discount_amount,
      })),
    })

    if (res?.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    setSuccess('Penawaran berhasil dibuat!')
    setShowModal(false)
    setTimeout(() => window.location.reload(), 1000)
  }

  const handleCreateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!customerForm.name.trim()) {
      setCustomerError('Nama customer wajib diisi.')
      return
    }

    setSavingCustomer(true)
    setCustomerError(null)

    const formData = new FormData()
    formData.set('type', 'CUSTOMER')
    formData.set('name', customerForm.name)
    formData.set('email', customerForm.email)
    formData.set('phone', customerForm.phone)
    formData.set('phone_wa', customerForm.phone_wa)
    formData.set('instagram', customerForm.instagram)
    formData.set('address', customerForm.address)

    const res = await createContact(orgId, formData)

    if (res?.error) {
      setCustomerError(res.error)
      setSavingCustomer(false)
      return
    }

    if (res?.data?.id) {
      const nextCustomer = {
        id: String(res.data.id),
        name: String(res.data.name || customerForm.name).trim(),
      }

      setCustomerOptions((current) => sortContactOptions([
        ...current.filter((item) => item.id !== nextCustomer.id),
        nextCustomer,
      ]))
      setCustomerId(nextCustomer.id)
    }

    setSavingCustomer(false)
    closeCustomerModal()
  }

  const handleConvert = async (id: string) => {
    if (!await confirm('Ubah penawaran ini menjadi Pesanan Penjualan (Order) resmi?')) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    const res = await convertQuotationToOrder(orgId, id)
    if (res?.error) {
      setError(res.error)
    } else {
      setSuccess('Berhasil dikonversi menjadi Sales Order (DRAFT)!')
      setTimeout(() => setSuccess(null), 3500)
    }

    setLoading(false)
  }

  const handlePreviewPrint = (quotation: QuotationRecord) => {
    setViewQuotation(quotation)
    setError(null)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <div className={`space-y-12 ${viewQuotation ? 'print:hidden' : ''}`}>
        <PageHeader
          icon={<FileText />}
          title="Penawaran Harga"
          subtitle="Buat penawaran resmi (Quotation) untuk calon pelanggan sebelum menjadi Penjualan."
          tag="Sales Pre-Order"
          actions={
            <SafeButton variant="primary" icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
              Buat Penawaran Baru
            </SafeButton>
          }
        />

        {success && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            {success}
          </div>
        )}

        {error && !showModal && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Quotation Aktif" value={`${quotations.length} Dokumen`} icon={FileText} color="blue" />
          <StatCard
            label="Estimasi Revenue"
            value={formatRupiah(quotations.reduce((acc, quotation) => acc + getQuotationTotals(quotation).grandTotal, 0))}
            icon={Send}
            color="emerald"
          />
          <StatCard label="Pipeline Rate" value="100%" icon={ArrowRight} color="amber" sub="Sent to Client" />
        </div>

        <SectionCard>
          <SectionHeader title="Daftar Quotation" subtitle="Semua dokumen penawaran yang pernah dikirimkan."
            actions={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Cari no. ref atau customer..."
                  className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-100 transition-all outline-none w-56" />
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    <button type="button" onClick={() => setSortOrderQ(o => o === 'desc' ? 'asc' : 'desc')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-700 transition-colors cursor-pointer">
                      No. Ref & Tanggal
                      {sortOrderQ === 'desc' ? <ArrowDown size={12} className="text-blue-500" /> : <ArrowUp size={12} className="text-blue-500" />}
                    </button>
                  </th>
                  <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</th>
                  <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Total Penawaran</th>
                  <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedQuotations.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-slate-400 font-bold text-xs uppercase italic">Tidak ada quotation yang cocok.</td></tr>
                ) : null}
                {sortedQuotations.map((quotation) => {
                  const customer = pickRelation(quotation.contacts)
                  const totals = getQuotationTotals(quotation)

                  return (
                    <tr key={quotation.id} className="hover:bg-slate-50">
                      <td className="px-8 py-6">
                        <div className="text-xs font-semibold text-blue-600">{quotation.sale_number || `SQ-${quotation.id.slice(0, 8)}`}</div>
                        {(quotation as any).sale_date && <div className="text-[10px] text-slate-400 mt-0.5">{new Date((quotation as any).sale_date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</div>}
                      </td>
                      <td className="px-8 py-6 font-bold">{customer?.name || '-'}</td>
                      <td className="px-8 py-6 text-right font-semibold">{formatRupiah(totals.grandTotal)}</td>
                      <td className="px-8 py-6 text-center">
                        <StatusBadge label="Pending Quotation" variant="warning" />
                      </td>
                      <td className="px-8 py-6 text-right space-x-2">
                        <button type="button"
                          onClick={() => handleConvert(quotation.id)}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-semibold uppercase tracking-wide hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          Terima & Jadi Order
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreviewPrint(quotation)}
                          className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                          title="Preview & Cetak Quotation"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-xl p-8 max-h-[90vh] overflow-y-auto shadow-md"
            >
              <h3 className="text-xl font-bold mb-6">Buat Penawaran Harga Baru</h3>

              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-xl">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</label>
                      <button
                        type="button"
                        onClick={openCustomerModal}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        + CUSTOMER BARU
                      </button>
                    </div>
                    <select
                      required
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full h-12 px-4 border rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                    >
                      <option value="">Pilih Customer...</option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal Penawaran</label>
                    <input
                      type="date"
                      value={quoteDate}
                      onChange={(e) => setQuoteDate(e.target.value)}
                      className="w-full h-12 px-4 border rounded-xl text-sm font-bold outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Item Penawaran</label>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      + TAMBAH BARIS
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-2 px-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    <div className="col-span-4">Nama Produk / Jasa</div>
                    <div className="col-span-2">Kuantitas</div>
                    <div className="col-span-3">Harga Satuan</div>
                    <div className="col-span-2 text-rose-400">Potongan Harga</div>
                    <div className="col-span-1 text-center">Hapus</div>
                  </div>

                  {lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          list="prod_list"
                          placeholder="Pilih produk..."
                          value={line.product_name}
                          onChange={(e) => handleLineChange(line.id, 'product_name', e.target.value)}
                          className="w-full h-12 px-4 border rounded-xl text-xs outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={getSafeLineNumber(line.quantity)}
                          onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)}
                          className="w-full h-12 px-4 border rounded-xl text-xs outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="col-span-3">
                        <CurrencyInput
                          label=""
                          value={getSafeLineNumber(line.unit_price)}
                          onChange={(value) => handleLineChange(line.id, 'unit_price', value)}
                          className="!h-12"
                        />
                      </div>
                      <div className="col-span-2">
                        <CurrencyInput
                          label=""
                          value={getSafeLineNumber(line.discount_amount)}
                          onChange={(value) => handleLineChange(line.id, 'discount_amount', value)}
                          className="!h-12 !text-rose-500"
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          className="text-rose-500 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <datalist id="prod_list">
                    {products.map((product) => (
                      <option key={product.id} value={product.name} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          Diskon Tambahan
                        </label>
                        <div className="inline-flex rounded-xl border border-amber-200 bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setManualDiscountMode('FIXED')}
                            className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all ${
                              manualDiscountMode === 'FIXED'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-amber-700 hover:text-amber-900'
                            }`}
                          >
                            Flat (Rp)
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualDiscountMode('PERCENT')}
                            className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all ${
                              manualDiscountMode === 'PERCENT'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-amber-700 hover:text-amber-900'
                            }`}
                          >
                            Prosentase (%)
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        {manualDiscountMode === 'FIXED' ? (
                          <CurrencyInput
                            label=""
                            value={manualDiscountValue}
                            onChange={setManualDiscountValue}
                            className="!h-11 bg-white"
                            placeholder="Masukkan diskon flat"
                          />
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={manualDiscountValue || ''}
                            onChange={(e) => setManualDiscountValue(sanitizeDraftNumber(e.target.value))}
                            placeholder="Masukkan diskon %"
                            className="w-full h-11 rounded-xl border border-amber-200 bg-white px-4 text-sm font-bold outline-none focus:border-amber-500"
                          />
                        )}
                      </div>

                      <p className="mt-2 text-xs font-bold text-amber-700">
                        Potongan tambahan: {manualDiscount > 0 ? formatRupiah(manualDiscount) : 'Belum ada'}
                      </p>
                    </div>

                    {!appliedPromo ? (
                      <div className="flex gap-2 w-full">
                        <input
                          placeholder="Kode Kupon/Voucher..."
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          style={{ textTransform: 'uppercase' }}
                          className="flex-1 h-11 px-4 border rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-4 h-11 bg-slate-900 text-white font-semibold text-[10px] tracking-wide uppercase rounded-xl hover:bg-slate-800 transition-colors"
                        >
                          Terapkan
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-emerald-700 text-[10px] md:text-xs">
                        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                          🎟️ Kupon: <strong>{appliedPromo.code}</strong> (-{formatRupiah(promoDiscount)})
                        </span>
                        <button
                          type="button"
                          onClick={() => setAppliedPromo(null)}
                          className="text-emerald-900 font-bold hover:text-rose-500 uppercase tracking-wide text-[9px] px-2 py-1 bg-white rounded-lg shadow-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-6 shadow-inner">
                    <div className="flex items-center justify-between text-sm font-bold text-blue-900">
                      <span>Subtotal Barang</span>
                      <span>{formatRupiah(subtotal)}</span>
                    </div>
                    {totalLineDiscount > 0 && (
                      <div className="flex items-center justify-between text-sm font-bold text-rose-500">
                        <span>Diskon per Item</span>
                        <span>-{formatRupiah(totalLineDiscount)}</span>
                      </div>
                    )}
                    {manualDiscount > 0 && (
                      <div className="flex items-center justify-between text-sm font-bold text-amber-600">
                        <span>Diskon Tambahan</span>
                        <span>-{formatRupiah(manualDiscount)}</span>
                      </div>
                    )}
                    {promoDiscount > 0 && (
                      <div className="flex items-center justify-between text-sm font-bold text-emerald-600">
                        <span>Diskon Voucher</span>
                        <span>-{formatRupiah(promoDiscount)}</span>
                      </div>
                    )}
                    {isHeaderDiscountClamped && (
                      <p className="text-[11px] font-bold text-blue-700">
                        Diskon otomatis dibatasi supaya total penawaran tidak minus.
                      </p>
                    )}
                    <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                      <div className="text-[10px] md:text-xs font-semibold text-blue-900 uppercase tracking-wide">
                        Total Penawaran Estimasi
                      </div>
                      <div className="text-xl md:text-3xl font-semibold text-blue-600 drop-shadow-sm">{formatRupiah(grandTotal)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Catatan Penawaran</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Tulis catatan tambahan, syarat pembayaran, atau masa berlaku penawaran..."
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">
                    Batalkan
                  </button>
                  <SafeButton variant="primary" isLoading={loading} type="submit" className="!px-10">
                    Simpan & Kirim Penawaran
                  </SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewQuotation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:static print:block print:p-0">
            <style>{`
              @media print {
                @page { size: A4; margin: 12mm; }
                body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body * { visibility: hidden !important; }
                #quotation-print-area, #quotation-print-area * { visibility: visible !important; }
                #quotation-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  max-width: none;
                  margin: 0;
                  padding: 0;
                  border: none;
                  box-shadow: none;
                  overflow: visible;
                  background: #fff;
                }
                .quotation-no-print { display: none !important; }
              }
            `}</style>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewQuotation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden quotation-no-print"
            />
            <motion.div
              id="quotation-print-area"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-xl shadow-md overflow-hidden max-h-[90vh] flex flex-col print:shadow-none print:max-h-none print:h-auto print:max-w-none print:w-full print:mx-auto print:rounded-none print:text-[11px] print:leading-relaxed"
            >
              {(() => {
                const customer = pickRelation(viewQuotation.contacts)
                const branch = pickRelation(viewQuotation.branches)
                const totals = getQuotationTotals(viewQuotation)
                const quotationNumber = viewQuotation.sale_number || `SQ-${viewQuotation.id.slice(0, 8)}`
                const branchLabel = branch?.name || activeBranchName || ''

                return (
                  <>
                    <div className="hidden print:flex justify-between items-start pb-6 border-b-2 border-slate-900 mb-6 w-full">
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-4">
                          <img src={companyProfile.logo} alt="Logo Perusahaan" className="w-14 h-14 object-contain" />
                          <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-tighter">{companyProfile.name}</h2>
                        </div>
                        <p className="text-xs font-medium text-slate-700 max-w-[420px] mt-1">{companyProfile.address}</p>
                        <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-slate-500">
                          {companyProfile.hotline && <span>Telp/WA: {companyProfile.hotline}</span>}
                          {companyProfile.email && <span>Email: {companyProfile.email}</span>}
                          {companyProfile.website && <span>Web: {companyProfile.website}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center print:bg-transparent print:border-none print:px-0 print:pt-0 print:mb-0">
                      <div className="print:text-center print:w-full">
                        <h3 className="text-xl font-bold text-slate-900 print:text-2xl print:tracking-wide">
                          QUOTATION / SURAT PENAWARAN
                        </h3>
                        <p className="text-sm font-semibold text-blue-600 print:text-slate-900 print:mt-1">{quotationNumber}</p>
                      </div>
                      <button type="button"
                        onClick={() => setViewQuotation(null)}
                        className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full hover:bg-slate-200 transition-colors print:hidden quotation-no-print"
                      >
                        <XCircle size={24} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto w-full print:overflow-visible print:px-0 print:py-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
                        <div>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1 print:text-slate-600">
                            Customer / Klien
                          </p>
                          <p className="font-bold text-slate-900">{customer?.name || 'Unknown'}</p>
                          {branchLabel && (
                            <p className="mt-2 text-xs text-slate-500">
                              Unit / Cabang: <span className="font-bold text-slate-700">{branchLabel}</span>
                            </p>
                          )}
                        </div>
                        <div className="md:text-right">
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1 print:text-slate-600">
                            Tanggal Dokumen
                          </p>
                          <p className="font-bold text-slate-900">{viewQuotation.sale_date || '-'}</p>
                          <div className="mt-2 flex flex-wrap gap-2 md:justify-end">
                            {viewQuotation.due_date && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200 bg-amber-50 text-amber-700">
                                Berlaku s/d {viewQuotation.due_date}
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200 bg-blue-50 text-blue-600">
                              {viewQuotation.status || 'QUOTATION'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <table className="w-full mb-6 relative border-collapse print:border print:border-slate-200">
                        <thead className="border-y border-slate-100 bg-slate-50/50 print:bg-slate-100 print:text-slate-900">
                          <tr>
                            <th className="py-3 px-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide print:text-slate-900 print:border print:border-slate-200">
                              Deskripsi Barang/Jasa
                            </th>
                            <th className="py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide print:text-slate-900 print:border print:border-slate-200 w-20">
                              Qty
                            </th>
                            <th className="py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide print:text-slate-900 print:border print:border-slate-200">
                              Harga
                            </th>
                            <th className="py-3 px-2 text-right text-[10px] font-bold text-rose-400 uppercase tracking-wide print:text-slate-900 print:border print:border-slate-200">
                              Diskon
                            </th>
                            <th className="py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide print:text-slate-900 print:border print:border-slate-200">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {(viewQuotation.sales_items || []).map((item) => {
                            const product = pickRelation(item.products)
                            const quantity = Number(item.quantity || 0)
                            const unitPrice = Number(item.unit_price || 0)
                            const lineDiscount = quantity * Number(item.discount_amount || 0)
                            const lineTotal = (quantity * unitPrice) - lineDiscount

                            return (
                              <tr key={item.id}>
                                <td className="py-3 px-2 font-medium text-slate-900 print:border print:border-slate-200">
                                  {item.description || '-'}
                                </td>
                                <td className="py-3 px-2 text-right text-slate-600 font-bold print:border print:border-slate-200">
                                  {quantity} {product?.unit || ''}
                                </td>
                                <td className="py-3 px-2 text-right text-slate-600 print:border print:border-slate-200">
                                  {formatRupiah(unitPrice)}
                                </td>
                                <td className="py-3 px-2 text-right text-rose-500 print:border print:border-slate-200">
                                  {lineDiscount > 0 ? formatRupiah(lineDiscount) : '-'}
                                </td>
                                <td className="py-3 px-2 text-right font-bold text-slate-900 print:border print:border-slate-200">
                                  {formatRupiah(lineTotal)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      <div className="w-full bg-slate-50 rounded-xl p-4 flex flex-col gap-2 shadow-inner print:shadow-none print:border print:border-slate-200">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Subtotal Barang:</span>
                          <span>{formatRupiah(totals.subtotal)}</span>
                        </div>
                        {totals.lineDiscount > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-rose-500">
                            <span>Diskon per Item:</span>
                            <span>-{formatRupiah(totals.lineDiscount)}</span>
                          </div>
                        )}
                        {totals.headerDiscount > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-emerald-600">
                            <span>Diskon Promo / Voucher:</span>
                            <span>-{formatRupiah(totals.headerDiscount)}</span>
                          </div>
                        )}
                        {totals.taxAmount > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-slate-500">
                            <span>PPN / Pajak:</span>
                            <span>+{formatRupiah(totals.taxAmount)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-sm">TOTAL PENAWARAN:</span>
                          <span className="font-semibold text-blue-600 text-lg">{formatRupiah(totals.grandTotal)}</span>
                        </div>
                      </div>

                      {viewQuotation.notes && (
                        <div className="mt-6 border border-slate-200 bg-white rounded-xl p-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Catatan Penawaran</h4>
                          <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{viewQuotation.notes}</p>
                        </div>
                      )}

                      <div className="hidden print:block mt-10 w-full">
                        <div className="flex justify-between items-end px-4">
                          <div className="text-center">
                            <p className="text-xs font-bold mb-14 text-slate-600">Hormat kami,</p>
                            <p className="text-sm font-bold border-b-2 border-slate-900 px-6 mb-1">({companyProfile.name})</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold mb-14 text-slate-600">Menyetujui,</p>
                            <p className="text-sm border-b border-slate-400 px-6 w-36 mb-1"></p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2 print:hidden quotation-no-print">
                      <button type="button"
                        onClick={() => setTimeout(() => window.print(), 100)}
                        className="px-4 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-200"
                      >
                        Cetak Quotation
                      </button>
                      <button type="button"
                        onClick={() => setViewQuotation(null)}
                        className="px-6 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md transition-all border border-slate-700 ml-2"
                      >
                        Tutup
                      </button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !savingCustomer && closeCustomerModal()}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-xl bg-white p-8 shadow-md"
            >
              <h3 className="text-xl font-bold mb-6">Tambah Customer Baru</h3>

              {customerError && (
                <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                  {customerError}
                </div>
              )}

              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <input
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Nama customer / perusahaan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm((current) => ({ ...current, email: e.target.value }))}
                    placeholder="Email"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm((current) => ({ ...current, phone: e.target.value }))}
                    placeholder="No. telepon"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    value={customerForm.phone_wa}
                    onChange={(e) => setCustomerForm((current) => ({ ...current, phone_wa: e.target.value }))}
                    placeholder="WhatsApp"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={customerForm.instagram}
                    onChange={(e) => setCustomerForm((current) => ({ ...current, instagram: e.target.value }))}
                    placeholder="Instagram"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <textarea
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm((current) => ({ ...current, address: e.target.value }))}
                  rows={4}
                  placeholder="Alamat"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCustomerModal}
                    disabled={savingCustomer}
                    className="px-6 py-3 font-bold text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <SafeButton variant="primary" isLoading={savingCustomer} type="submit" className="!px-8">
                    Simpan Customer
                  </SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {ConfirmUI}
    </div>
  )
}
