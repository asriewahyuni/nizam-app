'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@nizam.app'
const ACTIVE_ORG_COOKIE = 'nizam_active_org_id'

/**
 * Server action: returns the active org_id for the current user.
 * Mirrors getActiveOrg() logic exactly, including demo cookie handling.
 * Used by useActiveOrgId() client hook to ensure client-server consistency.
 */
export async function getActiveOrgIdAction(): Promise<string | null> {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Demo user: prioritize the org from session cookie (same as getActiveOrg)
  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const cookieStore = await cookies()
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value
  const activeOrgCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  if (isDemoUser && demoOrgId) {
    // Verify this demo org still exists and belongs to this user
    const { data } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', demoOrgId)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data.org_id
  }

  if (activeOrgCookie) {
    const { data } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgCookie)
      .eq('is_active', true)
      .maybeSingle()

    if (data) return data.org_id
  }

  // Regular lookup: oldest joined active org (consistent with getActiveOrg)
  const { data } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  return data?.org_id ?? null
}
