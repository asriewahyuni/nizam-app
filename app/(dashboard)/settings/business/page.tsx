import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import BusinessClient from './BusinessClient'

export default async function BusinessSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  return <BusinessClient orgId={orgData.org.id} initialSettings={orgData.org.settings} />
}
