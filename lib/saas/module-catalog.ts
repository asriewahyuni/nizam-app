export const SAAS_LITE_CORE_MODULES = [
  'Sales',
  'POS',
  'CRM',
  'Reports',
] as const

export const SAAS_CORE_MODULES = [
  'Accounting',
  'Finance',
  'Inventory',
  'Purchasing',
  ...SAAS_LITE_CORE_MODULES,
] as const

export const SAAS_PREMIUM_MODULES = [
  'HRIS',
  'Manufacturing',
  'Audit',
] as const

export const SAAS_ADDON_MODULES = [
  'Fleet & Rental',
  'Job Order (Jasa)',
  'Warehouse',
  'Sales Page',
] as const

export const SAAS_SPECIALIZED_MODULES = [
  'Syirkah',
  'Integrasi API',
] as const

export const SAAS_CAPACITY_ADDONS = [
  'Multi-Entity (PT/CV)',
] as const

export const SAAS_PLATFORM_CORE_ITEMS = [
  { label: 'Dashboard', value: 'Dashboard' },
  { label: 'Cabang', value: 'Cabang & Divisi' },
  { label: 'Pengaturan Bisnis', value: 'Pengaturan Bisnis' },
  { label: 'Migrasi Data', value: 'Migrasi Data' },
  { label: 'Support Ticket', value: 'Support Ticket' },
] as const

export const SAAS_LITE_CORE_ITEMS = [
  { label: 'Sales', value: 'Sales' },
  { label: 'POS', value: 'POS' },
  { label: 'CRM', value: 'CRM' },
  { label: 'Reports', value: 'Reports' },
] as const

