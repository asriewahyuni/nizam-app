'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

async function resolveExpenseBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function ensureExpenseBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveExpenseBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
}

export async function getExpenseClaims(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveExpenseBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const claims = await prisma.expense_claims.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      branches: { select: { id: true, name: true, code: true } },
      employees: { select: { first_name: true, last_name: true, nik: true, branch_id: true } },
    },
    orderBy: { claim_date: 'desc' },
  })

  return claims.map((claim) => ({
    ...claim,
    branch: claim.branches,
    employee: claim.employees,
    branches: undefined,
    employees: undefined,
  }))
}

export async function createExpenseClaim(orgId: string, formData: FormData) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const employeeId = String(formData.get('employee_id') || '').trim()
  if (!employeeId) return { error: 'Karyawan wajib dipilih.' }

  const employee = await prisma.employees.findFirst({
    where: { id: employeeId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleEmployee = await ensureExpenseBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const amount = Number(formData.get('amount') || 0)
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const claimDate = formData.get('claim_date') as string || new Date().toISOString().split('T')[0]

  await prisma.expense_claims.create({
    data: {
      org_id: orgId,
      branch_id: accessibleEmployee.branchId,
      employee_id: employeeId,
      amount,
      category,
      description,
      claim_date: new Date(`${claimDate}T00:00:00.000Z`),
      status: 'PENDING',
      approved_by: null,
    },
  })

  revalidatePath('/hris')
  return { success: true }
}

export async function approveExpenseClaim(
  claimId: string, 
  expenseAccountId: string, 
  payableAccountId: string
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const claim = await prisma.expense_claims.findFirst({
    where: { id: claimId },
    select: {
      id: true,
      org_id: true,
      branch_id: true,
      employee_id: true,
      status: true,
      amount: true,
      description: true,
      claim_date: true,
    },
  })

  if (!claim?.id) return { error: 'Klaim tidak ditemukan.' }
  if (String(claim.status || '').toUpperCase() !== 'PENDING') {
    return { error: 'Klaim sudah diproses.' }
  }

  const accessibleClaim = await ensureExpenseBranchAccess(
    claim?.org_id ?? '',
    claim?.branch_id ?? null,
    'Klaim tidak ditemukan.'
  )
  if ('error' in accessibleClaim) return { error: accessibleClaim.error }

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journal_entries.create({
        data: {
          org_id: claim.org_id,
          branch_id: accessibleClaim.branchId,
          entry_number: '',
          entry_date: claim.claim_date,
          description: `Reimbursement: ${claim.description}`,
          reference_type: 'EMPLOYEE_EXPENSE',
          reference_id: claim.id,
          status: 'POSTED',
          is_auto: true,
          created_by: userId,
        },
        select: { id: true },
      })

      await tx.journal_lines.createMany({
        data: [
          {
            entry_id: entry.id,
            account_id: expenseAccountId,
            debit: claim.amount,
            credit: 0,
            memo: claim.description,
          },
          {
            entry_id: entry.id,
            account_id: payableAccountId,
            debit: 0,
            credit: claim.amount,
            memo: `Payable to employee: ${claim.employee_id}`,
          },
        ],
      })

      await tx.expense_claims.updateMany({
        where: { id: claimId, org_id: claim.org_id, branch_id: accessibleClaim.branchId },
        data: {
          status: 'APPROVED',
          approved_by: userId,
          journal_entry_id: entry.id,
          updated_at: new Date(),
        },
      })
    })
  } catch (error) {
    console.error('approveExpenseClaim Error:', error)
    return { error: 'Gagal memproses klaim biaya.' }
  }

  revalidatePath('/hris')
  return { success: true }
}

export async function deleteExpenseClaim(claimId: string) {
  const claim = await prisma.expense_claims.findFirst({
    where: { id: claimId },
    select: { id: true, org_id: true, branch_id: true },
  })
  if (!claim?.id) return { error: 'Klaim tidak ditemukan.' }

  const accessibleClaim = await ensureExpenseBranchAccess(
    claim.org_id,
    claim.branch_id ?? null,
    'Klaim tidak ditemukan.'
  )
  if ('error' in accessibleClaim) return { error: accessibleClaim.error }

  await prisma.expense_claims.deleteMany({
    where: { id: claimId, org_id: claim.org_id, branch_id: accessibleClaim.branchId },
  })

  revalidatePath('/hris')
  return { success: true }
}
