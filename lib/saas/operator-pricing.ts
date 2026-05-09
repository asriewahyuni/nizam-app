import {
  SAAS_CAPACITY_ADDONS,
  getSaasCapabilityDisplayLabel,
  getSaasCapabilityKind,
  getSaasCoreFamilyLabel,
  normalizeSaasEntitlementList,
  saasCoreFamilySatisfies,
  type SaasCoreFamily,
  type SaasCoreFamilyLevel,
} from '@/lib/saas/module-catalog'

export type OperatorAddonOption = {
  id: string
  name: string
  price: number
  anchorPrice?: number
  billing: string
  description: string
  capacityNote?: string
  selfServiceEnabled?: boolean
  minCoreFamily?: SaasCoreFamily
  dependsOnCapabilities?: string[]
}

const FLEET_MODULE_NAME = 'Fleet & Rental'
const JOB_ORDER_MODULE_NAME = 'Job Order (Jasa)'
const WORKSHOP_MODULE_NAME = 'Workshop'
const CONSTRUCTION_MODULE_NAME = 'Project & Construction'
const SYIRKAH_MODULE_NAME = 'Syirkah'
const WAREHOUSE_ADDON_NAME = 'Warehouse'
const SALES_PAGE_ADDON_NAME = 'Sales Page'
const API_ADDON_NAME = 'Integrasi API'

export type OperatorMarketplaceKind = 'module' | 'addon' | 'capacity_addon'
export type OperatorMarketplaceCompatibility = {
  isCompatible: boolean
  reason: string | null
  missingCapabilities: string[]
}

export const OPERATOR_ADDON_OPTIONS: OperatorAddonOption[] = [
  {
    id: 'addon_fleet',
    name: FLEET_MODULE_NAME,
    price: 249000,
    anchorPrice: 349000,
    billing: 'Bulan',
    description: 'Kelola aset kendaraan, jadwal driver, dan tracking bahan bakar.',
    minCoreFamily: 'lite',
  },
  {
    id: 'addon_job_order',
    name: JOB_ORDER_MODULE_NAME,
    price: 199000,
    anchorPrice: 299000,
    billing: 'Bulan',
    description: 'Sistem perintah kerja jasa/workshop untuk tracking progress.',
    minCoreFamily: 'lite',
  },
  {
    id: 'addon_workshop',
    name: WORKSHOP_MODULE_NAME,
    price: 199000,
    anchorPrice: 279000,
    billing: 'Bulan',
    description: 'SPK bengkel motor, manajemen kendaraan pelanggan, mekanik, spare part, dan jurnal pendapatan otomatis.',
    minCoreFamily: 'lite',
  },
  {
    id: 'addon_construction',
    name: CONSTRUCTION_MODULE_NAME,
    price: 299000,
    anchorPrice: 399000,
    billing: 'Bulan',
    description: 'Dashboard proyek, RAB/BoQ, progres lapangan, dan termin tagihan untuk arsitek maupun kontraktor.',
    minCoreFamily: 'starter',
  },
  {
    id: 'addon_syirkah',
    name: SYIRKAH_MODULE_NAME,
    price: 149000,
    anchorPrice: 199000,
    billing: 'Bulan',
    description: 'Workflow akad syirkah, dokumen digital, dan pelacakan kerja sama berbasis syariah.',
    selfServiceEnabled: false,
    minCoreFamily: 'starter',
    dependsOnCapabilities: ['Accounting'],
  },
  {
    id: 'addon_warehouse',
    name: WAREHOUSE_ADDON_NAME,
    price: 99000,
    anchorPrice: 149000,
    billing: 'Bulan',
    description: 'Tambah 1 lokasi gudang/unit untuk ekspansi operasional.',
    minCoreFamily: 'starter',
    dependsOnCapabilities: ['Inventory'],
  },
  {
    id: 'addon_org',
    name: SAAS_CAPACITY_ADDONS[0],
    price: 199000,
    anchorPrice: 299000,
    billing: 'Bulan',
    description: 'Kelola beberapa entitas bisnis dalam satu dashboard.',
    minCoreFamily: 'starter',
  },
  {
    id: 'addon_sales_page',
    name: SALES_PAGE_ADDON_NAME,
    price: 149000,
    anchorPrice: 249000,
    billing: 'Bulan',
    description: 'Landing page builder siap iklan dengan capture lead terintegrasi.',
    minCoreFamily: 'lite',
    dependsOnCapabilities: ['Sales'],
  },
  {
    id: 'addon_api',
    name: API_ADDON_NAME,
    price: 249000,
    anchorPrice: 349000,
    billing: 'Bulan',
    description: 'Open API dan webhook untuk sinkronisasi marketplace, aplikasi internal, atau partner.',
    selfServiceEnabled: false,
    minCoreFamily: 'lite',
  },
  {
    id: 'addon_quick_bill',
    name: 'Quick Bill',
    price: 49000,
    anchorPrice: 79000,
    billing: 'Single Bill',
    description: 'Add-on single bill untuk penerbitan tagihan cepat (Quick Bill).',
    minCoreFamily: 'lite',
    dependsOnCapabilities: ['Sales'],
  },
  {
    id: 'addon_fleet_maintenance',
    name: 'Fleet Maintenance Pack',
    price: 149000,
    anchorPrice: 249000,
    billing: 'Bulan',
    description: 'Bundel pencatatan oil record, tire record, odometer, dan reminder servis armada.',
    selfServiceEnabled: false,
    minCoreFamily: 'lite',
    dependsOnCapabilities: ['Fleet & Rental'],
  },
  {
    id: 'addon_package_tracking',
    name: 'Package Tracking',
    price: 149000,
    anchorPrice: 249000,
    billing: 'Bulan',
    description: 'Pelacakan paket ekspedisi dengan status perjalanan dan histori pengiriman.',
    selfServiceEnabled: false,
    minCoreFamily: 'lite',
    dependsOnCapabilities: ['Sales'],
  },
  {
    id: 'addon_sales_ar_cockpit',
    name: 'Sales AR Cockpit',
    price: 99000,
    anchorPrice: 149000,
    billing: 'Bulan',
    description: 'Dashboard piutang per salesman untuk follow up jatuh tempo, aging, dan collection.',
    capacityNote: 'Include 3 orang salesman',
    selfServiceEnabled: false,
    minCoreFamily: 'starter',
    dependsOnCapabilities: ['Sales', 'Finance'],
  },
  {
    id: 'addon_sales_ar_seat_pack',
    name: 'Sales AR Seat Pack',
    price: 69000,
    anchorPrice: 99000,
    billing: 'Bulan',
    description: 'Tambahan seat untuk dashboard piutang salesman dan monitoring collection tim penjualan.',
    capacityNote: 'Tambah 3 orang salesman',
    selfServiceEnabled: false,
    minCoreFamily: 'starter',
    dependsOnCapabilities: ['Sales AR Cockpit'],
  },
]

