import { createClient } from '@/lib/supabase/server'
import POSClient from './POSClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const products = activeBranch ? await getProducts(orgId, activeBranch.id) : []
  const productsWithStock = (products || [])
    .filter((product: any) => product.is_active)
    .map((product: any) => ({
      ...product,
      stock: Number(product.stock_available || 0),
    }))

  // Fetch customers
  const { data: customers } = await supabase.from('contacts').select('id, name, phone')
    .eq('org_id', orgId).eq('type', 'CUSTOMER')

  // Fetch cash accounts for payment
  const { data: accounts } = await supabase.from('accounts').select('id, name, code')
    .eq('org_id', orgId).eq('is_active', true)
    
  return (
    <POSClient
      orgId={orgId}
      org={orgData.org}
      products={productsWithStock}
      customers={customers || []}
      accounts={accounts || []}
      currentUser={user}
      activeBranchId={activeBranch?.id || null}
      activeBranchName={activeBranch?.name || null}
    />
  )
}
