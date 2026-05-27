import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getQuickStartData } from '@/modules/onboarding/actions/quick-start.actions'
import { QuickStartClient } from './QuickStartClient'

export const metadata = {
  title: 'Panduan Memulai — Nizam ERP',
}

export default async function QuickStartPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const data = await getQuickStartData()
  if (!data) return redirect('/dashboard')

  return <QuickStartClient data={data} />
}
