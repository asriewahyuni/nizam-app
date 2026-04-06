import { canSelectAllBranches, getActiveBranch, getActiveOrg, getInvitations } from '@/modules/organization/actions/org.actions'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getEmployeeTransferHistory, getEmployees } from '@/modules/hris/actions/employee.actions'
import { getPayrollComponents, getPayrollRuns } from '@/modules/hris/actions/payroll.actions'
import { getAttendanceRecords } from '@/modules/hris/actions/attendance.actions'
import { getLeaveRequests } from '@/modules/hris/actions/leave.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import HrisClient from './HrisClient'

type SiblingOrgRow = {
  id: string
  name: string
  parent_org_id: string | null
  is_active: boolean | null
}

type TransferTargetBranch = {
  id: string
  name: string
  code: string | null
}

type TransferTarget = {
  orgId: string
  orgName: string
  branches: TransferTargetBranch[]
}

type ChildOrgPicOption = {
  id: string
  name: string
  manager_employee_id?: string | null
}

type BranchRow = {
  id: string
  name: string
  code: string | null
  pic_employee_id: string | null
}

export default async function HrisPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams
  const defaultTab = (searchParams.tab || 'EMPLOYEES').toUpperCase()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const session = await auth()
  const user = session?.user
  const [roles, branches] = await Promise.all([
    prisma.roles.findMany({
      where: { org_id: orgData.org.id },
      orderBy: { name: 'asc' },
    }),
    prisma.$queryRaw<BranchRow[]>(Prisma.sql`
      SELECT id::text AS id, name, code, pic_employee_id::text AS pic_employee_id
      FROM public.branches
      WHERE org_id = CAST(${orgData.org.id} AS uuid)
        AND is_active = true
      ORDER BY name ASC
    `),
  ])

  let transferTargets: TransferTarget[] = []
  let transferDisabledReason: string | null = null
  let childOrgOptions: ChildOrgPicOption[] = []
  const sourceRole = String(orgData.role || '').toLowerCase()
  const sourceCanTransferEmployee = ['owner', 'admin'].includes(sourceRole)
  const isChildOrg = Boolean(orgData.org?.parent_org_id)
  const holdingOrgId = String(isChildOrg ? orgData.org.parent_org_id : orgData.org.id)

  if (!isChildOrg && sourceCanTransferEmployee) {
    try {
      const childOrgsWithManager = await prisma.$queryRaw<Array<{
        id: string
        name: string
        manager_employee_id?: string | null
      }>>(Prisma.sql`
        SELECT id::text AS id, name, manager_employee_id::text AS manager_employee_id
        FROM public.organizations
        WHERE parent_org_id = CAST(${orgData.org.id} AS uuid)
          AND is_active = true
        ORDER BY name ASC
      `)
      childOrgOptions = childOrgsWithManager.map((row) => ({
        id: row.id,
        name: row.name,
        manager_employee_id: row.manager_employee_id || null,
      }))
    } catch {
      // Fallback untuk environment lama yang belum punya kolom manager_employee_id.
      const fallbackChildOrgs = await prisma.organizations.findMany({
        where: { parent_org_id: orgData.org.id, is_active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })

      childOrgOptions = (fallbackChildOrgs as Array<{ id: string; name: string }>).map((row) => ({
        id: row.id,
        name: row.name,
        manager_employee_id: null,
      }))
    }
  }

  if (!sourceCanTransferEmployee) {
    transferDisabledReason = 'Hanya owner/admin pada organisasi asal yang dapat memproses mutasi.'
  } else if (sourceCanTransferEmployee) {
    if (user?.id) {
      let canTransferAcrossHolding = !isChildOrg
      if (isChildOrg) {
        const parentMembership = await prisma.org_members.findFirst({
          where: { org_id: holdingOrgId, user_id: user.id, is_active: true },
          select: { role: true },
        })
        const holdingRole = String(parentMembership?.role || '').toLowerCase()
        canTransferAcrossHolding = ['owner', 'admin'].includes(holdingRole)
      }

      let targetOrgRows: Array<{ orgId: string; orgName: string }> = []
      if (canTransferAcrossHolding) {
        const typedSiblingOrgs = await prisma.organizations.findMany({
          where: {
            is_active: true,
            OR: [{ id: holdingOrgId }, { parent_org_id: holdingOrgId }],
          },
          select: { id: true, name: true, parent_org_id: true, is_active: true },
          orderBy: { name: 'asc' },
        }) as SiblingOrgRow[]
        targetOrgRows = typedSiblingOrgs
          .filter((org) => {
            if (!org.id || !org.name) return false
            if (org.id === orgData.org.id) return false
            if (!isChildOrg && org.parent_org_id !== holdingOrgId) return false
            return true
          })
          .map((org) => ({
            orgId: org.id,
            orgName: org.name,
          }))
      }

      if (!canTransferAcrossHolding) {
        transferDisabledReason = 'Mutasi parent/child memerlukan akses owner/admin di organisasi holding.'
      }

      if (targetOrgRows.length > 0) {
        const targetOrgIds = targetOrgRows.map((item) => item.orgId)
        const typedTargetBranches = await prisma.branches.findMany({
          where: { org_id: { in: targetOrgIds }, is_active: true },
          select: { id: true, name: true, code: true, org_id: true },
          orderBy: { name: 'asc' },
        }) as Array<{
          id: string
          name: string
          code: string | null
          org_id: string
        }>
        const branchMap = new Map<string, TransferTargetBranch[]>()
        typedTargetBranches.forEach((branch) => {
          const orgBranches = branchMap.get(branch.org_id) || []
          orgBranches.push({
            id: branch.id,
            name: branch.name,
            code: branch.code,
          })
          branchMap.set(branch.org_id, orgBranches)
        })

        transferTargets = targetOrgRows
          .map((org) => ({
            ...org,
            branches: branchMap.get(org.orgId) || [],
          }))
          .filter((org) => org.branches.length > 0)
        if (transferTargets.length === 0) {
          transferDisabledReason = isChildOrg
            ? 'Parent/child tujuan belum memiliki cabang aktif.'
            : 'Child tujuan belum memiliki cabang aktif.'
        }
      } else if (canTransferAcrossHolding) {
        transferDisabledReason = isChildOrg
          ? 'Belum ada parent/child lain yang aktif dalam holding yang sama.'
          : 'Belum ada child aktif yang terhubung ke holding ini.'
      }
    } else {
      transferDisabledReason = 'Sesi user tidak ditemukan. Silakan login ulang.'
    }
  }

  const [employees, payrollComponents, accounts, payrollRuns, attendanceRecords, leaveRequests, invitations, allowAllBranchSelection, initialTransferHistory] = await Promise.all([
    getEmployees(orgData.org.id, activeBranch?.id),
    getPayrollComponents(orgData.org.id),
    getAccountBalances(orgData.org.id),
    getPayrollRuns(orgData.org.id, activeBranch?.id),
    getAttendanceRecords(orgData.org.id, activeBranch?.id),
    getLeaveRequests(orgData.org.id, activeBranch?.id),
    getInvitations(orgData.org.id),
    canSelectAllBranches(orgData.org.id),
    getEmployeeTransferHistory(orgData.org.id),
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
    branches={branches || []}
    childOrgOptions={childOrgOptions || []}
    transferTargets={transferTargets || []}
    transferDisabledReason={transferDisabledReason}
    initialTransferHistory={initialTransferHistory || []}
    initialInvitations={invitations || []}
    defaultTab={defaultTab}
  />
}
