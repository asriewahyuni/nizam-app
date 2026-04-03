'use server'

import { createClient } from '@/lib/supabase/server'
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
  branch_id?: string // Added for multi-branch support
  entry_date: string
  description: string
  reference_type?: JournalReferenceType
  reference_id?: string
  notes?: string
  lines: JournalLineInput[]
  auto_post?: boolean // if true, immediately post after creation
  allow_org_scope?: boolean
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

export async function getUnpostedJournalsCount(orgId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await (supabase as any)
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (error) {
    (console as any).error('Error fetching unposted journals count:', error)
    return 0
  }
  return count || 0
}

// ─────────────────────────────────────────────────────────────
// createJournalEntry — Core accounting engine
// Creates header + lines, optionally posts immediately
// ─────────────────────────────────────────────────────────────
export async function createJournalEntry(input: CreateJournalEntryInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // Validate: minimum 2 lines
  if (input.lines.length < 2) {
    return { error: 'Minimal 2 baris jurnal diperlukan.' }
  }

  // Validate: balanced entry
  const totalDebit = input.lines.reduce((s: any, l: any) => s + (l.debit || 0), 0)
  const totalCredit = input.lines.reduce((s: any, l: any) => s + (l.credit || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Jurnal tidak balance: debit ${totalDebit} ≠ credit ${totalCredit}` }
  }

  const resolvedBranch = await resolveJournalBranchId(input)
  if ('error' in resolvedBranch) return resolvedBranch

  // Insert header
  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .insert({
      org_id: input.org_id,
      branch_id: resolvedBranch.branchId, // Linked to branch
      entry_date: input.entry_date,
      description: input.description,
      reference_type: input.reference_type || 'MANUAL',
      reference_id: input.reference_id || null,
      notes: input.notes || null,
      status: 'DRAFT',
      created_by: user.id,
    })
    .select()
    .single()

  if (entryError || !entry) {
    return { error: 'Gagal membuat jurnal.' }
  }

  // Insert lines
  const { error: linesError } = await (supabase as any)
    .from('journal_lines')
    .insert(
      input.lines.map((line) => ({
        entry_id: entry.id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        memo: line.memo || null,
      }))
    )

  if (linesError) {
    // Clean up orphaned header
    await (supabase as any).from('journal_entries').delete().eq('id', entry.id)
    return { error: 'Gagal menyimpan baris jurnal.' }
  }

  // Auto-post if requested
  if (input.auto_post) {
    const result = await postJournalEntry(entry.id, input.org_id)
    if ((result as any).error) return result
  }

  revalidatePath('/accounting/journal')
  return { success: true, entryId: entry.id, entryNumber: entry.entry_number }
}

// ─────────────────────────────────────────────────────────────
// postJournalEntry — Post (finalize) a DRAFT entry
// DB trigger validates balance before allowing this
// ─────────────────────────────────────────────────────────────
export async function postJournalEntry(entryId: string, orgId: string) {
  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entryId)
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (error) {
    return { error: error.message || 'Gagal memposting jurnal.' }
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // 1. Fetch info for potential sync before voiding
  const { data: entry } = await (supabase as any)
    .from('journal_entries')
    .select('reference_type, reference_id')
    .eq('id', entryId)
    .single()

  // 2. VOID operation
  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'VOIDED',
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: reason,
    })
    .eq('id', entryId)
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (error) return { error: 'Gagal membatalkan jurnal.' }

  // 3. THE ENTERPRISE INTEGRITY: Two-Way Sync (Syncing GL to Modules)
  if (entry?.reference_id) {
    const refId = entry.reference_id;
    const refType = entry.reference_type;

    // A. SALES RETURN REVERSAL
    if (refType === 'SALES_RETURN') {
       await (supabase as any).from('sales_returns').update({ status: 'VOIDED' }).eq('id', refId);
       // Revert Stock
       await (supabase as any).from('stock_movements').delete().eq('reference_id', refId).eq('reference_type', 'SALES_RETURN');
    }

    // B. INVENTORY ADJUSTMENT (WRITE-OFF) REVERSAL
    if (refType === 'ADJUSTMENT') {
       await (supabase as any).from('inventory_adjustments').update({ status: 'VOIDED' }).eq('id', refId);
       // Revert Stock
       await (supabase as any).from('stock_movements').delete().eq('reference_id', refId).eq('reference_type', 'ADJUSTMENT');
       
       // Handle Fixed Asset link if any (Check CTO Challenge case)
       const { data: asset } = await (supabase as any).from('fixed_assets').select('id').eq('id', refId).single();
       if (asset) {
          await (supabase as any).from('fixed_assets').update({ status: 'VOIDED' }).eq('id', asset.id);
       }
    }

    // C. PURCHASE RETURN REVERSAL
    // C. PURCHASE RETURN REVERSAL
    if (refType === 'PURCHASE_RETURN') {
       await (supabase as any).from('purchase_returns').update({ status: 'VOIDED' }).eq('id', refId);
       await (supabase as any).from('stock_movements').delete().eq('reference_id', refId).eq('reference_type', 'PURCHASE_RETURN');
    }

    // D. PAYMENT REVERSAL (AR/AP)
    if (refType === 'PAYMENT_IN') {
       const { data: pay } = await (supabase as any).from('sales_payments').select('sale_id').eq('id', refId).single();
       if (pay) {
          await (supabase as any).from('sales').update({ payment_status: 'PARTIAL' }).eq('id', pay.sale_id);
       }
    }
    if (refType === 'PAYMENT_OUT') {
       const { data: pay } = await (supabase as any).from('purchase_payments').select('purchase_id').eq('id', refId).single();
       if (pay) {
          await (supabase as any).from('purchases').update({ payment_status: 'PARTIAL' }).eq('id', pay.purchase_id);
       }
    }
  }

  revalidatePath('/accounting/journal')
  revalidatePath('/accounting/assets')
  revalidatePath('/sales')
  revalidatePath('/purchase')
  revalidatePath('/inventory')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteJournalEntry — Soft-delete (Hidden from UI)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// deleteJournalEntry — Soft-delete (Hidden from UI) for Posted/Reference
// ─────────────────────────────────────────────────────────────
export async function deleteJournalEntry(entryId: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({ 
      status: 'VOIDED', 
      void_reason: 'HARD_DELETE_HIDDEN',
      voided_at: new Date().toISOString(),
      voided_by: user.id
    })
    .eq('id', entryId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal memperbarui jurnal: ' + error.message }

  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// hardDeleteDraftJournal — Actual delete for DRAFT status
// ─────────────────────────────────────────────────────────────
export async function hardDeleteDraftJournal(entryId: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // We explicitly check for DRAFT status to prevent deleting posted data
  // Using .select() to verify if any rows were actually affected (RLS check)
  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')
    .select('id')

  if (error) return { error: 'Gagal menghapus draft: ' + error.message }
  if (!data || data.length === 0) {
    return { error: 'Gagal menghapus draft. Mungkin Anda tidak memiliki izin atau data sudah terhapus/berubah status.' }
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
    branch_id?: string // Filter by branch
    fromDate?: string
    toDate?: string
    limit?: number
  }
) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounts (code, name, type)
      )
    `)
    .eq('org_id', orgId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Filter out the soft-deleted ones acting as hard-deletes
  query = query.or('void_reason.is.null,void_reason.neq.HARD_DELETE_HIDDEN')

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.branch_id) {
    query = query.eq('branch_id', filters.branch_id)
  }
  if (filters?.fromDate) {
    query = query.gte('entry_date', filters.fromDate)
  }
  if (filters?.toDate) {
    query = query.lte('entry_date', filters.toDate)
  }

  query = query.limit(filters?.limit || 50)

  const { data, error } = await query
  if (error || !data) return []

  // Sort helper: Debit > 0 appears first, then Credit > 0
  data.forEach((entry: any) => {
    if (entry.journal_lines) {
      entry.journal_lines.sort((a: any, b: any) => (b.debit || 0) - (a.debit || 0))
    }
  })

  return data
}
