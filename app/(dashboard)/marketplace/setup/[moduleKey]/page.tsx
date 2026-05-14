import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
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

  // Use full registry object
  const mod = getModuleByKey(moduleKey)
  if (!mod) return redirect('/marketplace')

  // Recreate as plain object to avoid serialization issues
  const safeMod = {
    key: mod.key,
    name: mod.name,
    tagline: mod.tagline,
    description: mod.description,
    icon: mod.icon,
    color: mod.color,
    href: mod.href,
    isCore: mod.isCore,
    category: mod.category,
    coaInjectionFn: mod.coaInjectionFn,
    onboardingSteps: mod.onboardingSteps,
    tags: mod.tags,
    requires: mod.requires,
  }

  return <SetupClient mod={safeMod} />
}
