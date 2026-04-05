import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getQuotations } from '@/modules/sales/actions/sales.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import QuotationClient from './QuotationClient'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function QuotationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const quotations = await getQuotations(orgId, activeBranch?.id)
  const customers = await getContacts(orgId, 'CUSTOMER')
  const products = await getProducts(orgId, activeBranch?.id)

  return <QuotationClient orgId={orgId} quotations={quotations} customers={customers} products={products || []} />
}
