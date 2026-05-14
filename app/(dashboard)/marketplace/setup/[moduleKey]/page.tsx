import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { SetupClient } from './setup-client'

type Props = {
  params: Promise<{ moduleKey: string }>
}

// Inline module data — no import from module-registry
const KNOWN_MODULES: Record<string, { key: string; name: string; tagline?: string; description?: string; icon?: string; color?: string; href: string; isCore: boolean; category: string; coaInjectionFn?: string; onboardingSteps?: any[]; tags?: string[]; requires?: string[] }> = {
  'Finance': {
    key: 'Finance', name: 'Finance', href: '/accounting',
    isCore: true, category: 'pillar', icon: '💳', color: 'bg-emerald-600',
    description: 'Financial management',
    onboardingSteps: [], tags: [], requires: [],
  },
  'Koperasi Syariah': {
    key: 'Koperasi Syariah', name: 'Koperasi Syariah',
    tagline: 'Koperasi serba usaha berbasis syariah',
    description: 'Koperasi dengan simpanan, pembiayaan murabahah, dan mudharabah multi pihak.',
    icon: '🕌', color: 'bg-emerald-600', href: '/koperasi',
    isCore: false, category: 'business_type',
    coaInjectionFn: 'inject_koperasi_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA', description: 'Instalasi chart of accounts' },
      { id: 'done', title: 'Selesai', description: 'Mulai menggunakan modul' },
    ],
    tags: ['koperasi', 'syariah'],
    requires: ['Finance'],
  },
}

export default async function ModuleSetupPage({ params }: Props) {
  noStore()

  const { moduleKey } = await params
  if (!moduleKey || typeof moduleKey !== 'string') return redirect('/marketplace')

  const orgData = await getActiveOrg()
  if (!orgData || !orgData.org) return redirect('/onboarding')

  const mod = KNOWN_MODULES[moduleKey]
  if (!mod) return redirect('/marketplace')

  return <SetupClient mod={mod} />
}
