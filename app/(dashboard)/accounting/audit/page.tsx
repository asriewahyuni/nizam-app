import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAuditOverview } from '@/modules/accounting/actions/audit.actions'
import { AuditClient } from './AuditClient'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Only owners/admins can see Audit Dashboard
  if (!['owner', 'admin'].includes(orgData.role)) {
    redirect('/dashboard')
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
