import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { toPlainSerializable } from '@/lib/serialization'

export default async function POSPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const products = activeBranch ? await getProducts(orgId, activeBranch.id) : []
  const warehouses = activeBranch ? await getWarehouses(orgId, activeBranch.id) : []
  const productsWithStock = (products || [])
    .filter((product: any) => product.is_active)
    .map((product: any) => ({
      ...product,
      stock: Number(product.stock_available || 0),
    }))

  const [customers, allAccounts] = await Promise.all([
    getContacts(orgId, 'CUSTOMER'),
    getChartOfAccounts(orgId),
  ])
  const accounts = allAccounts
    .filter((account) => account.is_active)
    .map((account) => ({
      id: account.id,
      name: account.name,
      code: account.code,
    }))
    
  return (
    <POSClient
      orgId={orgId}
      org={toPlainSerializable(orgData.org)}
      products={toPlainSerializable(productsWithStock)}
      customers={toPlainSerializable(customers)}
      accounts={toPlainSerializable(accounts)}
      warehouses={toPlainSerializable(warehouses || [])}
      currentUser={session.user}
      activeBranchId={activeBranch?.id || null}
      activeBranchName={activeBranch?.name || null}
    />
  )
}
