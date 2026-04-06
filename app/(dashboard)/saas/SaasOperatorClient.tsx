'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeDollarSign, CheckCircle2, ClipboardList, Download, Receipt, RefreshCcw } from 'lucide-react'
import {
  convertQuotationToSale,
  createOperatorQuotation,
  deleteOperatorQuotation,
  markOperatorSalePaid,
  updateOperatorQuotation,
  updateOperatorSaleInvoice,
} from '@/modules/saas/actions/operator-sales.actions'
import {
  EXTRA_BRANCH_UNIT_PRICE,
  EXTRA_ENTITY_UNIT_PRICE,
  OPERATOR_ADDON_OPTIONS,
} from '@/lib/saas/operator-pricing'

type Snapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string; modules: string[]; addons: string[] }>
  aiTokenPackages: Array<{ id: string; name: string; description: string | null; tokens: number; price: number }>
  quotations: InvoiceRecord[]
  sales: InvoiceRecord[]
  summary: {
    totalQuotes: number
    totalOpenSales: number
    totalPaidSales: number
    totalSalesValue: number
  }
}

type InvoiceRecord = {
  id: string
  org_id: string
  package_id: string | null
  invoice_number: string
  item_name: string | null
  item_description: string | null
  discount_percent?: number | null
  discount_amount?: number | null
  tax_percent?: number | null
  tax_amount?: number | null
  amount: number
  status: string
  due_date?: string | null
  created_at: string
  organization?: { name: string } | null
}

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function formatDate(dateLike: string) {
  if (!dateLike) return '-'
  return new Date(dateLike).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  })
}

