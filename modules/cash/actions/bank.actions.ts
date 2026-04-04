'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { BankAccount, BankTransaction } from '@/types/database.types'

type ActiveBranchResult = { branchId: string } | { error: string }

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) return { error: branchSelection.error || errorMessage }
  if (!branchSelection.branchId) return { error: errorMessage }
  return { branchId: branchSelection.branchId }
}

// ─────────────────────────────────────────────────────────────
// getBankAccounts — fetch all bank accounts for an org
// ─────────────────────────────────────────────────────────────
export async function getBankAccounts(orgId: string, branchId?: string | null) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bank_accounts')
    .select('*, account:accounts(*)')
    .eq('org_id', orgId)

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('bank_name', { ascending: true })

  if (error) return []
  return data as (BankAccount & { account: any })[]
}

// ─────────────────────────────────────────────────────────────
// createBankAccount — Add a new bank account
// ─────────────────────────────────────────────────────────────
export async function createBankAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat rekening kas/bank.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accountId = formData.get('account_id') as string // The GL Account ID
  const bankName = String(formData.get('bank_name') || '').trim()
  const accountNumber = String(formData.get('account_number') || '').trim() || null
  const accountHolder = String(formData.get('account_holder') || '').trim() || null
  const currency = (formData.get('currency') as string) || 'IDR'

  if (!accountId || !bankName) {
    return { error: 'Akun GL dan Nama Bank wajib diisi.' }
  }

  const { error } = await (supabase as any).from('bank_accounts').insert({
    org_id: orgId,
    branch_id: activeBranchResult.branchId,
    account_id: accountId,
    bank_name: bankName,
    account_number: accountNumber,
    account_holder: accountHolder,
    currency,
    is_active: true
  })

  if (error) {
    if (error.code === '23505') {
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
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mencatat transaksi kas/bank.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const bankAccountId = formData.get('bank_account_id') as string
  const transDate = formData.get('transaction_date') as string
  const description = (formData.get('description') as string).trim()
  const amount = parseFloat(formData.get('amount') as string)
  const type = formData.get('type') as 'IN' | 'OUT' | 'TRANSFER'
  const categoryId = formData.get('category_id') as string // Opposite GL Account
  const referenceNumber = (formData.get('reference_number') as string | null)?.trim() || null

  if (!bankAccountId || !transDate || !description || isNaN(amount) || !type || !categoryId) {
    return { error: 'Semua field wajib diisi.' }
  }

  if (type === 'TRANSFER') {
    return { error: 'Transfer antar rekening belum didukung pada modul Kas & Bank versi ini.' }
  }

  const { data: bankAccount, error: bankAccountError } = await (supabase as any)
    .from('bank_accounts')
    .select('id, branch_id')
    .eq('id', bankAccountId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (bankAccountError || !bankAccount?.id) {
    return { error: 'Rekening kas/bank tidak ditemukan.' }
  }

  if (bankAccount.branch_id !== activeBranchResult.branchId) {
    return { error: 'Rekening kas/bank tersebut tidak tersedia pada unit aktif.' }
  }

  const { error } = await (supabase as any).from('bank_transactions').insert({
    org_id: orgId,
    branch_id: activeBranchResult.branchId,
    bank_account_id: bankAccountId,
    transaction_date: transDate,
    description,
    amount,
    type,
    category_id: categoryId,
    reference_number: referenceNumber,
    status: 'POSTED' // Automatically post to GL via trigger
  })

  if (error) {
    return { error: 'Gagal menyimpan transaksi: ' + error.message }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getRecentBankTransactions — fetch recent ones
// ─────────────────────────────────────────────────────────────
export async function getRecentBankTransactions(orgId: string, limit = 10, branchId?: string | null) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bank_transactions')
    .select('*, bank_account:bank_accounts(bank_name, account_number), category:accounts(name, code)')
    .eq('org_id', orgId)

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as (BankTransaction & { bank_account: any; category: any })[]
}

// ─────────────────────────────────────────────────────────────
// deleteBankAccount — Delete a bank account
// ─────────────────────────────────────────────────────────────
export async function deleteBankAccount(orgId: string, accountId: string) {
  const supabase = await createClient()

  const { data: bankAccount, error: bankAccountError } = await (supabase as any)
    .from('bank_accounts')
    .select('id, branch_id')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (bankAccountError || !bankAccount?.id) {
    return { error: 'Rekening kas/bank tidak ditemukan.' }
  }

  if (bankAccount.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, bankAccount.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
  }

  // Note: This will fail if there are existing transactions (CASCADE protection is usually OFF by default for financial safety)
  const { error } = await (supabase as any)
    .from('bank_accounts')
    .delete()
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) {
    if (error.code === '23503') {
      return { error: 'Tidak bisa menghapus rekening yang sudah memiliki riwayat transaksi. Harap hapus transaksinya terlebih dahulu.' }
    }
    return { error: 'Gagal menghapus rekening: ' + error.message }
  }

  revalidatePath('/cash')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteBankTransaction — Void a cash movement while preserving audit trail
// ─────────────────────────────────────────────────────────────
export async function deleteBankTransaction(orgId: string, transactionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // 1. Fetch the linked journal entry and current status first
  const { data: tx, error: txError } = await (supabase as any)
    .from('bank_transactions')
    .select('id, journal_entry_id, branch_id, status')
    .eq('id', transactionId)
    .eq('org_id', orgId)
    .single()

  if (txError || !tx?.id) {
    return { error: 'Transaksi kas/bank tidak ditemukan.' }
  }

  if (tx?.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, tx.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
  }

  if (tx.status === 'VOIDED') {
    return { success: true }
  }

  // 2. Void the linked journal entry so GL stays balanced
  if (tx?.journal_entry_id) {
    const { error: journalError } = await (supabase as any)
      .from('journal_entries')
      .update({
        status: 'VOIDED',
        void_reason: 'Transaksi Kas/Bank di-void manual',
        voided_by: user.id,
        voided_at: new Date().toISOString()
      })
      .eq('id', tx.journal_entry_id)
      .eq('org_id', orgId)

    if (journalError) {
      return { error: 'Gagal me-void jurnal transaksi kas/bank.' }
    }
  }

  // 3. Soft-void the source transaction for auditability
  const { error } = await (supabase as any)
    .from('bank_transactions')
    .update({
      status: 'VOIDED',
    })
    .eq('id', transactionId)
    .eq('org_id', orgId)

  if (error) {
    return { error: 'Gagal me-void mutasi: ' + error.message }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  return { success: true }
}
