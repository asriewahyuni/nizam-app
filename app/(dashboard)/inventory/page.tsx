import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getInventoryMutations,
  getInventoryWarehouseSnapshot,
  getProducts,
} from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const [products, warehouses, warehouseSnapshot, recentMutations] = await Promise.all([
    getProducts(orgData.org.id, activeBranch?.id),
    getWarehouses(orgData.org.id, activeBranch?.id),
    getInventoryWarehouseSnapshot(orgData.org.id, activeBranch?.id),
    getInventoryMutations(orgData.org.id, activeBranch?.id),
  ])

  return (
    <Suspense fallback={<div className="p-5 text-center font-semibold animate-pulse">Loading Inventory Data...</div>}>
      <InventoryClient 
        orgId={orgData.org.id} 
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialProducts={products}
        warehouseSnapshot={warehouseSnapshot}
        recentMutations={recentMutations}
        warehouses={warehouses}
      />
    </Suspense>
  )
}
