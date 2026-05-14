'use server'

import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

/**
 * Server action for setup page — returns module data as safe JSON.
 * Avoids React Flight serialization issues with complex props.
 */
export async function getSetupModData(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData || !orgData.org) throw new Error('Not authenticated')

  const mod = getModuleByKey(moduleKey)
  if (!mod) throw new Error('Module not found')

  return {
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
}

export async function completeSetupOnboarding(moduleKey: string) {
  const { revalidatePath } = await import('next/cache')
  const { redirect } = await import('next/navigation')

  const orgData = await getActiveOrg()
  if (!orgData || !orgData.org) throw new Error('Not authenticated')

  const supabase = await (await import('@/lib/supabase/client')).createClient()

  const { error } = await supabase
    .from('org_module_instances')
    .update({ status: 'READY', ready_at: new Date().toISOString() })
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)

  if (error) throw new Error(error.message)

  revalidatePath('/marketplace')
  revalidatePath('/', 'layout')

  return { success: true, redirectTo: `/${moduleKey.toLowerCase().replace(/\s+/g, '')}` }
}
