import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const products = await getProducts(orgData.org.id)
  const warehouses = await getWarehouses(orgData.org.id)

  return (
    <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Inventory Data...</div>}>
      <InventoryClient 
        orgId={orgData.org.id} 
        initialProducts={products} 
        warehouses={warehouses}
      />
    </Suspense>
  )
}
