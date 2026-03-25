import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { BranchManagementClient } from './BranchManagementClient'

export const revalidate = 0

export default async function BranchSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const branches = await getBranches(orgData.org.id)

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <BranchManagementClient 
        orgId={orgData.org.id}
        branches={branches || []}
      />
    </div>
  )
}