export const SAAS_STARTER_CORE_ITEMS = [
  { label: 'Accounting', value: 'Accounting' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Inventory', value: 'Inventory' },
  { label: 'Purchasing', value: 'Purchasing' },
] as const

export const SAAS_FULL_CORE_EXTENSION_ITEMS = [
  { label: 'HRIS', value: 'HRIS' },
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Audit', value: 'Audit' },
] as const

export const SAAS_VERTICAL_MODULE_ITEMS = [
  { label: 'Fleet & Rental', value: 'Fleet & Rental' },
  { label: 'Job Order (Jasa)', value: 'Job Order (Jasa)' },
  { label: 'Project & Construction', value: 'Project & Construction' },
  { label: 'Syirkah', value: 'Syirkah' },
] as const

export const SAAS_ADDON_ITEMS = [
  { label: 'Warehouse', value: 'Warehouse' },
  { label: 'Sales Page', value: 'Sales Page' },
  { label: 'Integrasi API', value: 'Integrasi API' },
  { label: 'Multi-Entity (PT/CV)', value: 'Multi-Entity (PT/CV)' },
  { label: 'Quick Bill', value: 'Quick Bill' },
  { label: 'Fleet Maintenance Pack', value: 'Fleet Maintenance Pack' },
  { label: 'Package Tracking', value: 'Package Tracking' },
  { label: 'Sales AR Cockpit', value: 'Sales AR Cockpit' },
  { label: 'Sales AR Seat Pack', value: 'Sales AR Seat Pack' },
] as const

export type SaasCapabilityKind =
  | 'platform_core'
  | 'lite_core'
  | 'starter_core'
  | 'full_core_extension'
  | 'vertical_module'
  | 'addon'
  | 'capacity_addon'
  | 'unclassified'

export type SaasCoreFamily = 'lite' | 'starter' | 'full'
export type SaasCoreFamilyLevel = SaasCoreFamily | 'none'

export type SaasCapabilityOption = {
  label: string
  value: string
}

export type SaasCapabilitySection = {
  key: string
  title: string
  description: string
  kind: SaasCapabilityKind
  items: readonly SaasCapabilityOption[]
}

export const SAAS_PACKAGE_EDITOR_SECTIONS: readonly SaasCapabilitySection[] = [
  {
    key: 'platform_core',
    title: 'Platform Core',
    description: 'Fondasi SaaS yang selalu melekat ke produk inti Nizam.',
    kind: 'platform_core',
    items: SAAS_PLATFORM_CORE_ITEMS,
  },
  {
    key: 'lite_core',
    title: 'Lite Core Family',
    description: 'Core transaksi paling sederhana untuk jualan, kasir, pelanggan, dan laporan ringkas.',
    kind: 'lite_core',
    items: SAAS_LITE_CORE_ITEMS,
  },
  {
    key: 'starter_core',
    title: 'Starter Core Family',
    description: 'Ekstensi operasional di atas Lite Core untuk finance, accounting, inventory, dan purchasing.',
    kind: 'starter_core',
    items: SAAS_STARTER_CORE_ITEMS,
  },
  {
    key: 'full_core_extension',
    title: 'Full Core Family',
    description: 'Ekstensi core untuk HRIS, manufaktur, dan audit.',
    kind: 'full_core_extension',
    items: SAAS_FULL_CORE_EXTENSION_ITEMS,
  },
  {
    key: 'vertical_module',
    title: 'Vertical Modules',
    description: 'Modul industri/vertikal yang menempel ke core.',
    kind: 'vertical_module',
    items: SAAS_VERTICAL_MODULE_ITEMS,
  },
  {
    key: 'addon',
    title: 'Add-ons',
    description: 'Ekspansi tambahan di atas core atau vertical module.',
    kind: 'addon',
    items: SAAS_ADDON_ITEMS,
  },
] as const

export const SAAS_LITE_PACKAGE_MODULES = [...SAAS_LITE_CORE_MODULES, 'Config'] as const
export const SAAS_BASE_PACKAGE_MODULES = [...SAAS_CORE_MODULES, 'Config'] as const
export const SAAS_PRO_PACKAGE_MODULES = [...SAAS_CORE_MODULES, ...SAAS_PREMIUM_MODULES, 'Config'] as const
export const SAAS_ENTERPRISE_PACKAGE_MODULES = [...SAAS_PRO_PACKAGE_MODULES] as const
export const SAAS_DEMO_PACKAGE_MODULES = [...SAAS_PRO_PACKAGE_MODULES, 'Fleet & Rental', 'Job Order (Jasa)', 'Project & Construction', 'Syirkah', 'Warehouse', 'Sales Page', 'Integrasi API'] as const
export const SAAS_ABS_SPECIAL_MODULES = [
  ...SAAS_CORE_MODULES,
  'HRIS',
  'Warehouse',
  'Config',
] as const

type CatalogEntry = {
  canonical: string
  aliases: string[]
}

const SAAS_CAPABILITY_COVERAGE: Record<string, readonly string[]> = {
  HRIS: ['Attendance', 'Payroll'],
  'Job Order (Jasa)': ['Project & Construction'],
  'Project & Construction': ['Job Order (Jasa)'],
}

const SAAS_ENTITLEMENT_CATALOG: CatalogEntry[] = [
  {
    canonical: 'Accounting',
    aliases: ['accounting', 'akun (coa)', 'buku besar', 'journal', 'jurnal', 'manajemen zakat', 'manajemen pajak', 'penutupan buku', 'anggaran'],
  },
  {
    canonical: 'Finance',
    aliases: ['finance', 'kas & bank', 'cash', 'bank', 'aging', 'reimbursement', 'aging (ar/ap)', 'aset tetap', 'proyeksi kas'],
  },
  {
    canonical: 'Inventory',
    aliases: ['inventory', 'inventori', 'stok', 'gudang & stok'],
  },
  {
    canonical: 'Purchasing',
    aliases: ['purchasing', 'pembelian', 'po', 'purchase'],
  },
  {
    canonical: 'Sales',
    aliases: ['sales', 'penjualan', 'quotation', 'sales pipeline', 'penawaran (quotation)', 'target & komisi', 'promo & reward'],
  },
  {
    canonical: 'POS',
    aliases: ['pos', 'pos (kasir)', 'kasir'],
  },
  {
    canonical: 'CRM',
    aliases: ['crm', 'marketing', 'pelanggan (crm)', 'contacts', 'customer'],
  },
  {
    canonical: 'Reports',
    aliases: ['reports', 'laporan', 'insight', 'strategy', 'forecast', 'strategi (bsc)'],
  },
  {
    canonical: 'HRIS',
    aliases: ['hris', 'karyawan (hris)', 'karyawan (sdm)', 'employees', 'employee', 'akses & jabatan'],
  },
  {
    canonical: 'Manufacturing',
    aliases: ['manufacturing', 'factory', 'manufaktur', 'bom', 'manufaktur (bom)'],
  },
  {
    canonical: 'Audit',
    aliases: ['audit', 'audit trail', 'audit integritas'],
  },
  {
    canonical: 'Consolidation',
    aliases: ['consolidation', 'cabang & divisi', 'branch', 'branches'],
  },
  {
    canonical: 'Config',
    aliases: ['config', 'pengaturan bisnis', 'settings', 'business settings', 'ticketing', 'support ticket', 'doc update ticketing', 'doc update support ticket', 'dokumen update support ticket', 'migrasi data'],
  },
  {
    canonical: 'Attendance',
    aliases: ['attendance', 'absensi & cuti', 'absensi', 'cuti'],
  },
  {
    canonical: 'Payroll',
    aliases: ['payroll', 'payroll components', 'proses penggajian', 'penggajian'],
  },
  {
    canonical: 'Fleet & Rental',
    aliases: ['fleet & rental', 'fleet', 'fleet management', 'smart fleet management'],
  },
  {
    canonical: 'Job Order (Jasa)',
    aliases: ['job order (jasa)', 'job order', 'industrial job order', 'services', 'service jasa'],
  },
  {
    canonical: 'Project & Construction',
    aliases: [
      'project & construction',
      'project and construction',
      'construction',
      'project construction',
      'project konstruksi',
      'konstruksi',
      'modul kontraktor',
      'modul arsitek',
      'arsitek',
      'kontraktor',
      'rab',
      'boq',
      'site progress',
    ],
  },
  {
    canonical: 'Warehouse',
    aliases: ['warehouse', 'gudang (wms)', 'gudang', 'wms', 'wms expansion pack'],
  },
  {
    canonical: 'Sales Page',
    aliases: ['sales page', 'salespage', 'landing page'],
  },
  {
    canonical: 'Syirkah',
    aliases: ['syirkah', 'akad syirkah', 'partnership', 'partnership contract'],
  },
  {
    canonical: 'Integrasi API',
    aliases: [
      'integrasi api',
      'api & integrasi',
      'api integration',
      'developer api',
      'developers',
      'open api',
      'webhook',
      'api settings',
    ],
  },
  {
    canonical: 'Multi-Entity (PT/CV)',
    aliases: ['multi-entity (pt/cv)', 'multi-entity', 'multi entity', 'multi entity (pt/cv)'],
  },
  {
    canonical: 'Quick Bill',
    aliases: ['quick bill', 'billing cepat', 'tagihan cepat'],
  },
  {
    canonical: 'Fleet Maintenance Pack',
    aliases: ['fleet maintenance pack', 'oil record', 'tire record', 'tyre record', 'oil & tire record', 'fleet maintenance'],
  },
  {
    canonical: 'Package Tracking',
    aliases: ['package tracking', 'tracking paket', 'pelacakan paket', 'resi', 'tracking resi'],
  },
  {
    canonical: 'Sales AR Cockpit',
    aliases: ['sales ar cockpit', 'ar dashboard salesman', 'ar dashboard sales', 'dashboard piutang salesman', 'dashboard piutang sales'],
  },
  {
    canonical: 'Sales AR Seat Pack',
    aliases: ['sales ar seat pack', 'seat sales ar', 'seat tambahan sales ar', 'tambahan seat salesman', 'tambahan 3 salesman'],
  },
]

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeSaasEntitlementName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = normalizeLookupValue(trimmed)
  const match = SAAS_ENTITLEMENT_CATALOG.find((entry) => entry.aliases.includes(normalized))
  return match?.canonical || trimmed
}

