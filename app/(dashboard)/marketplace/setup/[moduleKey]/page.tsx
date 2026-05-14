import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { SetupClient } from './setup-client'

type Props = {
  params: Promise<{ moduleKey: string }>
}

export default async function ModuleSetupPage({ params }: Props) {
  noStore()

  const { moduleKey } = await params
  if (!moduleKey || typeof moduleKey !== 'string') return redirect('/marketplace')

  const orgData = await getActiveOrg()
  if (!orgData || !orgData.org) return redirect('/onboarding')

  // Manual mod object (NOT from getModuleByKey)
  const mod = {
    icon: '🕌',
    name: decodeURIComponent(moduleKey),
    description: 'Halaman setup untuk modul ini.',
    href: '/marketplace',
  }

  return <SetupClient mod={mod} />
}
