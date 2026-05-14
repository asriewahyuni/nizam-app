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

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const mod = getModuleByKey(moduleKey)
  if (!mod) return notFound()

  const isEnabled = orgData.enabledModules?.some(
    (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, '') === moduleKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  )
  if (!isEnabled) {
    // Maybe user just activated — check if module_key exists in enabled_modules more leniently
    const isEnabledLoose = (orgData.enabledModules || []).some(
      (m: string) => m.toLowerCase().includes(moduleKey.toLowerCase().replace(/[^a-z0-9]/g, '')) 
        || moduleKey.toLowerCase().replace(/[^a-z0-9]/g, '').includes(m.toLowerCase().replace(/[^a-z0-9]/g, ''))
    )
    if (!isEnabledLoose) return redirect('/marketplace')
  }

  const instance = await getModuleInstanceStatus(orgData.org.id, moduleKey)
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
