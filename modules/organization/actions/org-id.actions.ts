'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'

const DEMO_EMAIL = 'demo@nizam.app'

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
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

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

  if (activeOrgIdCookie) {
    const { data } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgIdCookie)
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
    .maybeSingle()

  return data?.org_id ?? null
}

/**
 * Server action: returns the verified active branch_id for the provided org.
 * Returns null when "Semua Unit" is selected or when the cookie no longer matches
 * an active branch in the current organization.
 */
export async function getActiveBranchIdAction(orgId: string): Promise<string | null> {
  const trimmedOrgId = orgId.trim()
  if (!trimmedOrgId) return null

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const activeBranchIdCookie = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value
  if (activeBranchIdCookie) {
    const { data } = await db
      .from('branches')
      .select('id')
      .eq('id', activeBranchIdCookie)
      .eq('org_id', trimmedOrgId)
      .eq('is_active', true)
      .maybeSingle()

    if (data?.id) return data.id
  }

  const { data } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(2)

  if (!Array.isArray(data) || data.length !== 1) return null
  return data[0]?.id ?? null
}
