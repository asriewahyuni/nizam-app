'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BadgeDollarSign, CheckCircle2, ClipboardList, Download, Receipt, RefreshCcw, UserCheck, XCircle } from 'lucide-react'
import {
  convertQuotationToSale,
  createOperatorQuotation,
  deleteOperatorQuotation,
  markOperatorSalePaid,
  updateOperatorInvoiceReseller,
  updateOperatorQuotation,
  updateOperatorSaleInvoice,
  voidOperatorSale,
} from '@/modules/saas/actions/operator-sales.actions'
import {
  EXTRA_BRANCH_UNIT_PRICE,
  EXTRA_ENTITY_UNIT_PRICE,
  OPERATOR_ADDON_OPTIONS,
  getOperatorAddonById,
  getOperatorMarketplaceCompatibility,
  getOperatorMarketplaceKind,
  getOperatorMarketplaceLabel,
  getOperatorMarketplaceMinCoreFamily,
} from '@/lib/saas/operator-pricing'
import {
  getSaasCoreFamilyLabel,
  getSaasPackageArchitecture,
  normalizeSaasEntitlementList,
} from '@/lib/saas/module-catalog'
import { CORE_MODULES, MINIMUM_CORE_MODULES, OPERATIONAL_MODULES } from '@/modules/marketplace/lib/module-registry'
import { OPERATOR_GROWTH_ADDON_OPTIONS } from '@/lib/saas/operator-pricing'

type ResellerOption = {
  id: string
  name: string
  reseller_type: string
  company_name: string | null
  commission_type: string | null
  commission_value: number | null
  is_active: boolean
}

type Snapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string; modules: string[]; addons: string[]; corePrices: Record<string, number>; operationalPrices: Record<string, number> }>
  aiTokenPackages: Array<{ id: string; name: string; description: string | null; tokens: number; price: number }>
  resellers: ResellerOption[]
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
  reseller_id?: string | null
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
  reseller?: { id: string; name: string; commission_type: string | null; commission_value: number | null } | null
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
    if (line.startsWith('Harga Core Family:')) {
      parsed.baseAmount = parseCurrencyValue(line.slice('Harga Core Family:'.length))
      return
    }

    if (line.startsWith('Paket dasar:')) {
      parsed.baseAmount = parseCurrencyValue(line.slice('Paket dasar:'.length))
      return
    }

    const durationMatch = line.match(/^Durasi:\s+(\d+)\s+bulan$/i)
    if (durationMatch) {
      parsed.durationMonths = Math.max(1, Number(durationMatch[1] || 1))
      return
    }

    const addonWithAnchor = line.match(/^(?:Module|Add-on|Capacity Add-on)(?:\s+Single\s+Bill)?\s+(.+):\s+(.+)\s+->\s+(.+)$/i)
    if (addonWithAnchor) {
      parsed.addons.push({
        name: addonWithAnchor[1].trim(),
        anchorPrice: parseCurrencyValue(addonWithAnchor[2]),
        promoPrice: parseCurrencyValue(addonWithAnchor[3]),
      })
      return
    }

    const addonSimple = line.match(/^(?:Module|Add-on|Capacity Add-on)(?:\s+Single\s+Bill)?\s+(.+):\s+(.+)$/i)
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

    const extraBranchMatch = line.match(/^(?:Cabang|Unit) tambahan:\s+(\d+)\s+x\s+(.+?)\s+=\s+(.+)$/i)
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

    if (line.startsWith('Core Family Scope:')) {
      parsed.modules = line
        .slice('Core Family Scope:'.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
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

function subscribeToHydration() {
  return () => {}
}

function getClientHydrationState() {
  return true
}

function getServerHydrationState() {
  return false
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
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState
  )
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [editingSaleInvoiceId, setEditingSaleInvoiceId] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>(MINIMUM_CORE_MODULES)
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
  const [selectedResellerId, setSelectedResellerId] = useState('')
  const [editingResellerInvoiceId, setEditingResellerInvoiceId] = useState<string | null>(null)
  const [editingResellerValue, setEditingResellerValue] = useState('')

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
  const selectedPackageArchitecture = useMemo(
    () => selectedPackage ? getSaasPackageArchitecture(selectedPackage.modules || [], selectedPackage.addons || []) : null,
    [selectedPackage]
  )
  const quoteCoreCapabilities = useMemo(
    () => normalizeSaasEntitlementList(selectedModules.length > 0 ? selectedModules : (selectedPackage?.modules || [])),
    [selectedModules, selectedPackage?.modules]
  )
  const quoteArchitecture = useMemo(
    () => getSaasPackageArchitecture(quoteCoreCapabilities),
    [quoteCoreCapabilities]
  )
  const selectedAddonCapabilities = useMemo(
    () => normalizeSaasEntitlementList(
      selectedAddonIds
        .map((addonId) => getOperatorAddonById(addonId)?.name || '')
        .filter(Boolean)
    ),
    [selectedAddonIds]
  )
  const quoteEnabledCapabilities = useMemo(
    () => normalizeSaasEntitlementList([...quoteCoreCapabilities, ...selectedAddonCapabilities]),
    [quoteCoreCapabilities, selectedAddonCapabilities]
  )
  const addonCompatibilityById = useMemo(() => (
    Object.fromEntries(
      OPERATOR_ADDON_OPTIONS.map((addon) => [
        addon.id,
        getOperatorMarketplaceCompatibility(addon, {
          coreFamilyLevel: quoteArchitecture.coreFamilyLevel,
          enabledCapabilities: quoteEnabledCapabilities,
        }),
      ])
    ) as Record<string, ReturnType<typeof getOperatorMarketplaceCompatibility>>
  ), [quoteArchitecture.coreFamilyLevel, quoteEnabledCapabilities])
  const marketplaceSections = useMemo(() => ([
    {
      title: 'Module Marketplace',
      items: OPERATOR_ADDON_OPTIONS
        .filter((addon) => getOperatorMarketplaceKind(addon) === 'module')
        .map((addon) => ({ ...addon, compatibility: addonCompatibilityById[addon.id] })),
    },
    {
      title: 'Add-on Marketplace',
      items: OPERATOR_ADDON_OPTIONS
        .filter((addon) => getOperatorMarketplaceKind(addon) !== 'module')
        .map((addon) => ({ ...addon, compatibility: addonCompatibilityById[addon.id] })),
    },
  ]), [addonCompatibilityById])
  const addonOptionByName = useMemo(() => (
    new Map(OPERATOR_ADDON_OPTIONS.map((addon) => [addon.name.trim().toLowerCase(), addon]))
  ), [])
  const selectedPackageAddonNames = useMemo(
    () => new Set((selectedPackage?.addons || []).map((addonName) => addonName.trim().toLowerCase())),
    [selectedPackage?.addons]
  )
  const visiblePackageModules = useMemo(
    () => (selectedPackage?.modules || []).filter((moduleName) => {
      const normalizedModuleName = moduleName.trim().toLowerCase()
      const isAddonModule = selectedPackageAddonNames.has(normalizedModuleName) || addonOptionByName.has(normalizedModuleName)
      if (!isAddonModule) return true
      return selectedModules.includes(moduleName)
    }),
    [addonOptionByName, selectedModules, selectedPackage?.modules, selectedPackageAddonNames]
  )

  const parseSafeNumber = (raw: string | number, fallback = 0) => {
    const num = Number(raw)
    return Number.isFinite(num) ? num : fallback
  }

  const toggleAddon = (addonId: string) => {
    const compatibility = addonCompatibilityById[addonId]
    if (!selectedAddonIds.includes(addonId) && compatibility && !compatibility.isCompatible) {
      setMsg({ type: 'err', text: compatibility.reason || 'Module/Add-on belum kompatibel dengan Core Family yang dipilih.' })
      return
    }

    const nextSelectedAddonIds = selectedAddonIds.includes(addonId)
      ? selectedAddonIds.filter((id) => id !== addonId)
      : [...selectedAddonIds, addonId]

    const nextAddonCapabilities = normalizeSaasEntitlementList(
      nextSelectedAddonIds
        .map((id) => getOperatorAddonById(id)?.name || '')
        .filter(Boolean)
    )
    const nextEnabledCapabilities = normalizeSaasEntitlementList([...quoteCoreCapabilities, ...nextAddonCapabilities])
    const filteredAddonIds = nextSelectedAddonIds.filter((id) => {
      const addon = getOperatorAddonById(id)
      if (!addon) return false
      return getOperatorMarketplaceCompatibility(addon, {
        coreFamilyLevel: quoteArchitecture.coreFamilyLevel,
        enabledCapabilities: nextEnabledCapabilities,
      }).isCompatible
    })

    setSelectedAddonIds(filteredAddonIds)
  }

  const toggleModule = (moduleName: string) => {
    const nextModules = selectedModules.includes(moduleName)
      ? selectedModules.filter((name) => name !== moduleName)
      : [...selectedModules, moduleName]

    setSelectedModules(nextModules)

    if (selectedAddonIds.length === 0) return

    const nextArchitecture = getSaasPackageArchitecture(nextModules)
    const nextAddonCapabilities = normalizeSaasEntitlementList(
      selectedAddonIds
        .map((addonId) => getOperatorAddonById(addonId)?.name || '')
        .filter(Boolean)
    )
    const nextEnabledCapabilities = normalizeSaasEntitlementList([...nextModules, ...nextAddonCapabilities])
    const filteredAddonIds = selectedAddonIds.filter((addonId) => {
      const addon = getOperatorAddonById(addonId)
      if (!addon) return false
      return getOperatorMarketplaceCompatibility(addon, {
        coreFamilyLevel: nextArchitecture.coreFamilyLevel,
        enabledCapabilities: nextEnabledCapabilities,
      }).isCompatible
    })

    if (filteredAddonIds.length !== selectedAddonIds.length) {
      setSelectedAddonIds(filteredAddonIds)
    }
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
  const selectedModulesMonthlyTotal = useMemo(
    () => selectedModules.reduce((acc, modKey) => {
      const corePrice = selectedPackage?.corePrices?.[modKey] || 0
      const operationalPrice = selectedPackage?.operationalPrices?.[modKey] || 0
      // Modul operasional yang merupakan add-on sudah dihitung di selectedAddonMonthlyTotal
      const isAddon = OPERATOR_ADDON_OPTIONS.some(a => a.name === modKey || a.name.toLowerCase().includes(modKey.toLowerCase().split(' ')[0]))
      return acc + corePrice + (isAddon ? 0 : operationalPrice)
    }, 0),
    [selectedModules, selectedPackage]
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
  const estimateMonthlySubtotal = baseAmount + selectedModulesMonthlyTotal + selectedAddonMonthlyTotal + extraEntityTotal + extraBranchTotal
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
    setSelectedModules(MINIMUM_CORE_MODULES)
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
    setSelectedResellerId('')
    setEditingResellerInvoiceId(null)
    setEditingResellerValue('')
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
      const warning = 'warning' in res ? res.warning : null
      setMsg({
        type: 'ok',
        text: warning
          ? `Penawaran berhasil dikonversi ke penjualan. ${warning}`
          : 'Penawaran berhasil dikonversi ke penjualan.',
      })
      router.refresh()
    })
  }

  const handleChangeReseller = (invoiceId: string) => {
    startTransition(async () => {
      const newResellerId = editingResellerValue || null
      const res = await updateOperatorInvoiceReseller(invoiceId, newResellerId)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      setEditingResellerInvoiceId(null)
      setEditingResellerValue('')
      setMsg({
        type: 'ok',
        text: newResellerId
          ? `Reseller berhasil diperbarui.`
          : `Reseller berhasil dihapus dari invoice.`,
      })
      router.refresh()
    })
  }

  const handleVoidSale = (invoiceId: string, invoiceNumber: string) => {
    const confirmed = window.confirm(
      `Void invoice ${invoiceNumber}?\n\nTindakan ini akan:\n• Mengubah status invoice menjadi VOIDED\n• Me-void jurnal GL terkait\n\nInvoice yang sudah PAID tidak bisa di-void.`
    )
    if (!confirmed) return

    startTransition(async () => {
      const res = await voidOperatorSale(invoiceId)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      if (editingSaleInvoiceId === invoiceId) {
        resetQuoteForm()
      }
      setMsg({ type: 'ok', text: `Invoice ${invoiceNumber} berhasil di-void dan jurnal GL terkait telah dibatalkan.` })
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
          Memuat modul penawaran SaaS...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">SaaS Operator Desk</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Modul khusus pengelola SaaS untuk mengelola penawaran dan penjualan tanpa membuka halaman admin utama.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <Link
            href="/saas/penawaran"
            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider ${isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penawaran
          </Link>
          <Link
            href="/saas/penjualan"
            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider ${!isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penjualan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><ClipboardList size={14} /> Total Penawaran</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalQuotes}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Receipt size={14} /> Open Sales</div>
          <div className="mt-2 text-2xl font-semibold text-amber-600">{stats.totalOpenSales}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><CheckCircle2 size={14} /> Paid Sales</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-600">{stats.totalPaidSales}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><BadgeDollarSign size={14} /> Nilai Penjualan</div>
          <div className="mt-2 text-lg font-semibold text-[#003366]">{formatIdr(stats.totalSalesValue)}</div>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </div>
      )}

      {(isQuotesMode || Boolean(editingSaleInvoiceId)) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            {editingQuoteId ? 'Edit Penawaran SaaS' : editingSaleInvoiceId ? 'Edit Invoice SaaS' : 'Buat Penawaran SaaS Baru'}
          </h2>
          <form action={handleSaveQuote} className="mt-4 space-y-3">
            {(snapshot.orgs.length === 0 || snapshot.packages.length === 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                Data tenant/paket belum terbaca. Pastikan daftar tenant & paket tersedia.
              </div>
            )}

            {/* ── STEP 1: Nama & Tenant ── */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">1 · Nama Paket & Tenant</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tenant</span>
                  <select
                    name="org_id" required value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    disabled={Boolean(editingSaleInvoiceId)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="">Pilih Tenant</option>
                    {snapshot.orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Jenis Layanan / Base Plan <span className="font-normal normal-case text-slate-400">(Referensi)</span>
                  </span>
                  <select
                    name="package_id" required value={selectedPackageId}
                    onChange={(e) => {
                      const nextId = e.target.value
                      setSelectedPackageId(nextId)
                      const pkg = snapshot.packages.find((p) => p.id === nextId)
                      // No longer overwriting selectedModules with pkg.modules to preserve the standard minimal configuration
                      setSelectedAddonIds([])
                      setAddonPromoPrices(createDefaultAddonPromoMap())
                      setAddonAnchorPrices(createDefaultAddonAnchorMap())
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="">Pilih Base Plan</option>
                    {snapshot.packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>{pkg.name} — {formatIdr(pkg.price)}</option>
                    ))}
                  </select>
                </label>
              </div>
              {(snapshot.resellers?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <label className="space-y-1.5">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reseller <span className="font-normal normal-case text-slate-400">(Opsional)</span></span>
                    <select
                      name="reseller_id" value={selectedResellerId}
                      onChange={(e) => setSelectedResellerId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold md:w-1/2"
                    >
                      <option value="">— Tanpa Reseller —</option>
                      {snapshot.resellers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.commission_value ? ` · ${r.commission_value}${r.commission_type === 'PERCENT' ? '%' : ' fix'}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </section>

            {/* ── STEP 2: Entitas ── */}
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">2 · Kebutuhan Entitas</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Child Entity (Anak Perusahaan)</span>
                  <input type="number" min="0" value={extraEntityQty}
                    onChange={(e) => setExtraEntityQty(Math.max(0, Number(e.target.value || 0)))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Harga / Child Entity</span>
                  <input type="number" min="0" value={extraEntityUnitPrice}
                    onChange={(e) => setExtraEntityUnitPrice(e.target.value)}
                    placeholder={String(199000)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unit / Cabang</span>
                  <input type="number" min="0" value={extraBranchQty}
                    onChange={(e) => setExtraBranchQty(Math.max(0, Number(e.target.value || 0)))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Harga / Unit</span>
                  <input type="number" min="0" value={extraBranchUnitPrice}
                    onChange={(e) => setExtraBranchUnitPrice(e.target.value)}
                    placeholder={String(99000)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  />
                </label>
              </div>
              {(extraEntityQty > 0 || extraBranchQty > 0) && (
                <div className="mt-2 text-[11px] font-semibold text-slate-500">
                  {extraEntityQty > 0 && <span>{extraEntityQty} child × {formatIdr(extraEntityUnitPriceValue)} = {formatIdr(extraEntityQty * extraEntityUnitPriceValue)} / bln</span>}
                  {extraEntityQty > 0 && extraBranchQty > 0 && <span className="mx-2 text-slate-300">|</span>}
                  {extraBranchQty > 0 && <span>{extraBranchQty} unit × {formatIdr(extraBranchUnitPriceValue)} = {formatIdr(extraBranchQty * extraBranchUnitPriceValue)} / bln</span>}
                </div>
              )}
            </section>

            {/* ── STEP 3: Gudang ── */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">3 · Gudang Tambahan (WMS)</p>
              <p className="mb-3 text-[11px] font-medium text-slate-500">Setiap paket sudah termasuk 1 gudang utama. Tambahkan gudang jika bisnis membutuhkan multi-lokasi stok.</p>
              {(() => {
                const warehouseAddon = OPERATOR_GROWTH_ADDON_OPTIONS.find(a => a.id === 'addon_warehouse')
                if (!warehouseAddon) return null
                const isSelected = selectedAddonIds.includes('addon_warehouse')
                return (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAddon('addon_warehouse')}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800">🏬 Gudang Tambahan</span>
                      <p className="text-[11px] text-slate-500">{warehouseAddon.description}</p>
                    </div>
                    <span className="text-sm font-semibold text-indigo-700">{formatIdr(parseSafeNumber(addonPromoPrices['addon_warehouse'], warehouseAddon.price))} / bln</span>
                  </label>
                )
              })()}
            </section>

            {/* ── STEP 4: Modul Inti ── */}
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">4 · Modul Inti</p>
              <p className="mb-3 text-[11px] font-medium text-slate-500">Pilih modul-modul inti yang disertakan dalam paket. Harga per modul sesuai katalog SaaS.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {CORE_MODULES.map((mod) => {
                  const isSelected = selectedModules.includes(mod.key)
                  const isMinimum = MINIMUM_CORE_MODULES.includes(mod.key)
                  const unmet = (mod.requires || []).filter(req => !selectedModules.some(m => m.toLowerCase() === req.toLowerCase()))
                  const isBlocked = !isSelected && unmet.length > 0
                  const isLocked = isMinimum // minimum modules cannot be unchecked
                  const price = selectedPackage?.corePrices?.[mod.key] || 0
                  return (
                    <label key={mod.key} className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-all ${isLocked ? 'cursor-default border-emerald-300 bg-emerald-50/80' : isSelected ? 'cursor-pointer border-emerald-200 bg-emerald-50' : isBlocked ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60' : 'cursor-pointer border-slate-200 bg-slate-50/60 hover:border-emerald-200'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isBlocked || isLocked}
                        onChange={() => !isLocked && toggleModule(mod.key)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{mod.icon}</span>
                            <span className="text-sm font-bold text-slate-800">{mod.name}</span>
                            {isMinimum && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-emerald-700">Wajib</span>}
                          </div>
                          {price > 0 && <span className="text-xs font-semibold text-emerald-700">{formatIdr(price)}/bln</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{mod.tagline}</p>
                        {isBlocked && <p className="mt-1 text-[10px] font-bold text-rose-500">Butuh: {unmet.join(', ')}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* ── STEP 5: Modul Operasional ── */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">5 · Modul Operasional</p>
              <p className="mb-3 text-[11px] font-medium text-slate-500">Tambahkan ekstensi bisnis spesifik. Harga muncul setelah diset di Pengaturan SaaS.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {OPERATIONAL_MODULES.map((mod) => {
                  const addonEntry = OPERATOR_ADDON_OPTIONS.find(a => a.name === mod.key || a.name.toLowerCase().includes(mod.key.toLowerCase().split(' ')[0]))
                  const addonId = addonEntry?.id
                  const isSelected = addonId ? selectedAddonIds.includes(addonId) : selectedModules.includes(mod.key)
                  const unmet = (mod.requires || []).filter(req => !selectedModules.some(m => m.toLowerCase() === req.toLowerCase()))
                  const isBlocked = !isSelected && unmet.length > 0
                  
                  let price = 0
                  if (addonId) {
                    price = parseSafeNumber(addonPromoPrices[addonId], addonEntry?.price || 0)
                  } else {
                    price = selectedPackage?.operationalPrices?.[mod.key] || 0
                  }

                  return (
                    <label key={mod.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-all ${isSelected ? 'border-blue-200 bg-blue-50' : isBlocked ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => addonId ? toggleAddon(addonId) : toggleModule(mod.key)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{mod.icon}</span>
                            <span className="text-sm font-bold text-slate-800">{mod.name}</span>
                          </div>
                          {price > 0 && <span className="text-xs font-semibold text-blue-700">{formatIdr(price)}/bln</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{mod.tagline}</p>
                        {isBlocked && <p className="mt-1 text-[10px] font-bold text-rose-500">Butuh: {unmet.join(', ')}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* ── STEP 6: Add-on ── */}
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">6 · Add-on</p>
              <p className="mb-3 text-[11px] font-medium text-slate-500">Fitur tambahan yang memperkuat kapasitas bisnis tanpa mengubah model operasional.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OPERATOR_GROWTH_ADDON_OPTIONS.filter(a => a.id !== 'addon_warehouse').map((addon) => {
                  const isSelected = selectedAddonIds.includes(addon.id)
                  const compatibility = addonCompatibilityById[addon.id]
                  const isLocked = !isSelected && compatibility && !compatibility.isCompatible
                  return (
                    <div key={addon.id} className={`rounded-xl border px-3 py-3 transition-all ${isSelected ? 'border-indigo-200 bg-indigo-50' : isLocked ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-slate-50/60 hover:border-indigo-200'}`}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={Boolean(isLocked)}
                          onChange={() => toggleAddon(addon.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800">{addon.name}</span>
                            <span className="text-sm font-semibold text-indigo-700">{formatIdr(parseSafeNumber(addonPromoPrices[addon.id], addon.price))}</span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-slate-500">{addon.description}</p>
                          <span className="mt-1 inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase text-slate-500">{addon.billing}</span>
                          {isLocked && compatibility?.reason && <p className="mt-1 text-[10px] font-bold text-amber-600">{compatibility.reason}</p>}
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── STEP 7: Durasi ── */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">7 · Durasi & Harga Override</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Durasi (Bulan)</span>
                  <input name="duration_months" type="number" min="1" step="1"
                    value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Harga Base Override <span className="font-normal normal-case text-slate-400">(Opsional)</span></span>
                  <input name="amount" type="number" min="0"
                    value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)}
                    placeholder="Kosongkan = ikut template"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Catatan</span>
                  <input name="note" type="text"
                    value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Catatan opsional..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                  />
                </label>
              </div>
            </section>

            {/* ── STEP 8-10: Kalkulasi Total ── */}
            <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">8–10 · Subtotal · Diskon & Pajak · Total</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1 rounded-xl border border-indigo-100 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">8 · Subtotal per Bulan</p>
                  <div className="space-y-0.5 text-[11px] text-slate-600 font-semibold">
                    {(overrideAmount || selectedPackage?.price) ? <div className="flex justify-between"><span>Base paket</span><span>{formatIdr(baseAmount)}</span></div> : null}
                    {selectedModulesMonthlyTotal > 0 && <div className="flex justify-between text-emerald-700"><span>Modul custom</span><span>{formatIdr(selectedModulesMonthlyTotal)}</span></div>}
                    {selectedAddonMonthlyTotal > 0 && <div className="flex justify-between"><span>Add-on bulanan</span><span>{formatIdr(selectedAddonMonthlyTotal)}</span></div>}
                    {extraEntityQty > 0 && <div className="flex justify-between"><span>Child entity ×{extraEntityQty}</span><span>{formatIdr(extraEntityTotal)}</span></div>}
                    {extraBranchQty > 0 && <div className="flex justify-between"><span>Unit ×{extraBranchQty}</span><span>{formatIdr(extraBranchTotal)}</span></div>}
                    {selectedAddonSingleBillTotal > 0 && <div className="flex justify-between text-slate-400"><span>One-time add-on</span><span>{formatIdr(selectedAddonSingleBillTotal)}</span></div>}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-indigo-100 pt-2">
                    <span className="text-xs font-semibold text-slate-700">Subtotal × {safeDurationMonths} bulan</span>
                    <span className="text-sm font-semibold text-slate-900">{formatIdr(estimateSubtotal)}</span>
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">9 · Diskon & Pajak</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-500">Diskon (%)</span>
                      <input name="discount_percent" type="number" min="0" max="100" step="0.01"
                        value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-500">Pajak (%)</span>
                      <input name="tax_percent" type="number" min="0" max="100" step="0.01"
                        value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold"
                      />
                    </label>
                  </div>
                  {(estimateDiscountAmount > 0 || estimateTaxAmount > 0) && (
                    <div className="space-y-0.5 text-[11px] text-slate-600 font-semibold">
                      {estimateDiscountAmount > 0 && <div className="flex justify-between text-rose-600"><span>Diskon {safeDiscountPercent}%</span><span>- {formatIdr(estimateDiscountAmount)}</span></div>}
                      {estimateTaxAmount > 0 && <div className="flex justify-between text-amber-700"><span>Pajak {safeTaxPercent}%</span><span>+ {formatIdr(estimateTaxAmount)}</span></div>}
                    </div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t border-indigo-100 pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">10 · Grand Total</span>
                    <span className="text-2xl font-semibold text-indigo-700">{formatIdr(estimateGrandTotal)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                {(editingQuoteId || editingSaleInvoiceId) && (
                  <button type="button" disabled={isPending} onClick={resetQuoteForm}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-xs font-semibold uppercase tracking-wider text-slate-600 disabled:opacity-60">
                    Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isPending || !selectedOrgId || !selectedPackageId}
                  className="h-11 rounded-xl bg-[#003366] px-6 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60 hover:bg-indigo-700 transition-colors">
                  {isPending ? 'Menyimpan...' : editingQuoteId || editingSaleInvoiceId ? 'Simpan Perubahan' : 'Buat Penawaran'}
                </button>
              </div>
            </section>

            {/* Hidden fields */}
            {selectedAddonIds.map((id) => <input key={`addon-${id}`} type="hidden" name="selected_addons" value={id} />)}
            {selectedModules.map((m) => <input key={`module-${m}`} type="hidden" name="selected_modules" value={m} />)}
            <input type="hidden" name="ai_token_package_id" value={selectedAiTokenPackageId} />
            <input type="hidden" name="extra_entity_qty" value={extraEntityQty} />
            <input type="hidden" name="extra_branch_qty" value={extraBranchQty} />
            <input type="hidden" name="extra_entity_unit_price" value={extraEntityUnitPriceValue} />
            <input type="hidden" name="extra_branch_unit_price" value={extraBranchUnitPriceValue} />
            <input type="hidden" name="addon_price_overrides_json" value={JSON.stringify(addonPromoPrices)} />
            <input type="hidden" name="addon_anchor_overrides_json" value={JSON.stringify(addonAnchorPrices)} />
            {editingQuoteId && <input type="hidden" name="quote_id" value={editingQuoteId} />}
            {editingSaleInvoiceId && <input type="hidden" name="invoice_id" value={editingSaleInvoiceId} />}
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            {isQuotesMode ? 'Daftar Penawaran SaaS' : 'Daftar Penjualan SaaS'}
          </h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
          >
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3">Nomor</th>
                <th className="px-3 py-3">Tenant</th>
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Nilai</th>
                <th className="px-3 py-3">Diskon</th>
                <th className="px-3 py-3">Pajak</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Reseller</th>
                <th className="px-3 py-3">Dibuat</th>
                <th className="px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(isQuotesMode ? snapshot.quotations : snapshot.sales).map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-sm">
                  <td className="px-3 py-3 font-semibold text-slate-900">{item.invoice_number}</td>
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
                  <td className="px-3 py-3 font-semibold text-[#003366]">{formatIdr(Number(item.amount || 0))}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                    {formatIdr(Number(item.discount_amount || 0))}
                    <div className="text-[10px] text-slate-400">{Number(item.discount_percent || 0)}%</div>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                    {formatIdr(Number(item.tax_amount || 0))}
                    <div className="text-[10px] text-slate-400">{Number(item.tax_percent || 0)}%</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                      item.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'VOIDED'
                          ? 'bg-slate-100 text-slate-500 line-through'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-500">{formatDate(item.created_at)}</td>
                  {/* Reseller cell — inline edit */}
                  <td className="px-3 py-3">
                    {editingResellerInvoiceId === item.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={editingResellerValue}
                          onChange={(e) => setEditingResellerValue(e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold"
                        >
                          <option value="">— Hapus —</option>
                          {(snapshot.resellers || []).map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleChangeReseller(item.id)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingResellerInvoiceId(null); setEditingResellerValue('') }}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {item.reseller ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            {item.reseller.name}
                            {item.reseller.commission_value
                              ? ` ${item.reseller.commission_value}${item.reseller.commission_type === 'PERCENT' ? '%' : ''}`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                        {item.status !== 'VOIDED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingResellerInvoiceId(item.id)
                              setEditingResellerValue(item.reseller_id || '')
                            }}
                            className="text-[10px] text-slate-400 hover:text-violet-600"
                            title="Ubah reseller"
                          >
                            <UserCheck size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isQuotesMode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStartEditQuote(item)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleConvert(item.id)}
                          className="rounded-lg bg-[#003366] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-60"
                        >
                          Konversi ke Penjualan
                        </button>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteQuote(item.id, item.invoice_number)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : item.status === 'VOIDED' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Dibatalkan</span>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                      </div>
                    ) : item.status !== 'PAID' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStartEditSale(item)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 disabled:opacity-60"
                        >
                          Edit Invoice
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleMarkPaid(item.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-60"
                        >
                          Tandai Paid
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVoidSale(item.id, item.invoice_number)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 disabled:opacity-60"
                        >
                          <XCircle size={11} /> Void
                        </button>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          <Download size={11} /> Download
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600">Selesai</span>
                        <Link
                          href={`/saas/dokumen/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
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
