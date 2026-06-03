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
  const decodedModuleKey = decodeURIComponent(moduleKey)

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const mod = getModuleByKey(decodedModuleKey)
  if (!mod) return notFound()

  // If not core and not enabled, redirect to marketplace
  const isEnabled = orgData.enabledModules?.some(
    (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, '') === decodedModuleKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  )
  if (!isEnabled) return redirect('/marketplace')

  // If already READY, go to module home
  const instance = await getModuleInstanceStatus(orgData.org.id, decodedModuleKey)
  if (instance?.status === 'READY') return redirect(mod.href)

  const coaInstalled = instance?.coa_installed ?? false
  const currentSettings = instance?.settings ?? (mod.defaultSettings || {})

  return (
    <SetupClient
      mod={mod}
      coaInstalled={coaInstalled}
      currentSettings={currentSettings}
    />
  )
}
