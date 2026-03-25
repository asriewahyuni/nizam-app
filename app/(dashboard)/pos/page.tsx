import { createClient } from '@/lib/supabase/server'
import POSClient from './POSClient'

export default async function POSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orgMember } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()

  if (!orgMember) return null
  
  const orgId = orgMember.org_id

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
    
  return <POSClient orgId={orgId} products={productsWithStock} customers={customers || []} accounts={accounts || []} currentUser={user} />
}
