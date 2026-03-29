import { getActiveOrg, getInvitations } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import BusinessClient from './BusinessClient'
import { createClient } from '@/lib/supabase/server'

export default async function BusinessSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  const db = supabase as any
  const { data: roles } = await db.from('roles').select('*').eq('org_id', orgData.org.id).order('name')

  return <BusinessClient 
    orgId={orgData.org.id} 
    initialSettings={orgData.org} 
    roles={roles || []}
  />
}
