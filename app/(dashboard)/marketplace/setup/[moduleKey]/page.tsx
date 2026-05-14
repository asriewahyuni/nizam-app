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

  // Build object incrementally — test each property
  const mod: Record<string, any> = {}
  mod.icon = '🕌'
  mod.name = moduleKey
  mod.description = 'Setup untuk modul ini.'
  mod.href = '/marketplace'
  return <SetupClient mod={mod} />
}
