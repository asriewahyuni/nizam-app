import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getBoms, getWorkOrders } from '@/modules/factory/actions/factory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { ManufacturingClient } from './ManufacturingClient'

export const revalidate = 0

export default async function ManufacturingPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  // Fetch all necessary data
  const [boms, workOrders, products, warehouses] = await Promise.all([
    getBoms(orgData.org.id, activeBranch?.id),
    getWorkOrders(orgData.org.id, activeBranch?.id),
    getProducts(orgData.org.id, activeBranch?.id),
    getWarehouses(orgData.org.id, activeBranch?.id)
  ])

  return (
    <div className="p-4 md:p-8">
      <ManufacturingClient 
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        boms={boms}
        workOrders={workOrders}
        products={products || []}
        warehouses={warehouses || []}
      />
    </div>
  )
}
