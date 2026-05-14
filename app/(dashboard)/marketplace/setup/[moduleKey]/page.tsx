import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'
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

  const mod = getModuleByKey(moduleKey)
  if (!mod) return redirect('/marketplace')

  const orgId = orgData.org.id
  const instance = await getModuleInstanceStatus(orgId, moduleKey)
  if (instance?.status === 'READY') return redirect(mod.href)

  return <SetupClient mod={mod} />
}
