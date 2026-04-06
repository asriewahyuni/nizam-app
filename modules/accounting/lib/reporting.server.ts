import { getAuthUser, getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

export type BranchFilter = string | null | undefined

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function toNumber(value: unknown) {
  return Number(value || 0)
}

export async function ensureAccountingAccess(orgId: string) {
  const user = await getAuthUser()
  if (!user) return null
  return getMembership(user.userId, orgId)
}

export async function getCurrentUserId() {
  const user = await getAuthUser()
  return user?.userId ?? null
}

export async function resolveBranchFilter(orgId: string, branchId?: BranchFilter) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) {
    return { error: 'Unauthorized' }
  }

  const trimmedBranchId = typeof branchId === 'string' ? branchId.trim() : ''
  if (!trimmedBranchId) {
    return { branchId: null as string | null }
  }

  const branchSelection = await resolveAccessibleBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: branchSelection.branchId }
}

export async function getPostedEntryIds(
  orgId: string,
  options: {
    branchId?: BranchFilter
    startDate?: string
    endDate?: string
    asOfDate?: string
  } = {}
) {
  const entryDate: {
    gte?: Date
    lte?: Date
  } = {}

  if (options.startDate) {
    entryDate.gte = parseDateOnly(options.startDate)
  }

  if (options.endDate) {
    entryDate.lte = parseDateOnly(options.endDate)
  }

  if (options.asOfDate) {
    entryDate.lte = parseDateOnly(options.asOfDate)
  }

  const rows = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
      ...(options.branchId ? { branch_id: options.branchId } : {}),
      ...(Object.keys(entryDate).length > 0 ? { entry_date: entryDate } : {}),
    },
    select: { id: true },
  })

  return rows.map((entry) => entry.id)
}

export async function getAggregatedAccountBalances(entryIds: string[], codeFilter?: string[]) {
  if (entryIds.length === 0) return []

  const lines = await prisma.journal_lines.findMany({
    where: {
      entry_id: { in: entryIds },
      ...(codeFilter && codeFilter.length > 0
        ? {
            accounts: {
              is: {
                code: { in: codeFilter },
              },
            },
          }
        : {}),
    },
    include: {
      accounts: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normal_balance: true,
          cash_flow_category: true,
        },
      },
    },
  })

  const accountMap = new Map<string, {
    id: string
    code: string
    name: string
    type: string
    normal_balance: string
    cash_flow_category: string | null
    total_debit: number
    total_credit: number
  }>()

  lines.forEach((line) => {
    const account = line.accounts
    const existing = accountMap.get(account.id)

    if (existing) {
      existing.total_debit += toNumber(line.debit)
      existing.total_credit += toNumber(line.credit)
      return
    }

    accountMap.set(account.id, {
      id: account.id,
      code: account.code,
      name: account.name,
      type: String(account.type),
      normal_balance: String(account.normal_balance),
      cash_flow_category: account.cash_flow_category,
      total_debit: toNumber(line.debit),
      total_credit: toNumber(line.credit),
    })
  })

  return Array.from(accountMap.values())
}

export async function getCashAccountCodes(orgId: string, branchId?: BranchFilter) {
  const linkedAccounts = await prisma.bank_accounts.findMany({
    where: {
      org_id: orgId,
      is_active: true,
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      accounts: {
        select: {
          code: true,
        },
      },
    },
  })

  const codes = Array.from(
    new Set(
      linkedAccounts
        .map((account) => account.accounts.code)
        .filter(Boolean)
    )
  )

  return codes.length > 0 ? codes : ['1101', '1102', '1103', '1104', '1105']
}
