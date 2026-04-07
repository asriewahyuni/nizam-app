import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getBoms, getWorkOrders } from '@/modules/factory/actions/factory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { ManufacturingClient } from './ManufacturingClient'

export const revalidate = 0

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

  const safeBoms = toPlainValue(boms) as typeof boms
  const safeWorkOrders = toPlainValue(workOrders) as typeof workOrders
  const safeProducts = toPlainValue(products) as typeof products
  const safeWarehouses = toPlainValue(warehouses) as typeof warehouses

  return (
    <div className="p-4 md:p-8">
      <ManufacturingClient 
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        boms={safeBoms}
        workOrders={safeWorkOrders}
        products={safeProducts || []}
        warehouses={safeWarehouses || []}
      />
    </div>
  )
}
