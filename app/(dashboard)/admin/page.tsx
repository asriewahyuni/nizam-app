'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  Users, 
  Building2,
  Package, 
  Plus, 
  Search, 
  Settings2, 
  CheckCircle2, 
  Edit3,
  Loader2,
  RefreshCw,
  X,
  Trash2,
  ReceiptText,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  Edit2,
  XCircle,
  Mail,
  Database,
  Zap,
  ExternalLink,
  Coins,
  LogIn,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatusBadge, ConfirmDialog } from '@/components/ui/NizamUI'
import { createClient } from '@/lib/supabase/client'
import { deleteInactiveTenantByPlatformAdmin, signInAsTenantOwner } from '@/modules/auth/actions/auth.actions'
import {
  addSaasAssessor,
  deleteSaasAssessor,
  getSaasAssessorAdminSnapshot,
  setSaasAssessorActive,
  type SaasAssessorRecord,
} from '@/modules/saas/actions/assessor.actions'
import { Organization } from '@/types/database.types'
import Link from 'next/link'
import { UserActivityMonitor } from '@/components/admin/UserActivityMonitor'
import {
  type SaasCoreFamily,
  type SaasCoreFamilyLevel,
  SAAS_ADDON_ITEMS,
  SAAS_FULL_CORE_EXTENSION_ITEMS,
  SAAS_MODULE_COMPATIBILITY_OPTIONS,
  SAAS_PACKAGE_EDITOR_SECTIONS,
  SAAS_STARTER_CORE_ITEMS,
  SAAS_VERTICAL_MODULE_ITEMS,
  getSaasAddonCompatibilityOption,
  getSaasCapabilityDisplayLabel,
  getSaasCapabilityKind,
  getSaasCoreFamilyLabel,
  getSaasPackageArchitecture,
  getSaasProvisioningModulesForCoreFamily,
  getSaasRelatedAddonsForModule,
  getSaasCoreFamilyRank,
  isSaasAddonCompatible,
  normalizeSaasEntitlementList,
  normalizeSaasEntitlementName,
  saasCoreFamilySatisfies,
  saasModuleMatches,
} from '@/lib/saas/module-catalog'
import { CORE_MODULES, MINIMUM_CORE_MODULES, OPERATIONAL_MODULES } from '@/modules/marketplace/lib/module-registry'
import { OPERATOR_GROWTH_ADDON_OPTIONS } from '@/lib/saas/operator-pricing'
import {
  calculateAiHppPerGeneration,
  calculateAiRecommendedSellPer1kTokens,
  calculateAiRecommendedSellPerGeneration,
  normalizeAiTokenPolicy,
} from '@/modules/ai/lib/ai-token'
import { cn } from '@/lib/utils'

const supabase = createClient()

function isCapabilitySelected(values: readonly string[] | undefined, value: string) {
  if (!Array.isArray(values) || values.length === 0) return false

  if (value === 'Dashboard') {
    return values.some((moduleName) => String(moduleName || '').trim().toLowerCase() === 'dashboard')
  }

  return values.some((moduleName) => saasModuleMatches(String(moduleName || ''), value))
}

type OrganizationExpirySource = {
  subscription_end?: unknown
  settings?: Record<string, unknown> | null
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null

  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveOrganizationExpiryDate(org: OrganizationExpirySource | null | undefined): Date | null {
  const settings = org?.settings && typeof org.settings === 'object' ? org.settings : null
  const candidates = [
    parseOptionalDate(org?.subscription_end),
    parseOptionalDate(settings?.expires_at),
  ].filter((candidate): candidate is Date => candidate instanceof Date)

  if (candidates.length === 0) return null

  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  )
}

function formatDateInputValue(date: Date | null): string {
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildPlanExpiryIso(durationDays: number | null | undefined): string | null {
  if (typeof durationDays !== 'number' || durationDays <= 0) return null

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)
  return expiresAt.toISOString()
}

function buildPlanExpiryDateInput(durationDays: number | null | undefined): string {
  if (typeof durationDays !== 'number' || durationDays <= 0) return ''

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)
  return formatDateInputValue(expiresAt)
}

function resolveNextExpiryDateInput(
  currentValue: string,
  currentDurationDays: number | null | undefined,
  nextDurationDays: number | null | undefined
): string {
  const trimmedCurrentValue = String(currentValue || '').trim()
  const currentSuggestedValue = buildPlanExpiryDateInput(currentDurationDays)
  const nextSuggestedValue = buildPlanExpiryDateInput(nextDurationDays)

  if (!trimmedCurrentValue) return nextSuggestedValue
  if (trimmedCurrentValue === currentSuggestedValue) return nextSuggestedValue
  return trimmedCurrentValue
}

function toExpiryIsoFromDateInput(value: string): string | null {
  const trimmedValue = String(value || '').trim()
  if (!trimmedValue) return null

  const parsed = new Date(`${trimmedValue}T23:59:59`)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString()
}

type SaasActiveAddonEntry = Record<string, unknown> & {
  id?: string
  name: string
  activated_at?: string
  source?: string
}

const SAAS_TENANT_ENTITLEMENT_SECTIONS = [
  {
    key: 'starter_core_upsell',
    title: 'Upsell Starter Core',
    description: 'Capability operasional yang bisa ditambahkan di atas Lite Core.',
    items: SAAS_STARTER_CORE_ITEMS,
  },
  {
    key: 'full_core_upsell',
    title: 'Upsell Full Core',
    description: 'Capability lanjutan seperti HRIS, Manufacturing, dan Audit.',
    items: SAAS_FULL_CORE_EXTENSION_ITEMS,
  },
  {
    key: 'vertical_modules',
    title: 'Vertical Modules',
    description: 'Module industri atau workflow spesifik yang bisa diaktifkan per tenant.',
    items: SAAS_VERTICAL_MODULE_ITEMS,
  },
  {
    key: 'addons',
    title: 'Add-ons',
    description: 'Ekspansi tambahan seperti WMS, API, sales page, dan capacity pack.',
    items: SAAS_ADDON_ITEMS,
  },
] as const

function toCapabilityArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeSaasEntitlementList(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return normalizeSaasEntitlementList(
          parsed
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        )
      }
    } catch {
      return normalizeSaasEntitlementList(
        trimmed
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    }
  }

  return []
}

function normalizeActiveAddonEntries(value: unknown): SaasActiveAddonEntry[] {
  if (!Array.isArray(value)) return []

  const output: SaasActiveAddonEntry[] = []
  const seen = new Set<string>()

  value.forEach((entry, index) => {
    let sourceEntry: Record<string, unknown> | null = null
    if (typeof entry === 'string') {
      sourceEntry = { name: entry }
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      sourceEntry = entry as Record<string, unknown>
    }

    const normalizedName = normalizeSaasEntitlementName(String(sourceEntry?.name || ''))
    if (!normalizedName || seen.has(normalizedName)) return

    seen.add(normalizedName)
    output.push({
      ...sourceEntry,
      id: String(sourceEntry?.id || `legacy-addon-${index}`),
      name: normalizedName,
      activated_at: typeof sourceEntry?.activated_at === 'string' ? sourceEntry.activated_at : undefined,
      source: typeof sourceEntry?.source === 'string' ? sourceEntry.source : undefined,
    })
  })

  return output
}

function buildActiveAddonPayload(
  selectedNames: readonly string[],
  currentEntries: unknown,
  source: string
): SaasActiveAddonEntry[] {
  const existingEntries = normalizeActiveAddonEntries(currentEntries)
  const existingByName = new Map(existingEntries.map((entry) => [entry.name, entry]))

  return normalizeSaasEntitlementList([...selectedNames]).map((name, index) => {
    const existing = existingByName.get(name)
    return {
      ...(existing || {}),
      id: String(existing?.id || `${source}:${name}:${index}`),
      name,
      activated_at: existing?.activated_at || new Date().toISOString(),
      source: existing?.source || source,
    }
  })
}

type Tab =
  | 'users'
  | 'module_management'
  | 'addon_management'
  | 'packages'
  | 'invoices'
  | 'settings'
  | 'ai_tokens'
  | 'activity'
  | 'assessors'

type OrganizationHierarchyRow = {
  org: Organization
  depth: number
  parentOrg: Organization | null
  ancestorOrgIds: string[]
  visibleDescendantCount: number
}

