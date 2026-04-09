'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import type { Account, BankAccount } from '@/types/database.types'
import type { CashBankAccount, RecentTransactionOption } from '@/modules/cash/types'

type ActiveBranchResult = { branchId: string } | { error: string }
type NamedRelation = { name?: string | null } | Array<{ name?: string | null }> | null | undefined
type CashBankAccountRecord = Omit<CashBankAccount, 'balances' | 'org_name' | 'branch_name'>
type AccountBalanceRow = {
  account_id?: string | null
  balance?: number | string | null
}

function isInvestingTransferAccount(account: Pick<Account, 'code' | 'name' | 'type' | 'cash_flow_category'> | null | undefined) {
  const code = String(account?.code || '').trim()
  const name = String(account?.name || '').toLowerCase()

  return (
    account?.type === 'ASSET' &&
    (
      account?.cash_flow_category === 'INVESTING' ||
      code.startsWith('16') ||
      name.includes('investasi')
    )
  )
}

function isFinancingTransferAccount(account: Pick<Account, 'code' | 'type' | 'cash_flow_category'> | null | undefined) {
  const code = String(account?.code || '').trim()

  return (
    (account?.type === 'EQUITY' || account?.type === 'LIABILITY') &&
    (
      account?.cash_flow_category === 'FINANCING' ||
      code.startsWith('25') ||
      code.startsWith('26') ||
      code.startsWith('3')
    )
  )
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection) return { error: branchSelection.error || errorMessage }
  if (!branchSelection.branchId) return { error: errorMessage }
  return { branchId: branchSelection.branchId }
}

function readRelationName(relation: NamedRelation): string | null {
  if (!relation) return null
  if (!Array.isArray(relation) && typeof relation.name === 'string') return relation.name
  if (Array.isArray(relation) && relation.length > 0 && typeof relation[0]?.name === 'string') {
    return relation[0].name
  }
  return null
}

function isMissingRpc(error: { code?: string | null; message?: string | null } | null | undefined, functionName: string) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const normalizedFunctionName = functionName.toLowerCase()

  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (
      message.includes(normalizedFunctionName) &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('undefined function'))
    )
  )
}

function decorateCashAccountsWithBalance<T extends CashBankAccountRecord & {
  branch?: NamedRelation
  organization?: NamedRelation
}>(
  accounts: T[],
  balancesByAccountId: Map<string, number>
): CashBankAccount[] {
  return accounts.map((acc) => ({
    ...acc,
    balances: { balance: balancesByAccountId.get(String(acc.account_id)) || 0 },
    org_name: readRelationName(acc.organization),
    branch_name: readRelationName(acc.branch),
  }))
}

async function getPostedEntryIdsForCash(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  let query = supabase
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []
  return data.map((entry: { id: string }) => entry.id)
}

