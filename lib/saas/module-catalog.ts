export const SAAS_CORE_MODULES = [
  'Accounting',
  'Finance',
  'Inventory',
  'Purchasing',
  'Sales',
  'POS',
  'CRM',
  'Reports',
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

export const SAAS_CAPACITY_ADDONS = [
  'Multi-Entity (PT/CV)',
] as const

export const SAAS_BASE_PACKAGE_MODULES = [...SAAS_CORE_MODULES] as const
export const SAAS_PRO_PACKAGE_MODULES = [...SAAS_CORE_MODULES, ...SAAS_PREMIUM_MODULES] as const
export const SAAS_ENTERPRISE_PACKAGE_MODULES = [...SAAS_PRO_PACKAGE_MODULES, ...SAAS_ADDON_MODULES] as const
export const SAAS_DEMO_PACKAGE_MODULES = [...SAAS_ENTERPRISE_PACKAGE_MODULES] as const
export const SAAS_ABS_SPECIAL_MODULES = [
  ...SAAS_CORE_MODULES,
  'HRIS',
  'Warehouse',
] as const

type CatalogEntry = {
  canonical: string
  aliases: string[]
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
    aliases: ['config', 'pengaturan bisnis', 'settings', 'business settings', 'ticketing', 'doc update ticketing'],
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
    canonical: 'Warehouse',
    aliases: ['warehouse', 'gudang (wms)', 'gudang', 'wms', 'wms expansion pack'],
  },
  {
    canonical: 'Sales Page',
    aliases: ['sales page', 'salespage', 'landing page'],
  },
  {
    canonical: 'Multi-Entity (PT/CV)',
    aliases: ['multi-entity (pt/cv)', 'multi-entity', 'multi entity', 'multi entity (pt/cv)'],
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