export default function SaaSAdminPage() {
  const db = supabase as any
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [searchTxt, setSearchTxt] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'demo' | 'official'>('all')
  const [packageFilter, setPackageFilter] = useState<string>('all')
  const [saasSettings, setSaasSettings] = useState<any>({ bank_info: {}, support_info: {} })
  const [aiTokenPolicyRaw, setAiTokenPolicyRaw] = useState<any>({})
  const [aiTokenInventory, setAiTokenInventory] = useState<any>({ total_stock_tokens: 0 })
  const [aiTopupPackages, setAiTopupPackages] = useState<any[]>([])
  const [aiWalletSummary, setAiWalletSummary] = useState({
    totalBalance: 0,
    totalPurchased: 0,
    totalUsed: 0,
  })
  const [aiTopupModal, setAiTopupModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  const [assessors, setAssessors] = useState<SaasAssessorRecord[]>([])
  const [loadingAssessors, setLoadingAssessors] = useState(true)
  const [assessorPending, startAssessorTransition] = useTransition()

  const aiPolicy = normalizeAiTokenPolicy(aiTokenPolicyRaw)
  const aiHppPerGenerate = calculateAiHppPerGeneration(aiPolicy)
  const aiRecommendedPerGenerate = calculateAiRecommendedSellPerGeneration(aiPolicy)
  const aiRecommendedPer1kToken = calculateAiRecommendedSellPer1kTokens(aiPolicy)
  const aiAvailableStock = Math.max(0, Number(aiTokenInventory?.total_stock_tokens || 0) - aiWalletSummary.totalBalance)

  useEffect(() => {
    async function fetchConfig() {
      const { data } = await db.from('saas_config').select('*')
      if (data) {
        const config: any = {}
        data.forEach((item: any) => config[item.key] = item.value)
        setSaasSettings(config)
      }
    }
    fetchConfig()
  }, [])

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const bank = { 
      bank: fd.get('bank_name'), 
      account: fd.get('bank_acc'), 
      name: fd.get('bank_user') 
    }
    const support = { 
      wa: fd.get('wa_num'), 
      label: fd.get('wa_label') 
    }
    
    const { error } = await db.from('saas_config').upsert([
      { key: 'bank_info', value: bank }, 
      { key: 'support_info', value: support }
    ])
    
    if (!error) {
      alert('✅ Pengaturan Global Berhasil Disimpan!')
      setSaasSettings({ bank_info: bank, support_info: support })
    } else {
      alert('❌ Gagal: ' + error.message)
    }
  }
  
  const [packages, setPackages] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [collapsedParentOrgIds, setCollapsedParentOrgIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ======== MODALS STATE ========
  const [pkgModal, setPkgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  const [orgModal, setOrgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  const [orgModalPlanName, setOrgModalPlanName] = useState('Demo')
  const [entitlementModal, setEntitlementModal] = useState<{
    open: boolean
    org: Organization | null
    selectedPlan: string
    expiryDate: string
    selectedModules: string[]
    selectedAddons: string[]
  }>({
    open: false,
    org: null,
    selectedPlan: '',
    expiryDate: '',
    selectedModules: [],
    selectedAddons: [],
  })
  const [entitlementViewMode, setEntitlementViewMode] = useState<'all' | 'modules' | 'addons'>('all')
  const [entitlementFocusedModule, setEntitlementFocusedModule] = useState<string | null>(null)
  
  const [confirmState, setConfirmState] = useState<{ open: boolean, title: string, message: string, action: () => Promise<void> }>({
    open: false, title: '', message: '', action: async () => {}
  })
  const [loginAsPending, startLoginAsTransition] = useTransition()
  const [loginAsOrgId, setLoginAsOrgId] = useState<string | null>(null)
  const [tenantDeleteMode, setTenantDeleteMode] = useState(false)
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null)

  // State local untuk helper set date di modal org
  const [modalExpireDate, setModalExpireDate] = useState('')
  const [savingEntitlements, startEntitlementTransition] = useTransition()
  
  const getOrgSettings = (org: Organization | null | undefined) => (
    org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? org.settings as Record<string, unknown>
      : {}
  )

  const getOrgCustomEnabledModules = (org: Organization | null | undefined) =>
    toCapabilityArray((org as any)?.enabled_modules)

  const isOrgUsingCustomModules = (org: Organization | null | undefined) =>
    getOrgSettings(org).use_custom_modules === true

  const resolveManagedModulesForOrg = (
    org: Organization | null | undefined,
    packageModules: string[]
  ) => {
    if (isOrgUsingCustomModules(org)) {
      return getOrgCustomEnabledModules(org)
    }

    return packageModules
  }

  const resolvePackageCoreFamily = (pkg: any): SaasCoreFamilyLevel => {
    if (!pkg) return 'none'
    return getSaasPackageArchitecture(toCapabilityArray(pkg.modules), []).coreFamilyLevel
  }

  const closeOrgModal = () => {
    setOrgModal({ open: false, editData: null })
    setOrgModalPlanName('Demo')
    setModalExpireDate('')
  }

  const openOrgModal = (org: Organization | null) => {
    const initialPlan = String((org?.settings as any)?.plan || 'Demo').trim() || 'Demo'
    const initialPackage = packages.find((pkg) => pkg.name === initialPlan) || null
    const initialExpiry =
      formatDateInputValue(resolveOrganizationExpiryDate(org as OrganizationExpirySource)) ||
      buildPlanExpiryDateInput(initialPackage?.duration_days)

    setOrgModalPlanName(initialPlan)
    setModalExpireDate(initialExpiry)
    setOrgModal({ open: true, editData: org })
  }

  const handleOrgModalPlanChange = (nextPlan: string) => {
    const currentPackage = packages.find((pkg) => pkg.name === orgModalPlanName) || null
    const nextPackage = packages.find((pkg) => pkg.name === nextPlan) || null

    setModalExpireDate((currentValue) =>
      resolveNextExpiryDateInput(currentValue, currentPackage?.duration_days, nextPackage?.duration_days)
    )
    setOrgModalPlanName(nextPlan)
  }

  const getCoreFamilyFromRank = (rank: number): SaasCoreFamily => {
    if (rank >= 3) return 'full'
    if (rank >= 2) return 'starter'
    return 'lite'
  }

  const deriveCoreFamilyFromModules = (
    modulesRaw: readonly string[],
    fallbackCoreFamily: SaasCoreFamily = 'lite'
  ): SaasCoreFamily => {
    const highestRequiredRank = normalizeSaasEntitlementList([...modulesRaw]).reduce((currentHighest, capability) => {
      const matchedOption = SAAS_MODULE_COMPATIBILITY_OPTIONS.find((option) => saasModuleMatches(option.value, capability))
      if (!matchedOption) return currentHighest
      return Math.max(currentHighest, getSaasCoreFamilyRank(matchedOption.requiredCoreFamily))
    }, 0)

    if (highestRequiredRank === 0) return fallbackCoreFamily
    return getCoreFamilyFromRank(highestRequiredRank)
  }

  const sanitizeModuleSelectionForCoreFamily = (
    modulesRaw: readonly string[],
    coreFamily: SaasCoreFamily
  ) => {
    return normalizeSaasEntitlementList([...modulesRaw]).filter((capability) => {
      const normalizedCapability = normalizeSaasEntitlementName(capability)
      const matchedOption = SAAS_MODULE_COMPATIBILITY_OPTIONS.find((option) => saasModuleMatches(option.value, normalizedCapability))

      if (matchedOption) {
        return saasCoreFamilySatisfies(coreFamily, matchedOption.requiredCoreFamily)
      }

      const capabilityKind = getSaasCapabilityKind(normalizedCapability)
      return capabilityKind === 'platform_core' || capabilityKind === 'unclassified'
    })
  }

  const sanitizeAddonSelectionForCompatibility = (
    addonsRaw: readonly string[],
    modulesRaw: readonly string[],
    coreFamily: SaasCoreFamily
  ) => {
    const normalizedAddons = normalizeSaasEntitlementList([...addonsRaw])
    const normalizedModules = normalizeSaasEntitlementList([...modulesRaw])

    return normalizedAddons.filter((capability) => {
      const addonRule = getSaasAddonCompatibilityOption(capability)
      if (!addonRule) return true

      return isSaasAddonCompatible(addonRule.value, normalizedModules, coreFamily, normalizedAddons)
    })
  }

  const findPreferredPackageForCoreFamily = (
    coreFamily: SaasCoreFamily,
    preferredPlanName?: string
  ) => {
    const candidates = packages.filter((pkg) => resolvePackageCoreFamily(pkg) === coreFamily)
    if (candidates.length === 0) return null
    return candidates.find((pkg) => pkg.name === preferredPlanName) || candidates[0] || null
  }


  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.from('organizations').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setOrgs(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true)
      const { data, error } = await db.from('saas_packages').select('*').order('price', { ascending: true })
      
      if (error) throw error

      const formatted = (data || []).map((p: any) => ({
        ...p,
        active: p.is_active, 
        modules: Array.isArray(p.modules) ? p.modules : JSON.parse(p.modules || '[]'),
        addons: Array.isArray(p.addons) ? p.addons : JSON.parse(p.addons || '[]')
      }))
      setPackages(formatted)
    } catch (err: any) {
    } finally {
      setLoadingPackages(false)
    }
  }

  const fetchInvoices = async () => {
    const { data } = await db.from('saas_invoices').select(`
      *,
      organization:organizations(name),
      package:saas_packages(name, modules, duration_days, max_orgs, max_warehouses)
    `).order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  const fetchAiTokenData = async () => {
    const { data: configRows } = await db
      .from('saas_config')
      .select('*')
      .in('key', ['ai_token_policy', 'ai_token_inventory'])

    const config: any = {}
    ;(configRows || []).forEach((row: any) => {
      config[row.key] = row.value
    })
    setAiTokenPolicyRaw(config.ai_token_policy || {})
    setAiTokenInventory(config.ai_token_inventory || { total_stock_tokens: 0 })

    const { data: topupRows } = await db
      .from('ai_token_topup_packages')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('tokens', { ascending: true })

    setAiTopupPackages(topupRows || [])

    const { data: walletRows } = await db
      .from('ai_token_wallets')
      .select('balance_tokens, total_purchased_tokens, total_used_tokens')

    const summary = (walletRows || []).reduce(
      (acc: { totalBalance: number; totalPurchased: number; totalUsed: number }, wallet: any) => {
        acc.totalBalance += Number(wallet.balance_tokens || 0)
        acc.totalPurchased += Number(wallet.total_purchased_tokens || 0)
        acc.totalUsed += Number(wallet.total_used_tokens || 0)
        return acc
      },
      { totalBalance: 0, totalPurchased: 0, totalUsed: 0 },
    )

    setAiWalletSummary(summary)
  }

  const fetchAssessors = async () => {
    setLoadingAssessors(true)
    const snapshot = await getSaasAssessorAdminSnapshot()
    if (snapshot.error) {
      alert(snapshot.error)
      setAssessors([])
    } else {
      setAssessors(snapshot.assessors)
    }
    setLoadingAssessors(false)
  }

  const saveAssessorForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startAssessorTransition(async () => {
      const result = await addSaasAssessor(formData)
      if (result.error) {
        alert(result.error)
        return
      }

      form.reset()
      await fetchAssessors()
    })
  }

  const toggleAssessorStatus = (id: string, currentStatus: boolean) => {
    startAssessorTransition(async () => {
      const result = await setSaasAssessorActive(id, !currentStatus)
      if (result.error) {
        alert(result.error)
        return
      }

      await fetchAssessors()
    })
  }

  const handleDeleteAssessor = (id: string, email: string) => {
    setConfirmState({
      open: true,
      title: 'Hapus Assessor?',
      message: `Akses assessor ${email} akan dicabut dari panel SaaS. Lanjutkan?`,
      action: async () => {
        const result = await deleteSaasAssessor(id)
        if (result.error) {
          alert(result.error)
        } else {
          await fetchAssessors()
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      },
    })
  }

  const saveAiTokenConfig = async () => {
    const policyValue = {
      cost_per_1k_input_idr: Number(aiPolicy.costPer1kInputIdr || 0),
      cost_per_1k_output_idr: Number(aiPolicy.costPer1kOutputIdr || 0),
      avg_input_tokens: Number(aiPolicy.avgInputTokens || 0),
      avg_output_tokens: Number(aiPolicy.avgOutputTokens || 0),
      tokens_per_generation: Number(aiPolicy.tokensPerGeneration || 0),
      overhead_percent: Number(aiPolicy.overheadPercent || 0),
      margin_percent: Number(aiPolicy.marginPercent || 0),
      low_balance_threshold: Number(aiPolicy.lowBalanceThreshold || 0),
    }

    const inventoryValue = {
      total_stock_tokens: Number(aiTokenInventory?.total_stock_tokens || 0),
    }

    const { error } = await db.from('saas_config').upsert([
      { key: 'ai_token_policy', value: policyValue },
      { key: 'ai_token_inventory', value: inventoryValue },
    ])

    if (error) {
      alert('❌ Gagal menyimpan pengaturan token AI: ' + error.message)
      return
    }

    alert('✅ Konfigurasi token AI berhasil disimpan.')
    await fetchAiTokenData()
  }

  const saveAiTopupPackageForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      tokens: Number(fd.get('tokens') || 0),
      price_idr: Number(fd.get('price_idr') || 0),
      cost_idr: Number(fd.get('cost_idr') || 0),
      sort_order: Number(fd.get('sort_order') || 0),
      is_active: fd.get('is_active') === 'on',
    }

    if (!payload.name || payload.tokens <= 0) {
      alert('Nama paket dan jumlah token wajib valid.')
      return
    }

    const { error } = aiTopupModal.editData?.id
      ? await db.from('ai_token_topup_packages').update(payload).eq('id', aiTopupModal.editData.id)
      : await db.from('ai_token_topup_packages').insert(payload)

    if (error) {
      alert('❌ Gagal menyimpan paket topup: ' + error.message)
      return
    }

    alert('✅ Paket topup token berhasil disimpan.')
    setAiTopupModal({ open: false, editData: null })
    await fetchAiTokenData()
  }

  const toggleAiTopupStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await db
      .from('ai_token_topup_packages')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      alert('❌ Gagal mengubah status paket topup: ' + error.message)
      return
    }

    await fetchAiTokenData()
  }

  const handleDeleteAiTopupPackage = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Hapus Paket Topup?',
      message: `Paket token "${name}" akan dihapus permanen. Lanjutkan?`,
      action: async () => {
        const { error } = await db.from('ai_token_topup_packages').delete().eq('id', id)
        if (error) {
          alert(error.message)
        } else {
          await fetchAiTokenData()
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      },
    })
  }

  const approveInvoice = async (invoice: any) => {
    const pkg = invoice.package
    const isAddon = !invoice.package_id
    
    // 1. Update status invoice jadi PAID
    const { error: invErr } = await db.from('saas_invoices').update({ status: 'PAID' }).eq('id', invoice.id)
    if (invErr) return alert('Gagal update invoice: ' + invErr.message)

    // 1.1 Jika ini invoice topup token AI, lakukan kredit token ke wallet org
    const { data: tokenOrder } = await db
      .from('ai_token_topup_orders')
      .select('*')
      .eq('invoice_id', invoice.id)
      .maybeSingle()

    if (tokenOrder) {
      const tokenAmount = Number(tokenOrder.tokens || 0)
      const { data: wallet } = await db
        .from('ai_token_wallets')
        .select('*')
        .eq('org_id', invoice.org_id)
        .maybeSingle()

      if (wallet?.org_id) {
        const { error: walletUpdateError } = await db
          .from('ai_token_wallets')
          .update({
            balance_tokens: Number(wallet.balance_tokens || 0) + tokenAmount,
            total_purchased_tokens: Number(wallet.total_purchased_tokens || 0) + tokenAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', invoice.org_id)

        if (walletUpdateError) {
          return alert('Gagal update saldo token AI: ' + walletUpdateError.message)
        }
      } else {
        const { error: walletCreateError } = await db
          .from('ai_token_wallets')
          .insert({
            org_id: invoice.org_id,
            balance_tokens: tokenAmount,
            total_purchased_tokens: tokenAmount,
            total_used_tokens: 0,
            low_balance_threshold: aiPolicy.lowBalanceThreshold,
          })

        if (walletCreateError) {
          return alert('Gagal membuat wallet token AI: ' + walletCreateError.message)
        }
      }

      await db.from('ai_token_usage_logs').insert({
        org_id: invoice.org_id,
        source: 'topup',
        direction: 'CREDIT',
        tokens: tokenAmount,
        related_invoice_id: invoice.id,
        note: `Topup AI token dari paket ${tokenOrder.package_id}`,
        meta: {
          topup_order_id: tokenOrder.id,
          package_id: tokenOrder.package_id,
        },
      })

      await db
        .from('ai_token_topup_orders')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenOrder.id)

      alert('✅ Topup token AI berhasil dikonfirmasi dan saldo tenant sudah ditambahkan.')
      fetchInvoices()
      fetchAiTokenData()
      return
    }

    if (isAddon) {
      // HANDLE ADDON ACTIVATION
      const { data: org, error: orgLookupError } = await db
        .from('organizations')
        .select('active_addons, settings')
        .eq('id', invoice.org_id)
        .single()
      if (orgLookupError) return alert('Gagal membaca data organisasi: ' + orgLookupError.message)

      const normalizedAddonName = normalizeSaasEntitlementName(String(invoice.item_name || ''))
      if (!normalizedAddonName) return alert('Nama add-on pada invoice tidak valid.')

      const currentAddons = Array.isArray(org?.active_addons) ? org.active_addons : []
      const mergedAddonNames = normalizeSaasEntitlementList([
        ...normalizeActiveAddonEntries(currentAddons).map((entry) => entry.name),
        normalizedAddonName,
      ])

      const { error: addonErr } = await db.from('organizations').update({
        active_addons: buildActiveAddonPayload(mergedAddonNames, currentAddons, 'billing_manual_approval')
      }).eq('id', invoice.org_id)
      
      if (addonErr) return alert('Gagal aktivasi add-on: ' + addonErr.message)
    } else {
      // HANDLE PLAN UPGRADE
      const { data: org, error: orgLookupError } = await db
        .from('organizations')
        .select('settings')
        .eq('id', invoice.org_id)
        .single()
      if (orgLookupError) return alert('Gagal membaca data organisasi: ' + orgLookupError.message)

      const expiresAt = buildPlanExpiryIso(pkg?.duration_days)
      const currentSettings =
        org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
          ? org.settings
          : {}

      const { error: orgErr } = await db.from('organizations').update({
        settings: {
          ...currentSettings,
          plan: pkg?.name || 'Pro',
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        },
        subscription_end: expiresAt,
      }).eq('id', invoice.org_id)

      if (orgErr) return alert('Gagal update plan organisasi: ' + orgErr.message)
    }

    alert('✅ Pembayaran Berhasil Dikonfirmasi & Item Aktif!')
    fetchInvoices()
    fetchAiTokenData()
  }

  const cancelInvoice = async (id: string) => {
    const { error } = await db.from('saas_invoices').update({ status: 'CANCELLED' }).eq('id', id)
    if (error) alert('Gagal membatalkan: ' + error.message)
    else fetchInvoices()
  }

  const deleteInvoice = async (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Tagihan?",
      message: "Data tagihan akan dihapus permanen dari sistem (Soft-delete not applied). Lanjutkan?",
      action: async () => {
        const { error } = await db.from('saas_invoices').delete().eq('id', id)
        if (error) alert(error.message)
        else fetchInvoices()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  useEffect(() => {
    fetchOrganizations()
    fetchPackages()
    fetchInvoices()
    fetchAiTokenData()
    fetchAssessors()
  }, [])

  const togglePackageStatus = async (pkgId: string, currentStatus: boolean) => {
    setPackages(packages.map(p => p.id === pkgId ? { ...p, active: !p.active } : p))
    try {
       await db.from('saas_packages').update({ is_active: !currentStatus }).eq('id', pkgId)
    } catch (err) {}
  }

  const handleDeletePackage = (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Paket?",
      message: "Tindakan ini tidak dapat dibatalkan. Konfirmasi penghapusan paket SaaS?",
      action: async () => {
         const { error } = await db.from('saas_packages').delete().eq('id', id)
        if (error) {
           alert("Gagal menghapus paket: " + error.message)
        }
        await fetchPackages()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const savePackageForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const modules = Array.from(
        new Set(
          fd.getAll('modules')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      )
      const addons = Array.from(
        new Set(
          fd.getAll('addons')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      )
      const payload = {
        name: fd.get('name') as string,
        price: Number(fd.get('price')),
        billing: fd.get('billing') as string,
        is_active: true,
        modules: JSON.stringify(modules), // PostgREST requires stringified array for jsonb column
        addons: JSON.stringify(addons),
        duration_days: Number(fd.get('duration_days') || 30),
        max_orgs: Number(fd.get('max_orgs') || 1),
        max_warehouses: Number(fd.get('max_warehouses') || 1),
        max_branches: fd.get('max_branches') ? Number(fd.get('max_branches')) : null,
        max_child_orgs: fd.get('max_child_orgs') ? Number(fd.get('max_child_orgs')) : null,
        max_users: fd.get('max_users') ? Number(fd.get('max_users')) : null,
      }

      const { error } = pkgModal.editData?.id
        ? await (db.from('saas_packages').update(payload).eq('id', pkgModal.editData.id) as any)
        : await (db.from('saas_packages').upsert([payload], { onConflict: 'name' }) as any)

      if (error) throw error
      alert('✅ Paket Berhasil Disimpan!')
      setPkgModal({ open: false, editData: null })
      fetchPackages()
    } catch (err: any) {
      alert('❌ Gagal: ' + err.message)
    }
  }

  const saveOrgForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const selectedPlanName = String(fd.get('plan') || '').trim()
      const expiresVal = fd.get('expires_at') as string
      const expiresAt = toExpiryIsoFromDateInput(expiresVal)
      const currentSettings =
        orgModal.editData?.settings &&
        typeof orgModal.editData.settings === 'object' &&
        !Array.isArray(orgModal.editData.settings)
          ? orgModal.editData.settings
          : {}
      
      const payload = {
         name: fd.get('name'),
         is_active: fd.get('is_active') === 'on',
         is_demo: fd.get('is_demo') === 'on',
         owner_email: fd.get('owner_email'),
         subscription_end: expiresAt,
         settings: {
            ...currentSettings,
            plan: selectedPlanName,
            expires_at: expiresAt,
         }
      }

      if (orgModal.editData?.id) {
         await db.from('organizations').update(payload).eq('id', orgModal.editData.id)
      } else {
         const slug = (fd.get('name') as string).toLowerCase().replace(/ /g, '-') + '-' + Math.random().toString(36).substring(2,5)
         await db.from('organizations').insert([{ ...payload, slug }])
      }

      closeOrgModal()
      fetchOrganizations()
    } catch (err: any) {
       alert(err.message)
    }
  }

  const handleDeleteOrg = (org: Organization) => {
     if (!tenantDeleteMode) {
        alert('Aktifkan Mode Hapus Tenant Nonaktif terlebih dahulu.')
        return
     }

     if (org.is_active) {
        alert(`Tenant "${org.name}" masih aktif. Ubah status ke Suspended terlebih dahulu sebelum menghapus.`)
        return
     }

     setConfirmState({
        open: true,
        title: "Hapus Tenant?",
        message: `PERINGATAN: Tenant nonaktif "${org.name}" akan dihapus permanen beserta seluruh data terkait. Lanjutkan?`,
        action: async () => {
           setDeletingOrgId(org.id)
           try {
             const result = await deleteInactiveTenantByPlatformAdmin(org.id)
             if (result?.error) {
               alert(result.error)
             } else {
               await fetchOrganizations()
             }
           } finally {
             setDeletingOrgId(null)
             setConfirmState(prev => ({ ...prev, open: false }))
           }
        }
     })
  }

  const resetEntitlementModal = () => {
    setEntitlementModal({ open: false, org: null, selectedPlan: '', expiryDate: '', selectedModules: [], selectedAddons: [] })
    setEntitlementViewMode('all')
    setEntitlementFocusedModule(null)
  }

  const openEntitlementModal = (org: Organization, mode: 'all' | 'modules' | 'addons' = 'all') => {
    const currentPlan = String((org.settings as any)?.plan || '').trim()
    const fallbackPlan =
      packages.find((pkg) => pkg.name === currentPlan)?.name ||
      packages.find((pkg) => pkg.name === 'Demo')?.name ||
      packages[0]?.name ||
      currentPlan
    const selectedPackage = packages.find((pkg) => pkg.name === fallbackPlan) || null
    const packageModules = selectedPackage ? toCapabilityArray(selectedPackage.modules) : []
    const selectedAddons = normalizeActiveAddonEntries((org as any).active_addons).map((entry) => entry.name)
    const selectedModules = resolveManagedModulesForOrg(org, packageModules)
    const expiryDate =
      formatDateInputValue(resolveOrganizationExpiryDate(org as OrganizationExpirySource)) ||
      buildPlanExpiryDateInput(selectedPackage?.duration_days)

    setEntitlementViewMode(mode)
    setEntitlementModal({
      open: true,
      org,
      selectedPlan: fallbackPlan,
      expiryDate,
      selectedModules,
      selectedAddons,
    })
    setEntitlementFocusedModule(selectedModules[0] || null)
  }

  const handleEntitlementPlanChange = (nextPlan: string) => {
    const currentPackage = packages.find((pkg) => pkg.name === entitlementModal.selectedPlan) || null
    const selectedPackage = packages.find((pkg) => pkg.name === nextPlan) || null
    const packageModules = selectedPackage ? toCapabilityArray(selectedPackage.modules) : []
    const packageCoreFamilyLevel = resolvePackageCoreFamily(selectedPackage)
    const packageFallbackCore = packageCoreFamilyLevel === 'none' ? 'lite' : packageCoreFamilyLevel

    setEntitlementModal((prev) => {
      const nextModules =
        entitlementViewMode === 'addons'
          ? sanitizeModuleSelectionForCoreFamily(prev.selectedModules, packageFallbackCore)
          : sanitizeModuleSelectionForCoreFamily(packageModules, packageFallbackCore)
      const nextCoreFamily = deriveCoreFamilyFromModules(nextModules, packageFallbackCore)

      return {
        ...prev,
        selectedPlan: nextPlan,
        expiryDate: resolveNextExpiryDateInput(prev.expiryDate, currentPackage?.duration_days, selectedPackage?.duration_days),
        selectedModules: nextModules,
        selectedAddons: sanitizeAddonSelectionForCompatibility(prev.selectedAddons, nextModules, nextCoreFamily),
      }
    })
  }

  const toggleEntitlementModule = (name: string, checked: boolean) => {
    const normalizedName = normalizeSaasEntitlementName(name)
    if (!normalizedName) return

    setEntitlementModal((prev) => {
      const nextSet = new Set(prev.selectedModules)
      if (checked) {
        nextSet.add(normalizedName)
      } else {
        nextSet.delete(normalizedName)
      }

      const selectedPackage = packages.find((pkg) => pkg.name === prev.selectedPlan) || null
      const packageCoreFamilyLevel = resolvePackageCoreFamily(selectedPackage)
      const packageFallbackCore = packageCoreFamilyLevel === 'none' ? 'lite' : packageCoreFamilyLevel
      const nextModules = sanitizeModuleSelectionForCoreFamily([...nextSet], packageFallbackCore)
      const nextCoreFamily = deriveCoreFamilyFromModules(nextModules, packageFallbackCore)

      return {
        ...prev,
        selectedModules: nextModules,
        selectedAddons: sanitizeAddonSelectionForCompatibility(prev.selectedAddons, nextModules, nextCoreFamily),
      }
    })
  }

  const areCapabilitySetsEqual = (left: readonly string[], right: readonly string[]) => {
    const normalizedLeft = normalizeSaasEntitlementList([...left])
    const normalizedRight = normalizeSaasEntitlementList([...right])

    if (normalizedLeft.length !== normalizedRight.length) return false
    return normalizedLeft.every((capability) => normalizedRight.includes(capability))
  }

  const toggleEntitlementAddon = (name: string, checked: boolean) => {
    const normalizedName = normalizeSaasEntitlementName(name)
    if (!normalizedName) return

    setEntitlementModal((prev) => {
      const nextSet = new Set(prev.selectedAddons)
      if (checked) {
        nextSet.add(normalizedName)
      } else {
        nextSet.delete(normalizedName)
      }

      const selectedPackage = packages.find((pkg) => pkg.name === prev.selectedPlan) || null
      const packageCoreFamilyLevel = resolvePackageCoreFamily(selectedPackage)
      const packageFallbackCore = packageCoreFamilyLevel === 'none' ? 'lite' : packageCoreFamilyLevel
      const nextCoreFamily = deriveCoreFamilyFromModules(prev.selectedModules, packageFallbackCore)

      return {
        ...prev,
        selectedAddons: sanitizeAddonSelectionForCompatibility([...nextSet], prev.selectedModules, nextCoreFamily),
      }
    })
  }

  const handleEntitlementCoreFamilyChange = (nextCoreFamily: SaasCoreFamily) => {
    const nextPackage = findPreferredPackageForCoreFamily(nextCoreFamily, entitlementModal.selectedPlan)

    if (!nextPackage) {
      alert(`Belum ada plan yang kompatibel untuk ${getSaasCoreFamilyLabel(nextCoreFamily)}.`)
      return
    }

    const nextPackageModules = toCapabilityArray(nextPackage.modules)
    const currentPackage = packages.find((pkg) => pkg.name === entitlementModal.selectedPlan) || null

    setEntitlementModal((prev) => {
      const nextModules = sanitizeModuleSelectionForCoreFamily(
        [...nextPackageModules, ...prev.selectedModules],
        nextCoreFamily
      )

      return {
        ...prev,
        selectedPlan: nextPackage.name,
        expiryDate: resolveNextExpiryDateInput(prev.expiryDate, currentPackage?.duration_days, nextPackage?.duration_days),
        selectedModules: nextModules,
        selectedAddons: sanitizeAddonSelectionForCompatibility(prev.selectedAddons, nextModules, nextCoreFamily),
      }
    })
  }

  const saveTenantEntitlements = () => {
    if (!entitlementModal.org?.id) return

    const targetOrg = entitlementModal.org
    const selectedPackage = packages.find((pkg) => pkg.name === entitlementModal.selectedPlan) || null
    if (!selectedPackage) {
      alert('Paket tenant tidak ditemukan. Pilih paket yang valid terlebih dahulu.')
      return
    }

    const packageModules = toCapabilityArray(selectedPackage.modules)
    const selectedModules = normalizeSaasEntitlementList(entitlementModal.selectedModules)
    const currentSettings =
      targetOrg.settings &&
      typeof targetOrg.settings === 'object' &&
      !Array.isArray(targetOrg.settings)
        ? targetOrg.settings
        : {}
    const preservedModules =
      entitlementViewMode === 'addons'
        ? resolveManagedModulesForOrg(targetOrg, packageModules)
        : selectedModules
    const filteredAddons = normalizeSaasEntitlementList(entitlementModal.selectedAddons).filter(
      (capability) => !preservedModules.includes(capability)
    )
    const useCustomModules =
      entitlementViewMode === 'addons'
        ? currentSettings.use_custom_modules === true
        : !areCapabilitySetsEqual(selectedModules, packageModules)
    const expiresAt = toExpiryIsoFromDateInput(entitlementModal.expiryDate)

    startEntitlementTransition(async () => {
      const { error } = await db
        .from('organizations')
        .update({
          settings: {
            ...currentSettings,
            plan: selectedPackage.name,
            expires_at: expiresAt,
            use_custom_modules: useCustomModules,
            module_management_updated_at:
              entitlementViewMode === 'addons'
                ? currentSettings.module_management_updated_at || null
                : new Date().toISOString(),
          },
          subscription_end: expiresAt,
          enabled_modules:
            entitlementViewMode === 'addons'
              ? ((targetOrg as any).enabled_modules || null)
              : selectedModules,
          active_addons: buildActiveAddonPayload(filteredAddons, (targetOrg as any).active_addons, 'platform_admin_manual'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetOrg.id)

      if (error) {
        alert('❌ Gagal menyimpan entitlement tenant: ' + error.message)
        return
      }

      alert('✅ Module dan add-on tenant berhasil diperbarui.')
      resetEntitlementModal()
      await fetchOrganizations()
    })
  }

  const filteredOrgs = orgs.filter(o => {
     const matchesSearch = o.name.toLowerCase().includes(searchTxt.toLowerCase()) || (o as any).owner_email?.toLowerCase().includes(searchTxt.toLowerCase())
     const matchesType = typeFilter === 'all' ? true : (typeFilter === 'demo' ? (o as any).is_demo : !(o as any).is_demo)
     const matchesPkg = packageFilter === 'all' ? true : (o.settings as any)?.plan === packageFilter
     return matchesSearch && matchesType && matchesPkg
  })

  const allOrgById = new Map(orgs.map((org) => [org.id, org]))
  const childrenByParentId = new Map<string, Organization[]>()
  const collapsedParentOrgIdSet = new Set(collapsedParentOrgIds)

  orgs.forEach((org) => {
    const parentOrgId = String(org.parent_org_id || '').trim()
    if (!parentOrgId || !allOrgById.has(parentOrgId)) return

    const bucket = childrenByParentId.get(parentOrgId) || []
    bucket.push(org)
    childrenByParentId.set(parentOrgId, bucket)
  })

  const filteredOrgIds = new Set(filteredOrgs.map((org) => org.id))
  const hierarchicalFilteredOrgs: OrganizationHierarchyRow[] = []
  const visitedHierarchyOrgIds = new Set<string>()

  // Flatten the full organization tree while only rendering rows that match the current filters.
  const appendHierarchyRows = (
    org: Organization,
    depth: number,
    ancestorOrgIds: string[] = []
  ): number => {
    if (visitedHierarchyOrgIds.has(org.id)) return 0
    visitedHierarchyOrgIds.add(org.id)

    const parentOrgId = String(org.parent_org_id || '').trim()
    const parentOrg = parentOrgId ? allOrgById.get(parentOrgId) || null : null
    const directChildren = childrenByParentId.get(org.id) || []
    const isVisible = filteredOrgIds.has(org.id)
    const rowIndex = isVisible ? hierarchicalFilteredOrgs.length : -1

    if (isVisible) {
      hierarchicalFilteredOrgs.push({
        org,
        depth,
        parentOrg,
        ancestorOrgIds,
        visibleDescendantCount: 0,
      })
    }

    const nextAncestorOrgIds = isVisible ? [...ancestorOrgIds, org.id] : ancestorOrgIds
    let visibleDescendantCount = 0
    directChildren.forEach((child) => {
      visibleDescendantCount += appendHierarchyRows(child, depth + 1, nextAncestorOrgIds)
    })

    if (rowIndex >= 0) {
      hierarchicalFilteredOrgs[rowIndex].visibleDescendantCount = visibleDescendantCount
    }

    return (isVisible ? 1 : 0) + visibleDescendantCount
  }

  orgs
    .filter((org) => {
      const parentOrgId = String(org.parent_org_id || '').trim()
      return !parentOrgId || !allOrgById.has(parentOrgId)
    })
    .forEach((org) => appendHierarchyRows(org, 0))

  orgs.forEach((org) => {
    if (!visitedHierarchyOrgIds.has(org.id)) {
      appendHierarchyRows(org, 0)
    }
  })

  const visibleHierarchicalFilteredOrgs = hierarchicalFilteredOrgs.filter(
    (row) => !row.ancestorOrgIds.some((ancestorOrgId) =>
      filteredOrgIds.has(ancestorOrgId) && collapsedParentOrgIdSet.has(ancestorOrgId)
    )
  )
  const filteredActiveTenantCount = filteredOrgs.filter((org) => org.is_active).length
  const filteredDemoTenantCount = filteredOrgs.filter((org) => Boolean((org as any).is_demo)).length
  const filteredParentTenantCount = hierarchicalFilteredOrgs.filter((row) => row.visibleDescendantCount > 0).length
  const filteredAttentionTenantCount = filteredOrgs.filter((org) => {
    if (!org.is_active) return true
    const expiryDate = resolveOrganizationExpiryDate(org as OrganizationExpirySource)
    if (!expiryDate) return false
    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysRemaining <= 7
  }).length
  const hasVisibleTenantRows = visibleHierarchicalFilteredOrgs.length > 0

  const toggleParentRowCollapse = (orgId: string) => {
    setCollapsedParentOrgIds((current) =>
      current.includes(orgId)
        ? current.filter((id) => id !== orgId)
        : [...current, orgId]
    )
  }

  const buildCapabilityPreview = (
    items: readonly string[],
    emptyLabel: string,
    limit = 2
  ) => {
    const labels = normalizeSaasEntitlementList([...items]).map((capability) =>
      getSaasCapabilityDisplayLabel(capability)
    )

    if (labels.length === 0) return emptyLabel

    const preview = labels.slice(0, limit)
    const remaining = labels.length - preview.length

    return remaining > 0 ? `${preview.join(', ')} +${remaining}` : preview.join(', ')
  }

  const renderTenantTypeBadge = (isDemo: boolean) => {
    const Icon = isDemo ? Settings2 : CheckCircle2

    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold',
        isDemo
          ? 'border-orange-200 bg-orange-50 text-orange-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      )}>
        <Icon size={11} />
        {isDemo ? 'Demo' : 'Official'}
      </span>
    )
  }

  const renderOrganizationCell = (
    row: OrganizationHierarchyRow,
    variant: 'full' | 'compact' = 'full'
  ) => {
    const ownerEmail = String((row.org as any).owner_email || '').trim()
    const hasParent = Boolean(row.parentOrg)
    const isCollapsible = row.visibleDescendantCount > 0
    const isCollapsed = isCollapsible && collapsedParentOrgIdSet.has(row.org.id)
    const depthPadding = Math.min(row.depth, 4) * (variant === 'compact' ? 16 : 20)
    const hierarchySummary = row.parentOrg
      ? isCollapsible
        ? `Di bawah ${row.parentOrg.name} • ${row.visibleDescendantCount} child`
        : `Di bawah ${row.parentOrg.name}`
      : isCollapsible
        ? `Parent • ${row.visibleDescendantCount} child`
        : 'Tenant mandiri'

    return (
      <div className="min-w-0" style={depthPadding > 0 ? { paddingLeft: `${depthPadding}px` } : undefined}>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
            {isCollapsible ? (
              <button
                type="button"
                onClick={() => toggleParentRowCollapse(row.org.id)}
                aria-label={isCollapsed ? `Expand ${row.org.name}` : `Collapse ${row.org.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : hasParent ? (
              <span className="block h-px w-3 bg-slate-300" />
            ) : (
              <span className="block h-1.5 w-1.5 rounded-full bg-slate-300" />
            )}
          </div>

          <div className="min-w-0">
            <p className={cn(
              'truncate font-bold text-slate-900',
              variant === 'compact' ? 'text-sm' : 'text-[15px]'
            )}>
              {row.org.name}
            </p>

            <p className={cn(
              'mt-0.5 truncate text-slate-400',
              variant === 'compact' ? 'text-[10px]' : 'text-[11px]'
            )}>
              {hierarchySummary}
            </p>

            <p className={cn(
              'mt-1 flex min-w-0 items-center gap-1.5 text-slate-500',
              variant === 'compact' ? 'text-[10px]' : 'text-[11px]'
            )}>
              <Mail size={12} className="shrink-0" />
              <span className="truncate">{ownerEmail || 'No Email'}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const entitlementSelectedPackage = packages.find((pkg) => pkg.name === entitlementModal.selectedPlan) || null
  const orgModalSelectedPackage = packages.find((pkg) => pkg.name === orgModalPlanName) || null
  const entitlementPackageModules = entitlementSelectedPackage ? toCapabilityArray(entitlementSelectedPackage.modules) : []
  const entitlementPackageBlueprintAddons = entitlementSelectedPackage ? toCapabilityArray(entitlementSelectedPackage.addons) : []
  const entitlementManagedModules = normalizeSaasEntitlementList(entitlementModal.selectedModules)
  const entitlementUsesCustomModules = !areCapabilitySetsEqual(entitlementManagedModules, entitlementPackageModules)
  const entitlementPackageCoreFamilyLevel = resolvePackageCoreFamily(entitlementSelectedPackage)
  const entitlementFallbackCoreFamily =
    entitlementPackageCoreFamilyLevel === 'none' ? 'lite' : entitlementPackageCoreFamilyLevel
  const entitlementCurrentCoreFamily = deriveCoreFamilyFromModules(
    entitlementManagedModules,
    entitlementFallbackCoreFamily
  )
  const entitlementProvisioningModules = getSaasProvisioningModulesForCoreFamily(entitlementCurrentCoreFamily)
  const entitlementFocusedModuleDefinition = entitlementProvisioningModules.find((option) =>
    saasModuleMatches(option.value, entitlementFocusedModule || '')
  ) || null
  const entitlementBuilderAddons = entitlementFocusedModuleDefinition
    ? getSaasRelatedAddonsForModule(entitlementFocusedModuleDefinition.value, entitlementCurrentCoreFamily)
    : []
  const entitlementManualAddonsCount = normalizeSaasEntitlementList(entitlementModal.selectedAddons).filter(
    (capability) => !entitlementManagedModules.includes(capability)
  ).length
  const entitlementModalTitle =
    entitlementViewMode === 'modules'
      ? 'Module Management'
      : entitlementViewMode === 'addons'
        ? 'Add-on Management'
        : 'Provisioning Builder'
  const entitlementModalSubtitle =
    entitlementViewMode === 'modules'
      ? 'Kelola plan bundle dan module turunan tenant SaaS.'
      : entitlementViewMode === 'addons'
        ? 'Kelola entitlement add-on manual tenant SaaS.'
        : 'Flow setup tenant ala column browser: pilih core, aktifkan module, lalu pilih add-on yang kompatibel.'
  const getOrgEntitlementSnapshot = (org: Organization) => {
    const activePlanName = String((org.settings as any)?.plan || '').trim()
    const rowPackage = packages.find((pkg) => pkg.name === activePlanName) || null
    const rowPackageModules = rowPackage ? toCapabilityArray(rowPackage.modules) : []
    const rowBlueprintAddons = rowPackage ? toCapabilityArray(rowPackage.addons) : []
    const rowCustomModules = getOrgCustomEnabledModules(org)
    const useCustomModules = isOrgUsingCustomModules(org)
    const rowManagedModules = useCustomModules ? rowCustomModules : rowPackageModules
    const rowManualAddons = normalizeSaasEntitlementList(
      normalizeActiveAddonEntries((org as any).active_addons).map((entry) => entry.name)
    ).filter((capability) => !rowManagedModules.includes(capability))
    const rowArchitecture = rowManagedModules.length > 0
      ? getSaasPackageArchitecture(rowManagedModules, [])
      : null
    const rowFinalCapabilities = normalizeSaasEntitlementList([
      ...rowManagedModules,
      ...rowManualAddons,
    ])

    return {
      activePlanName,
      rowPackage,
      rowPackageModules,
      rowCustomModules,
      useCustomModules,
      rowManagedModules,
      rowBlueprintAddons,
      rowManualAddons,
      rowArchitecture,
      rowFinalCapabilities,
    }
  }

  useEffect(() => {
    if (!entitlementModal.open) return

    const nextFocusedModule =
      entitlementProvisioningModules.find((option) =>
        entitlementManagedModules.some((capability) => saasModuleMatches(capability, option.value))
      )?.value ||
      entitlementProvisioningModules[0]?.value ||
      null

    if (
      entitlementFocusedModule &&
      entitlementProvisioningModules.some((option) => saasModuleMatches(option.value, entitlementFocusedModule))
    ) {
      return
    }

    if (nextFocusedModule !== entitlementFocusedModule) {
      setEntitlementFocusedModule(nextFocusedModule)
    }
  }, [
    entitlementFocusedModule,
    entitlementManagedModules,
    entitlementModal.open,
    entitlementProvisioningModules,
  ])

  const entitlementUnknownSelectedAddons = normalizeSaasEntitlementList(entitlementModal.selectedAddons).filter((capability) => {
    const isKnown = SAAS_TENANT_ENTITLEMENT_SECTIONS.some((section) => (
      section.items.some((item) => saasModuleMatches(item.value, capability))
    ))
    return !isKnown
  })
  const entitlementFinalCapabilities = normalizeSaasEntitlementList([
    ...entitlementManagedModules,
    ...normalizeSaasEntitlementList(entitlementModal.selectedAddons).filter((capability) => !entitlementManagedModules.includes(capability)),
  ])

  const getAddonCompatibilityMessage = (addonValue: string) => {
    const addonRule = getSaasAddonCompatibilityOption(addonValue)
    if (!addonRule) return null

    if (!saasCoreFamilySatisfies(entitlementCurrentCoreFamily, addonRule.requiredCoreFamily)) {
      return `Butuh ${getSaasCoreFamilyLabel(addonRule.requiredCoreFamily)}.`
    }

    const missingModules = addonRule.requiredModules.filter((requiredModule) => (
      !entitlementManagedModules.some((capability) => saasModuleMatches(capability, requiredModule))
    ))
    if (missingModules.length > 0) {
      return `Aktifkan ${missingModules.map((item) => getSaasCapabilityDisplayLabel(item)).join(', ')} terlebih dahulu.`
    }

    const missingAddons = (addonRule.requiredAddons || []).filter((requiredAddon) => (
      !entitlementModal.selectedAddons.some((capability) => saasModuleMatches(capability, requiredAddon))
    ))
    if (missingAddons.length > 0) {
      return `Butuh ${missingAddons.map((item) => getSaasCapabilityDisplayLabel(item)).join(', ')} terlebih dahulu.`
    }

    return 'Compatible dengan konfigurasi tenant saat ini.'
  }

  const handleLoginAsTenant = (org: Organization) => {
    const ownerEmail = String((org as any).owner_email || '').trim()
    const confirmText = ownerEmail
      ? `Sesi admin saat ini akan diganti dengan sesi tenant ${org.name} (${ownerEmail}). Lanjutkan login as owner?`
      : `Sesi admin saat ini akan diganti dengan sesi tenant ${org.name}. Lanjutkan login as owner?`

    if (!window.confirm(confirmText)) {
      return
    }

    setLoginAsOrgId(org.id)
    startLoginAsTransition(async () => {
      const result = await signInAsTenantOwner(org.id)

      if (result?.error) {
        alert(result.error)
        setLoginAsOrgId(null)
      }
    })
  }

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4 italic uppercase">
               <ShieldCheck size={48} className="text-blue-600" /> Control Center
            </h1>
            <p className="text-slate-400 font-bold text-sm tracking-widest mt-1 uppercase">NIZAM SaaS Platform Administration</p>
         </div>
	         <div className="flex flex-wrap gap-3">
	            <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Tenants</button>
	            <button onClick={() => setActiveTab('module_management')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'module_management' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Manajemen Modul</button>
	            <button onClick={() => setActiveTab('addon_management')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'addon_management' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Manajemen Add-on</button>
	            <button onClick={() => setActiveTab('activity')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Activity</button>
	            <button onClick={() => setActiveTab('assessors')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'assessors' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Assessors</button>
	            <button onClick={() => setActiveTab('packages')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'packages' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>SaaS Plans</button>
	            <button onClick={() => setActiveTab('ai_tokens')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ai_tokens' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>AI Tokens</button>
	            <button onClick={() => setActiveTab('invoices')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'invoices' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Billing</button>
	            <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Settings</button>
	         </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
	          {activeTab === 'activity' && <UserActivityMonitor />}

	          {activeTab === 'assessors' && (
	            <div className="space-y-6">
	              <SectionCard>
	                <form onSubmit={saveAssessorForm} className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Email Member SaaS</label>
	                    <input
	                      name="email"
	                      type="email"
	                      required
	                      placeholder="assessor@executive.id"
	                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                    />
	                  </div>
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Nama Tampilan</label>
	                    <input
	                      name="display_name"
	                      placeholder="Nama assessor"
	                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                    />
	                  </div>
	                  <SafeButton type="submit" variant="primary" isLoading={assessorPending} loadingText="Menyimpan..." icon={<Plus size={16} />}>
	                    Add Assessor
	                  </SafeButton>
	                </form>
	              </SectionCard>

	              <SectionCard>
	                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
	                  <div>
	                    <h3 className="text-xl font-black tracking-tight text-slate-900">Assessor SaaS</h3>
	                    <p className="mt-1 text-xs font-bold text-slate-400">Akses panel assessor di tenant hanya membaca daftar ini.</p>
	                  </div>
	                  <button onClick={fetchAssessors} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
	                    <RefreshCw size={18} className={loadingAssessors ? 'animate-spin' : ''} />
	                  </button>
	                </div>

	                <div className="overflow-x-auto">
	                  <table className="w-full border-collapse">
	                    <thead>
	                      <tr className="border-b border-slate-100">
	                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Assessor</th>
	                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Dibuat</th>
	                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Status</th>
	                        <th className="text-right py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Aksi</th>
	                      </tr>
	                    </thead>
	                    <tbody className="divide-y divide-slate-50">
	                      {assessors.length === 0 && (
	                        <tr>
	                          <td colSpan={4} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
	                            {loadingAssessors ? 'Memuat assessor...' : 'Belum ada assessor SaaS.'}
	                          </td>
	                        </tr>
	                      )}
	                      {assessors.map((assessor) => (
	                        <tr key={assessor.id} className="hover:bg-slate-50/50 transition-colors">
	                          <td className="py-4 px-6">
	                            <p className="font-bold text-slate-900">{assessor.displayName || 'Assessor SaaS'}</p>
	                            <p className="text-[10px] text-blue-600 font-black flex items-center gap-1.5 mt-0.5">
	                              <Mail size={12} /> {assessor.email}
	                            </p>
	                          </td>
	                          <td className="py-4 px-6 text-xs font-bold text-slate-500">
	                            {assessor.createdAt
	                              ? new Date(assessor.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
	                              : '-'}
	                          </td>
	                          <td className="py-4 px-6">
	                            <StatusBadge variant={assessor.isActive ? 'success' : 'neutral'} label={assessor.isActive ? 'Aktif' : 'Nonaktif'} />
	                          </td>
	                          <td className="py-4 px-6 text-right">
	                            <div className="flex justify-end gap-2">
	                              <button
	                                onClick={() => toggleAssessorStatus(assessor.id, assessor.isActive)}
	                                disabled={assessorPending}
	                                title={assessor.isActive ? 'Nonaktifkan assessor' : 'Aktifkan assessor'}
	                                className={`p-2 rounded-xl transition-all disabled:opacity-50 ${assessor.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
	                              >
	                                {assessor.isActive ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
	                              </button>
	                              <button
	                                onClick={() => handleDeleteAssessor(assessor.id, assessor.email)}
	                                disabled={assessorPending}
	                                title="Hapus assessor"
	                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
	                              >
	                                <Trash2 size={18} />
	                              </button>
	                            </div>
	                          </td>
	                        </tr>
	                      ))}
	                    </tbody>
	                  </table>
	                </div>
	              </SectionCard>
	            </div>
	          )}

	          {activeTab === 'ai_tokens' && (
	            <div className="space-y-8">
	              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stok Provider</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{Number(aiTokenInventory?.total_stock_tokens || 0).toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Tenant Aktif</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{aiWalletSummary.totalBalance.toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stok Tersedia</p>
	                    <p className={`text-2xl font-black tracking-tight ${aiAvailableStock < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
	                      {aiAvailableStock.toLocaleString('id-ID')}
	                    </p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pemakaian Total</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{aiWalletSummary.totalUsed.toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	              </div>

	              <SectionCard>
	                <div className="p-6 space-y-6">
	                  <div>
	                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Konfigurasi Biaya & Pricing Token AI</h3>
	                    <p className="text-sm font-medium text-slate-500 mt-1">Atur input cost, overhead, margin, dan stok global token untuk kalkulasi HPP otomatis.</p>
	                  </div>
	                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Biaya Input / 1K (IDR)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.costPer1kInputIdr}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, cost_per_1k_input_idr: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Biaya Output / 1K (IDR)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.costPer1kOutputIdr}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, cost_per_1k_output_idr: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Input Tokens</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.avgInputTokens}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, avg_input_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Output Tokens</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.avgOutputTokens}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, avg_output_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Token / Generate</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.tokensPerGeneration}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, tokens_per_generation: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Overhead (%)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.overheadPercent}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, overhead_percent: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Margin (%)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.marginPercent}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, margin_percent: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Stok Token Global</label>
	                      <input
	                        type="number"
	                        value={Number(aiTokenInventory?.total_stock_tokens || 0)}
	                        onChange={(e) => setAiTokenInventory((prev: any) => ({ ...prev, total_stock_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">HPP / Generate</div>
	                      <div className="mt-1 text-lg font-black text-slate-900">Rp {Math.ceil(aiHppPerGenerate).toLocaleString('id-ID')}</div>
	                    </div>
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rekomendasi / Generate</div>
	                      <div className="mt-1 text-lg font-black text-emerald-700">Rp {Math.ceil(aiRecommendedPerGenerate).toLocaleString('id-ID')}</div>
	                    </div>
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rekomendasi / 1K Token</div>
	                      <div className="mt-1 text-lg font-black text-indigo-700">Rp {Math.ceil(aiRecommendedPer1kToken).toLocaleString('id-ID')}</div>
	                    </div>
	                  </div>

	                  <div className="flex justify-end">
	                    <SafeButton variant="primary" onClick={saveAiTokenConfig} icon={<Coins size={16} />}>
	                      Simpan Konfigurasi Token AI
	                    </SafeButton>
	                  </div>
	                </div>
	              </SectionCard>

	              <SectionCard>
	                <div className="p-6 space-y-5">
	                  <div className="flex items-center justify-between gap-4">
	                    <div>
	                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Paket Top Up Token AI</h3>
	                      <p className="text-sm font-medium text-slate-500 mt-1">Kelola paket yang akan tampil di halaman billing tenant.</p>
	                    </div>
	                    <SafeButton variant="primary" onClick={() => setAiTopupModal({ open: true, editData: null })} icon={<Plus size={16} />}>
	                      Tambah Paket Token
	                    </SafeButton>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
	                    {aiTopupPackages.map((pkg) => (
	                      <div key={pkg.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
	                        <div className="flex items-center justify-between gap-3">
	                          <div className="text-sm font-black text-slate-900">{pkg.name}</div>
	                          <button
	                            onClick={() => toggleAiTopupStatus(pkg.id, Boolean(pkg.is_active))}
	                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pkg.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
	                          >
	                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
	                          </button>
	                        </div>
	                        <div className="mt-4 text-3xl font-black tracking-tighter text-slate-900">{Number(pkg.tokens || 0).toLocaleString('id-ID')}</div>
	                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Token</div>
	                        <div className="mt-3 text-xs font-bold text-slate-500">{pkg.description || '-'}</div>
	                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
	                          <div>
	                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sell Price</div>
	                            <div className="text-sm font-black text-slate-900">Rp {Number(pkg.price_idr || 0).toLocaleString('id-ID')}</div>
	                          </div>
	                          <div className="flex gap-2">
	                            <button onClick={() => setAiTopupModal({ open: true, editData: pkg })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
	                              <Edit3 size={16} />
	                            </button>
	                            <button onClick={() => handleDeleteAiTopupPackage(pkg.id, pkg.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
	                              <Trash2 size={16} />
	                            </button>
	                          </div>
	                        </div>
	                      </div>
	                    ))}
	                  </div>
	                </div>
	              </SectionCard>
	            </div>
	          )}

	          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-8">
               <SectionHeader title="SaaS Platform Settings" subtitle="Konfigurasi rekening bank & bantuan WA secara global." />
               <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard>
                    <div className="p-6 space-y-4">
                       <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-indigo-600 border-b pb-3 mb-4">
                          <Building2 size={18} /> Bank Info (Main Account)
                       </h4>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nama Bank</label>
                             <input name="bank_name" defaultValue={saasSettings.bank_info?.bank} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nomor Rekening</label>
                             <input name="bank_acc" defaultValue={saasSettings.bank_info?.account} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-mono text-lg font-black tracking-widest" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Atas Nama (Pemilik)</label>
                             <input name="bank_user" defaultValue={saasSettings.bank_info?.name} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                       </div>
                    </div>
                  </SectionCard>

                  <SectionCard>
                    <div className="p-6 space-y-4">
                       <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-600 border-b pb-3 mb-4">
                          <Mail size={18} /> Support Contacts
                       </h4>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp (62xxx)</label>
                             <input name="wa_num" defaultValue={saasSettings.support_info?.wa} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Label / Nama CS</label>
                             <input name="wa_label" defaultValue={saasSettings.support_info?.label} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div className="pt-6">
                            <SafeButton type="submit" variant="primary" size="lg" className="w-full">Simpan Pengaturan</SafeButton>
                          </div>
                       </div>
                    </div>
                  </SectionCard>
               </form>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
                <SectionCard className="relative overflow-hidden border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_46%,#eef6ff_100%)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent" />
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-100/70 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-blue-50 blur-2xl" />
                  <div className="relative p-7 md:p-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                      <ShieldCheck size={12} className="text-sky-500" />
                      Tenant Workspace
                    </div>
                    <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-slate-900">
                      Kelola tenant dengan tampilan yang lebih bersih dan modern.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                      Parent-child, status, paket, dan masa berlaku tenant ditata ulang agar lebih cepat dipindai saat jumlah tenant mulai bertambah.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <SafeButton variant="primary" onClick={() => openOrgModal(null)} icon={<Plus size={18} />}>
                        Registrasi Tenant Baru
                      </SafeButton>
                      <SafeButton
                        variant={tenantDeleteMode ? 'danger' : 'white'}
                        onClick={() => setTenantDeleteMode(prev => !prev)}
                        icon={tenantDeleteMode ? <X size={18} /> : <Trash2 size={18} />}
                      >
                        {tenantDeleteMode ? 'Keluar Mode Hapus' : 'Mode Hapus Tenant Nonaktif'}
                      </SafeButton>
                      <button
                        onClick={fetchOrganizations}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition-all hover:bg-white hover:text-slate-800"
                        title="Refresh data tenant"
                      >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: 'Tenant Terlihat',
                      value: filteredOrgs.length,
                      note: 'Hasil filter saat ini',
                      icon: Users,
                      tone: 'from-sky-50 to-white text-sky-600',
                    },
                    {
                      label: 'Tenant Aktif',
                      value: filteredActiveTenantCount,
                      note: 'Berstatus running',
                      icon: CheckCircle2,
                      tone: 'from-emerald-50 to-white text-emerald-600',
                    },
                    {
                      label: 'Parent Tenant',
                      value: filteredParentTenantCount,
                      note: 'Memiliki child tenant',
                      icon: Building2,
                      tone: 'from-indigo-50 to-white text-indigo-600',
                    },
                    {
                      label: 'Perlu Perhatian',
                      value: filteredAttentionTenantCount,
                      note: 'Suspended atau hampir habis',
                      icon: Zap,
                      tone: 'from-amber-50 to-white text-amber-600',
                    },
                  ].map((item) => {
                    const StatIcon = item.icon
                    return (
                      <SectionCard
                        key={item.label}
                        className={`border-slate-200/80 bg-gradient-to-br ${item.tone} shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]`}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {item.label}
                              </p>
                              <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                                {item.value}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-500">
                                {item.note}
                              </p>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/80 shadow-sm">
                              <StatIcon size={18} className="shrink-0" />
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    )
                  })}
                </div>
              </div>

              <SectionCard glass className="border-slate-200/80 bg-white/80 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.18)]">
                <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      value={searchTxt}
                      onChange={(e) => setSearchTxt(e.target.value)}
                      placeholder="Cari tenant atau email pemilik..."
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 py-3.5 pl-12 pr-4 font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-100/70"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe Akun</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-100/70"
                    >
                      <option value="all">Semua Tipe</option>
                      <option value="official">Resmi / Produksi</option>
                      <option value="demo">Demo / Latihan</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Filter Paket</label>
                    <select
                      value={packageFilter}
                      onChange={(e) => setPackageFilter(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-100/70"
                    >
                      <option value="all">Semua Paket</option>
                      {packages.map((p) => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {tenantDeleteMode && (
                <div className="rounded-[26px] border border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fff7f7_100%)] px-5 py-4 text-xs font-bold text-rose-700 shadow-[0_18px_35px_-28px_rgba(225,29,72,0.55)]">
                  Mode hapus aktif: hanya tenant berstatus <span className="font-black">Suspended</span> yang dapat dihapus.
                </div>
              )}

              <SectionCard className="border-slate-200/80 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.16)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(255,255,255,0.9)_100%)] px-6 py-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tenant Overview</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Daftar tenant yang sedang Anda pantau</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {filteredOrgs.length} tenant cocok dengan filter • {visibleHierarchicalFilteredOrgs.length} baris terlihat pada struktur saat ini
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Hierarchy</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      Chevron parent akan membuka dan menutup child tenant.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Organisasi / Pemilik</th>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Tipe</th>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Paket / Entitlement</th>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Masa Berlaku</th>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Status</th>
                        <th className="sticky top-0 z-10 border-b border-slate-100 bg-white/92 px-6 py-4 text-right text-[11px] font-black uppercase tracking-widest text-slate-400 backdrop-blur">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {!hasVisibleTenantRows && (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center">
                              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-400 shadow-sm">
                                <Search size={20} />
                              </div>
                              <h4 className="mt-4 text-lg font-black text-slate-900">Belum ada tenant yang cocok</h4>
                              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                                Coba longgarkan kata kunci pencarian atau ubah filter tipe dan paket untuk melihat tenant lain.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {visibleHierarchicalFilteredOrgs.map((row) => {
                        const org = row.org
                        const expiryDate = resolveOrganizationExpiryDate(org as OrganizationExpirySource)
                        const expiryTime = expiryDate?.getTime() ?? null
                        const daysRemaining = expiryTime
                          ? Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24))
                          : null
                        const expiryLabel =
                          expiryDate && expiryTime !== null && daysRemaining !== null
                            ? daysRemaining < 0
                              ? `Expired ${Math.abs(daysRemaining)} hari`
                              : daysRemaining === 0
                                ? 'Berakhir hari ini'
                                : `${daysRemaining} hari lagi`
                            : 'Unlimited'
                        const expiryToneClass =
                          expiryDate && expiryTime !== null && daysRemaining !== null
                            ? daysRemaining < 0
                              ? 'text-rose-600'
                              : daysRemaining <= 7
                                ? 'text-orange-500'
                                : 'text-slate-800'
                            : 'text-slate-700'
                        const {
                          activePlanName,
                          rowManagedModules,
                          rowManualAddons,
                          rowArchitecture,
                          rowFinalCapabilities,
                          useCustomModules,
                        } = getOrgEntitlementSnapshot(org)

                        return (
                          <tr key={org.id} className="align-top transition-colors hover:bg-sky-50/30">
                          <td className="px-6 py-5">
                            {renderOrganizationCell(row, 'full')}
                          </td>
                          <td className="px-6 py-5">
                            {renderTenantTypeBadge(Boolean((org as any).is_demo))}
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-800">
                                {activePlanName || 'Belum dipilih'}
                              </p>
                              <p className="text-[11px] font-medium text-slate-500">
                                {rowArchitecture?.bundleLabel || 'Custom / Unknown'} • {rowManagedModules.length} modul • {rowManualAddons.length} add-on
                              </p>
                              <p className="text-[10px] font-medium text-slate-400">
                                {useCustomModules ? 'Custom modules aktif' : 'Ikuti konfigurasi plan'} • total {rowFinalCapabilities.length} capability
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-0.5">
                              <p className={cn('text-xs font-black tabular-nums', expiryToneClass)}>
                                {expiryLabel}
                              </p>
                              <p className="text-[10px] font-medium text-slate-400">
                                {expiryDate
                                  ? expiryDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : 'Tanpa batas waktu'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <StatusBadge variant={org.is_active ? 'success' : 'neutral'} label={org.is_active ? 'Running' : 'Suspended'} />
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEntitlementModal(org, 'all')}
                                title="Kelola paket dan entitlement tenant"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50"
                              >
                                <Package size={14} />
                                <span>Kelola</span>
                              </button>
                              <button
                                onClick={() => handleLoginAsTenant(org)}
                                disabled={loginAsPending}
                                title="Login sebagai owner tenant ini"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                              >
                                {loginAsPending && loginAsOrgId === org.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <LogIn size={14} />
                                )}
                                <span>Masuk</span>
                              </button>
                              <button onClick={() => openOrgModal(org)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700">
                                 <Edit3 size={16} />
                              </button>
                              {tenantDeleteMode && (
                                <button
                                  onClick={() => handleDeleteOrg(org)}
                                  disabled={org.is_active || deletingOrgId === org.id}
                                  title={org.is_active ? 'Hanya tenant Suspended yang bisa dihapus.' : 'Hapus tenant nonaktif'}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-400"
                                >
                                  {deletingOrgId === org.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                </button>
                              )}
                            </div>
                          </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'module_management' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={searchTxt}
                    onChange={(e) => setSearchTxt(e.target.value)}
                    placeholder="Cari tenant untuk manajemen modul..."
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Tipe Akun</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="official">Resmi / Produksi</option>
                    <option value="demo">Demo / Latihan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Filter Paket</label>
                  <select
                    value={packageFilter}
                    onChange={(e) => setPackageFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="all">Semua Paket</option>
                    {packages.map((p) => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">Manajemen Modul</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Kelola bundle plan dan module aktif tenant dari tab khusus ini.
                  </p>
                </div>
                <button onClick={fetchOrganizations} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <SectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Tenant</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Plan Aktif</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Core Family</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Module Plan</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Total Capability</th>
                        <th className="text-right py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visibleHierarchicalFilteredOrgs.map((row) => {
                        const org = row.org
                        const {
                          activePlanName,
                          rowManagedModules,
                          rowArchitecture,
                          rowFinalCapabilities,
                          useCustomModules,
                        } = getOrgEntitlementSnapshot(org)

                        return (
                          <tr key={`module-mgmt-${org.id}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              {renderOrganizationCell(row, 'compact')}
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-slate-700">{activePlanName || 'Belum Dipilih'}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800">
                                  {rowArchitecture?.bundleLabel || 'Custom / Unknown'}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400">
                                  {useCustomModules ? 'Custom modules aktif' : 'Ikuti plan default'}
                                </p>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <p className="text-xs font-medium leading-5 text-slate-500">
                                {buildCapabilityPreview(rowManagedModules, 'Belum ada modul aktif.')}
                              </p>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-slate-900">{rowFinalCapabilities.length}</span>
                              <span className="ml-1 text-[10px] font-medium text-slate-400">capability</span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openEntitlementModal(org, 'all')}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition-all hover:bg-slate-50"
                                >
                                  <Package size={14} />
                                  <span>Kelola</span>
                                </button>
                                <SafeButton variant="white" onClick={() => openEntitlementModal(org, 'all')} icon={<Package size={16} />}>
                                  Atur Modul
                                </SafeButton>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'addon_management' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={searchTxt}
                    onChange={(e) => setSearchTxt(e.target.value)}
                    placeholder="Cari tenant untuk manajemen add-on..."
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Tipe Akun</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="official">Resmi / Produksi</option>
                    <option value="demo">Demo / Latihan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Filter Paket</label>
                  <select
                    value={packageFilter}
                    onChange={(e) => setPackageFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="all">Semua Paket</option>
                    {packages.map((p) => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">Manajemen Add-on</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Kelola entitlement add-on manual tenant tanpa mencampurinya dengan module bawaan plan.
                  </p>
                </div>
                <button onClick={fetchOrganizations} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <SectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Tenant</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Plan Aktif</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Add-on Manual</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Blueprint</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Total Capability</th>
                        <th className="text-right py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visibleHierarchicalFilteredOrgs.map((row) => {
                        const org = row.org
                        const {
                          activePlanName,
                          rowBlueprintAddons,
                          rowManualAddons,
                          rowFinalCapabilities,
                        } = getOrgEntitlementSnapshot(org)

                        return (
                          <tr key={`addon-mgmt-${org.id}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              {renderOrganizationCell(row, 'compact')}
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-slate-700">{activePlanName || 'Belum Dipilih'}</span>
                            </td>
                            <td className="py-4 px-6">
                              <p className="text-xs font-medium leading-5 text-slate-500">
                                {buildCapabilityPreview(rowManualAddons, 'Belum ada add-on manual.')}
                              </p>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-slate-700">{rowBlueprintAddons.length}</span>
                              <span className="ml-1 text-[10px] font-medium text-slate-400">blueprint</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-slate-900">{rowFinalCapabilities.length}</span>
                              <span className="ml-1 text-[10px] font-medium text-slate-400">capability</span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openEntitlementModal(org, 'all')}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition-all hover:bg-slate-50"
                                >
                                  <Package size={14} />
                                  <span>Kelola</span>
                                </button>
                                <SafeButton variant="white" onClick={() => openEntitlementModal(org, 'all')} icon={<Package size={16} />}>
                                  Atur Add-on
                                </SafeButton>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <p className="text-sm font-bold text-slate-500 italic">Daftar Paket SaaS Aktif</p>
                 <SafeButton variant="primary" onClick={() => setPkgModal({ open: true, editData: null })} icon={<Plus size={16} />}>Tambah Paket Baru</SafeButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {packages.map((pkg) => {
                    const architecture = getSaasPackageArchitecture(pkg.modules || [], [])
                    const blueprintAddons = toCapabilityArray(pkg.addons)
                    const totalCoreItems = architecture.liteCore.length + architecture.starterCore.length
                    return (
                    <div key={pkg.id || pkg.name} className={`
                      relative p-6 rounded-[32px] border transition-all duration-300 shadow-sm flex flex-col justify-between
                      ${pkg.active ? 'bg-white border-slate-200 hover:shadow-xl hover:-translate-y-1' : 'bg-slate-50/50 border-slate-200 opacity-75 grayscale-[30%]'}
                    `}>
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase border shadow-sm ${pkg.active ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                            {pkg.name}
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => setPkgModal({ open: true, editData: pkg })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit3 size={16} />
                             </button>
                             <button onClick={() => handleDeletePackage(pkg.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>

                        <div className="mb-6 space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black font-mono text-slate-900 tracking-tighter">
                              {pkg.price === 0 ? `Free` : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                            </span>
                            {pkg.price > 0 && <span className="text-xs text-slate-400 font-bold">/{pkg.billing}</span>}
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                            {architecture.bundleLabel}
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-wider ${pkg.price === 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            Batas: {pkg.duration_days ?? '?'} Hari
                          </p>
                        </div>

                        <div className="space-y-4 mb-4">
                           <div className="flex flex-wrap gap-1.5">
                              {pkg.modules?.slice(0, 4).map((mod: string) => (
                                 <span key={mod} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                   {getSaasCapabilityDisplayLabel(mod)}
                                 </span>
                              ))}
                              {pkg.modules?.length > 4 && <span className="text-[9px] font-bold text-slate-400">+{pkg.modules.length - 4} more</span>}
                           </div>
                           <p className="text-[10px] font-semibold text-slate-400">
                             Platform Core + {totalCoreItems} core item
                             {architecture.fullCoreExtensions.length > 0 ? ` + ${architecture.fullCoreExtensions.length} full core` : ''}
                             {architecture.verticalModules.length > 0 ? ` + ${architecture.verticalModules.length} vertical module` : ''}
                           </p>
                           <p className="text-[10px] font-semibold text-emerald-600">
                             Blueprint Add-on: {blueprintAddons.length}
                           </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Status</span>
                         <button
                            onClick={() => togglePackageStatus(pkg.id, pkg.active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pkg.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                         >
                           <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.active ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                      </div>
                    </div>
                    )
                 })}
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                     <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="px-8 py-5">Tanggal</th>
                        <th className="px-8 py-5">Tenant / Bisnis</th>
                        <th className="px-8 py-5">Paket / Add-on</th>
                        <th className="px-8 py-5 text-right">Nominal</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-8 py-5 text-xs font-bold text-slate-500">
                              {new Date(inv.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </td>
                           <td className="px-8 py-5">
                              <p className="text-sm font-black text-slate-900">{inv.organization?.name || 'Unknown'}</p>
                              <code className="text-[9px] text-slate-400 font-mono">#{inv.invoice_number}</code>
                           </td>
                           <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 italic">
                                 {inv.item_name || inv.package?.name || 'Nizam Package'}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">
                              Rp {inv.amount?.toLocaleString('id-ID')}
                           </td>
                           <td className="px-8 py-5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                 <StatusBadge label={inv.status} variant={inv.status === 'PAID' ? 'success' : 'warning'} />
                                 {inv.payment_proof_url && (
                                    <a href={inv.payment_proof_url} target="_blank" className="text-[9px] font-black text-blue-600 hover:underline uppercase flex items-center gap-1">
                                       <ExternalLink size={10} /> Lihat Bukti
                                    </a>
                                 )}
                              </div>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                    <button 
                                       onClick={() => approveInvoice(inv)} 
                                       className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                                    >
                                       Konfirmasi
                                    </button>
                                 )}
                                 
                                 {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                    <button 
                                       onClick={() => cancelInvoice(inv.id)} 
                                       title="Batalkan Invoice"
                                       className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                                    >
                                       <XCircle size={18} />
                                    </button>
                                 )}

                                 <button 
                                    onClick={() => deleteInvoice(inv.id)} 
                                    title="Hapus Permanen"
                                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                 >
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* TENANT ENTITLEMENT MODAL */}
      <AnimatePresence>
        {entitlementModal.open && (
          <div key="entitlement-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="entitlement-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetEntitlementModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              key="entitlement-modal-content"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className={`relative w-full rounded-[40px] border border-white bg-white p-8 shadow-2xl ${
                entitlementViewMode === 'all' ? 'max-w-7xl' : 'max-w-4xl'
              }`}
            >
              <div className="flex items-start justify-between gap-6 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                    {entitlementModalTitle}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {entitlementModalSubtitle}
                  </p>
                </div>
                <button
                  onClick={resetEntitlementModal}
                  className="rounded-2xl border border-slate-200 p-3 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 max-h-[72vh] space-y-6 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tenant</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{entitlementModal.org?.name || 'Tenant'}</div>
                    <div className="mt-1 text-xs font-bold text-blue-600">{String((entitlementModal.org as any)?.owner_email || '')}</div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plan / Bundle Aktif</label>
                    <select
                      value={entitlementModal.selectedPlan}
                      onChange={(e) => handleEntitlementPlanChange(e.target.value)}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900"
                    >
                      {!packages.length && <option value="">Belum ada paket SaaS</option>}
                      {packages.map((pkg) => (
                        <option key={pkg.id || pkg.name} value={pkg.name}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      {entitlementViewMode === 'modules'
                        ? 'Pilih plan dasar, lalu sesuaikan module tenant secara manual bila diperlukan.'
                        : entitlementViewMode === 'addons'
                          ? 'Module aktif tenant tetap mengikuti entitlement saat ini.'
                          : 'Saat core diganti, builder akan memilih plan yang paling kompatibel secara otomatis.'}
                    </p>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Masa Berlaku Manual</label>
                          <div className="flex flex-wrap gap-1">
                            {[3, 5, 30].map((days) => (
                              <button
                                key={`entitlement-expiry-${days}`}
                                type="button"
                                onClick={() => {
                                  const nextDate = new Date()
                                  nextDate.setDate(nextDate.getDate() + days)
                                  setEntitlementModal((prev) => ({ ...prev, expiryDate: formatDateInputValue(nextDate) }))
                                }}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-black text-slate-600 transition-colors hover:bg-indigo-600 hover:text-white"
                              >
                                +{days} Hari
                              </button>
                            ))}
                            {typeof entitlementSelectedPackage?.duration_days === 'number' && entitlementSelectedPackage.duration_days > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEntitlementModal((prev) => ({
                                    ...prev,
                                    expiryDate: buildPlanExpiryDateInput(entitlementSelectedPackage.duration_days),
                                  }))
                                }
                                className="rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] font-black text-indigo-700 transition-colors hover:bg-indigo-600 hover:text-white"
                              >
                                Paket ({entitlementSelectedPackage.duration_days}H)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEntitlementModal((prev) => ({ ...prev, expiryDate: '' }))}
                              className="rounded bg-rose-50 px-1.5 py-0.5 text-[8px] font-black text-rose-700 transition-colors hover:bg-rose-600 hover:text-white"
                            >
                              Unlimited
                            </button>
                          </div>
                        </div>
                        <input
                          type="date"
                          value={entitlementModal.expiryDate}
                          onChange={(e) => setEntitlementModal((prev) => ({ ...prev, expiryDate: e.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900"
                        />
                        <p className="text-[11px] font-semibold text-slate-500">
                          Kosongkan tanggal jika tenant ini harus aktif tanpa batas waktu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {entitlementSelectedPackage ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Core Family</div>
                        <div className="mt-2 text-lg font-black text-slate-900">
                          {getSaasPackageArchitecture(entitlementSelectedPackage.modules || [], []).bundleLabel}
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-slate-500">
                          Harga Rp {Number(entitlementSelectedPackage.price || 0).toLocaleString('id-ID')} / {entitlementSelectedPackage.billing}
                        </p>
                      </div>

                      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Module Dari Plan</div>
                        <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                          {entitlementPackageModules.length}
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-slate-500">
                          Capability dasar yang langsung aktif lewat bundle.
                        </p>
                      </div>

                      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {entitlementViewMode === 'modules'
                            ? 'Module Tersetel'
                            : entitlementViewMode === 'addons'
                              ? 'Add-on Aktif Manual'
                              : 'Entitlement Tersetel'}
                        </div>
                        <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                          {entitlementViewMode === 'modules'
                            ? entitlementManagedModules.length
                            : entitlementViewMode === 'all'
                              ? entitlementManagedModules.length + entitlementManualAddonsCount
                            : entitlementManualAddonsCount}
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-slate-500">
                          {entitlementViewMode === 'modules'
                            ? (entitlementUsesCustomModules ? 'Tenant memakai custom module override.' : 'Tenant masih mengikuti module bawaan plan.')
                            : entitlementViewMode === 'addons'
                              ? 'Entitlement tambahan di luar module bawaan plan.'
                              : 'Gabungan module aktif tenant dan add-on manual yang lolos compatibility guard.'}
                        </p>
                      </div>
                    </div>

                    {entitlementViewMode === 'all' && (
                      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
                          <div>
                            <h3 className="text-lg font-black text-slate-900">Provisioning Flow</h3>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              Pilih core family, aktifkan module yang diinginkan, lalu pilih add-on yang kompatibel dengan module fokus.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                              Compatibility Guard Aktif
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                              Focus: {entitlementFocusedModuleDefinition?.label || 'Belum Dipilih'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr_1.25fr_0.95fr]">
                          <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">1. Core</h4>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">Core menentukan baseline compatibility tenant.</p>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">3 opsi</span>
                            </div>
                            <div className="mt-4 space-y-3">
                              {(['lite', 'starter', 'full'] as SaasCoreFamily[]).map((coreFamily) => {
                                const isSelected = entitlementCurrentCoreFamily === coreFamily
                                const compatiblePlan = findPreferredPackageForCoreFamily(coreFamily, entitlementModal.selectedPlan)

                                return (
                                  <button
                                    key={`core-family-${coreFamily}`}
                                    type="button"
                                    onClick={() => handleEntitlementCoreFamilyChange(coreFamily)}
                                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                                      isSelected
                                        ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                        : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                                          {getSaasCoreFamilyLabel(coreFamily)}
                                        </div>
                                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                          {coreFamily === 'lite'
                                            ? 'Revenue basic dan operasional paling ringan.'
                                            : coreFamily === 'starter'
                                              ? 'Tambah accounting, finance, inventory, dan purchasing.'
                                              : 'Tambah HRIS, manufacturing, dan audit.'}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                                          Active
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-3 text-[10px] font-bold text-slate-400">
                                      {compatiblePlan ? `Plan default: ${compatiblePlan.name}` : 'Belum ada plan kompatibel'}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">2. Modules</h4>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">Klik module untuk memfokuskan daftar add-on di kolom sebelah.</p>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {entitlementProvisioningModules.length} opsi
                              </span>
                            </div>
                            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                              {entitlementProvisioningModules.map((option) => {
                                const isSelected = entitlementManagedModules.some((capability) => saasModuleMatches(capability, option.value))
                                const isPlanDefault = entitlementPackageModules.some((capability) => saasModuleMatches(capability, option.value))
                                const isFocused = entitlementFocusedModuleDefinition
                                  ? saasModuleMatches(entitlementFocusedModuleDefinition.value, option.value)
                                  : false

                                return (
                                  <label
                                    key={`builder-module-${option.value}`}
                                    className={`block rounded-[24px] border px-4 py-4 transition-all ${
                                      isFocused
                                        ? 'border-indigo-300 bg-indigo-50/80 shadow-sm'
                                        : isSelected
                                          ? 'border-slate-300 bg-slate-50'
                                          : 'border-slate-200 bg-white hover:border-indigo-200'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => toggleEntitlementModule(option.value, e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEntitlementFocusedModule(option.value)}
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                                              {option.label}
                                            </div>
                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                              {option.description}
                                            </p>
                                          </div>
                                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                            {option.sectionTitle}
                                          </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                          {isSelected && (
                                            <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                                              Active
                                            </span>
                                          )}
                                          {isPlanDefault && (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                              Plan Default
                                            </span>
                                          )}
                                          {isFocused && (
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                                              Focus
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">3. Add-ons</h4>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                  Add-on difilter dari module yang sedang di-focus dan divalidasi otomatis.
                                </p>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {entitlementBuilderAddons.length} opsi
                              </span>
                            </div>
                            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                              {entitlementFocusedModuleDefinition ? (
                                entitlementBuilderAddons.map((option) => {
                                  const isSelected = entitlementModal.selectedAddons.some((capability) => saasModuleMatches(capability, option.value))
                                  const isBlueprintOption = entitlementPackageBlueprintAddons.some((capability) => saasModuleMatches(capability, option.value))
                                  const isCompatible = isSaasAddonCompatible(
                                    option.value,
                                    entitlementManagedModules,
                                    entitlementCurrentCoreFamily,
                                    entitlementModal.selectedAddons
                                  )
                                  const compatibilityMessage = getAddonCompatibilityMessage(option.value)

                                  return (
                                    <label
                                      key={`builder-addon-${option.value}`}
                                      className={`block rounded-[24px] border px-4 py-4 transition-all ${
                                        isCompatible
                                          ? isSelected
                                            ? 'border-emerald-200 bg-emerald-50/80 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-emerald-200'
                                          : 'border-slate-200 bg-slate-50 opacity-70'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={!isCompatible}
                                          onChange={(e) => toggleEntitlementAddon(option.value, e.target.checked)}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                                            {option.label}
                                          </div>
                                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                            {option.description}
                                          </p>
                                          <div className="mt-3 flex flex-wrap gap-1.5">
                                            {isSelected && (
                                              <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                                                Active Manual
                                              </span>
                                            )}
                                            {isBlueprintOption && (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                                Blueprint
                                              </span>
                                            )}
                                            {option.global && (
                                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                                                Global
                                              </span>
                                            )}
                                          </div>
                                          <p className={`mt-3 text-[11px] font-semibold ${isCompatible ? 'text-slate-500' : 'text-amber-700'}`}>
                                            {compatibilityMessage}
                                          </p>
                                        </div>
                                      </div>
                                    </label>
                                  )
                                })
                              ) : (
                                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                                  Pilih atau fokuskan satu module dulu untuk melihat add-on yang relevan.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">4. Summary</h4>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">Snapshot konfigurasi tenant sebelum disimpan.</p>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Live</span>
                            </div>
                            <div className="mt-4 space-y-3">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Core</div>
                                <div className="mt-1 text-sm font-black text-slate-900">{getSaasCoreFamilyLabel(entitlementCurrentCoreFamily)}</div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Plan</div>
                                <div className="mt-1 text-sm font-black text-slate-900">{entitlementModal.selectedPlan || 'Belum dipilih'}</div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Expiry</div>
                                <div className="mt-1 text-sm font-black text-slate-900">
                                  {entitlementModal.expiryDate || 'Unlimited'}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Modules</div>
                                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{entitlementManagedModules.length}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Add-ons</div>
                                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{entitlementManualAddonsCount}</div>
                                </div>
                              </div>
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Compatibility</div>
                                <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                                  Core yang lebih rendah akan otomatis membuang module dan add-on yang tidak lagi kompatibel.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Module Aktif dari Plan</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            Ini adalah capability yang akan otomatis aktif berdasarkan bundle tenant.
                          </p>
                        </div>
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                          {entitlementPackageModules.length} module
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {entitlementPackageModules.map((capability) => (
                          <span key={`plan-module-${capability}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                            {getSaasCapabilityDisplayLabel(capability)}
                          </span>
                        ))}
                        {entitlementPackageModules.length === 0 && (
                          <span className="text-xs font-bold text-slate-400">Belum ada module aktif dari plan.</span>
                        )}
                      </div>
                    </div>

                    {entitlementViewMode === 'modules' && (
                      <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black text-slate-900">Module Settings</h3>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              Pilih module yang benar-benar aktif untuk tenant ini. Jika sama persis dengan plan, tenant akan kembali mengikuti plan default.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] border ${
                              entitlementUsesCustomModules
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-white text-slate-500'
                            }`}>
                              {entitlementUsesCustomModules ? 'Custom Modules' : 'Follow Plan'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEntitlementModal((prev) => ({ ...prev, selectedModules: entitlementPackageModules }))}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-slate-50"
                            >
                              Reset ke Plan
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 space-y-5">
                          {SAAS_PACKAGE_EDITOR_SECTIONS
                            .filter((section) => section.kind !== 'addon')
                            .map((section) => (
                              <div key={`module-settings-${section.key}`} className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{section.title}</h4>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-500">{section.description}</p>
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    {section.items.length} opsi
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                  {section.items.map((item) => {
                                    const isSelected = entitlementManagedModules.some((capability) => saasModuleMatches(capability, item.value))
                                    const isPlanDefault = entitlementPackageModules.some((capability) => saasModuleMatches(capability, item.value))

                                    return (
                                      <label
                                        key={`tenant-module-${section.key}-${item.value}`}
                                        className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all ${
                                          isSelected
                                            ? 'border-indigo-200 bg-indigo-50/70'
                                            : 'border-slate-200 bg-white hover:border-indigo-200'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => toggleEntitlementModule(item.value, e.target.checked)}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                                            {item.label}
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            {isSelected && (
                                              <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                                                Active
                                              </span>
                                            )}
                                            {isPlanDefault && (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                                Plan Default
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {entitlementViewMode === 'addons' && (
                    <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Add-on Management</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            Pilih capability tambahan yang boleh aktif untuk tenant ini di luar module aktif tenant.
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          Blueprint {entitlementPackageBlueprintAddons.length}
                        </span>
                      </div>

                      <div className="mt-5 space-y-5">
                        {SAAS_TENANT_ENTITLEMENT_SECTIONS.map((section) => {
                          const sectionItems = section.items

                          return (
                            <div key={section.key} className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{section.title}</h4>
                                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{section.description}</p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                  {sectionItems.length} opsi
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {sectionItems.map((item) => {
                                  const includedByPlan = entitlementManagedModules.some((capability) => saasModuleMatches(capability, item.value))
                                  const isSelected = entitlementModal.selectedAddons.some((capability) => saasModuleMatches(capability, item.value))
                                  const isBlueprintOption = entitlementPackageBlueprintAddons.some((capability) => saasModuleMatches(capability, item.value))

                                  return (
                                    <label
                                      key={`tenant-addon-${section.key}-${item.value}`}
                                      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all ${
                                        includedByPlan
                                          ? 'border-indigo-200 bg-indigo-50/70'
                                          : isSelected
                                            ? 'border-emerald-200 bg-emerald-50/70'
                                            : 'border-slate-200 bg-white hover:border-emerald-200'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={includedByPlan || isSelected}
                                        disabled={includedByPlan}
                                        onChange={(e) => toggleEntitlementAddon(item.value, e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                                          {item.label}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                          {includedByPlan ? (
                                            <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                                              Included in Plan
                                            </span>
                                          ) : isSelected ? (
                                            <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                                              Active Manual
                                            </span>
                                          ) : null}
                                          {!includedByPlan && isBlueprintOption && (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                              Blueprint
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}

                        {entitlementUnknownSelectedAddons.length > 0 && (
                          <div className="space-y-3 rounded-[28px] border border-amber-200 bg-amber-50/70 p-4">
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-[0.14em] text-amber-700">Legacy / Override Entitlements</h4>
                              <p className="mt-1 text-[11px] font-semibold text-amber-700/80">
                                Add-on aktif ini tidak ditemukan di katalog standar saat ini, tetapi masih tersimpan di tenant.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              {entitlementUnknownSelectedAddons.map((capability) => (
                                <label key={`legacy-addon-${capability}`} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-white px-3 py-3">
                                  <input
                                    type="checkbox"
                                    checked
                                    onChange={(e) => toggleEntitlementAddon(capability, e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                  />
                                  <div className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-800">
                                    {getSaasCapabilityDisplayLabel(capability)}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    <div className="rounded-[32px] border border-slate-200 bg-white p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Capability Final Tenant</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            Gabungan module aktif tenant dan add-on manual yang dipilih.
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">
                          Total {entitlementFinalCapabilities.length}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {entitlementFinalCapabilities.map((capability) => (
                          <span key={`final-capability-${capability}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                            {getSaasCapabilityDisplayLabel(capability)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
                    Paket yang dipilih belum ditemukan. Pilih plan yang valid sebelum menyimpan entitlement tenant.
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={resetEntitlementModal}
                  className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                >
                  Batal
                </button>
                <SafeButton
                  variant="primary"
                  onClick={saveTenantEntitlements}
                  isLoading={savingEntitlements}
                  loadingText="Menyimpan..."
                  icon={<Package size={16} />}
                >
                  {entitlementViewMode === 'modules'
                    ? 'Simpan Modul'
                    : entitlementViewMode === 'addons'
                      ? 'Simpan Add-on'
                      : 'Simpan Entitlement'}
                </SafeButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ORG MODAL */}
      <AnimatePresence>
         {orgModal.open && (
           <div key="org-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div key="org-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeOrgModal} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div key="org-modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden border border-white">
                 <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight mb-8">
                    {orgModal.editData ? 'Edit Data Tenant' : 'Registrasi Tenant Manual'}
                 </h2>
                 <form onSubmit={saveOrgForm} className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Organisasi</label>
                       <input name="name" required defaultValue={orgModal.editData?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Pemilik (Login Akun)</label>
                       <input name="owner_email" required type="email" defaultValue={orgModal.editData?.owner_email} placeholder="email@perusahaan.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paket SaaS</label>
                           <select
                              name="plan"
                              value={orgModalPlanName}
                              onChange={(e) => handleOrgModalPlanChange(e.target.value)}
                              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                           >
                              <option value="Demo">Demo</option>
                              {packages.map(p => (
                                 <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center ml-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Berlaku (Expire Date)</label>
                              <div className="flex gap-1">
                                 {[3, 5, 30].map(days => (
                                    <button 
                                       key={days}
                                       type="button"
                                       onClick={() => {
                                          const d = new Date()
                                          d.setDate(d.getDate() + days)
                                          setModalExpireDate(formatDateInputValue(d))
                                       }}
                                       className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded text-[8px] font-black transition-colors"
                                    >
                                       +{days} Hari
                                    </button>
                                 ))}
                                 {typeof orgModalSelectedPackage?.duration_days === 'number' && orgModalSelectedPackage.duration_days > 0 && (
                                    <button
                                       type="button"
                                       onClick={() => setModalExpireDate(buildPlanExpiryDateInput(orgModalSelectedPackage.duration_days))}
                                       className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded text-[8px] font-black transition-colors"
                                    >
                                       Paket ({orgModalSelectedPackage.duration_days}H)
                                    </button>
                                 )}
                                 <button
                                    type="button"
                                    onClick={() => setModalExpireDate('')}
                                    className="px-1.5 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded text-[8px] font-black transition-colors"
                                 >
                                    Unlimited
                                 </button>
                              </div>
                           </div>
                           <input 
                              name="expires_at" 
                              type="date" 
                              value={modalExpireDate || formatDateInputValue(resolveOrganizationExpiryDate(orgModal.editData as OrganizationExpirySource))} 
                              onChange={(e) => setModalExpireDate(e.target.value)}
                              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" 
                           />
                        </div>
                    </div>
                    <div className="flex gap-4 items-center h-full pt-6">
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" name="is_demo" defaultChecked={orgModal.editData?.is_demo} className="w-5 h-5 rounded-lg text-orange-500" />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Demo?</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" name="is_active" defaultChecked={orgModal.editData?.is_active ?? true} className="w-5 h-5 rounded-lg text-emerald-500" />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Active?</span>
                           </label>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                       <button type="button" onClick={closeOrgModal} className="px-6 py-4 text-xs font-black uppercase text-slate-400">Batal</button>
                       <SafeButton type="submit" variant="primary">Simpan Tenant</SafeButton>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}
      </AnimatePresence>

      {/* PKG MODAL */}
      <AnimatePresence>
         {pkgModal.open && (
           <div key="pkg-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div key="pkg-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPkgModal({ open: false, editData: null })} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div key="pkg-modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden border border-white">
                 <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight mb-8">
                    {pkgModal.editData ? 'Edit Paket SaaS' : 'Buat Paket SaaS Baru'}
                 </h2>
                 <form onSubmit={savePackageForm} className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pr-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Paket</label>
                          <input name="name" required defaultValue={pkgModal.editData?.name} placeholder="e.g. Basic, Pro" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Billing</label>
                          <select name="billing" defaultValue={pkgModal.editData?.billing || 'Bulan'} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                             <option value="Bulan">Bulan</option>
                             <option value="Tahun">Tahun</option>
                             <option value="Sekali">Sekali</option>
                          </select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga (Angka)</label>
                          <input name="price" type="number" required defaultValue={pkgModal.editData?.price ?? 0} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Durasi (Hari)</label>
                          <input name="duration_days" type="number" required defaultValue={pkgModal.editData?.duration_days ?? 30} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Branch / Cabang</label>
                          <input name="max_branches" type="number" defaultValue={pkgModal.editData?.max_branches ?? ''} placeholder="Kosong = Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Anak Perusahaan</label>
                          <input name="max_child_orgs" type="number" defaultValue={pkgModal.editData?.max_child_orgs ?? ''} placeholder="Kosong = Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Org</label>
                          <input name="max_orgs" type="number" required defaultValue={pkgModal.editData?.max_orgs ?? 1} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Warehouse</label>
                          <input name="max_warehouses" type="number" required defaultValue={pkgModal.editData?.max_warehouses ?? 1} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Users</label>
                          <input name="max_users" type="number" defaultValue={pkgModal.editData?.max_users ?? ''} placeholder="Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Core & Modul Operasional</label>
                       
                       <div className="space-y-6 p-6 bg-slate-50 border border-slate-100 rounded-[32px]">
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 px-2">
                                <div className="h-[1px] flex-1 bg-slate-200" />
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Modul Inti</span>
                                <div className="h-[1px] flex-1 bg-slate-200" />
                             </div>
                             <p className="px-2 text-[11px] font-semibold text-slate-500 mb-2">Pilih modul-modul inti yang disertakan dalam paket ini.</p>
                             <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {CORE_MODULES.map((mod) => {
                                  const isMinimum = MINIMUM_CORE_MODULES.includes(mod.key)
                                  return (
                                    <label key={mod.key} className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-all ${isMinimum ? 'cursor-default border-emerald-300 bg-emerald-50/80' : 'cursor-pointer border-slate-200 bg-white hover:border-emerald-200'}`}>
                                       <input 
                                          type="checkbox" 
                                          name="modules" 
                                          value={mod.key} 
                                          defaultChecked={isMinimum || isCapabilitySelected(pkgModal.editData?.modules, mod.key)}
                                          disabled={isMinimum}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                                       />
                                       <div className="flex-1 min-w-0">
                                         <div className="flex items-center gap-2 flex-wrap">
                                           <span className="text-base">{mod.icon}</span>
                                           <span className="text-sm font-bold text-slate-800">{mod.name}</span>
                                           {isMinimum && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">Wajib</span>}
                                         </div>
                                         <p className="mt-0.5 text-[10px] text-slate-500">{mod.tagline}</p>
                                       </div>
                                    </label>
                                  )
                                })}
                             </div>
                          </div>

                          <div className="space-y-2 mt-6">
                             <div className="flex items-center gap-2 px-2">
                                <div className="h-[1px] flex-1 bg-slate-200" />
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Modul Operasional</span>
                                <div className="h-[1px] flex-1 bg-slate-200" />
                             </div>
                             <p className="px-2 text-[11px] font-semibold text-slate-500 mb-2">Tambahkan ekstensi bisnis spesifik.</p>
                             <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {OPERATIONAL_MODULES.map((mod) => (
                                   <label key={mod.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 hover:border-blue-200 transition-all group">
                                      <input 
                                         type="checkbox" 
                                         name="modules" 
                                         value={mod.key} 
                                         defaultChecked={isCapabilitySelected(pkgModal.editData?.modules, mod.key)}
                                         className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-base">{mod.icon}</span>
                                          <span className="text-sm font-bold text-slate-800">{mod.name}</span>
                                        </div>
                                        <p className="mt-0.5 text-[10px] text-slate-500">{mod.tagline}</p>
                                      </div>
                                   </label>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add-on Opsional</label>

                       <div className="space-y-6 p-6 bg-slate-50 border border-slate-100 rounded-[32px]">
                          <div className="space-y-2">
                             <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {OPERATOR_GROWTH_ADDON_OPTIONS.map((addon) => (
                                   <label key={addon.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 hover:border-indigo-200 transition-all group">
                                      <input 
                                         type="checkbox" 
                                         name="addons" 
                                         value={addon.name} 
                                         defaultChecked={isCapabilitySelected(pkgModal.editData?.addons, addon.name)}
                                         className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-slate-800">{addon.name}</span>
                                        <p className="mt-0.5 text-[10px] text-slate-500">{addon.description}</p>
                                      </div>
                                   </label>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                       <button type="button" onClick={() => setPkgModal({ open: false, editData: null })} className="px-6 py-4 text-xs font-black uppercase text-slate-400">Batal</button>
                       <SafeButton type="submit" variant="primary">Simpan Paket</SafeButton>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}
	      </AnimatePresence>

	      {/* AI TOPUP MODAL */}
	      <AnimatePresence>
	        {aiTopupModal.open && (
	          <div key="ai-topup-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
	            <motion.div
	              key="ai-topup-modal-backdrop"
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
	              onClick={() => setAiTopupModal({ open: false, editData: null })}
	              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
	            />
	            <motion.div
	              key="ai-topup-modal-content"
	              initial={{ scale: 0.9, opacity: 0 }}
	              animate={{ scale: 1, opacity: 1 }}
	              exit={{ scale: 0.9, opacity: 0 }}
	              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl p-8 border border-white"
	            >
	              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">
	                {aiTopupModal.editData ? 'Edit Paket Topup Token' : 'Tambah Paket Topup Token'}
	              </h2>

	              <form onSubmit={saveAiTopupPackageForm} className="space-y-4">
	                <div>
	                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nama Paket</label>
	                  <input name="name" required defaultValue={aiTopupModal.editData?.name} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                </div>
	                <div>
	                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Deskripsi</label>
	                  <textarea name="description" rows={3} defaultValue={aiTopupModal.editData?.description} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                </div>
	                <div className="grid grid-cols-2 gap-4">
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Jumlah Token</label>
	                    <input name="tokens" type="number" min={1} required defaultValue={aiTopupModal.editData?.tokens || 50000} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sort Order</label>
	                    <input name="sort_order" type="number" defaultValue={aiTopupModal.editData?.sort_order || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                </div>
	                <div className="grid grid-cols-2 gap-4">
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Harga Jual (IDR)</label>
	                    <input name="price_idr" type="number" min={0} required defaultValue={aiTopupModal.editData?.price_idr || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">HPP Paket (IDR)</label>
	                    <input name="cost_idr" type="number" min={0} defaultValue={aiTopupModal.editData?.cost_idr || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                </div>
	                <label className="inline-flex items-center gap-2 cursor-pointer">
	                  <input type="checkbox" name="is_active" defaultChecked={aiTopupModal.editData?.is_active ?? true} className="w-4 h-4 rounded" />
	                  <span className="text-xs font-bold text-slate-600">Aktifkan paket ini</span>
	                </label>
	                <div className="flex justify-end gap-3 pt-2">
	                  <button type="button" onClick={() => setAiTopupModal({ open: false, editData: null })} className="px-4 py-3 text-xs font-black uppercase text-slate-400">Batal</button>
	                  <SafeButton type="submit" variant="primary">Simpan Paket</SafeButton>
	                </div>
	              </form>
	            </motion.div>
	          </div>
	        )}
	      </AnimatePresence>

	      <ConfirmDialog 
	        isOpen={confirmState.open} 
        title={confirmState.title} 
        message={confirmState.message} 
        onConfirm={confirmState.action} 
        onClose={() => setConfirmState(prev => ({ ...prev, open: false }))} 
      />
    </div>
  )
}
