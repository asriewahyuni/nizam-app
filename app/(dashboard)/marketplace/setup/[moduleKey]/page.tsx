import { redirect } from 'next/navigation'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

export default async function OldGenericSetupPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>
}) {
  const { moduleKey } = await params
  const modDef = getModuleByKey(moduleKey)

  if (modDef?.href) {
    redirect(`${modDef.href}/onboarding`)
  }

  redirect('/marketplace')
}
