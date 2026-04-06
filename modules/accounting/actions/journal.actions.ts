'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { JournalReferenceType } from '@/types/database.types'

export interface JournalLineInput {
  account_id: string
  debit: number
  credit: number
  memo?: string
}

export interface CreateJournalEntryInput {
  org_id: string
  branch_id?: string
  entry_date: string
  description: string
  reference_type?: JournalReferenceType
  reference_id?: string
  notes?: string
  lines: JournalLineInput[]
  auto_post?: boolean
  allow_org_scope?: boolean
}

function normalizeJournalLine(line: any) {
  return {
    ...line,
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
  }
}

function normalizeJournalEntry(entry: any) {
  const journalLines = Array.isArray(entry.journal_lines)
    ? entry.journal_lines
        .map((line: any) => normalizeJournalLine(line))
        .sort((a: any, b: any) => Number(b.debit || 0) - Number(a.debit || 0))
    : []

  return {
    ...entry,
    entry_date: entry.entry_date instanceof Date ? entry.entry_date.toISOString().slice(0, 10) : entry.entry_date,
    posted_at: entry.posted_at instanceof Date ? entry.posted_at.toISOString() : entry.posted_at,
    voided_at: entry.voided_at instanceof Date ? entry.voided_at.toISOString() : entry.voided_at,
    created_at: entry.created_at instanceof Date ? entry.created_at.toISOString() : entry.created_at,
    updated_at: entry.updated_at instanceof Date ? entry.updated_at.toISOString() : entry.updated_at,
    journal_lines: journalLines,
  }
}

