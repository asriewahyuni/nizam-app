import { createClient } from '@/lib/supabase/server'
import { getQuotations } from '@/modules/sales/actions/sales.actions'
import QuotationClient from './QuotationClient'

import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function QuotationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  const quotations = await getQuotations(orgId)
  
  const { data: customers } = await supabase.from('contacts').select('id, name').eq('org_id', orgId).eq('type', 'CUSTOMER')
  const { data: products } = await supabase.from('products').select('id, name, selling_price').eq('org_id', orgId).eq('is_active', true)

  return <QuotationClient orgId={orgId} quotations={quotations} customers={customers || []} products={products || []} />
}
