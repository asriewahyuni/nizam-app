'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { ensureAccountingAccess, formatDateOnly, parseDateOnly, toNumber } from '@/modules/accounting/lib/reporting.server'

type BranchFilterResult =
  | { branchId: string | null }
  | { error: string }

function normalizeBudgetRow(budget: {
  id: string
  org_id: string
  account_id: string
  period: Date
  budget_amount: Prisma.Decimal
  created_at: Date
  updated_at: Date
  branch_id: string | null
  accounts: { code: string; name: string; type: string }
  branches: { id: string; name: string; code: string } | null
}) {
  return {
    id: budget.id,
    org_id: budget.org_id,
    account_id: budget.account_id,
    period: formatDateOnly(budget.period),
    budget_amount: toNumber(budget.budget_amount),
    created_at: budget.created_at.toISOString(),
    updated_at: budget.updated_at.toISOString(),
    branch_id: budget.branch_id,
    accounts: {
      code: budget.accounts.code,
      name: budget.accounts.name,
      type: budget.accounts.type,
    },
    branch: budget.branches
      ? {
          id: budget.branches.id,
          name: budget.branches.name,
          code: budget.branches.code,
        }
      : null,
  }
}

async function resolveBudgetBranchId(orgId: string, branchId?: string | null): Promise<BranchFilterResult> {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const trimmedBranchId = typeof branchId === 'string' ? branchId.trim() : ''
  if (!trimmedBranchId) return { branchId: null }

  const branchSelection = await resolveAccessibleBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak ditemukan.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<BranchFilterResult> {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

export async function getBudgets(orgId: string, period: string, branchId?: string | null) {
  const branchSelection = await resolveBudgetBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const budgets = await prisma.budgets.findMany({
    where: {
      org_id: orgId,
      period: parseDateOnly(period),
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      accounts: {
        select: {
          code: true,
          name: true,
          type: true,
        },
      },
      branches: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: [{ branches: { name: 'asc' } }, { accounts: { code: 'asc' } }],
  })

  return budgets.map(normalizeBudgetRow)
}

export async function saveBudget(orgId: string, accountId: string, period: string, amount: number) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih satu unit aktif terlebih dahulu untuk menyimpan budget.'
  )

  if ('error' in activeBranchResult) {
    return { error: activeBranchResult.error }
  }

  const periodDate = parseDateOnly(period)

  try {
    const existing = await prisma.budgets.findFirst({
      where: {
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        account_id: accountId,
        period: periodDate,
      },
      select: { id: true },
    })

    if (existing?.id) {
      await prisma.budgets.update({
        where: { id: existing.id },
        data: {
          budget_amount: amount,
          updated_at: new Date(),
        },
      })
    } else {
      await prisma.budgets.create({
        data: {
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
          account_id: accountId,
          period: periodDate,
          budget_amount: amount,
        },
      })
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'Budget untuk akun dan periode ini sudah ada.' }
    }
    return { error: 'Gagal menyimpan budget.' }
  }

  revalidatePath('/accounting/budgets')
  return { success: true, branchId: activeBranchResult.branchId }
}

export async function getBudgetVsActual(
  orgId: string,
  startDate: string,
  endDate: string,
  branchId?: string | null
) {
  const branchSelection = await resolveBudgetBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const accounts = await prisma.accounts.findMany({
    where: {
      org_id: orgId,
      type: { in: ['REVENUE', 'EXPENSE'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normal_balance: true,
    },
    orderBy: { code: 'asc' },
  })

  if (accounts.length === 0) return []

  const budgets = await prisma.budgets.findMany({
    where: {
      org_id: orgId,
      period: {
        gte: parseDateOnly(startDate),
        lte: parseDateOnly(endDate),
      },
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    select: {
      account_id: true,
      budget_amount: true,
    },
  })

  const budgetByAccount: Record<string, number> = {}
  budgets.forEach((budget) => {
    budgetByAccount[budget.account_id] = (budgetByAccount[budget.account_id] || 0) + toNumber(budget.budget_amount)
  })

  const entries = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
      entry_date: {
        gte: parseDateOnly(startDate),
        lte: parseDateOnly(endDate),
      },
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    select: { id: true },
  })

  const actualByAccount: Record<string, number> = {}
  if (entries.length > 0) {
    const lines = await prisma.journal_lines.findMany({
      where: {
        entry_id: { in: entries.map((entry) => entry.id) },
      },
      select: {
        account_id: true,
        debit: true,
        credit: true,
      },
    })

    lines.forEach((line) => {
      actualByAccount[line.account_id] = (actualByAccount[line.account_id] || 0) + toNumber(line.debit) - toNumber(line.credit)
    })
  }

  return accounts
    .map((account) => {
      const budgetAmount = budgetByAccount[account.id] || 0
      const actualRaw = actualByAccount[account.id] || 0
      const actualAmount = account.normal_balance === 'DEBIT' ? actualRaw : -actualRaw

      if (budgetAmount === 0 && actualAmount === 0) return null

      const variance = actualAmount - budgetAmount
      const variancePct = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0

      return {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: String(account.type),
        period: startDate,
        budget_amount: budgetAmount,
        actual_amount: actualAmount,
        variance,
        variance_pct: Math.round(variancePct * 10) / 10,
        status: Math.abs(variancePct) <= 5 ? 'ON_TRACK' : variance < 0 ? 'UNDER' : 'OVER',
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

export async function getChartOfAccountsForBudget(orgId: string) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return []

  const accounts = await prisma.accounts.findMany({
    where: {
      org_id: orgId,
      type: { in: ['REVENUE', 'EXPENSE'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: { code: 'asc' },
  })

  return accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: String(account.type),
  }))
}
