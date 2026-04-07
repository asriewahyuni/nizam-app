import { getActiveOrg, getBranches, getInvitations, getOrgMembers } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { getOrgRoles } from '@/modules/organization/actions/hris.actions'
import { toPlainSerializable } from '@/lib/serialization'

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
      initialMembers={toPlainSerializable(members || [])}
      branches={toPlainSerializable(branches || [])}
      roles={toPlainSerializable(rolesResult.roles || [])}
      initialInvitations={toPlainSerializable(invitations || [])}
    />
  )
}
