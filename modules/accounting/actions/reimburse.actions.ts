'use server'

import { auth } from '@/auth'
import { getDateInTimeZone } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from './journal.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { uploadReimbursementReceipt } from '@/modules/accounting/lib/reimbursement-receipt-storage.server'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

async function resolveActiveBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function syncReimbursementApprovalRequest(params: {
  orgId: string
  reimbursementId: string
  branchId: string
  status: 'APPROVED' | 'REJECTED'
  approverId: string
  notes?: string
}) {
  const { orgId, reimbursementId, branchId, status, approverId, notes } = params

  try {
    await prisma.approval_requests.updateMany({
      where: {
        org_id: orgId,
        branch_id: branchId,
        source_type: 'REIMBURSEMENT',
        source_id: reimbursementId,
        status: 'PENDING',
      },
      data: {
        status: status as any,
        approver_id: approverId,
        notes: notes || null,
        decided_at: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to sync reimbursement approval request:', error)
  }
}

function normalizeReimbursement(row: any) {
  const items = Array.isArray(row.reimbursement_items ?? row.items)
    ? (row.reimbursement_items ?? row.items).map((item: any) => ({
        ...item,
        expense_date: item.expense_date instanceof Date ? item.expense_date.toISOString().slice(0, 10) : item.expense_date,
        amount: Number(item.amount || 0),
        account: item.accounts ?? item.account ?? null,
      }))
    : []

  return {
    ...row,
    claim_date: row.claim_date instanceof Date ? row.claim_date.toISOString().slice(0, 10) : row.claim_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    total_amount: Number(row.total_amount || 0),
    items,
  }
}

export async function uploadReceipt(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { success: false, error: 'Tidak terautentikasi.' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { success: false, error: 'File tidak valid.' }

  const upload = await uploadReimbursementReceipt(userId, file)
  if ('error' in upload) {
    return { success: false, error: upload.error }
  }

  return { success: true, url: upload.url }
}

export async function getReimbursements(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  try {
    const data = await prisma.reimbursements.findMany({
      where: {
        org_id: orgId,
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
      },
      include: {
        reimbursement_items: {
          include: {
            accounts: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return data.map(normalizeReimbursement)
  } catch (error) {
    console.error('getReimbursements error:', error)
    return []
  }
}

export async function submitReimbursement(orgId: string, input: {
  description: string,
  items: {
    expense_date: string,
    category_account_id: string,
    description: string,
    amount: number,
    receipt_url?: string
  }[]
}) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengajukan reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const totalAmount = input.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const claimNumber = `REIMB-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

  try {
    const reimbursement = await prisma.$transaction(async (tx) => {
      const created = await tx.reimbursements.create({
        data: {
          org_id: orgId,
          branch_id: activeBranchId,
          user_id: userId,
          claim_number: claimNumber,
          description: input.description,
          total_amount: totalAmount,
          status: 'PENDING',
        },
        select: {
          id: true,
        },
      })

      await tx.reimbursement_items.createMany({
        data: input.items.map((item) => ({
          reimbursement_id: created.id,
          expense_date: new Date(`${item.expense_date}T00:00:00.000Z`),
          category_account_id: item.category_account_id,
          description: item.description,
          amount: Number(item.amount || 0),
          receipt_url: item.receipt_url || null,
        })),
      })

      return created
    })

    try {
      await prisma.approval_requests.create({
        data: {
          org_id: orgId,
          branch_id: activeBranchId,
          requester_id: userId,
          source_type: 'REIMBURSEMENT',
          source_id: reimbursement.id,
          reason: `Reimbursement: ${input.description}`,
          status: 'PENDING',
          requested_at: new Date(),
        },
      })
    } catch (error) {
      console.error('Failed to create approval request:', error)
    }

    revalidatePath('/accounting/reimburse')
    revalidatePath('/accounting/approvals')
    return { success: true, id: reimbursement.id }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { error: 'Nomor klaim reimbursement bentrok. Silakan coba lagi.' }
    }
    return { error: `Gagal membuat pengajuan reimburse. ${error?.message || ''}` }
  }
}

export async function approveReimbursement(id: string, orgId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menyetujui reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const result = await prisma.reimbursements.updateMany({
    where: {
      id,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    data: {
      status: 'APPROVED',
      updated_at: new Date(),
    },
  })

  if (result.count === 0) return { error: 'Gagal menyetujui reimbursement.' }

  await syncReimbursementApprovalRequest({
    orgId,
    reimbursementId: id,
    branchId: activeBranchResult.branchId,
    status: 'APPROVED',
    approverId: userId,
  })

  revalidatePath('/accounting/reimburse')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function rejectReimbursement(id: string, orgId: string, reason: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menolak reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const result = await prisma.reimbursements.updateMany({
    where: {
      id,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    data: {
      status: 'REJECTED',
      notes: reason,
      updated_at: new Date(),
    },
  })

  if (result.count === 0) return { error: 'Gagal menolak reimbursement.' }

  await syncReimbursementApprovalRequest({
    orgId,
    reimbursementId: id,
    branchId: activeBranchResult.branchId,
    status: 'REJECTED',
    approverId: userId,
    notes: reason,
  })

  revalidatePath('/accounting/reimburse')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function payReimbursement(id: string, orgId: string, bankAccountId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membayar reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const reim = await prisma.reimbursements.findFirst({
    where: {
      id,
      org_id: orgId,
      branch_id: activeBranchId,
    },
    include: {
      reimbursement_items: true,
    },
  })

  if (!reim?.id) return { error: 'Data reimbursement tidak ditemukan.' }
  if (reim.status !== 'APPROVED') return { error: 'Hanya reimbursement status APPROVED yang bisa dibayar.' }

  const bank = await prisma.bank_accounts.findFirst({
    where: {
      id: bankAccountId,
      org_id: orgId,
      branch_id: activeBranchId,
    },
    select: {
      account_id: true,
    },
  })

  if (!bank?.account_id) return { error: 'Akun Bank tidak ditemukan.' }

  const accountGroups: Record<string, number> = {}
  reim.reimbursement_items.forEach((item: any) => {
    accountGroups[item.category_account_id] = (accountGroups[item.category_account_id] || 0) + Number(item.amount)
  })

  const lines = []
  for (const [accId, amount] of Object.entries(accountGroups)) {
    lines.push({
      account_id: accId,
      debit: amount,
      credit: 0,
      memo: `Reimburse ${reim.claim_number}: ${reim.description}`,
    })
  }

  lines.push({
    account_id: bank.account_id,
    debit: 0,
    credit: Number(reim.total_amount),
    memo: `Pembayaran Reimburse ${reim.claim_number}`,
  })

  const journalResult = await createJournalEntry({
    org_id: orgId,
    branch_id: activeBranchId,
    entry_date: getDateInTimeZone('Asia/Jakarta'),
    description: `Pembayaran Reimburse ${reim.claim_number} - ${reim.description}`,
    reference_type: 'CASH_OUT',
    reference_id: reim.id,
    lines,
    auto_post: true,
  })

  if ((journalResult as any).error) return journalResult

  await prisma.reimbursements.updateMany({
    where: {
      id,
      org_id: orgId,
      branch_id: activeBranchId,
    },
    data: {
      status: 'PAID',
      journal_id: (journalResult as any).entryId,
      updated_at: new Date(),
    },
  })

  revalidatePath('/accounting/reimburse')
  return { success: true }
}
