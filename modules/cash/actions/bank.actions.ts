'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BankAccount, BankTransaction } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// getBankAccounts — fetch all bank accounts for an org
// ─────────────────────────────────────────────────────────────
export async function getBankAccounts(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('bank_accounts')
    .select('*, account:accounts(*)')
    .eq('org_id', orgId)
    .order('bank_name', { ascending: true })

  if (error) return []
  return data as (BankAccount & { account: any })[]
}

// ─────────────────────────────────────────────────────────────
// createBankAccount — Add a new bank account
// ─────────────────────────────────────────────────────────────
export async function createBankAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const accountId = formData.get('account_id') as string // The GL Account ID
  const bankName = (formData.get('bank_name') as string).trim()
  const accountNumber = (formData.get('account_number') as string).trim() || null
  const accountHolder = (formData.get('account_holder') as string).trim() || null
  const currency = (formData.get('currency') as string) || 'IDR'

  if (!accountId || !bankName) {
    return { error: 'Akun GL dan Nama Bank wajib diisi.' }
  }

  const { error } = await (supabase as any).from('bank_accounts').insert({
    org_id: orgId,
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

  const { error } = await (supabase as any).from('bank_transactions').insert({
    org_id: orgId,
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
export async function getRecentBankTransactions(orgId: string, limit = 10) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('bank_transactions')
    .select('*, bank_account:bank_accounts(bank_name, account_number), category:accounts(name, code)')
    .eq('org_id', orgId)
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
// deleteBankTransaction — Remove a cash movement
// ─────────────────────────────────────────────────────────────
export async function deleteBankTransaction(orgId: string, transactionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // 1. Fetch the linked journal entry BEFORE deleting (SET NULL on delete)
  const { data: tx } = await (supabase as any)
    .from('bank_transactions')
    .select('journal_entry_id')
    .eq('id', transactionId)
    .eq('org_id', orgId)
    .single()

  // 2. Void the linked journal entry so GL stays balanced
  if (tx?.journal_entry_id) {
    await (supabase as any)
      .from('journal_entries')
      .update({
        status: 'VOIDED',
        void_reason: 'Transaksi Kas/Bank dihapus manual',
        voided_by: user.id,
        voided_at: new Date().toISOString()
      })
      .eq('id', tx.journal_entry_id)
  }

  // 3. Delete the transaction
  const { error } = await (supabase as any)
    .from('bank_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('org_id', orgId)

  if (error) {
    return { error: 'Gagal menghapus mutasi: ' + error.message }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  return { success: true }
}
