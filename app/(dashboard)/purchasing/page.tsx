import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPurchases, getPurchaseRequests } from '@/modules/purchasing/actions/purchasing.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import PurchasingClient from './PurchasingClient'

import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function PurchasingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'

  const [purchases, vendors, products, coa, purchaseRequests] = await Promise.all([
    getPurchases(orgId),
    getContacts(orgId, 'SUPPLIER'),
    getProducts(orgId),
    getAccountBalances(orgId),
    getPurchaseRequests(orgId)
  ])

  return (
    <div className="p-10 space-y-10">
      <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Purchasing Dashboard...</div>}>
        <PurchasingClient 
          orgId={orgId}
          orgName={orgName}
          org={orgData.org}
          purchases={purchases}
          vendors={vendors}
          products={products}
          coa={coa}
          purchaseRequests={purchaseRequests}
        />
      </Suspense>
    </div>
  )
}