export async function getBankAccountsWithBalances(
  orgId: string,
  branchId?: string | null
): Promise<CashBankAccount[]> {
  const supabase = await createClient()

  let resolvedBranchId = branchId ?? null
  if (resolvedBranchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, resolvedBranchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    resolvedBranchId = branchSelection.branchId
  }

  let accountsQuery = (supabase as any)
    .from('bank_accounts')
    .select(`
      id,
      org_id,
      branch_id,
      account_id,
      bank_name,
      account_number,
      account:accounts(id, code, name, type, cash_flow_category),
      branch:branches(name)
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (resolvedBranchId) {
    accountsQuery = accountsQuery.eq('branch_id', resolvedBranchId)
  }

  const { data: accounts, error: accountError } = await accountsQuery.order('bank_name', { ascending: true })
  if (accountError || !Array.isArray(accounts) || accounts.length === 0) return []

  const typedAccounts = accounts as Array<CashBankAccountRecord & { branch?: NamedRelation }>
  const accountIds = typedAccounts.map((account) => String(account.account_id || '').trim()).filter(Boolean)
  if (accountIds.length === 0) return decorateCashAccountsWithBalance(typedAccounts, new Map())

  const { data: scopedBalances, error: scopedBalanceError } = await (supabase as any).rpc('get_posted_account_balances', {
    p_org_id: orgId,
    p_branch_id: resolvedBranchId,
    p_account_ids: accountIds,
  })

  if (!scopedBalanceError && Array.isArray(scopedBalances)) {
    const balancesByAccountId = new Map<string, number>(
      (scopedBalances as AccountBalanceRow[]).map((row) => [String(row.account_id), Number(row.balance || 0)])
    )
    return decorateCashAccountsWithBalance(typedAccounts, balancesByAccountId)
  }

  if (scopedBalanceError) {
    const fallbackReason = isMissingRpc(scopedBalanceError, 'get_posted_account_balances')
      ? 'RPC belum tersedia, pakai fallback query lama'
      : 'RPC gagal, pakai fallback query lama'
    ;(console as any).warn('getBankAccountsWithBalances:', fallbackReason, scopedBalanceError)
  }

  if (!resolvedBranchId) {
    const { data: balances, error: balanceError } = await (supabase as any)
      .from('account_balances')
      .select('account_id, balance')
      .in('account_id', accountIds)

    if (balanceError || !Array.isArray(balances)) {
      return decorateCashAccountsWithBalance(typedAccounts, new Map())
    }

    const balancesByAccountId = new Map<string, number>(
      (balances as AccountBalanceRow[]).map((row) => [String(row.account_id), Number(row.balance || 0)])
    )
    return decorateCashAccountsWithBalance(typedAccounts, balancesByAccountId)
  }

  const entryIds = await getPostedEntryIdsForCash(orgId, resolvedBranchId)
  if (entryIds.length === 0) {
    return decorateCashAccountsWithBalance(typedAccounts, new Map())
  }

  const { data: lines, error: linesError } = await (supabase as any)
    .from('journal_lines')
    .select('account_id, debit, credit')
    .in('entry_id', entryIds)
    .in('account_id', accountIds)

  if (linesError || !Array.isArray(lines)) {
    return decorateCashAccountsWithBalance(typedAccounts, new Map())
  }

  const balanceMap = new Map<string, number>()
  for (const line of lines as Array<{ account_id?: string | null; debit?: number | string | null; credit?: number | string | null }>) {
    const accountId = String(line.account_id || '').trim()
    if (!accountId) continue
    const current = balanceMap.get(accountId) || 0
    balanceMap.set(accountId, current + Number(line.debit || 0) - Number(line.credit || 0))
  }

  return decorateCashAccountsWithBalance(typedAccounts, balanceMap)
}

export async function getBankLiquidityTotal(
  orgId: string,
  branchId?: string | null
): Promise<number> {
  const bankAccounts = await getBankAccountsWithBalances(orgId, branchId)
  return bankAccounts.reduce((sum, account) => sum + Number(account?.balances?.balance || 0), 0)
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
// HANYA untuk Parent/Holding. Child/Branch gunakan:
// → /accounting/coa-requests untuk mengajukan rekening baru
// ─────────────────────────────────────────────────────────────
export async function createBankAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()

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

  const { error } = await (supabase as any).from('bank_accounts').insert({
    org_id: finalOrgId,
    branch_id: finalBranchId as string,
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
  const categoryId = formData.get('category_id') as string // Opposite Ledger Account for IN/OUT
  const targetBankAccountId = (formData.get('target_bank_account_id') as string | null)?.trim() || null
  const referenceNumber = (formData.get('reference_number') as string | null)?.trim() || null

  if (!bankAccountId || !transDate || !description || isNaN(amount) || amount <= 0 || !type) {
    return { error: 'Semua field wajib diisi.' }
  }

  const { data: bankAccount, error: bankAccountError } = await (supabase as any)
    .from('bank_accounts')
    .select('id, branch_id, account_id')
    .eq('id', bankAccountId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (bankAccountError || !bankAccount?.id) {
    return { error: 'Rekening kas/bank tidak ditemukan.' }
  }

  if (bankAccount.branch_id !== activeBranchResult.branchId) {
    return { error: 'Rekening kas/bank tersebut tidak tersedia pada unit aktif.' }
  }

  let oppositeAccountId = categoryId

  if (type === 'TRANSFER') {
    const targetLookup = targetBankAccountId
      ? (supabase as any)
          .from('bank_accounts')
          .select('id, branch_id, account_id')
          .eq('id', targetBankAccountId)
          .eq('org_id', orgId)
      : (supabase as any)
          .from('bank_accounts')
          .select('id, branch_id, account_id')
          .eq('account_id', categoryId)
          .eq('org_id', orgId)
          .eq('branch_id', activeBranchResult.branchId)

    const { data: targetBankAccount, error: targetBankAccountError } = await targetLookup.maybeSingle()

    if (targetBankAccountError || !targetBankAccount?.id) {
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

  const { error } = await (supabase as any).from('bank_transactions').insert({
    org_id: orgId,
    branch_id: activeBranchResult.branchId,
    bank_account_id: bankAccountId,
    transaction_date: transDate,
    description,
    amount,
    type,
    category_id: oppositeAccountId,
    reference_number: referenceNumber,
    status: 'POSTED' // Automatically post to GL via trigger
  })

  if (error) {
    return { error: 'Gagal menyimpan transaksi: ' + error.message }
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
  const supabase = await createClient()

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

  const { data: sourceCounterAccount, error: sourceCounterError } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, cash_flow_category')
    .eq('id', sourceCounterAccountId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (sourceCounterError || !sourceCounterAccount?.id) {
    return { error: 'Akun investasi parent (sumber) tidak ditemukan.' }
  }

  if (!isInvestingTransferAccount(sourceCounterAccount)) {
    return {
      error:
        'Akun lawan parent harus akun investasi (kelompok 16xx), misalnya 1601 Investasi pada Entitas Anak / Unit.',
    }
  }

  const { data: targetCounterAccount, error: targetCounterError } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, cash_flow_category')
    .eq('id', targetCounterAccountId)
    .maybeSingle()

  if (targetCounterError || !targetCounterAccount?.id) {
    return { error: 'Akun lawan entitas tujuan tidak ditemukan.' }
  }

  if (!isFinancingTransferAccount(targetCounterAccount)) {
    return {
      error:
        'Akun lawan entitas tujuan harus akun pendanaan/modal (kelompok 25xx, 26xx, atau 3xxx), misalnya 3001 Modal Disetor.',
    }
  }

  const { data, error } = await (supabase as any).rpc('create_interorg_capital_transfer', {
    p_source_org_id: orgId,
    p_source_bank_account_id: sourceBankAccountId,
    p_source_counter_account_id: sourceCounterAccountId,
    p_target_bank_account_id: targetBankAccountId,
    p_target_counter_account_id: targetCounterAccountId,
    p_transaction_date: transactionDate,
    p_amount: amount,
    p_description: description,
    p_reference_number: referenceNumber,
  })

  if (error) {
    return { error: `Gagal mencatat transfer modal antar entitas: ${error.message}` }
  }

  revalidatePath('/cash')
  revalidatePath('/accounting/journal')
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { success: true, data }
}

// ─────────────────────────────────────────────────────────────
// getRecentBankTransactions — fetch recent ones
// ─────────────────────────────────────────────────────────────
export async function getRecentBankTransactions(
  orgId: string,
  limit = 10,
  branchId?: string | null
): Promise<RecentTransactionOption[]> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bank_transactions')
    .select(`
      id,
      org_id,
      branch_id,
      bank_account_id,
      transaction_date,
      description,
      amount,
      type,
      status,
      bank_account:bank_accounts(bank_name, account_number),
      category:accounts(name, code)
    `)
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
  return data as RecentTransactionOption[]
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
  revalidatePath('/reports')
  revalidatePath('/dashboard')
  return { success: true }
}