export function normalizeSaasEntitlementList(values: readonly string[]) {
  const output: string[] = []
  const seen = new Set<string>()

  values.forEach((value) => {
    const normalized = normalizeSaasEntitlementName(String(value || ''))
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    output.push(normalized)
  })

  return output
}

export function saasModuleMatches(enabledModuleRaw: string, candidateRaw: string) {
  const enabled = normalizeSaasEntitlementName(enabledModuleRaw)
  const candidate = normalizeSaasEntitlementName(candidateRaw)

  if (!enabled || !candidate) return false
  return enabled === candidate
}

export function saasModuleCoversCapability(enabledModuleRaw: string, candidateRaw: string) {
  const enabled = normalizeSaasEntitlementName(enabledModuleRaw)
  const candidate = normalizeSaasEntitlementName(candidateRaw)

  if (!enabled || !candidate) return false
  if (enabled === candidate) return true

  const coveredCapabilities = SAAS_CAPABILITY_COVERAGE[enabled] || []
  return coveredCapabilities.some((coveredCapability) => coveredCapability === candidate)
}

function includesCapability(
  values: readonly string[],
  candidates: readonly string[],
  options?: { fallbackToConfig?: boolean }
) {
  const normalizedValues = normalizeSaasEntitlementList(values)

  return candidates.some((candidate) => {
    if (normalizedValues.some((value) => saasModuleMatches(value, candidate))) {
      return true
    }

    if (!options?.fallbackToConfig) return false
    return normalizedValues.some((value) => saasModuleMatches(value, 'Config'))
  })
}

export function getSaasCapabilityDisplayLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (
    (SAAS_PLATFORM_CORE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed) ||
    (SAAS_LITE_CORE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed) ||
    (SAAS_STARTER_CORE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed) ||
    (SAAS_FULL_CORE_EXTENSION_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed) ||
    (SAAS_VERTICAL_MODULE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed) ||
    (SAAS_ADDON_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.label === trimmed)
  ) {
    return trimmed
  }

  const normalized = normalizeSaasEntitlementName(trimmed)

  if (trimmed === 'Cabang & Divisi' || normalized === 'Consolidation') return 'Cabang'
  if (trimmed === 'Ticketing') return 'Support Ticket'
  if (trimmed === 'Doc Update Ticketing') return 'Dokumen Update Support Ticket'
  if (normalized === 'Config') return 'Pengaturan Bisnis'

  return trimmed
}

export function getSaasCapabilityKind(value: string): SaasCapabilityKind {
  const trimmed = value.trim()
  if (!trimmed) return 'unclassified'

  const normalized = normalizeSaasEntitlementName(trimmed)

  if (
    trimmed === 'Dashboard' ||
    normalized === 'Config' ||
    normalized === 'Consolidation'
  ) {
    return 'platform_core'
  }

  if ((SAAS_LITE_CORE_MODULES as readonly string[]).includes(normalized)) return 'lite_core'
  if ((SAAS_STARTER_CORE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.value === normalized)) {
    return 'starter_core'
  }
  if ((SAAS_PREMIUM_MODULES as readonly string[]).includes(normalized)) return 'full_core_extension'
  if ((SAAS_VERTICAL_MODULE_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.value === normalized)) {
    return 'vertical_module'
  }
  if (normalized === 'Multi-Entity (PT/CV)') return 'capacity_addon'
  if ((SAAS_ADDON_ITEMS as readonly SaasCapabilityOption[]).some((item) => item.value === normalized)) {
    return 'addon'
  }

  return 'unclassified'
}

