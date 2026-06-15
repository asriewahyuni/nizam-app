// app/(dashboard)/wacrm/onboarding/page.tsx
// Server component: route guard + fetch state → delegate render ke client wizard

import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { isModuleAvailableForOrg, getModuleByKey } from '@/modules/marketplace/lib/module-registry'
import { WaCrmOnboardingClient } from './WaCrmOnboardingClient'

const MODULE_KEY = 'WA_CRM'

export default async function WaCrmOnboardingPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  // Blok akses jika org belum dalam daftar beta
  const waCrmDef = getModuleByKey(MODULE_KEY)
  if (waCrmDef && !isModuleAvailableForOrg(waCrmDef, orgId)) redirect('/marketplace')

  const instance = await getModuleInstanceStatus(orgId, MODULE_KEY)
  if (instance?.status === 'READY') redirect('/wacrm')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.kliknizam.app'
  const webhookUrl = `${appUrl}/api/wacrm/webhook/${orgId}`
  const savedSettings = (instance?.settings ?? {}) as Record<string, string>

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <WaCrmOnboardingClient
        orgId={orgId}
        webhookUrl={webhookUrl}
        savedSettings={savedSettings}
      />
    </div>
  )
}
