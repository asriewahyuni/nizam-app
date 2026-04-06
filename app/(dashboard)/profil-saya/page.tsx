'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getMyAttendanceRecords, getMyExpenseClaims, getMyLeaveRequests } from '@/modules/hris/actions/self-service.actions'
import ProfilSayaClient from './ProfilSayaClient'

export default async function ProfilSayaPage() {
  const session = await auth()
  if (!session?.user?.id) return redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // Find this user's employee record
  const employee = await prisma.employees.findFirst({
    where: {
      org_id: orgData.org.id,
      user_id: session.user.id,
    },
    include: {
      branches: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  const [attendanceRecords, leaveRequests, expenseClaims] = await Promise.all([
    getMyAttendanceRecords(orgData.org.id),
    getMyLeaveRequests(orgData.org.id),
    getMyExpenseClaims(orgData.org.id),
  ])

  return (
    <ProfilSayaClient
      employee={employee ? { ...employee, branch: employee.branches } : null}
      orgId={orgData.org.id}
      userName={orgData.user?.user_metadata?.full_name || orgData.user?.email || ''}
      initialAttendanceRecords={attendanceRecords}
      initialLeaveRequests={leaveRequests}
      initialExpenseClaims={expenseClaims}
    />
  )
}
