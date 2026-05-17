import { queryPostgres } from '@/lib/db/postgres'
import PlanClient from './PlanClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Paket & Harga — NIZAM ERP',
  description: 'Pilih paket NIZAM ERP yang sesuai dengan kebutuhan bisnis Anda.',
}

export default async function PlanPage() {
  const { rows } = await queryPostgres<{
    id: string
    name: string
    price: number
    billing: string
    max_users: number | null
    max_child_orgs: number | null
    max_branches: number | null
  }>(
    `SELECT id, name, price, billing, max_users, max_child_orgs, max_branches
     FROM saas_packages
     WHERE is_active = true AND LOWER(name) = ANY($1)
     ORDER BY price ASC`,
    [['lite', 'mini', 'enterprise']]
  )

  return <PlanClient packages={rows} />
}
