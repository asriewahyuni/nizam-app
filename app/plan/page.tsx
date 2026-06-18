import { queryPostgres } from '@/lib/db/postgres'
import PlanClient from './PlanClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Paket & Harga — NIZAM ERP',
  description: 'Pilih paket NIZAM ERP yang sesuai dengan kebutuhan bisnis Anda.',
}

type PlanPackage = {
  id: string
  name: string
  price: number
  billing: string
  max_users: number | null
  max_child_orgs: number | null
  max_branches: number | null
}

// Fallback data apabila DB tidak bisa diakses atau belum ada data.
const FALLBACK_PACKAGES: PlanPackage[] = [
  { id: 'mini',       name: 'Mini',       price: 599000,  billing: 'Bulan', max_users: 15, max_child_orgs: 1,    max_branches: 3  },
  { id: 'enterprise', name: 'Enterprise', price: 1299000, billing: 'Bulan', max_users: null, max_child_orgs: null, max_branches: null },
]

export default async function PlanPage() {
  let packages: PlanPackage[] = FALLBACK_PACKAGES

  try {
    const { rows } = await queryPostgres<PlanPackage>(
      `SELECT id, name, price, billing, max_users, max_child_orgs, max_branches
       FROM saas_packages
       WHERE is_active = true AND LOWER(name) = ANY($1)
       ORDER BY price ASC`,
      [['mini', 'enterprise']]
    )
    if (rows.length > 0) packages = rows
  } catch (err) {
    console.error('[PlanPage] Gagal memuat paket dari database, pakai fallback:', err)
  }

  return <PlanClient packages={packages} />
}
