import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getBoms, getWorkOrders } from '@/modules/factory/actions/factory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { ManufacturingClient } from './ManufacturingClient'

export const revalidate = 0

export default async function ManufacturingPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()

  // Fetch all necessary data
  const [boms, workOrders, { data: productsRaw }, warehouses] = await Promise.all([
    getBoms(orgData.org.id),
    getWorkOrders(orgData.org.id),
    supabase.from('products').select('id, name, sku, average_cost, purchase_price, unit, inventory_stocks(quantity)').eq('org_id', orgData.org.id),
    getWarehouses(orgData.org.id)
  ])

  const products = productsRaw?.map(p => ({
     ...p,
     stock: p.inventory_stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0
  })) || []

  return (
    <div className="p-4 md:p-8">
      <ManufacturingClient 
        orgId={orgData.org.id}
        boms={boms}
        workOrders={workOrders}
        products={products || []}
        warehouses={warehouses || []}
      />
    </div>
  )
}
