'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import type { BankAccount, BankTransaction } from '@/types/database.types'

type ActiveBranchResult = { branchId: string } | { error: string }

type BankAccountWithRelation = BankAccount & { account: any }
type BankTransactionWithRelation = BankTransaction & { bank_account: any; category: any }

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) return { error: branchSelection.error || errorMessage }
  if (!branchSelection.branchId) return { error: errorMessage }
  return { branchId: branchSelection.branchId }
}

function normalizeBankAccount(row: any): BankAccountWithRelation {
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    account: row.accounts ?? row.account ?? null,
  } as BankAccountWithRelation
}

function normalizeBankTransaction(row: any): BankTransactionWithRelation {
  return {
    ...row,
    transaction_date: row.transaction_date instanceof Date ? row.transaction_date.toISOString().slice(0, 10) : row.transaction_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    amount: Number(row.amount || 0),
    bank_account: row.bank_accounts ?? row.bank_account ?? null,
    category: row.accounts ?? row.category ?? null,
  } as BankTransactionWithRelation
}

// ─────────────────────────────────────────────────────────────
// getBankAccounts — fetch all bank accounts for an org
// ─────────────────────────────────────────────────────────────
export async function getBankAccounts(orgId: string, branchId?: string | null) {
  let effectiveBranchId: string | undefined

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    effectiveBranchId = branchSelection.branchId
  }

  try {
    const data = await prisma.bank_accounts.findMany({
      where: {
        org_id: orgId,
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
      },
      include: {
        accounts: true,
      },
      orderBy: {
        bank_name: 'asc',
      },
    })

    return data.map(normalizeBankAccount)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// createBankAccount — Add a new bank account
// HANYA untuk Parent/Holding. Child/Branch gunakan:
// → /accounting/coa-requests untuk mengajukan rekening baru
// ─────────────────────────────────────────────────────────────
export async function createBankAccount(orgId: string, formData: FormData) {
  // ── Guard 1: Branch aktif wajib ada ──
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat rekening kas/bank.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  // ── Guard 2: Hanya Parent/Holding yang boleh membuat rekening bank langsung ──
  const { canManageDirect } = await checkCanManageCoA(orgId)
  if (!canManageDirect) {
    return {
      error:
        'Hanya Organisasi Utama (Parent/Holding) yang dapat menambahkan rekening bank secara langsung. ' +
        'Silakan ajukan melalui menu "Pengajuan Rekening CoA".',
      requiresRequest: true,
    }
  }


  const accountId = formData.get('account_id') as string // The GL Account ID
  const bankName = String(formData.get('bank_name') || '').trim()
  const accountNumber = String(formData.get('account_number') || '').trim() || null
  const accountHolder = String(formData.get('account_holder') || '').trim() || null
  const currency = (formData.get('currency') as string) || 'IDR'
  
  const explicitBranchId = formData.get('target_branch_id') as string | null
  const targetOrgBranch = formData.get('target_org_branch') as string | null

  let finalOrgId = orgId;
  let finalBranchId: string | null = explicitBranchId && explicitBranchId.trim() ? explicitBranchId.trim() : activeBranchResult.branchId;

  if (targetOrgBranch) {
    const parts = targetOrgBranch.split('|');
    if (parts.length >= 1 && parts[0].trim()) {
      finalOrgId = parts[0].trim();
    }
    // parts[1] might be empty if "Kantor Utama" is selected and it has no default branch ID? Actually branches are mandatory. But if it's empty, use NULL (kantor utama fallback)
    finalBranchId = parts.length >= 2 && parts[1].trim() ? parts[1].trim() : null;
  }

  if (!accountId || !bankName) {
    return { error: 'Akun GL dan Nama Bank wajib diisi.' }
  }

  try {
    await prisma.bank_accounts.create({
      data: {
        org_id: finalOrgId,
        branch_id: finalBranchId as string,
        account_id: accountId,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        currency,
        is_active: true,
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { error: `Nomor rekening ${accountNumber} sudah terdaftar.` }
    }
    return { error: 'Gagal menyimpan rekening bank.' }
  }

  revalidatePath('/cash')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// createBankTransaction — Record cash movement
// ─────────────────────────────────────────────────────────────
export async function createBankTransaction(orgId: string, formData: FormData) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mencatat transaksi kas/bank.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const bankAccountId = formData.get('bank_account_id') as string
  const transDate = formData.get('transaction_date') as string
  const description = String(formData.get('description') || '').trim()
  const amount = Number(formData.get('amount') as string)
  const type = formData.get('type') as 'IN' | 'OUT' | 'TRANSFER'
  const categoryId = formData.get('category_id') as string
  const targetBankAccountId = String(formData.get('target_bank_account_id') || '').trim() || null
  const referenceNumber = String(formData.get('reference_number') || '').trim() || null

  if (!bankAccountId || !transDate || !description || !Number.isFinite(amount) || amount <= 0 || !type) {
    return { error: 'Semua field wajib diisi.' }
  }

  const bankAccount = await prisma.bank_accounts.findFirst({
    where: {
      id: bankAccountId,
      org_id: orgId,
    },
    select: {
      id: true,
      branch_id: true,
      account_id: true,
    },
  })

  if (!bankAccount?.id) {
    return { error: 'Rekening kas/bank tidak ditemukan.' }
  }

  if (bankAccount.branch_id !== activeBranchResult.branchId) {
    return { error: 'Rekening kas/bank tersebut tidak tersedia pada unit aktif.' }
  }

  let oppositeAccountId = categoryId

  if (type === 'TRANSFER') {
    const targetBankAccount = await prisma.bank_accounts.findFirst({
      where: {
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        ...(targetBankAccountId
          ? { id: targetBankAccountId }
          : { account_id: categoryId }),
      },
      select: {
        id: true,
        branch_id: true,
        account_id: true,
      },
    })

    if (!targetBankAccount?.id) {
      return { error: 'Rekening tujuan transfer tidak ditemukan.' }
    }

    if (targetBankAccount.branch_id !== activeBranchResult.branchId) {
      return { error: 'Rekening tujuan transfer tidak tersedia pada unit aktif.' }
    }

    if (targetBankAccount.id === bankAccount.id || targetBankAccount.account_id === bankAccount.account_id) {
      return { error: 'Rekening sumber dan tujuan transfer harus berbeda.' }
    }

    oppositeAccountId = targetBankAccount.account_id
  } else if (!oppositeAccountId) {
    return { error: 'Akun lawan transaksi wajib dipilih.' }
  }

  if (oppositeAccountId === bankAccount.account_id) {
    return { error: 'Akun lawan tidak boleh sama dengan akun kas/bank sumber karena jurnal akan bernilai nol.' }
  }

  try {
    await prisma.bank_transactions.create({
      data: {
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        bank_account_id: bankAccountId,
        transaction_date: new Date(transDate),
        description,
        amount,
        type,
        category_id: oppositeAccountId,
        reference_number: referenceNumber,
        status: 'POSTED',
      },
    })
  } catch (error: any) {
    return { error: 'Gagal menyimpan transaksi: ' + (error?.message || 'Unknown error') }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// createInterOrgCapitalTransfer — Parent transfer modal ke Child/Cabang
// Mencatat 2 transaksi atomik:
// 1) OUT di org sumber (parent)
// 2) IN  di org tujuan (child/cabang)
// ─────────────────────────────────────────────────────────────
export async function createInterOrgCapitalTransfer(orgId: string, formData: FormData) {
  const sourceBankAccountId = String(formData.get('bank_account_id') || '').trim()
  const targetBankAccountId = String(formData.get('target_bank_account_id') || '').trim()
  const sourceCounterAccountId = String(formData.get('source_counter_account_id') || '').trim()
  const targetCounterAccountId = String(formData.get('target_counter_account_id') || '').trim()
  const transactionDate = String(formData.get('transaction_date') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const amount = Number(formData.get('amount') || 0)
  const referenceNumber = String(formData.get('reference_number') || '').trim() || null

  if (
    !sourceBankAccountId ||
    !targetBankAccountId ||
    !sourceCounterAccountId ||
    !targetCounterAccountId ||
    !transactionDate ||
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return { error: 'Field transfer modal antar entitas belum lengkap.' }
  }

  const sourceCounterAccount = await prisma.accounts.findFirst({
    where: { id: sourceCounterAccountId, org_id: orgId },
    select: { id: true, code: true, name: true, type: true },
  })

  if (!sourceCounterAccount?.id) {
    return { error: 'Akun lawan parent (sumber) tidak ditemukan.' }
  }

  const sourceCounterCode = String(sourceCounterAccount.code || '')
  const sourceCounterName = String(sourceCounterAccount.name || '').toLowerCase()
  const isSourceCashBankLike =
    sourceCounterAccount.type === 'ASSET'
    && (sourceCounterCode.startsWith('11') || sourceCounterName.includes('kas') || sourceCounterName.includes('bank'))

  if (!isSourceCashBankLike) {
    return {
      error:
        'Akun lawan parent harus akun kas/bank anak (kelompok 11xx). ' +
        'Gunakan rekening anak/cabang yang sudah direquest, bukan akun investasi.',
    }
  }

  try {
    const data = await prisma.$queryRaw<Array<{ result: unknown }>>`
      SELECT public.create_interorg_capital_transfer(
        CAST(${orgId} AS uuid),
        CAST(${sourceBankAccountId} AS uuid),
        CAST(${sourceCounterAccountId} AS uuid),
        CAST(${targetBankAccountId} AS uuid),
        CAST(${targetCounterAccountId} AS uuid),
        CAST(${transactionDate} AS date),
        ${amount},
        ${description},
        ${referenceNumber}
      ) AS result
    `

    revalidatePath('/cash')
    revalidatePath('/accounting/journal')
    revalidatePath('/reports')
    revalidatePath('/dashboard')
    return { success: true, data }
  } catch (error: any) {
    return { error: `Gagal mencatat transfer modal antar entitas: ${error?.message || 'Unknown error'}` }
  }
}

// ─────────────────────────────────────────────────────────────
// getRecentBankTransactions — fetch recent ones
// ─────────────────────────────────────────────────────────────
export async function getRecentBankTransactions(orgId: string, limit = 10, branchId?: string | null) {
  let effectiveBranchId: string | undefined

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    effectiveBranchId = branchSelection.branchId
  }

  try {
    const data = await prisma.bank_transactions.findMany({
      where: {
        org_id: orgId,
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
      },
      include: {
        bank_accounts: {
          select: {
            bank_name: true,
            account_number: true,
          },
        },
        accounts: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' },
      ],
      take: limit,
    })

    return data.map(normalizeBankTransaction)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// deleteBankAccount — Delete a bank account
// ─────────────────────────────────────────────────────────────
export async function deleteBankAccount(orgId: string, accountId: string) {
  const bankAccount = await prisma.bank_accounts.findFirst({
    where: {
      id: accountId,
      org_id: orgId,
    },
    select: {
      id: true,
      branch_id: true,
    },
  })

  if (!bankAccount?.id) {
    return { error: 'Rekening kas/bank tidak ditemukan.' }
  }

  if (bankAccount.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, bankAccount.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
  }

  try {
    await prisma.bank_accounts.delete({
      where: {
        id: accountId,
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return { error: 'Tidak bisa menghapus rekening yang sudah memiliki riwayat transaksi. Harap hapus transaksinya terlebih dahulu.' }
    }
    return { error: 'Gagal menghapus rekening: ' + (error?.message || 'Unknown error') }
  }

  revalidatePath('/cash')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteBankTransaction — Void a cash movement while preserving audit trail
// ─────────────────────────────────────────────────────────────
export async function deleteBankTransaction(orgId: string, transactionId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const tx = await prisma.bank_transactions.findFirst({
    where: {
      id: transactionId,
      org_id: orgId,
    },
    select: {
      id: true,
      journal_entry_id: true,
      branch_id: true,
      status: true,
    },
  })

  if (!tx?.id) {
    return { error: 'Transaksi kas/bank tidak ditemukan.' }
  }

  if (tx.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, tx.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
  }

  if (tx.status === 'VOIDED') {
    return { success: true }
  }

  try {
    await prisma.$transaction(async (db) => {
      if (tx.journal_entry_id) {
        await db.journal_entries.updateMany({
          where: {
            id: tx.journal_entry_id,
            org_id: orgId,
          },
          data: {
            status: 'VOIDED',
            void_reason: 'Transaksi Kas/Bank di-void manual',
            voided_by: userId,
            voided_at: new Date(),
          },
        })
      }

      await db.bank_transactions.updateMany({
        where: {
          id: transactionId,
          org_id: orgId,
        },
        data: {
          status: 'VOIDED',
        },
      })
    })
  } catch (error: any) {
    return { error: 'Gagal me-void mutasi: ' + (error?.message || 'Unknown error') }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { success: true }
}
