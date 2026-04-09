import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getQuotations } from '@/modules/sales/actions/sales.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import QuotationClient from './QuotationClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function QuotationsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const supabase = await createClient()
  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const orgSettings = orgData.org.settings || {}
  const activeBranch = await getActiveBranch(orgId)
  const [quotations, { data: customers }, products] = await Promise.all([
    getQuotations(orgId, activeBranch?.id),
    supabase.from('contacts').select('id, name').eq('org_id', orgId).eq('type', 'CUSTOMER'),
    getProducts(orgId, activeBranch?.id),
  ])

  return (
    <QuotationClient
      orgId={orgId}
      orgName={orgName}
      orgSettings={orgSettings}
      activeBranchName={activeBranch?.name || null}
      quotations={quotations}
      customers={customers || []}
      products={products || []}
    />
  )
}
