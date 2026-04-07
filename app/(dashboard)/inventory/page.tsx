import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import InventoryClient from './InventoryClient'

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item))
  if (typeof value === 'object') {
    if ('toNumber' in (value as Record<string, unknown>) && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber()
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toPlainValue(entry)])
    )
  }
  return value
}

export default async function InventoryPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const products = await getProducts(orgData.org.id, activeBranch?.id)
  const warehouses = await getWarehouses(orgData.org.id, activeBranch?.id)
  const safeProducts = toPlainValue(products) as typeof products
  const safeWarehouses = toPlainValue(warehouses) as typeof warehouses

  return (
    <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Inventory Data...</div>}>
      <InventoryClient 
        orgId={orgData.org.id} 
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialProducts={safeProducts} 
        warehouses={safeWarehouses}
      />
    </Suspense>
  )
}