async function resolveJournalBranchId(input: CreateJournalEntryInput) {
  if (input.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(input.org_id, input.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
    return { branchId: branchSelection.branchId }
  }

  if (input.allow_org_scope) {
    return { branchId: null as string | null }
  }

  const branchSelection = await resolveAccessibleBranchSelection(input.org_id)
  if ('error' in branchSelection) return { error: branchSelection.error }
  if (!branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat jurnal manual.' }
  }

  return { branchId: branchSelection.branchId }
}

export async function getUnpostedJournalsCount(orgId: string, branchId?: string | null): Promise<number> {
  let effectiveBranchId: string | undefined

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return 0
    effectiveBranchId = branchSelection.branchId
  }

  try {
    return await prisma.journal_entries.count({
      where: {
        org_id: orgId,
        status: 'DRAFT',
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
      },
    })
  } catch (error) {
    console.error('Error fetching unposted journals count:', error)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────
// createJournalEntry — Core accounting engine
// Creates header + lines, optionally posts immediately
// ─────────────────────────────────────────────────────────────
export async function createJournalEntry(input: CreateJournalEntryInput) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  if (input.lines.length < 2) {
    return { error: 'Minimal 2 baris jurnal diperlukan.' }
  }

  const totalDebit = input.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
  const totalCredit = input.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Jurnal tidak balance: debit ${totalDebit} ≠ credit ${totalCredit}` }
  }

  const resolvedBranch = await resolveJournalBranchId(input)
  if ('error' in resolvedBranch) return resolvedBranch

  try {
    const entry = await prisma.$transaction(async (db) => {
      const createdEntry = await db.journal_entries.create({
        data: {
          org_id: input.org_id,
          branch_id: resolvedBranch.branchId,
          entry_number: '',
          entry_date: new Date(`${input.entry_date}T00:00:00.000Z`),
          description: input.description,
          reference_type: (input.reference_type || 'MANUAL') as any,
          reference_id: input.reference_id || null,
          notes: input.notes || null,
          status: 'DRAFT',
          created_by: userId,
        },
        select: {
          id: true,
          entry_number: true,
        },
      })

      await db.journal_lines.createMany({
        data: input.lines.map((line) => ({
          entry_id: createdEntry.id,
          account_id: line.account_id,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          memo: line.memo || null,
        })),
      })

      return createdEntry
    })

    if (input.auto_post) {
      const result = await postJournalEntry(entry.id, input.org_id)
      if ((result as any).error) return result
    }

    revalidatePath('/accounting/journal')
    return { success: true, entryId: entry.id, entryNumber: entry.entry_number }
  } catch {
    return { error: 'Gagal membuat jurnal.' }
  }
}

// ─────────────────────────────────────────────────────────────
// postJournalEntry — Post (finalize) a DRAFT entry
// DB trigger validates balance before allowing this
// ─────────────────────────────────────────────────────────────
export async function postJournalEntry(entryId: string, orgId: string) {
  try {
    const result = await prisma.journal_entries.updateMany({
      where: {
        id: entryId,
        org_id: orgId,
        status: 'DRAFT',
      },
      data: {
        status: 'POSTED',
      },
    })

    if (result.count === 0) {
      return { error: 'Gagal memposting jurnal.' }
    }
  } catch (error: any) {
    return { error: error?.message || 'Gagal memposting jurnal.' }
  }

  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// voidJournalEntry — Void a POSTED entry (with reason)
// ─────────────────────────────────────────────────────────────
export async function voidJournalEntry(
  entryId: string,
  orgId: string,
  reason: string
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const entry = await prisma.journal_entries.findFirst({
    where: {
      id: entryId,
      org_id: orgId,
    },
    select: {
      reference_type: true,
      reference_id: true,
    },
  })

  try {
    const result = await prisma.journal_entries.updateMany({
      where: {
        id: entryId,
        org_id: orgId,
        status: 'POSTED',
      },
      data: {
        status: 'VOIDED',
        voided_at: new Date(),
        voided_by: userId,
        void_reason: reason,
      },
    })

    if (result.count === 0) {
      return { error: 'Gagal membatalkan jurnal.' }
    }

    if (entry?.reference_id) {
      const refId = entry.reference_id
      const refType = entry.reference_type

      if (refType === 'SALES_RETURN') {
        await prisma.sales_returns.updateMany({
          where: { id: refId, org_id: orgId },
          data: { status: 'VOIDED' },
        })
        await prisma.stock_movements.deleteMany({
          where: {
            org_id: orgId,
            reference_id: refId,
            reference_type: 'SALES_RETURN',
          },
        })
      }

      if (refType === 'ADJUSTMENT') {
        await prisma.inventory_adjustments.updateMany({
          where: { id: refId, org_id: orgId },
          data: { status: 'VOIDED' },
        })
        await prisma.stock_movements.deleteMany({
          where: {
            org_id: orgId,
            reference_id: refId,
            reference_type: 'ADJUSTMENT',
          },
        })

        const asset = await prisma.fixed_assets.findFirst({
          where: { id: refId, org_id: orgId },
          select: { id: true },
        })

        if (asset?.id) {
          await prisma.fixed_assets.updateMany({
            where: { id: asset.id, org_id: orgId },
            data: { status: 'VOIDED' },
          })
        }
      }

      if (refType === 'PURCHASE_RETURN') {
        await prisma.stock_movements.deleteMany({
          where: {
            org_id: orgId,
            reference_id: refId,
            reference_type: 'PURCHASE_RETURN',
          },
        })
      }

      if (refType === 'PAYMENT_IN') {
        const pay = await prisma.sales_payments.findFirst({
          where: { id: refId, org_id: orgId },
          select: { sale_id: true },
        })
        if (pay?.sale_id) {
          await prisma.sales.updateMany({
            where: { id: pay.sale_id, org_id: orgId },
            data: { payment_status: 'PARTIAL' },
          })
        }
      }

      if (refType === 'PAYMENT_OUT') {
        const pay = await prisma.purchase_payments.findFirst({
          where: { id: refId, org_id: orgId },
          select: { purchase_id: true },
        })
        if (pay?.purchase_id) {
          await prisma.purchases.updateMany({
            where: { id: pay.purchase_id, org_id: orgId },
            data: { payment_status: 'PARTIAL' },
          })
        }
      }
    }
  } catch {
    return { error: 'Gagal membatalkan jurnal.' }
  }

  revalidatePath('/accounting/journal')
  revalidatePath('/accounting/assets')
  revalidatePath('/sales')
  revalidatePath('/purchase')
  revalidatePath('/inventory')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteJournalEntry — Soft-delete (Hidden from UI) for Posted/Reference
// ─────────────────────────────────────────────────────────────
export async function deleteJournalEntry(entryId: string, orgId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  try {
    await prisma.journal_entries.updateMany({
      where: {
        id: entryId,
        org_id: orgId,
      },
      data: {
        status: 'VOIDED',
        void_reason: 'HARD_DELETE_HIDDEN',
        voided_at: new Date(),
        voided_by: userId,
      },
    })
  } catch (error: any) {
    return { error: 'Gagal memperbarui jurnal: ' + error.message }
  }

  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// hardDeleteDraftJournal — Actual delete for DRAFT status
// ─────────────────────────────────────────────────────────────
export async function hardDeleteDraftJournal(entryId: string, orgId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  try {
    const result = await prisma.journal_entries.deleteMany({
      where: {
        id: entryId,
        org_id: orgId,
        status: 'DRAFT',
      },
    })

    if (result.count === 0) {
      return { error: 'Gagal menghapus draft. Mungkin Anda tidak memiliki izin atau data sudah terhapus/berubah status.' }
    }
  } catch (error: any) {
    return { error: 'Gagal menghapus draft: ' + error.message }
  }

  revalidatePath('/accounting/journal')
  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getJournalEntries — List with filters
// ─────────────────────────────────────────────────────────────
export async function getJournalEntries(
  orgId: string,
  filters?: {
    status?: string
    branch_id?: string
    fromDate?: string
    toDate?: string
    limit?: number
  }
) {
  let effectiveBranchId: string | undefined

  if (filters?.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, filters.branch_id)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    effectiveBranchId = branchSelection.branchId
  }

  try {
    const data = await prisma.journal_entries.findMany({
      where: {
        org_id: orgId,
        OR: [
          { void_reason: null },
          { void_reason: { not: 'HARD_DELETE_HIDDEN' } },
        ],
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
        ...(filters?.fromDate ? { entry_date: { gte: new Date(`${filters.fromDate}T00:00:00.000Z`) } } : {}),
        ...(filters?.toDate
          ? {
              entry_date: {
                ...(filters?.fromDate ? { gte: new Date(`${filters.fromDate}T00:00:00.000Z`) } : {}),
                lte: new Date(`${filters.toDate}T00:00:00.000Z`),
              },
            }
          : {}),
      },
      include: {
        journal_lines: {
          include: {
            accounts: {
              select: {
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: [
        { entry_date: 'desc' },
        { created_at: 'desc' },
      ],
      take: filters?.limit || 50,
    })

    return data.map(normalizeJournalEntry)
  } catch {
    return []
  }
}
