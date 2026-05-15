import { redirect } from 'next/navigation'
import { getModuleByKey } from '@/lib/saas/module-catalog'

/**
 * Old generic setup page — all 9 operational modules now have their own 
 * dedicated onboarding pages. Redirect to the module-specific onboarding.
 */
export default async function OldGenericSetupPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>
}) {
  const { moduleKey } = await params
  const modDef = getModuleByKey(moduleKey)

  // If module has a dedicated onboarding page, redirect there
  if (modDef?.href) {
    redirect(`${modDef.href}/onboarding`)
  }

  // Fallback: redirect back to marketplace if no matching module
  redirect('/marketplace')
}
