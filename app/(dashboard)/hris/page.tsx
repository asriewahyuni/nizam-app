import { canSelectAllBranches, getActiveBranch, getActiveOrg, getInvitations } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getEmployeeTransferHistory, getEmployees } from '@/modules/hris/actions/employee.actions'
import { getPayrollComponents, getPayrollRuns } from '@/modules/hris/actions/payroll.actions'
import { getAttendanceRecords } from '@/modules/hris/actions/attendance.actions'
import { getLeaveRequests } from '@/modules/hris/actions/leave.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import { createAdminClient, createClient } from '@/lib/supabase/server'
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

export default async function HrisPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams
  const defaultTab = (searchParams.tab || 'EMPLOYEES').toUpperCase()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const supabase = await createClient()
  const admin = await createAdminClient()
  const { data: roles } = await supabase.from('roles').select('*').eq('org_id', orgData.org.id).order('name')
  const { data: branches } = await supabase.from('branches').select('id, name, code, pic_employee_id').eq('org_id', orgData.org.id).eq('is_active', true).order('name')

  let transferTargets: TransferTarget[] = []
  let transferDisabledReason: string | null = null
  let childOrgOptions: ChildOrgPicOption[] = []
  const sourceRole = String(orgData.role || '').toLowerCase()
  const sourceCanTransferEmployee = ['owner', 'admin'].includes(sourceRole)
  const isChildOrg = Boolean(orgData.org?.parent_org_id)
  const holdingOrgId = String(isChildOrg ? orgData.org.parent_org_id : orgData.org.id)

  if (!isChildOrg && sourceCanTransferEmployee) {
    const { data: childOrgsWithManager, error: childOrgsWithManagerError } = await admin
      .from('organizations')
      .select('id, name, manager_employee_id')
      .eq('parent_org_id', orgData.org.id)
      .eq('is_active', true)
      .order('name')

    if (!childOrgsWithManagerError) {
      childOrgOptions = ((childOrgsWithManager || []) as Array<{
        id: string
        name: string
        manager_employee_id?: string | null
      }>).map((row) => ({
        id: row.id,
        name: row.name,
        manager_employee_id: row.manager_employee_id || null,
      }))
    } else {
      // Fallback untuk environment lama yang belum punya kolom manager_employee_id.
      const { data: fallbackChildOrgs } = await admin
        .from('organizations')
        .select('id, name')
        .eq('parent_org_id', orgData.org.id)
        .eq('is_active', true)
        .order('name')

      childOrgOptions = ((fallbackChildOrgs || []) as Array<{ id: string; name: string }>).map((row) => ({
        id: row.id,
        name: row.name,
        manager_employee_id: null,
      }))
    }
  }

  if (!sourceCanTransferEmployee) {
    transferDisabledReason = 'Hanya owner/admin pada organisasi asal yang dapat memproses mutasi.'
  } else if (sourceCanTransferEmployee) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      let canTransferAcrossHolding = !isChildOrg
      if (isChildOrg) {
        const { data: parentMembership } = await supabase
          .from('org_members')
          .select('role')
          .eq('org_id', holdingOrgId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
        const typedParentMembership = parentMembership as { role?: string | null } | null
        const holdingRole = String(typedParentMembership?.role || '').toLowerCase()
        canTransferAcrossHolding = ['owner', 'admin'].includes(holdingRole)
      }

      let targetOrgRows: Array<{ orgId: string; orgName: string }> = []
      if (canTransferAcrossHolding) {
        const { data: siblingOrgs } = await admin
          .from('organizations')
          .select('id, name, parent_org_id, is_active')
          .or(`id.eq.${holdingOrgId},parent_org_id.eq.${holdingOrgId}`)
          .eq('is_active', true)
          .order('name')

        const typedSiblingOrgs = (siblingOrgs || []) as SiblingOrgRow[]
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
        const { data: targetBranches } = await admin
          .from('branches')
          .select('id, name, code, org_id')
          .in('org_id', targetOrgIds)
          .eq('is_active', true)
          .order('name')

        const typedTargetBranches = (targetBranches || []) as Array<{
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