function parseCurrencyValue(raw: string) {
  const normalized = raw.replace(/[^\d-]/g, '')
  if (!normalized) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function parsePercentValue(raw: string) {
  const normalized = raw.replace(/[^\d.,-]/g, '').replace(',', '.')
  if (!normalized) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function createDefaultAddonPromoMap() {
  return Object.fromEntries(OPERATOR_ADDON_OPTIONS.map((addon) => [addon.id, String(addon.price)]))
}

function createDefaultAddonAnchorMap() {
  return Object.fromEntries(OPERATOR_ADDON_OPTIONS.map((addon) => [addon.id, String(addon.anchorPrice || addon.price)]))
}

type ParsedQuoteAddon = {
  name: string
  promoPrice: number
  anchorPrice: number | null
}

type ParsedQuoteDraft = {
  baseAmount: number | null
  durationMonths: number
  discountPercent: number
  taxPercent: number
  note: string
  modules: string[]
  aiTokenLabel: string
  extraEntityQty: number
  extraEntityUnitPrice: number
  extraBranchQty: number
  extraBranchUnitPrice: number
  addons: ParsedQuoteAddon[]
}

function parseQuoteDraft(rawDescription: string | null | undefined): ParsedQuoteDraft {
  const parsed: ParsedQuoteDraft = {
    baseAmount: null,
    durationMonths: 1,
    discountPercent: 0,
    taxPercent: 0,
    note: '',
    modules: [],
    aiTokenLabel: '',
    extraEntityQty: 0,
    extraEntityUnitPrice: EXTRA_ENTITY_UNIT_PRICE,
    extraBranchQty: 0,
    extraBranchUnitPrice: EXTRA_BRANCH_UNIT_PRICE,
    addons: [],
  }

  const normalizedDescription = String(rawDescription || '').replace(/\\n/g, '\n')
  const lines = normalizedDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  lines.forEach((line) => {
    if (line.startsWith('Paket dasar:')) {
      parsed.baseAmount = parseCurrencyValue(line.slice('Paket dasar:'.length))
      return
    }

    const durationMatch = line.match(/^Durasi:\s+(\d+)\s+bulan$/i)
    if (durationMatch) {
      parsed.durationMonths = Math.max(1, Number(durationMatch[1] || 1))
      return
    }

    const addonWithAnchor = line.match(/^Add-on(?:\s+Single\s+Bill)?\s+(.+):\s+(.+)\s+->\s+(.+)$/i)
    if (addonWithAnchor) {
      parsed.addons.push({
        name: addonWithAnchor[1].trim(),
        anchorPrice: parseCurrencyValue(addonWithAnchor[2]),
        promoPrice: parseCurrencyValue(addonWithAnchor[3]),
      })
      return
    }

    const addonSimple = line.match(/^Add-on(?:\s+Single\s+Bill)?\s+(.+):\s+(.+)$/i)
    if (addonSimple) {
      parsed.addons.push({
        name: addonSimple[1].trim(),
        anchorPrice: null,
        promoPrice: parseCurrencyValue(addonSimple[2]),
      })
      return
    }

    if (line.startsWith('Token AI:')) {
      const tokenText = line.slice('Token AI:'.length).trim()
      parsed.aiTokenLabel = tokenText.replace(/\s*\([^()]*\)\s*$/, '').trim()
      return
    }

    const extraEntityMatch = line.match(/^Entitas tambahan:\s+(\d+)\s+x\s+(.+?)\s+=\s+(.+)$/i)
    if (extraEntityMatch) {
      parsed.extraEntityQty = Number(extraEntityMatch[1] || 0)
      parsed.extraEntityUnitPrice = parseCurrencyValue(extraEntityMatch[2]) || EXTRA_ENTITY_UNIT_PRICE
      return
    }

    const extraBranchMatch = line.match(/^Cabang tambahan:\s+(\d+)\s+x\s+(.+?)\s+=\s+(.+)$/i)
    if (extraBranchMatch) {
      parsed.extraBranchQty = Number(extraBranchMatch[1] || 0)
      parsed.extraBranchUnitPrice = parseCurrencyValue(extraBranchMatch[2]) || EXTRA_BRANCH_UNIT_PRICE
      return
    }

    const discountMatch = line.match(/^Diskon(?: setelah durasi)?:\s+([\d.,]+)%/i)
    if (discountMatch) {
      parsed.discountPercent = parsePercentValue(discountMatch[1])
      return
    }

    const taxMatch = line.match(/^Pajak:\s+([\d.,]+)%/i)
    if (taxMatch) {
      parsed.taxPercent = parsePercentValue(taxMatch[1])
      return
    }

    if (line.startsWith('Modul dipilih:')) {
      parsed.modules = line
        .slice('Modul dipilih:'.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      return
    }

  })

  parsed.note = extractQuoteNote(normalizedDescription)
  return parsed
}

function extractQuoteNote(rawDescription: string | null | undefined) {
  const normalizedDescription = String(rawDescription || '').replace(/\\n/g, '\n')
  const blockMatch = normalizedDescription.match(/(?:^|\n)(Catatan(?:\s+tambahan|\s+penawaran|\s+invoice)?|Note)\s*[:\-]?\s*([\s\S]*)$/i)
  if (blockMatch?.[2]) return blockMatch[2].trim()
  return ''
}

export default function SaasOperatorClient({
  mode,
  snapshot,
}: {
  mode: 'quotes' | 'sales'
  snapshot: Snapshot
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isHydrated, setIsHydrated] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [editingSaleInvoiceId, setEditingSaleInvoiceId] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [selectedAiTokenPackageId, setSelectedAiTokenPackageId] = useState('')
  const [extraEntityQty, setExtraEntityQty] = useState(0)
  const [extraBranchQty, setExtraBranchQty] = useState(0)
  const [extraEntityUnitPrice, setExtraEntityUnitPrice] = useState(String(EXTRA_ENTITY_UNIT_PRICE))
  const [extraBranchUnitPrice, setExtraBranchUnitPrice] = useState(String(EXTRA_BRANCH_UNIT_PRICE))
  const [addonPromoPrices, setAddonPromoPrices] = useState<Record<string, string>>(createDefaultAddonPromoMap)
  const [addonAnchorPrices, setAddonAnchorPrices] = useState<Record<string, string>>(createDefaultAddonAnchorMap)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('1')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [taxPercent, setTaxPercent] = useState('0')
  const [note, setNote] = useState('')

  const isQuotesMode = mode === 'quotes'

  const stats = useMemo(() => snapshot.summary, [snapshot.summary])
  const selectedPackage = useMemo(
    () => snapshot.packages.find((pkg) => pkg.id === selectedPackageId) || null,
    [snapshot.packages, selectedPackageId]
  )
  const selectedAiTokenPackage = useMemo(
    () => snapshot.aiTokenPackages.find((pkg) => pkg.id === selectedAiTokenPackageId) || null,
    [snapshot.aiTokenPackages, selectedAiTokenPackageId]
  )
  const addonOptionByName = useMemo(() => (
    new Map(OPERATOR_ADDON_OPTIONS.map((addon) => [addon.name.trim().toLowerCase(), addon]))
  ), [])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const parseSafeNumber = (raw: string | number, fallback = 0) => {
    const num = Number(raw)
    return Number.isFinite(num) ? num : fallback
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) => (
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    ))
  }

  const toggleModule = (moduleName: string) => {
    setSelectedModules((prev) => (
      prev.includes(moduleName)
        ? prev.filter((name) => name !== moduleName)
        : [...prev, moduleName]
    ))
  }

  const selectedAddonMonthlyTotal = useMemo(
    () => selectedAddonIds.reduce((acc, addonId) => {
      const addonPrice = Math.max(0, parseSafeNumber(addonPromoPrices[addonId], 0))
      const addonBilling = String(OPERATOR_ADDON_OPTIONS.find((addon) => addon.id === addonId)?.billing || '').toLowerCase()
      return addonBilling.includes('single') ? acc : acc + addonPrice
    }, 0),
    [selectedAddonIds, addonPromoPrices]
  )
  const selectedAddonSingleBillTotal = useMemo(
    () => selectedAddonIds.reduce((acc, addonId) => {
      const addonPrice = Math.max(0, parseSafeNumber(addonPromoPrices[addonId], 0))
      const addonBilling = String(OPERATOR_ADDON_OPTIONS.find((addon) => addon.id === addonId)?.billing || '').toLowerCase()
      return addonBilling.includes('single') ? acc + addonPrice : acc
    }, 0),
    [selectedAddonIds, addonPromoPrices]
  )
  const selectedAiTokenTotal = Number(selectedAiTokenPackage?.price || 0)
  const baseAmount = Number(overrideAmount || selectedPackage?.price || 0)
  const safeDurationMonths = Math.max(1, Math.floor(parseSafeNumber(durationMonths, 1)))
  const safeDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent || 0)))
  const safeTaxPercent = Math.min(100, Math.max(0, Number(taxPercent || 0)))
  const extraEntityUnitPriceValue = Math.max(0, parseSafeNumber(extraEntityUnitPrice, EXTRA_ENTITY_UNIT_PRICE))
  const extraBranchUnitPriceValue = Math.max(0, parseSafeNumber(extraBranchUnitPrice, EXTRA_BRANCH_UNIT_PRICE))
  const extraEntityTotal = extraEntityQty * extraEntityUnitPriceValue
  const extraBranchTotal = extraBranchQty * extraBranchUnitPriceValue
  const estimateMonthlySubtotal = baseAmount + selectedAddonMonthlyTotal + extraEntityTotal + extraBranchTotal
  const estimateOneTimeSubtotal = selectedAddonSingleBillTotal + selectedAiTokenTotal
  const estimateSubtotal = (estimateMonthlySubtotal * safeDurationMonths) + estimateOneTimeSubtotal
  const estimateDiscountAmount = (estimateSubtotal * safeDiscountPercent) / 100
  const estimateTaxAmount = ((estimateSubtotal - estimateDiscountAmount) * safeTaxPercent) / 100
  const estimateGrandTotal = Math.max(0, estimateSubtotal - estimateDiscountAmount + estimateTaxAmount)

  const resetQuoteForm = () => {
    setEditingQuoteId(null)
    setEditingSaleInvoiceId(null)
    setSelectedOrgId('')
    setSelectedPackageId('')
    setSelectedAddonIds([])
    setSelectedModules([])
    setSelectedAiTokenPackageId('')
    setExtraEntityQty(0)
    setExtraBranchQty(0)
    setExtraEntityUnitPrice(String(EXTRA_ENTITY_UNIT_PRICE))
    setExtraBranchUnitPrice(String(EXTRA_BRANCH_UNIT_PRICE))
    setAddonPromoPrices(createDefaultAddonPromoMap())
    setAddonAnchorPrices(createDefaultAddonAnchorMap())
    setOverrideAmount('')
    setDurationMonths('1')
    setDiscountPercent('0')
    setTaxPercent('0')
    setNote('')
  }

  const handleSaveQuote = (formData: FormData) => {
    startTransition(async () => {
      const res = editingQuoteId
        ? (() => {
            formData.set('quote_id', editingQuoteId)
            return updateOperatorQuotation(formData)
          })()
        : editingSaleInvoiceId
          ? (() => {
              formData.set('invoice_id', editingSaleInvoiceId)
              return updateOperatorSaleInvoice(formData)
            })()
          : createOperatorQuotation(formData)
      const resolved = await res

      if ('error' in resolved && resolved.error) {
        setMsg({ type: 'err', text: resolved.error })
        return
      }

      const invoiceNumber = 'invoiceNumber' in resolved ? resolved.invoiceNumber : '-'
      if (editingQuoteId) {
        setMsg({ type: 'ok', text: `Penawaran berhasil diperbarui (${invoiceNumber}).` })
        resetQuoteForm()
      } else if (editingSaleInvoiceId) {
        setMsg({ type: 'ok', text: `Invoice berhasil diperbarui (${invoiceNumber}).` })
        resetQuoteForm()
      } else {
        setMsg({ type: 'ok', text: `Penawaran berhasil dibuat (${invoiceNumber}).` })
      }

      router.refresh()
    })
  }

  const handleStartEditQuote = (quote: InvoiceRecord) => {
    const parsed = parseQuoteDraft(quote.item_description)
    const packageId = quote.package_id || ''
    const defaultModules = snapshot.packages.find((pkg) => pkg.id === packageId)?.modules || []

    const promoMap = createDefaultAddonPromoMap()
    const anchorMap = createDefaultAddonAnchorMap()
    const selectedAddons: string[] = []

    parsed.addons.forEach((addon) => {
      const mappedAddon = addonOptionByName.get(addon.name.toLowerCase())
      if (!mappedAddon) return
      selectedAddons.push(mappedAddon.id)
      promoMap[mappedAddon.id] = String(addon.promoPrice || mappedAddon.price)
      anchorMap[mappedAddon.id] = String(addon.anchorPrice || mappedAddon.anchorPrice || mappedAddon.price)
    })

    const aiTokenPackage = parsed.aiTokenLabel
      ? snapshot.aiTokenPackages.find((pkg) => parsed.aiTokenLabel.toLowerCase().includes(pkg.name.toLowerCase()))
      : null

    setEditingQuoteId(quote.id)
    setEditingSaleInvoiceId(null)
    setSelectedOrgId(quote.org_id)
    setSelectedPackageId(packageId)
    setSelectedModules(parsed.modules.length > 0 ? parsed.modules : defaultModules)
    setSelectedAddonIds(selectedAddons)
    setAddonPromoPrices(promoMap)
    setAddonAnchorPrices(anchorMap)
    setSelectedAiTokenPackageId(aiTokenPackage?.id || '')
    setOverrideAmount(parsed.baseAmount && parsed.baseAmount > 0 ? String(parsed.baseAmount) : '')
    setDurationMonths(String(Math.max(1, parsed.durationMonths || 1)))
    setDiscountPercent(String(parsed.discountPercent || Number(quote.discount_percent || 0)))
    setTaxPercent(String(parsed.taxPercent || Number(quote.tax_percent || 0)))
    setExtraEntityQty(parsed.extraEntityQty)
    setExtraBranchQty(parsed.extraBranchQty)
    setExtraEntityUnitPrice(String(parsed.extraEntityUnitPrice || EXTRA_ENTITY_UNIT_PRICE))
    setExtraBranchUnitPrice(String(parsed.extraBranchUnitPrice || EXTRA_BRANCH_UNIT_PRICE))
    setNote(parsed.note || '')
    setMsg({ type: 'ok', text: `Mode edit aktif untuk ${quote.invoice_number}.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleStartEditSale = (invoice: InvoiceRecord) => {
    const parsed = parseQuoteDraft(invoice.item_description)
    const packageId = invoice.package_id || ''
    const defaultModules = snapshot.packages.find((pkg) => pkg.id === packageId)?.modules || []

    const promoMap = createDefaultAddonPromoMap()
    const anchorMap = createDefaultAddonAnchorMap()
    const selectedAddons: string[] = []

    parsed.addons.forEach((addon) => {
      const mappedAddon = addonOptionByName.get(addon.name.toLowerCase())
      if (!mappedAddon) return
      selectedAddons.push(mappedAddon.id)
      promoMap[mappedAddon.id] = String(addon.promoPrice || mappedAddon.price)
      anchorMap[mappedAddon.id] = String(addon.anchorPrice || mappedAddon.anchorPrice || mappedAddon.price)
    })

    const aiTokenPackage = parsed.aiTokenLabel
      ? snapshot.aiTokenPackages.find((pkg) => parsed.aiTokenLabel.toLowerCase().includes(pkg.name.toLowerCase()))
      : null

    setEditingQuoteId(null)
    setEditingSaleInvoiceId(invoice.id)
    setSelectedOrgId(invoice.org_id)
    setSelectedPackageId(packageId)
    setSelectedModules(parsed.modules.length > 0 ? parsed.modules : defaultModules)
    setSelectedAddonIds(selectedAddons)
    setAddonPromoPrices(promoMap)
    setAddonAnchorPrices(anchorMap)
    setSelectedAiTokenPackageId(aiTokenPackage?.id || '')
    setOverrideAmount(parsed.baseAmount && parsed.baseAmount > 0 ? String(parsed.baseAmount) : '')
    setDurationMonths(String(Math.max(1, parsed.durationMonths || 1)))
    setDiscountPercent(String(parsed.discountPercent || Number(invoice.discount_percent || 0)))
    setTaxPercent(String(parsed.taxPercent || Number(invoice.tax_percent || 0)))
    setExtraEntityQty(parsed.extraEntityQty)
    setExtraBranchQty(parsed.extraBranchQty)
    setExtraEntityUnitPrice(String(parsed.extraEntityUnitPrice || EXTRA_ENTITY_UNIT_PRICE))
    setExtraBranchUnitPrice(String(parsed.extraBranchUnitPrice || EXTRA_BRANCH_UNIT_PRICE))
    setNote(parsed.note || '')
    setMsg({ type: 'ok', text: `Mode edit invoice aktif untuk ${invoice.invoice_number}.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteQuote = (invoiceId: string, invoiceNumber: string) => {
    const confirmed = window.confirm(`Hapus penawaran ${invoiceNumber}? Tindakan ini tidak bisa dibatalkan.`)
    if (!confirmed) return

    startTransition(async () => {
      const res = await deleteOperatorQuotation(invoiceId)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }

      if (editingQuoteId === invoiceId) {
        resetQuoteForm()
      }
      setMsg({ type: 'ok', text: `Penawaran ${invoiceNumber} berhasil dihapus.` })
      router.refresh()
    })
  }

  const handleConvert = (invoiceId: string) => {
    startTransition(async () => {
      const res = await convertQuotationToSale(invoiceId)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      setMsg({ type: 'ok', text: 'Penawaran berhasil dikonversi ke penjualan.' })
      router.refresh()
    })
  }

  const handleMarkPaid = (invoiceId: string) => {
    startTransition(async () => {
      const res = await markOperatorSalePaid(invoiceId, 'MANUAL_TRANSFER')
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      if (editingSaleInvoiceId === invoiceId) {
        resetQuoteForm()
      }
      setMsg({ type: 'ok', text: 'Penjualan ditandai PAID dan paket tenant diaktifkan.' })
      router.refresh()
    })
  }

  if (!isHydrated) {
    return (
      <div className="space-y-6 pb-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
          Memuat modul penawaran SaaS...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">SaaS Operator Desk</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Modul khusus pengelola SaaS untuk mengelola penawaran dan penjualan tanpa membuka halaman admin utama.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
          <Link
            href="/saas/penawaran"
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penawaran
          </Link>
          <Link
            href="/saas/penjualan"
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${!isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penjualan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><ClipboardList size={14} /> Total Penawaran</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{stats.totalQuotes}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><Receipt size={14} /> Open Sales</div>
          <div className="mt-2 text-2xl font-black text-amber-600">{stats.totalOpenSales}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><CheckCircle2 size={14} /> Paid Sales</div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{stats.totalPaidSales}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><BadgeDollarSign size={14} /> Nilai Penjualan</div>
          <div className="mt-2 text-lg font-black text-[#003366]">{formatIdr(stats.totalSalesValue)}</div>
        </div>
      </div>

      {msg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </div>
      )}

      {(isQuotesMode || Boolean(editingSaleInvoiceId)) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
            {editingQuoteId
              ? 'Edit Penawaran SaaS'
              : editingSaleInvoiceId
                ? 'Edit Invoice SaaS'
                : 'Buat Penawaran SaaS Baru'}
          </h2>
          <form action={handleSaveQuote} className="mt-4 space-y-4">
            {(snapshot.orgs.length === 0 || snapshot.packages.length === 0) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                Data tenant/paket belum terbaca. Pastikan daftar tenant & paket tersedia di halaman Admin dan akun ini punya akses ke data tersebut.
              </div>
            )}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">1. Target & Paket</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Pilih tenant, paket utama, dan nominal override jika ada penyesuaian khusus.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Tenant</span>
                  <select
                    name="org_id"
                    required
                    value={selectedOrgId}
                    onChange={(event) => setSelectedOrgId(event.target.value)}
                    disabled={Boolean(editingSaleInvoiceId)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="">Pilih Tenant</option>
                    {snapshot.orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Paket SaaS</span>
                  <select
                    name="package_id"
                    required
                    value={selectedPackageId}
                    onChange={(event) => {
                      const nextPackageId = event.target.value
                      setSelectedPackageId(nextPackageId)

                      const pkg = snapshot.packages.find((item) => item.id === nextPackageId)
                      setSelectedModules(pkg?.modules || [])
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="">Pilih Paket</option>
                    {snapshot.packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {formatIdr(pkg.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Nominal Override</span>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    value={overrideAmount}
                    onChange={(event) => setOverrideAmount(event.target.value)}
                    placeholder="Kosongkan jika ikut harga paket"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">2. Penyesuaian Harga</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Atur durasi, diskon setelah durasi, pajak, dan catatan {editingSaleInvoiceId ? 'invoice' : 'penawaran'} dalam satu blok.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Durasi (Bulan)</span>
                  <input
                    name="duration_months"
                    type="number"
                    min="1"
                    step="1"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(event.target.value)}
                    placeholder="1"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Diskon Setelah Durasi (%)</span>
                  <input
                    name="discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercent}
                    onChange={(event) => setDiscountPercent(event.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Pajak (%)</span>
                  <input
                    name="tax_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxPercent}
                    onChange={(event) => setTaxPercent(event.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
              </div>
              <label className="mt-3 block space-y-1.5">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {editingSaleInvoiceId ? 'Catatan Invoice' : 'Catatan Penawaran'}
                </span>
                <textarea
                  name="note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Catatan penawaran (opsional)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"
                />
              </label>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">3. Ekspansi Operasional</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Hitung kebutuhan entitas dan cabang tambahan dengan urutan quantity lalu harga satuan.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500">
                  Entitas: {extraEntityQty} x {formatIdr(extraEntityUnitPriceValue)}<br />
                  Cabang: {extraBranchQty} x {formatIdr(extraBranchUnitPriceValue)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Entitas Tambahan</span>
                  <input
                    type="number"
                    min="0"
                    value={extraEntityQty}
                    onChange={(event) => setExtraEntityQty(Math.max(0, Number(event.target.value || 0)))}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Harga Satuan Entitas</span>
                  <input
                    type="number"
                    min="0"
                    value={extraEntityUnitPrice}
                    onChange={(event) => setExtraEntityUnitPrice(event.target.value)}
                    placeholder="Harga satuan entitas"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Cabang Tambahan</span>
                  <input
                    type="number"
                    min="0"
                    value={extraBranchQty}
                    onChange={(event) => setExtraBranchQty(Math.max(0, Number(event.target.value || 0)))}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Harga Satuan Cabang</span>
                  <input
                    type="number"
                    min="0"
                    value={extraBranchUnitPrice}
                    onChange={(event) => setExtraBranchUnitPrice(event.target.value)}
                    placeholder="Harga satuan cabang"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">4. Aktivasi Fitur</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Review modul paket, add-on premium, dan topup token AI dalam satu area.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modul Paket</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedPackage?.modules || []).length > 0 ? (
                      (selectedPackage?.modules || []).map((moduleName) => (
                        <label key={moduleName} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(moduleName)}
                            onChange={() => toggleModule(moduleName)}
                            className="h-3 w-3 rounded border-slate-300 text-[#003366]"
                          />
                          {moduleName}
                        </label>
                      ))
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Pilih paket dulu.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Add-on Premium</p>
                  <div className="mt-2 space-y-1.5">
                    {OPERATOR_ADDON_OPTIONS.map((addon) => (
                      <div key={addon.id} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]">
                        <label className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedAddonIds.includes(addon.id)}
                              onChange={() => toggleAddon(addon.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#003366]"
                            />
                            {addon.name}
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                              {addon.billing}
                            </span>
                          </span>
                          <span className="font-black text-indigo-700">{formatIdr(parseSafeNumber(addonPromoPrices[addon.id], addon.price))}</span>
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            value={addonAnchorPrices[addon.id] || ''}
                            onChange={(event) => setAddonAnchorPrices((prev) => ({ ...prev, [addon.id]: event.target.value }))}
                            placeholder="Harga coret"
                            className="h-8 rounded-md border border-slate-200 px-2 text-[10px] font-bold"
                          />
                          <input
                            type="number"
                            min="0"
                            value={addonPromoPrices[addon.id] || ''}
                            onChange={(event) => setAddonPromoPrices((prev) => ({ ...prev, [addon.id]: event.target.value }))}
                            placeholder="Harga jual"
                            className="h-8 rounded-md border border-slate-200 px-2 text-[10px] font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Token AI (Opsional)</p>
                  <select
                    value={selectedAiTokenPackageId}
                    onChange={(event) => setSelectedAiTokenPackageId(event.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
                  >
                    <option value="">Tanpa topup token</option>
                    {snapshot.aiTokenPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.tokens.toLocaleString('id-ID')} token ({formatIdr(pkg.price)})
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500">
                    Cocok untuk kebutuhan generator AI seperti Sales Page dan drafting konten penawaran.
                  </div>
                </div>
              </div>
            </section>

            {selectedAddonIds.map((addonId) => (
              <input key={`addon-${addonId}`} type="hidden" name="selected_addons" value={addonId} />
            ))}
            {selectedModules.map((moduleName) => (
              <input key={`module-${moduleName}`} type="hidden" name="selected_modules" value={moduleName} />
            ))}
            <input type="hidden" name="ai_token_package_id" value={selectedAiTokenPackageId} />
            <input type="hidden" name="extra_entity_qty" value={extraEntityQty} />
            <input type="hidden" name="extra_branch_qty" value={extraBranchQty} />
            <input type="hidden" name="extra_entity_unit_price" value={extraEntityUnitPriceValue} />
            <input type="hidden" name="extra_branch_unit_price" value={extraBranchUnitPriceValue} />
            <input type="hidden" name="addon_price_overrides_json" value={JSON.stringify(addonPromoPrices)} />
            <input type="hidden" name="addon_anchor_overrides_json" value={JSON.stringify(addonAnchorPrices)} />
            {editingQuoteId && <input type="hidden" name="quote_id" value={editingQuoteId} />}
            {editingSaleInvoiceId && <input type="hidden" name="invoice_id" value={editingSaleInvoiceId} />}

            <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-xs font-bold text-slate-600">
                Estimasi Total: <span className="text-base font-black text-indigo-700">{formatIdr(estimateGrandTotal)}</span>
                <div className="text-[10px] text-slate-500">
                  Subtotal bulanan {formatIdr(estimateMonthlySubtotal)} x {safeDurationMonths} bulan + one-time {formatIdr(estimateOneTimeSubtotal)} = {formatIdr(estimateSubtotal)} • Diskon {formatIdr(estimateDiscountAmount)} • Pajak {formatIdr(estimateTaxAmount)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingQuoteId && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={resetQuoteForm}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-600 disabled:opacity-60"
                  >
                    Batal Edit
                  </button>
                )}
                {editingSaleInvoiceId && !editingQuoteId && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={resetQuoteForm}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-600 disabled:opacity-60"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending || !selectedOrgId || !selectedPackageId}
                  className="h-11 rounded-xl bg-[#003366] px-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
                >
                  {isPending
                    ? 'Menyimpan...'
                    : editingQuoteId || editingSaleInvoiceId
                      ? 'Simpan Perubahan'
                      : 'Buat Penawaran'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
            {isQuotesMode ? 'Daftar Penawaran SaaS' : 'Daftar Penjualan SaaS'}
          </h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500"
          >
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3">Nomor</th>
                <th className="px-3 py-3">Tenant</th>
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Nilai</th>
                <th className="px-3 py-3">Diskon</th>
                <th className="px-3 py-3">Pajak</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Dibuat</th>
                <th className="px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(isQuotesMode ? snapshot.quotations : snapshot.sales).map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-sm">
                  <td className="px-3 py-3 font-black text-slate-900">{item.invoice_number}</td>
                  <td className="px-3 py-3 font-semibold text-slate-700">{item.organization?.name || '-'}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-slate-800">{item.item_name || '-'}</div>
                    {item.item_description && <div className="mt-1 text-xs text-slate-500 whitespace-pre-line">{item.item_description}</div>}
                    {extractQuoteNote(item.item_description) && (
                      <div className="mt-1 whitespace-pre-line rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        Catatan: {extractQuoteNote(item.item_description)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-black text-[#003366]">{formatIdr(Number(item.amount || 0))}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                    {formatIdr(Number(item.discount_amount || 0))}
                    <div className="text-[10px] text-slate-400">{Number(item.discount_percent || 0)}%</div>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                    {formatIdr(Number(item.tax_amount || 0))}
                    <div className="text-[10px] text-slate-400">{Number(item.tax_percent || 0)}%</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-500">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3">
                    {isQuotesMode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStartEditQuote(item)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleConvert(item.id)}
                          className="rounded-lg bg-[#003366] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                        >
                          Konversi ke Penjualan
                        </button>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteQuote(item.id, item.invoice_number)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : item.status !== 'PAID' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStartEditSale(item)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 disabled:opacity-60"
                        >
                          Edit Invoice
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleMarkPaid(item.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                        >
                          Tandai Paid
                        </button>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600">Selesai</span>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(isQuotesMode ? snapshot.quotations.length === 0 : snapshot.sales.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm font-bold text-slate-400">
                    Belum ada data {isQuotesMode ? 'penawaran' : 'penjualan'} SaaS.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
