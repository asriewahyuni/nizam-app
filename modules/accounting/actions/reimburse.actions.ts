'use server'

import { getDateInTimeZone } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { checkClosedFiscalPeriod, buildClosedPeriodError } from '@/lib/erp-bridge/fiscal-period'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from './journal.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import {
  buildPublicStorageObjectPath,
  buildReceiptStorageKey,
  isObjectStorageConfigured,
  uploadObjectToStorage,
} from '@/lib/storage/object-storage.server'

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
  supabase: any
  orgId: string
  reimbursementId: string
  branchId: string
  status: 'APPROVED' | 'REJECTED'
  approverId: string
  notes?: string
}) {
  const { supabase, orgId, reimbursementId, branchId, status, approverId, notes } = params

  const { error } = await (supabase as any)
    .from('approval_requests')
    .update({
      status,
      approver_id: approverId,
      notes: notes || null,
      decided_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .eq('source_type', 'REIMBURSEMENT')
    .eq('source_id', reimbursementId)
    .eq('status', 'PENDING')

  if (error) {
    (console as any).error('Failed to sync reimbursement approval request:', error)
  }
}

export async function uploadReceipt(orgId: string, formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { success: false, error: 'Tidak terautentikasi.' }

  if (!isObjectStorageConfigured()) return { success: false, error: 'Storage belum dikonfigurasi.' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { success: false, error: 'File tidak valid.' }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storageKey = buildReceiptStorageKey(orgId, session.user.id, file.name)

    await uploadObjectToStorage({
      key: storageKey,
      body: fileBuffer,
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'private, max-age=86400',
    })

    const url = buildPublicStorageObjectPath(storageKey)
    return { success: true, url }
  } catch (err) {
    console.error('[Receipt] Upload gagal:', err)
    return { success: false, error: 'Upload nota gagal. Pastikan koneksi stabil dan coba lagi.' }
  }
}

export async function getReimbursements(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('reimbursements')
    .select(`
      *,
      items:reimbursement_items(
        *,
        account:accounts(code, name)
      )
    `)
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    (console as any).error('getReimbursements error:', error)
    return []
  }
  console.log(`Fetched ${data?.length || 0} reimbursements for org ${orgId}`)
  return data
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengajukan reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // Guard: cek periode fiskal tertutup untuk setiap tanggal pengeluaran
  for (const item of input.items) {
    const closedPeriod = await checkClosedFiscalPeriod(orgId, item.expense_date)
    if (closedPeriod) {
      return { error: buildClosedPeriodError('Pengajuan Reimbursement', item.expense_date, closedPeriod) }
    }
  }

  const totalAmount = input.items.reduce((sum: any, item: any) => sum + item.amount, 0)
  
  // 1. Generate claim number
  const claimNumber = `REIMB-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

  // 2. Insert Header
  const { data: reimbursement, error: rError } = await (supabase as any)
    .from('reimbursements')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      user_id: user.id,
      claim_number: claimNumber,
      description: input.description,
      total_amount: totalAmount,
      status: 'PENDING'
    })
    .select()
    .single()

  if (rError || !reimbursement) {
    (console as any).error('Insert reimbursement error:', rError)
    return { error: `Gagal membuat pengajuan reimburse. ${rError?.message || ''}` }
  }

  // 3. Insert Items
  const { error: iError } = await (supabase as any)
    .from('reimbursement_items')
    .insert(input.items.map((it: any) => ({
      reimbursement_id: reimbursement.id,
      ...it
    })))

  if (iError) {
    (console as any).error('Insert reimbursement items error:', iError)
    await (supabase as any).from('reimbursements').delete().eq('id', reimbursement.id)
    return { error: `Gagal menyimpan detail biaya. ${iError.message}` }
  }

  // 4. Buat Permintaan Approval ke Approval Center
  const { error: appErr } = await (supabase as any)
    .from('approval_requests')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      requester_id: user.id,
      source_type: 'REIMBURSEMENT', // Kita gunakan string ini agar Approval Center tahu sumbernya
      source_id: reimbursement.id,
      reason: `Reimbursement: ${input.description}`,
      status: 'PENDING',
      requested_at: new Date().toISOString()
    })

  if (appErr) {
    (console as any).error('Failed to create approval request:', appErr)
    // Kita tetap biarkan reimbursement terbuat walau approval center gagal (bisa manual nanti)
  }

  revalidatePath('/accounting/reimburse')
  revalidatePath('/accounting/approvals') // Refresh approval center juga
  return { success: true, id: reimbursement.id }
}

export async function approveReimbursement(id: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menyetujui reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('reimbursements')
    .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: 'Gagal menyetujui reimbursement.' }
  await syncReimbursementApprovalRequest({
    supabase,
    orgId,
    reimbursementId: id,
    branchId: activeBranchResult.branchId,
    status: 'APPROVED',
    approverId: user.id,
  })
  revalidatePath('/accounting/reimburse')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function rejectReimbursement(id: string, orgId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menolak reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('reimbursements')
    .update({ status: 'REJECTED', notes: reason, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: 'Gagal menolak reimbursement.' }
  await syncReimbursementApprovalRequest({
    supabase,
    orgId,
    reimbursementId: id,
    branchId: activeBranchResult.branchId,
    status: 'REJECTED',
    approverId: user.id,
    notes: reason,
  })
  revalidatePath('/accounting/reimburse')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function payReimbursement(id: string, orgId: string, bankAccountId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membayar reimbursement.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // 1. Fetch reimbursement data
  const { data: reim, error: rErr } = await (supabase as any)
    .from('reimbursements')
    .select(`
      *,
      items:reimbursement_items(*)
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (rErr || !reim) return { error: 'Data reimbursement tidak ditemukan.' }
  if (reim.status !== 'APPROVED') return { error: 'Hanya reimbursement status APPROVED yang bisa dibayar.' }

  // Guard: cek periode fiskal tertutup untuk tanggal pembayaran hari ini
  const paymentDate = getDateInTimeZone('Asia/Jakarta')
  const closedPeriod = await checkClosedFiscalPeriod(orgId, paymentDate)
  if (closedPeriod) {
    return { error: buildClosedPeriodError('Pembayaran Reimbursement', paymentDate, closedPeriod) }
  }

  // 2. Fetch Bank Account to get CoA Linked Account
  const { data: bank, error: bErr } = await (supabase as any)
    .from('bank_accounts')
    .select('account_id')
    .eq('id', bankAccountId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (bErr || !bank) return { error: 'Akun Bank tidak ditemukan.' }

  // 3. Prepare Journal Entry Lines
  // Group items by category_account_id
  const accountGroups: Record<string, number> = {}
  reim.items.forEach((it: any) => {
    accountGroups[it.category_account_id] = (accountGroups[it.category_account_id] || 0) + Number(it.amount)
  })

  const lines = []
  // Debits: Expense accounts
  for (const [accId, amount] of Object.entries(accountGroups)) {
    lines.push({
      account_id: accId,
      debit: amount,
      credit: 0,
      memo: `Reimburse ${reim.claim_number}: ${reim.description}`
    })
  }
  // Credit: Bank/Cash account
  lines.push({
    account_id: bank.account_id,
    debit: 0,
    credit: reim.total_amount,
    memo: `Pembayaran Reimburse ${reim.claim_number}`
  })

  // 4. Create Journal Entry
  const journalResult = await createJournalEntry({
    org_id: orgId,
    branch_id: activeBranchId,
    entry_date: paymentDate,
    description: `Pembayaran Reimburse ${reim.claim_number} - ${reim.description}`,
    reference_type: 'CASH_OUT',
    reference_id: reim.id,
    lines,
    auto_post: true
  })

  if ((journalResult as any).error) return journalResult

  // 5. Update Status to PAID
  await (supabase as any)
    .from('reimbursements')
    .update({ 
      status: 'PAID', 
      journal_id: (journalResult as any).entryId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)

  revalidatePath('/accounting/reimburse')
  return { success: true }
}
