import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPurchases } from '@/modules/purchasing/actions/purchasing.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import PurchasingClient from './PurchasingClient'

export default async function PurchasingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = (await supabase
    .from('org_members')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()) as any

  if (!member) redirect('/onboarding')

  const orgId = member.org_id
  const orgName = member.organizations?.name || 'Nizam'

  const [purchases, vendors, products, coa] = await Promise.all([
    getPurchases(orgId),
    getContacts(orgId, 'SUPPLIER'),
    getProducts(orgId),
    getAccountBalances(orgId)
  ])

  return (
    <div className="p-10 space-y-10">
      <Suspense fallback={<div className="p-10 text-center font-black animate-pulse">Loading Purchasing Dashboard...</div>}>
        <PurchasingClient 
          orgId={orgId}
          orgName={orgName}
          purchases={purchases}
          vendors={vendors}
          products={products}
          coa={coa}
        />
      </Suspense>
    </div>
  )
}
