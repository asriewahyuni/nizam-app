import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getPurchases, getPurchaseRequests } from '@/modules/purchasing/actions/purchasing.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import PurchasingClient from './PurchasingClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function PurchasingPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const activeBranch = await getActiveBranch(orgId)

  const [purchases, vendors, products, coa, purchaseRequests] = await Promise.all([
    getPurchases(orgId, activeBranch?.id),
    getContacts(orgId, 'SUPPLIER'),
    getProducts(orgId),
    getAccountBalances(orgId),
    getPurchaseRequests(orgId, activeBranch?.id)
  ])

  return (
    <div className="p-10 space-y-10">
      <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Purchasing Dashboard...</div>}>
        <PurchasingClient 
          orgId={orgId}
          orgName={orgName}
          org={orgData.org}
          activeBranchId={activeBranch?.id || null}
          activeBranchName={activeBranch?.name || null}
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
