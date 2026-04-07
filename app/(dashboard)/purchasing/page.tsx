import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getPurchases, getPurchaseRequests } from '@/modules/purchasing/actions/purchasing.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import PurchasingClient from './PurchasingClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item))
  if (typeof value === 'object') {
    if ('toNumber' in (value as Record<string, unknown>) && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber()
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toPlainValue(entry)])
    )
  }
  return value
}

export default async function PurchasingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

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

  const safePurchases = toPlainValue(purchases)
  const safeVendors = toPlainValue(vendors)
  const safeProducts = toPlainValue(products)
  const safeCoa = toPlainValue(coa)
  const safePurchaseRequests = toPlainValue(purchaseRequests)

  return (
    <div className="p-10 space-y-10">
      <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Purchasing Dashboard...</div>}>
        <PurchasingClient 
          orgId={orgId}
          orgName={orgName}
          org={orgData.org}
          activeBranchId={activeBranch?.id || null}
          activeBranchName={activeBranch?.name || null}
          purchases={safePurchases}
          vendors={safeVendors}
          products={safeProducts}
          coa={safeCoa}
          purchaseRequests={safePurchaseRequests}
        />
      </Suspense>
    </div>
  )
}
