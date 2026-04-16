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

const JOURNAL_ENTRY_MAX_INSERT_RETRIES = 5

function isJournalEntryNumberCollision(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()
  const code = String(error.code || '')

  return code === '23505' && (
    message.includes('journal_entries_org_id_entry_number_key')
    || (message.includes('duplicate key') && message.includes('entry_number'))
  )
}

function getJournalInsertErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').trim()
  if (!message) return 'Gagal membuat jurnal.'

  if (isJournalEntryNumberCollision(error)) {
    return 'Nomor jurnal bentrok saat disimpan. Sistem sudah mencoba ulang, silakan coba lagi beberapa saat lagi.'
  }

  return message
}

async function getNextJournalEntryNumber(supabase: any, orgId: string) {
  const year = String(new Date().getFullYear())
  const prefix = `JE-${year}-`

  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .select('entry_number')
    .eq('org_id', orgId)
    .like('entry_number', `${prefix}%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message || 'Gagal membaca nomor jurnal terakhir.' }
  }

  const lastEntryNumber = String(data?.entry_number || '')
  const lastSequence = lastEntryNumber.startsWith(prefix)
    ? Number.parseInt(lastEntryNumber.slice(prefix.length), 10)
    : 0
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1

  return {
    entryNumber: `${prefix}${String(nextSequence).padStart(6, '0')}`,
  }
}

async function insertJournalEntryHeaderWithRetry(
  supabase: any,
  input: CreateJournalEntryInput,
  branchId: string | null,
  userId: string
) {
  let lastError: { message?: string; code?: string } | null = null

  for (let attempt = 0; attempt < JOURNAL_ENTRY_MAX_INSERT_RETRIES; attempt += 1) {
    const nextEntryNumberResult = await getNextJournalEntryNumber(supabase, input.org_id)
    if ('error' in nextEntryNumberResult) {
      return {
        data: null,
        error: { message: nextEntryNumberResult.error },
      }
    }

    const { data, error } = await (supabase as any)
      .from('journal_entries')
      .insert({
        org_id: input.org_id,
        branch_id: branchId,
        entry_number: nextEntryNumberResult.entryNumber,
        entry_date: input.entry_date,
        description: input.description,
        reference_type: input.reference_type || 'MANUAL',
        reference_id: input.reference_id || null,
        notes: input.notes || null,
        status: 'DRAFT',
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      return { data, error: null }
    }

    if (!isJournalEntryNumberCollision(error)) {
      return { data: null, error }
    }

    lastError = error
  }

  return {
    data: null,
    error: lastError || { message: 'Gagal membuat jurnal setelah beberapa percobaan.' },
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

async function getClosedFiscalPeriodName(
  supabase: any,
  orgId: string,
  entryDate?: string | null
): Promise<string | null> {
  const normalizedEntryDate = String(entryDate || '').trim()
  if (!normalizedEntryDate) return null

  const { data, error } = await (supabase as any)
    .from('fiscal_periods')
    .select('name')
    .eq('org_id', orgId)
    .eq('is_closed', true)
    .lte('start_date', normalizedEntryDate)
    .gte('end_date', normalizedEntryDate)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return String(data.name || '').trim() || null
}

function buildClosedPeriodMessage(entryDate: string, actionLabel: string, fiscalPeriodName?: string | null) {
  if (fiscalPeriodName) {
    return `Jurnal tanggal ${entryDate} berada pada periode fiskal "${fiscalPeriodName}" yang sudah ditutup. Jurnal tidak dapat ${actionLabel}.`
  }

  return `Jurnal tanggal ${entryDate} berada pada periode fiskal yang sudah ditutup. Jurnal tidak dapat ${actionLabel}.`
}

async function getClosedPeriodMessageForJournalDate(
  supabase: any,
  orgId: string,
  entryDate?: string | null,
  actionLabel = 'diubah'
) {
  const normalizedEntryDate = String(entryDate || '').trim()
  if (!normalizedEntryDate) return null

  const fiscalPeriodName = await getClosedFiscalPeriodName(supabase, orgId, normalizedEntryDate)
  if (!fiscalPeriodName) return null

  return buildClosedPeriodMessage(normalizedEntryDate, actionLabel, fiscalPeriodName)
}

async function getClosedPeriodMessageForJournalEntry(
  supabase: any,
  orgId: string,
  entryId: string,
  actionLabel = 'diubah'
) {
  const { data: entry, error } = await (supabase as any)
    .from('journal_entries')
    .select('entry_date')
    .eq('id', entryId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !entry?.entry_date) return null

  return getClosedPeriodMessageForJournalDate(supabase, orgId, String(entry.entry_date), actionLabel)
}

export async function getUnpostedJournalsCount(orgId: string, branchId?: string | null): Promise<number> {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { count, error } = await query

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

  const closedPeriodMessage = await getClosedPeriodMessageForJournalDate(
    supabase,
    input.org_id,
    input.entry_date,
    'dibuat'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  // Insert header with explicit entry number so PO receipt is not blocked by
  // trigger collisions from COUNT(*)-based numbering.
  const { data: entry, error: entryError } = await insertJournalEntryHeaderWithRetry(
    supabase,
    input,
    resolvedBranch.branchId,
    user.id
  )

  if (entryError || !entry) {
    return { error: getJournalInsertErrorMessage(entryError) }
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

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'diposting'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

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

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'di-void'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

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

  if (error) return { error: error.message || 'Gagal membatalkan jurnal.' }

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

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'disembunyikan'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

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

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'dihapus'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

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
    branch_id?: string
    fromDate?: string
    toDate?: string
    limit?: number
  }
) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  // Build parameterized query dynamically
  const params: unknown[] = [orgId]
  const whereClauses: string[] = [
    `je.org_id = $1`,
    `(je.void_reason IS NULL OR je.void_reason <> 'HARD_DELETE_HIDDEN')`,
  ]

  if (filters?.status) {
    whereClauses.push(`je.status = $${params.push(filters.status)}`)
  }
  if (filters?.branch_id) {
    whereClauses.push(`je.branch_id = $${params.push(filters.branch_id)}`)
  }
  if (filters?.fromDate) {
    whereClauses.push(`je.entry_date >= $${params.push(filters.fromDate)}`)
  }
  if (filters?.toDate) {
    whereClauses.push(`je.entry_date <= $${params.push(filters.toDate)}`)
  }

  const limit = filters?.limit || 50
  params.push(limit)

  let entryRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT je.*
      FROM   public.journal_entries je
      WHERE  ${whereClauses.join(' AND ')}
      ORDER  BY je.entry_date DESC, je.created_at DESC
      LIMIT  $${params.length}
    `, params)
    entryRows = result.rows
  } catch (err) {
    ;(console as any).error('[getJournalEntries] raw SQL error:', err)
    return []
  }

  if (entryRows.length === 0) return []

  // Fetch journal lines with account info in one query
  const entryIds = entryRows.map((r) => r.id)
  const linesByEntryId: Record<string, any[]> = {}
  try {
    const linesResult = await queryPostgres<Record<string, unknown>>(`
      SELECT
        jl.*,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type
      FROM   public.journal_lines jl
      LEFT JOIN public.accounts a ON a.id = jl.account_id
      WHERE  jl.entry_id = ANY($1::uuid[])
    `, [entryIds])

    for (const line of linesResult.rows) {
      const eid = String(line.entry_id ?? '')
      if (!linesByEntryId[eid]) linesByEntryId[eid] = []
      linesByEntryId[eid].push({
        ...line,
        debit: toNumber(line.debit),
        credit: toNumber(line.credit),
        // UI expects line.accounts?.code, line.accounts?.name, line.accounts?.type
        accounts: line.account_name
          ? { code: line.account_code, name: line.account_name, type: line.account_type }
          : null,
      })
    }
  } catch (err) {
    ;(console as any).error('[getJournalEntries] lines SQL error:', err)
  }

  return entryRows.map((row) => {
    const eid = String(row.id ?? '')
    const lines = (linesByEntryId[eid] ?? [])
      .sort((a: any, b: any) => (Number(b.debit) || 0) - (Number(a.debit) || 0))
    return { ...row, journal_lines: lines }
  })
}
