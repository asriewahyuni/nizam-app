import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

export async function GET(req: NextRequest) {
  try {
    const moduleKey = req.nextUrl.searchParams.get('moduleKey')
    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey is required' }, { status: 400 })
    }

    const orgData = await getActiveOrg()
    if (!orgData || !orgData.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const mod = getModuleByKey(moduleKey)
    if (!mod) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    return NextResponse.json({
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
