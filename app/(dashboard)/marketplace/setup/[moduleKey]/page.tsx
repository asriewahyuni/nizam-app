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

  // ═══ 13 PROPS (same structure as getModuleByKey result) ═══
  const mod = {
    key: moduleKey,
    name: moduleKey,
    tagline: 'Tagline module',
    description: 'Setup untuk modul ini.',
    icon: '🕌',
    color: 'bg-emerald-600',
    href: '/marketplace',
    isCore: false,
    category: 'business_type',
    coaInjectionFn: 'inject_test_coa',
    onboardingSteps: [
      { id: 'step1', title: 'Langkah 1', description: 'Deskripsi langkah 1' },
    ],
    tags: ['tag1', 'tag2'],
    requires: ['Finance'],
  }

  return <SetupClient mod={mod} />
}
