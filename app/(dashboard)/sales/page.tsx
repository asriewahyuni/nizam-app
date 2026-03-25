import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSales } from '@/modules/sales/actions/sales.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import SalesClient from './SalesClient'

export default async function SalesPage() {
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
  const orgSettings = member.organizations?.settings || {}

  const [sales, customers, products, coa] = await Promise.all([
    getSales(orgId),
    getContacts(orgId, 'CUSTOMER'),
    getProducts(orgId),
    getChartOfAccounts(orgId)
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
          coa={coa}
          orgSettings={orgSettings}
        />
      </Suspense>
    </div>
  )
}
