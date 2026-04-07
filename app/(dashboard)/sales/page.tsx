import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSales } from '@/modules/sales/actions/sales.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { getActiveResellers } from '@/modules/sales/actions/commission.actions'
import SalesClient from './SalesClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function SalesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const orgSettings = orgData.org.settings || {}
  const activeBranch = await getActiveBranch(orgId)

  const [sales, customers, products, coa, warehouses, resellers] = await Promise.all([
    getSales(orgId, activeBranch?.id),
    getContacts(orgId, 'CUSTOMER'),
    getProducts(orgId, activeBranch?.id),
    getChartOfAccounts(orgId),
    getWarehouses(orgId, activeBranch?.id),
    getActiveResellers(orgId),
  ])

  return (
    <div className="p-10 space-y-10">
      <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Sales Dashboard...</div>}>
        <SalesClient 
          orgId={orgId}
          orgName={orgName}
          sales={sales}
          customers={customers}
          products={products}
          warehouses={warehouses}
          resellers={resellers}
          coa={coa}
          orgSettings={orgSettings}
          activeBranchName={activeBranch?.name || null}
        />
      </Suspense>
    </div>
  )
}
