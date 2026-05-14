import { notFound, redirect } from 'next/navigation'
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

  const orgId = orgData.org.id
  if (!orgId) return redirect('/onboarding')

  const mod = getModuleByKey(moduleKey)
  if (!mod) return notFound()

  // Check enabled — loose
  const enabled = orgData.enabledModules || []
  const normalizedKeys = enabled.map((m: string) => (m || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  const normalizedModuleKey = moduleKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  const isEnabled = normalizedKeys.some((k: string) => k === normalizedModuleKey)

  if (!isEnabled) return redirect('/marketplace')

  const instance = await getModuleInstanceStatus(orgId, moduleKey)

  if (instance?.status === 'READY') return redirect(mod.href)

  return (
    <SetupClient
      mod={mod}
      coaInstalled={instance?.coa_installed ?? false}
      currentSettings={instance?.settings ?? (mod.defaultSettings || {})}
    />
  )
}
