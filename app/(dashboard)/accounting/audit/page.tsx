import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAuditOverview } from '@/modules/accounting/actions/audit.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { AuditClient } from './AuditClient'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  if (!hasRolePermission(orgData.role, orgData.permissions, 'accounting:read')) {
    redirect('/dashboard?error=akses-ditolak')
  }

  const auditData = await getAuditOverview(orgData.org.id)

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <AuditClient 
        orgId={orgData.org.id} 
        initialData={auditData} 
      />
    </div>
  )
}
