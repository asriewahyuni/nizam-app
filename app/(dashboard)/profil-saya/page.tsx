'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import ProfilSayaClient from './ProfilSayaClient'

export default async function ProfilSayaPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Find this user's employee record
  const { data: employee } = await (supabase as any)
    .from('employees')
    .select('*')
    .eq('org_id', orgData.org.id)
    .eq('user_id', user?.id)
    .maybeSingle()

  return (
    <ProfilSayaClient
      employee={employee}
      orgId={orgData.org.id}
      userName={orgData.user?.user_metadata?.full_name || orgData.user?.email || ''}
    />
  )
}
