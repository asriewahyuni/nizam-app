import { redirect } from 'next/navigation'
import PromoClient from './PromoClient'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSalesPromos } from '@/modules/sales/actions/promo.actions'

export default async function PromosPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const promos = await getSalesPromos(orgData.org.id)

  return <PromoClient orgId={orgData.org.id} initialPromos={promos} />
}
