import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { WarehouseClient } from './WarehouseClient'

export const dynamic = 'force-dynamic'

export default async function WarehousesPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Hanya owner, admin, manager yang bisa akses (opsional, bisa dibatasi di DB RLS)
  if (!['owner', 'admin', 'manager', 'staff'].includes(orgData.role)) {
    redirect('/dashboard')
  }

  const activeBranch = await getActiveBranch(orgData.org.id)
  const warehouses = await getWarehouses(orgData.org.id, activeBranch?.id)

  return (
    <div className="p-8">
      <WarehouseClient
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialWarehouses={warehouses}
        userRole={orgData.role}
      />
    </div>
  )
}
