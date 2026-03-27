import { createClient } from '@/lib/supabase/server'
import POSClient from './POSClient'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id

  // Fetch active products with total stock
  const { data: products } = await supabase.from('products').select('*, inventory_stocks(quantity)')
    .eq('is_active', true)
    .eq('org_id', orgId)

  // Sub-process: manually aggregate quantity if needed or use the first record if POS uses single WH
  const productsWithStock = products?.map(p => ({
     ...p,
     stock: p.inventory_stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0
  })) || []

  // Fetch customers
  const { data: customers } = await supabase.from('contacts').select('id, name, phone')
    .eq('org_id', orgId).eq('type', 'CUSTOMER')

  // Fetch cash accounts for payment
  const { data: accounts } = await supabase.from('accounts').select('id, name, code')
    .eq('org_id', orgId).eq('is_active', true)
    
  return <POSClient orgId={orgId} org={orgData.org} products={productsWithStock} customers={customers || []} accounts={accounts || []} currentUser={user} />
}
