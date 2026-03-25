import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAuditLogs } from '@/modules/organization/actions/audit.actions'
import { AuditClient } from './AuditClient'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Hanya C-Level / Manajer yg bisa lihat Audit Trail
  if (!['owner', 'admin'].includes(orgData.role)) {
    redirect('/dashboard')
  }

  const logs = await getAuditLogs(100)

  return (
    <div className="p-8">
      {/* 
        Force Recompile HMR Cache: 
        Menghapus old action payload.
      */}
      <AuditClient logs={logs} orgName={orgData.org.name} orgId={orgData.org.id} />
    </div>
  )
}
