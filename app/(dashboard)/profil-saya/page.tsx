'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getMyAttendanceRecords, getMyExpenseClaims, getMyLeaveRequests } from '@/modules/hris/actions/self-service.actions'
import ProfilSayaClient from './ProfilSayaClient'

export default async function ProfilSayaPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  const userId = String(orgData.user?.id || '').trim()

  const [{ data: employee }, attendanceRecords, leaveRequests, expenseClaims] = await Promise.all([
    supabase
      .from('employees')
      .select('*, branch:branches!employees_branch_id_fkey(id, name, code)')
      .eq('org_id', orgData.org.id)
      .eq('user_id', userId)
      .maybeSingle(),
    getMyAttendanceRecords(orgData.org.id),
    getMyLeaveRequests(orgData.org.id),
    getMyExpenseClaims(orgData.org.id),
  ])

  return (
    <ProfilSayaClient
      employee={employee}
      orgId={orgData.org.id}
      userName={orgData.user?.user_metadata?.full_name || orgData.user?.email || ''}
      initialAttendanceRecords={attendanceRecords}
      initialLeaveRequests={leaveRequests}
      initialExpenseClaims={expenseClaims}
    />
  )
}
