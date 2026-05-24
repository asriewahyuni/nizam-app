import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createClient } from '@/lib/supabase/server'
import {
  getMyAttendanceRecords,
  getMyLeaveRequests,
  getMyExpenseClaims,
  getMyPayslips,
} from '@/modules/hris/actions/self-service.actions'
import { KaryawanClient } from './KaryawanClient'

export const dynamic = 'force-dynamic'

export default async function KaryawanPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  const userId = String(orgData.user?.id || '').trim()

  const [{ data: employee }, attendance, leaveRequests, expenseClaims, payslips] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, nik, job_title, department, avatar_url, branch:branches!employees_branch_id_fkey(id, name)')
      .eq('org_id', orgData.org.id)
      .eq('user_id', userId)
      .maybeSingle(),
    getMyAttendanceRecords(orgData.org.id),
    getMyLeaveRequests(orgData.org.id),
    getMyExpenseClaims(orgData.org.id),
    getMyPayslips(orgData.org.id),
  ])

  return (
    <KaryawanClient
      orgId={orgData.org.id}
      orgName={orgData.org.name}
      employee={employee}
      userName={orgData.user?.user_metadata?.full_name || orgData.user?.email || ''}
      initialAttendance={attendance}
      initialLeaveRequests={leaveRequests}
      initialExpenseClaims={expenseClaims}
      initialPayslips={payslips}
    />
  )
}
