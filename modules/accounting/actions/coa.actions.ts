'use server'

import { Prisma } from '@prisma/client'
import { getAuthUser, getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Account, AccountType, NormalBalance, AccountBalance } from '@/types/database.types'

function normalizeAccount(account: {
  id: string
  org_id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}): Account {
  return {
    id: account.id,
    org_id: account.org_id,
    code: account.code,
    name: account.name,
    type: account.type as AccountType,
    normal_balance: account.normal_balance as NormalBalance,
    parent_id: account.parent_id,
    description: account.description,
    is_system: account.is_system,
    is_active: account.is_active,
    created_at: account.created_at.toISOString(),
    updated_at: account.updated_at.toISOString(),
  }
}

async function ensureOrgAccess(orgId: string) {
  const user = await getAuthUser()
  if (!user) return null
  return getMembership(user.userId, orgId)
}

// ─────────────────────────────────────────────────────────────
// getChartOfAccounts — fetch all accounts for an org, tree-structured
// ─────────────────────────────────────────────────────────────
export async function getChartOfAccounts(orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return []

  const data = await prisma.accounts.findMany({
    where: { org_id: orgId },
    orderBy: { code: 'asc' },
  })

  return data.map(normalizeAccount)
}

// ─────────────────────────────────────────────────────────────
// createAccount — Add a custom account to CoA
// ─────────────────────────────────────────────────────────────
export async function createAccount(orgId: string, formData: FormData) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const code = (formData.get('code') as string).trim()
  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as AccountType
  const normalBalance = formData.get('normal_balance') as NormalBalance
  const parentId = formData.get('parent_id') as string | null
  const description = formData.get('description') as string | null

  if (!code || !name || !type || !normalBalance) {
    return { error: 'Kode, nama, tipe, dan saldo normal wajib diisi.' }
  }

  try {
    await prisma.accounts.create({
      data: {
        org_id: orgId,
        code,
        name,
        type,
        normal_balance: normalBalance,
        parent_id: parentId || null,
        description: description || null,
        is_system: false,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { error: `Kode akun ${code} sudah digunakan.` }
    }
    return { error: 'Gagal menyimpan akun.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// updateAccount — Edit name/description (not code, not system)
// ─────────────────────────────────────────────────────────────
export async function updateAccount(
  accountId: string,
  orgId: string,
  updates: { 
    name?: string; 
    description?: string; 
    is_active?: boolean;
    code?: string;
    type?: AccountType;
    normal_balance?: NormalBalance;
    parent_id?: string | null;
  }
) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // Prevent editing system accounts' critical fields
  const existing = await prisma.accounts.findFirst({
    where: {
      id: accountId,
      org_id: orgId,
    },
    select: {
      is_system: true,
    },
  })

  if (!existing) return { error: 'Akun tidak ditemukan.' }

  try {
    await prisma.accounts.update({
      where: { id: accountId },
      data: updates,
    })
  } catch {
    return { error: 'Gagal memperbarui akun.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteAccount — Only non-system, no journal lines
// ─────────────────────────────────────────────────────────────
export async function deleteAccount(accountId: string, orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const existing = await prisma.accounts.findFirst({
    where: {
      id: accountId,
      org_id: orgId,
    },
    select: {
      is_system: true,
    },
  })

  if (!existing) return { error: 'Akun tidak ditemukan.' }
  if (existing.is_system) return { error: 'Akun sistem tidak dapat dihapus.' }

  // Check for existing journal lines
  const count = await prisma.journal_lines.count({
    where: {
      account_id: accountId,
    },
  })

  if ((count ?? 0) > 0) {
    return { error: 'Akun ini sudah memiliki transaksi. Nonaktifkan saja, jangan hapus.' }
  }

  try {
    await prisma.accounts.delete({
      where: { id: accountId },
    })
  } catch {
    return { error: 'Gagal menghapus akun.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getAccountBalances — for dashboard/reports
// ─────────────────────────────────────────────────────────────
export async function getAccountBalances(orgId: string): Promise<AccountBalance[]> {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return []

  const rows = await prisma.$queryRaw<AccountBalance[]>`
    SELECT
      org_id::text AS org_id,
      account_id::text AS account_id,
      code,
      name,
      type::text AS type,
      normal_balance::text AS normal_balance,
      COALESCE(balance, 0)::double precision AS balance,
      COALESCE(total_debit, 0)::double precision AS total_debit,
      COALESCE(total_credit, 0)::double precision AS total_credit
    FROM public.account_balances
    WHERE org_id = CAST(${orgId} AS uuid)
    ORDER BY code ASC
  `

  return rows
}
// ─────────────────────────────────────────────────────────────
// seedInitialCoA — Manual trigger to seed default PSAK CoA if empty
// ─────────────────────────────────────────────────────────────
export async function seedInitialCoA(orgId: string) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // First check if already has accounts to prevent double seeding
  const existing = await prisma.accounts.findFirst({
    where: { org_id: orgId },
    select: { id: true },
  })

  if (existing) {
    return { error: 'Sudah ada akun CoA untuk organisasi ini.' }
  }

  try {
    await prisma.$queryRaw`SELECT public.seed_default_coa(CAST(${orgId} AS uuid))`
  } catch (error) {
    console.error('Seed CoA Error:', error)
    return { error: 'Gagal menyiapkan akun standar. Silakan hubungi dukungan.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// setShariahAccountsActive — Toggle Syariah Accounts
// ─────────────────────────────────────────────────────────────
export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const membership = await ensureOrgAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  // Common syariah codes from migration 1006
  const syariahCodes = ['2600', '2601', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

  try {
    await prisma.accounts.updateMany({
      where: {
        org_id: orgId,
        code: {
          in: syariahCodes,
        },
      },
      data: {
        is_active: active,
      },
    })
  } catch (error) {
    console.error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}
