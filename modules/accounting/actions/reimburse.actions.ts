'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from './journal.actions'

export async function uploadReceipt(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Tidak terautentikasi.' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { success: false, error: 'File tidak valid.' }

  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (error) return { success: false, error: `Upload gagal: ${error.message}` }

  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath)

  return { success: true, url: publicUrl }
}

export async function getReimbursements(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('reimbursements')
    .select(`
      *,
      items:reimbursement_items(
        *,
        account:accounts(code, name)
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

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

  const totalAmount = input.items.reduce((sum: any, item: any) => sum + item.amount, 0)
  
  // 1. Generate claim number
  const claimNumber = `REIMB-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

  // 2. Insert Header
  const { data: reimbursement, error: rError } = await (supabase as any)
    .from('reimbursements')
    .insert({
      org_id: orgId,
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
  const { error } = await (supabase as any)
    .from('reimbursements')
    .update({ status: 'APPROVED' })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal menyetujui reimbursement.' }
  revalidatePath('/accounting/reimburse')
  return { success: true }
}

export async function rejectReimbursement(id: string, orgId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('reimbursements')
    .update({ status: 'REJECTED', notes: reason })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal menolak reimbursement.' }
  revalidatePath('/accounting/reimburse')
  return { success: true }
}

export async function payReimbursement(id: string, orgId: string, bankAccountId: string) {
  const supabase = await createClient()

  // 1. Fetch reimbursement data
  const { data: reim, error: rErr } = await (supabase as any)
    .from('reimbursements')
    .select(`
      *,
      items:reimbursement_items(*)
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (rErr || !reim) return { error: 'Data reimbursement tidak ditemukan.' }
  if (reim.status !== 'APPROVED') return { error: 'Hanya reimbursement status APPROVED yang bisa dibayar.' }

  // 2. Fetch Bank Account to get CoA Linked Account
  const { data: bank, error: bErr } = await (supabase as any)
    .from('bank_accounts')
    .select('account_id')
    .eq('id', bankAccountId)
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
    entry_date: new Date().toISOString().split('T')[0],
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

  revalidatePath('/accounting/reimburse')
  return { success: true }
}