export type SaasPackageArchitecture = {
  bundleKey: 'lite_core' | 'starter_core' | 'full_core' | 'custom'
  bundleLabel: string
  coreFamilyLevel: SaasCoreFamilyLevel
  platformCore: string[]
  liteCore: string[]
  starterCore: string[]
  fullCoreExtensions: string[]
  verticalModules: string[]
  addons: string[]
}

export function getSaasCoreFamilyLabel(coreFamily: SaasCoreFamilyLevel) {
  if (coreFamily === 'full') return 'Full Core Family'
  if (coreFamily === 'starter') return 'Starter Core Family'
  if (coreFamily === 'lite') return 'Lite Core Family'
  return 'Belum ada Core Family'
}

export function getSaasCoreFamilyRank(coreFamily: SaasCoreFamilyLevel) {
  if (coreFamily === 'full') return 3
  if (coreFamily === 'starter') return 2
  if (coreFamily === 'lite') return 1
  return 0
}

export function saasCoreFamilySatisfies(
  currentCoreFamily: SaasCoreFamilyLevel,
  requiredCoreFamily: SaasCoreFamily
) {
  return getSaasCoreFamilyRank(currentCoreFamily) >= getSaasCoreFamilyRank(requiredCoreFamily)
}

export function getSaasPackageArchitecture(
  modulesRaw: readonly string[],
  addonsRaw: readonly string[] = []
): SaasPackageArchitecture {
  const modules = normalizeSaasEntitlementList(modulesRaw)
  const addons = normalizeSaasEntitlementList(addonsRaw)
  const allValues = [...modules, ...addons]

  const liteCore = SAAS_LITE_CORE_ITEMS
    .map((item) => item.label)
    .filter((label) => includesCapability(modules, [label]))

  const starterCore = SAAS_STARTER_CORE_ITEMS
    .map((item) => item.label)
    .filter((label) => includesCapability(modules, [label]))

  const fullCoreExtensions = SAAS_FULL_CORE_EXTENSION_ITEMS
    .map((item) => item.label)
    .filter((label) => includesCapability(modules, [label]))

  const verticalModules = SAAS_VERTICAL_MODULE_ITEMS
    .map((item) => item.label)
    .filter((label) => includesCapability(allValues, [label]))

  const addonLabels = SAAS_ADDON_ITEMS
    .map((item) => item.label)
    .filter((label) => includesCapability(allValues, [label]))

  const hasFullLiteCore = liteCore.length === SAAS_LITE_CORE_ITEMS.length
  const hasFullStarterCore = starterCore.length === SAAS_STARTER_CORE_ITEMS.length
  const hasFullCoreExtensions = fullCoreExtensions.length === SAAS_FULL_CORE_EXTENSION_ITEMS.length

  const bundleKey = hasFullCoreExtensions && hasFullStarterCore && hasFullLiteCore
    ? 'full_core'
    : hasFullStarterCore && hasFullLiteCore && fullCoreExtensions.length === 0
      ? 'starter_core'
      : hasFullLiteCore && starterCore.length === 0 && fullCoreExtensions.length === 0
        ? 'lite_core'
        : 'custom'

  return {
    bundleKey,
    bundleLabel:
      bundleKey === 'full_core'
        ? 'Full Core Family'
        : bundleKey === 'starter_core'
          ? 'Starter Core Family'
          : bundleKey === 'lite_core'
            ? 'Lite Core Family'
            : 'Custom Core Family',
    coreFamilyLevel: hasFullCoreExtensions && hasFullStarterCore && hasFullLiteCore
      ? 'full'
      : hasFullStarterCore && hasFullLiteCore
        ? 'starter'
        : hasFullLiteCore
          ? 'lite'
          : 'none',
    platformCore: SAAS_PLATFORM_CORE_ITEMS.map((item) => item.label),
    liteCore,
    starterCore,
    fullCoreExtensions,
    verticalModules,
    addons: addonLabels,
  }
}
