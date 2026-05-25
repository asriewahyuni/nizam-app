import { getActiveOrg, getBranches, getInvitations, getOrgMembers } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { createClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const orgData = await getActiveOrg()
  if (!orgData || !['owner', 'admin'].includes(orgData.role)) return redirect('/dashboard?error=akses-ditolak')

  const supabase = await createClient()
  const [members, branches, { data: roles }, invitations] = await Promise.all([
    getOrgMembers(orgData.org.id),
    getBranches(orgData.org.id),
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
      branches={branches || []}
      roles={roles || []}
      initialInvitations={invitations || []}
    />
  )
}
