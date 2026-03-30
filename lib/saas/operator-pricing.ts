import {
  SAAS_ADDON_MODULES,
  SAAS_CAPACITY_ADDONS,
} from '@/lib/saas/module-catalog'

export type OperatorAddonOption = {
  id: string
  name: string
  price: number
  anchorPrice?: number
  billing: string
  description: string
}

export const OPERATOR_ADDON_OPTIONS: OperatorAddonOption[] = [
  {
    id: 'addon_fleet',
    name: SAAS_ADDON_MODULES[0],
    price: 349000,
    anchorPrice: 449000,
    billing: 'Bulan',
    description: 'Kelola aset kendaraan, jadwal driver, dan tracking bahan bakar.',
  },
  {
    id: 'addon_job_order',
    name: SAAS_ADDON_MODULES[1],
    price: 299000,
    anchorPrice: 399000,
    billing: 'Bulan',
    description: 'Sistem perintah kerja jasa/workshop untuk tracking progress.',
  },
  {
    id: 'addon_warehouse',
    name: SAAS_ADDON_MODULES[2],
    price: 149000,
    anchorPrice: 199000,
    billing: 'Bulan',
    description: 'Tambah 1 lokasi gudang/cabang untuk ekspansi operasional.',
  },
  {
    id: 'addon_org',
    name: SAAS_CAPACITY_ADDONS[0],
    price: 249000,
    anchorPrice: 349000,
    billing: 'Bulan',
    description: 'Kelola beberapa entitas bisnis dalam satu dashboard.',
  },
  {
    id: 'addon_sales_page',
    name: SAAS_ADDON_MODULES[3],
    price: 199000,
    anchorPrice: 299000,
    billing: 'Bulan',
    description: 'Landing page builder siap iklan dengan capture lead terintegrasi.',
  },
]

export const EXTRA_ENTITY_UNIT_PRICE = 249000
export const EXTRA_BRANCH_UNIT_PRICE = 149000

export function getOperatorAddonById(id: string) {
  return OPERATOR_ADDON_OPTIONS.find((addon) => addon.id === id)
}
