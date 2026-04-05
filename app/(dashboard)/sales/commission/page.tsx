import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import CommissionClient from './CommissionClient'
import { getSales } from '@/modules/sales/actions/sales.actions'

import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'

export default async function CommissionPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const sales = (await getSales(orgId, activeBranch?.id)).filter((sale: any) =>
    ['FINISHED', 'ORDERED'].includes(String(sale.status || ''))
  )

  return <CommissionClient sales={sales} />
}
