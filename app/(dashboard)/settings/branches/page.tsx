import { getActiveOrg, getBranches, getHoldingEmployees, getOrgLimits } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { BranchManagementClient } from './BranchManagementClient'

export const revalidate = 0

export default async function BranchSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const branches = await getBranches(orgData.org.id)

  // Ambil limit & usage dari SaaS package
  const limits = await getOrgLimits(orgData.org.id)

  // Ambil karyawan untuk pilihan PIC (sama seperti sub-orgs)
  const employees = await getHoldingEmployees(orgData.org.id)
  const canMutate = orgData.role === 'owner'
  const isAdmin = orgData.role === 'owner' || orgData.role === 'admin'

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <BranchManagementClient
        orgId={orgData.org.id}
        branches={branches || []}
        employees={employees}
        canMutate={canMutate}
        isAdmin={isAdmin}
        limits={limits}
      />
    </div>
  )
}