export const EXTRA_ENTITY_UNIT_PRICE = 199000
export const EXTRA_BRANCH_UNIT_PRICE = 99000

export function getOperatorAddonById(id: string) {
  return OPERATOR_ADDON_OPTIONS.find((addon) => addon.id === id)
}

export function getOperatorMarketplaceMinCoreFamily(addon: Pick<OperatorAddonOption, 'minCoreFamily'>) {
  return addon.minCoreFamily || 'lite'
}

export function isAddonSelfServiceEnabled(addon: Pick<OperatorAddonOption, 'selfServiceEnabled'>) {
  return addon.selfServiceEnabled !== false
}

export function getOperatorMarketplaceKind(addon: Pick<OperatorAddonOption, 'name'>): OperatorMarketplaceKind {
  const capabilityKind = getSaasCapabilityKind(addon.name)
  if (capabilityKind === 'vertical_module') return 'module'
  if (capabilityKind === 'capacity_addon') return 'capacity_addon'
  return 'addon'
}

export function getOperatorMarketplaceLabel(addon: Pick<OperatorAddonOption, 'name'>) {
  const kind = getOperatorMarketplaceKind(addon)
  if (kind === 'module') return 'Module'
  if (kind === 'capacity_addon') return 'Capacity Add-on'
  return 'Add-on'
}

export function getOperatorMarketplaceCompatibility(
  addon: Pick<OperatorAddonOption, 'name' | 'minCoreFamily' | 'dependsOnCapabilities'>,
  context: {
    coreFamilyLevel: SaasCoreFamilyLevel
    enabledCapabilities?: readonly string[]
  }
): OperatorMarketplaceCompatibility {
  const minCoreFamily = getOperatorMarketplaceMinCoreFamily(addon)

  if (!saasCoreFamilySatisfies(context.coreFamilyLevel, minCoreFamily)) {
    return {
      isCompatible: false,
      reason: `Butuh minimal ${getSaasCoreFamilyLabel(minCoreFamily)}.`,
      missingCapabilities: [],
    }
  }

  const enabledCapabilities = normalizeSaasEntitlementList([...(context.enabledCapabilities || [])])
  const missingCapabilities = normalizeSaasEntitlementList(addon.dependsOnCapabilities || []).filter((capability) => (
    !enabledCapabilities.includes(capability)
  ))

  if (missingCapabilities.length > 0) {
    return {
      isCompatible: false,
      reason: `Butuh ${missingCapabilities.map((capability) => getSaasCapabilityDisplayLabel(capability)).join(', ')} aktif terlebih dahulu.`,
      missingCapabilities,
    }
  }

  return {
    isCompatible: true,
    reason: null,
    missingCapabilities: [],
  }
}

export const OPERATOR_MODULE_OPTIONS = OPERATOR_ADDON_OPTIONS.filter(
  (addon) => getOperatorMarketplaceKind(addon) === 'module'
)

export const OPERATOR_GROWTH_ADDON_OPTIONS = OPERATOR_ADDON_OPTIONS.filter(
  (addon) => getOperatorMarketplaceKind(addon) !== 'module'
)
