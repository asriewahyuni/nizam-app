import { createClient } from '@/lib/supabase/server'
import { getQuotations } from '@/modules/sales/actions/sales.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import QuotationClient from './QuotationClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function QuotationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const orgData = await getActiveOrg()
  if (!orgData) return null

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const quotations = await getQuotations(orgId, activeBranch?.id)
  
  const { data: customers } = await supabase.from('contacts').select('id, name').eq('org_id', orgId).eq('type', 'CUSTOMER')
  const products = await getProducts(orgId, activeBranch?.id)

  return <QuotationClient orgId={orgId} quotations={quotations} customers={customers || []} products={products || []} />
}
