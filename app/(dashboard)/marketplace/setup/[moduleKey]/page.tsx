import { redirect } from 'next/navigation'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

const CATEGORIES_WITH_ONBOARDING = ['business_type', 'addon', 'syirkah']

export default async function OldGenericSetupPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>
}) {
  const { moduleKey } = await params
  const modDef = getModuleByKey(moduleKey)

  if (modDef?.href && CATEGORIES_WITH_ONBOARDING.includes(modDef.category)) {
    redirect(`${modDef.href}/onboarding`)
  }

  if (modDef?.href) {
    redirect(modDef.href)
  }

  redirect('/marketplace')
}
