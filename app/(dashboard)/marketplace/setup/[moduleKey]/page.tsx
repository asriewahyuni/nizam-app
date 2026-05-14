import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'
import { getModuleInstanceStatus, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'
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

  const mod = getModuleByKey(moduleKey)
  if (!mod) return redirect('/marketplace')

  const instance = await getModuleInstanceStatus(orgId, moduleKey)
  if (instance?.status === 'READY') return redirect(mod.href)

  // ⚠️ Next.js 16 React Flight can't serialize arrays of objects.
  // Serialize onboardingSteps as JSON string to work around it.
  const modForClient = {
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
    onboardingStepsJson: JSON.stringify(mod.onboardingSteps),
    tags: mod.tags,
    requires: mod.requires,
  }

  return <SetupClient mod={modForClient} coaInstalled={false} currentSettings={{}} completeOnboarding={completeModuleOnboarding} />
}
