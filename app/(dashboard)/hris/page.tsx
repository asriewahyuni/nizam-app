import { canSelectAllBranches, getActiveBranch, getActiveOrg, getInvitations } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/modules/hris/actions/employee.actions'
import { getPayrollComponents, getPayrollRuns } from '@/modules/hris/actions/payroll.actions'
import { getAttendanceRecords } from '@/modules/hris/actions/attendance.actions'
import { getLeaveRequests } from '@/modules/hris/actions/leave.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import { createClient } from '@/lib/supabase/server'
import HrisClient from './HrisClient'

export default async function HrisPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams
  const defaultTab = (searchParams.tab || 'EMPLOYEES').toUpperCase()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const supabase = await createClient()
  const { data: roles } = await supabase.from('roles').select('*').eq('org_id', orgData.org.id).order('name')

  const [employees, payrollComponents, accounts, payrollRuns, attendanceRecords, leaveRequests, invitations, allowAllBranchSelection] = await Promise.all([
    getEmployees(orgData.org.id, activeBranch?.id),
    getPayrollComponents(orgData.org.id),
    getAccountBalances(orgData.org.id),
    getPayrollRuns(orgData.org.id, activeBranch?.id),
    getAttendanceRecords(orgData.org.id, activeBranch?.id),
    getLeaveRequests(orgData.org.id, activeBranch?.id),
    getInvitations(orgData.org.id),
    canSelectAllBranches(orgData.org.id),
  ])

  return <HrisClient 
    orgId={orgData.org.id} 
    activeBranchId={activeBranch?.id ?? null}
    activeBranchName={activeBranch?.name ?? null}
    allowAllBranchSelection={allowAllBranchSelection}
    initialEmployees={employees} 
    initialPayrollComponents={payrollComponents}
    initialPayrollRuns={payrollRuns}
    initialAttendanceRecords={attendanceRecords}
    initialLeaveRequests={leaveRequests}
    accounts={accounts}
    settings={orgData.org.settings}
    roles={roles || []}
    initialInvitations={invitations || []}
    defaultTab={defaultTab as any}
  />
}
