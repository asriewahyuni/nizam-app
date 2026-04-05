import { getActiveOrg, getBranches, getInvitations, getOrgMembers } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { getOrgRoles } from '@/modules/organization/actions/hris.actions'

export default async function UsersPage() {
  const orgData = await getActiveOrg()
  if (!orgData || !['owner', 'admin'].includes(orgData.role)) return redirect('/dashboard')

  const [members, branches, rolesResult, invitations] = await Promise.all([
    getOrgMembers(orgData.org.id),
    getBranches(orgData.org.id),
    getOrgRoles(orgData.org.id),
    getInvitations(orgData.org.id)
  ])

  return (
    <UsersClient
      orgId={orgData.org.id}
      initialMembers={members || []}
      branches={branches || []}
      roles={rolesResult.roles || []}
      initialInvitations={invitations || []}
    />
  )
}
