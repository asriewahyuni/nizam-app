import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'

export default async function POSPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const supabase = await createClient()
  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const [products, warehouses, { data: customers }, { data: accounts }] = await Promise.all([
    activeBranch ? getProducts(orgId, activeBranch.id) : Promise.resolve([]),
    activeBranch ? getWarehouses(orgId, activeBranch.id) : Promise.resolve([]),
    supabase.from('contacts').select('id, name, phone').eq('org_id', orgId).eq('type', 'CUSTOMER'),
    supabase.from('accounts').select('id, name, code').eq('org_id', orgId).eq('is_active', true),
  ])
  const productsWithStock = (products || [])
    .filter((product) => product.is_active)
    .map((product) => ({
      ...product,
      stock: Number(product.stock_available || 0),
    }))
    
  return (
    <POSClient
      orgId={orgId}
      org={orgData.org}
      products={productsWithStock}
      customers={customers || []}
      accounts={accounts || []}
      warehouses={warehouses || []}
      currentUser={orgData.user}
      activeBranchId={activeBranch?.id || null}
      activeBranchName={activeBranch?.name || null}
    />
  )
}
