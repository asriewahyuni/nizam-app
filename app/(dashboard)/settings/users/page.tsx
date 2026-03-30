import { getActiveOrg, getInvitations } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { createClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const orgData = await getActiveOrg()
  if (!orgData || orgData.role !== 'owner') return redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: members }, { data: roles }, invitations] = await Promise.all([
    supabase
      .from('org_members')
      .select(`
        *,
        user:user_id (
          email
        )
      `)
      .eq('org_id', orgData.org.id),
    supabase
      .from('roles')
      .select('*')
      .eq('org_id', orgData.org.id)
      .order('name'),
    getInvitations(orgData.org.id)
  ])

  return (
    <UsersClient
      orgId={orgData.org.id}
      initialMembers={members || []}
      roles={roles || []}
      initialInvitations={invitations || []}
    />
  )
}
