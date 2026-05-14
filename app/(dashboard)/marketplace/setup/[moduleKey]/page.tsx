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

  // TEST 1: tambah properti 'key'
  const mod: Record<string, any> = {
    icon: '🕌',
    name: moduleKey,
    description: 'Setup untuk modul ini.',
    href: '/marketplace',
    key: moduleKey,
  }

  return <SetupClient mod={mod} />
}
