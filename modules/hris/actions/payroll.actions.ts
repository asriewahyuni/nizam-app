'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

async function resolvePayrollBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requirePayrollRunBranch(orgId: string, errorMessage: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolvePayrollBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId as string }
}

async function ensurePayrollBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolvePayrollBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
}

export async function getPayrollComponents(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('payroll_components')
    .select(`
      *,
      account:account_id(name, code)
    `)
    .eq('org_id', orgId)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (error) return []
  return data
}

export async function createPayrollComponent(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const isPercentage = formData.get('is_percentage') === 'on'
  const isTaxable = formData.get('is_taxable') === 'on'

  const { error } = await (supabase as any).from('payroll_components').insert({
    org_id: orgId,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    is_taxable: isTaxable,
    is_percentage: isPercentage,
    default_amount: isPercentage ? 0 : Number(formData.get('amount') || 0),
    percentage_value: isPercentage ? Number(formData.get('amount') || 0) : null,
    account_id: formData.get('account_id') as string || null
  })

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function deletePayrollComponent(componentId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('payroll_components').delete().eq('id', componentId)
  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}
export async function getPayrollRuns(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolvePayrollBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = (supabase as any)
    .from('payroll_runs')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .order('period_start', { ascending: false })

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function generatePayrollRun(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const activeBranch = await requirePayrollRunBranch(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat payroll run.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }
  
  const periodStart = formData.get('period_start') as string
  const periodEnd = formData.get('period_end') as string
  const paymentDate = formData.get('payment_date') as string

  // 1. Create the Run Header
  const { data: run, error: runErr } = await (supabase as any)
    .from('payroll_runs')
    .insert({
      org_id: orgId,
      branch_id: activeBranch.branchId,
      period_start: periodStart,
      period_end: periodEnd,
      payment_date: paymentDate,
      status: 'DRAFT'
    })
    .select()
    .single()

  if (runErr) return { error: runErr.message }

  // 2. Execute SQL generation function
  const { error: genErr } = await (supabase as any).rpc('generate_payslips_for_run', { 
    p_run_id: run.id 
  })

  if (genErr) return { error: 'Gagal memproses payslip: ' + genErr.message }

  revalidatePath('/hris')
  return { success: true }
}


export async function payPayrollRun(runId: string, orgId: string, accountId: string) {
  const supabase = await createClient()
  const db = supabase as any
  
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: run, error: runError } = await db
    .from('payroll_runs')
    .select('id, branch_id')
    .eq('id', runId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (runError) return { error: runError.message }

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  // 1. Update the run with selected bank account before processing
  await db
    .from('payroll_runs')
    .update({ disbursement_account_id: accountId })
    .eq('id', runId)
    .eq('org_id', orgId)
    .eq('branch_id', accessibleRun.branchId)

  // 2. Execute SQL payment/journalizing function
  const { error } = await db.rpc('process_payroll_payment', {
    p_run_id: runId,
    p_bank_account_id: accountId, // This is now a fallback in the SQL function
    p_created_by: user.id
  })

  if (error) return { error: 'Gagal memproses pembayaran: ' + error.message }

  revalidatePath('/hris')
  return { success: true }
}


export async function fixEmptyPayrollJournals(orgId: string) {
  const supabase = await createClient()
  const activeBranch = await requirePayrollRunBranch(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menjalankan perbaikan jurnal payroll.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  const { data: runs } = await (supabase as any)
    .from('payroll_runs')
    .select('*')
    .eq('org_id', orgId)
    .eq('branch_id', activeBranch.branchId)
    .eq('status', 'PAID')

  if (!runs) return { success: true, count: 0 }

  let fixedCount = 0
  // 1. SMART ACCOUNT LOOKUP (CDO Logic: No Hardcode)
  let { data: accExpense } = await (supabase as any).from('accounts').select('id').eq('org_id', orgId).eq('code', '6001').maybeSingle()
  if (!accExpense) {
     const { data: altAcc } = await (supabase as any).from('accounts').select('id').eq('org_id', orgId).ilike('name', '%Beban Gaji%').limit(1).maybeSingle()
     accExpense = altAcc
  }
  
  const { data: firstBank } = await (supabase as any).from('bank_accounts').select('account_id').eq('org_id', orgId).limit(1).maybeSingle()

  if (!accExpense || !firstBank) {
      console.warn('Fallback Account for Payroll not found (Code 6001 or "Beban Gaji") or Bank Account missing.');
      return { error: 'Konfigurasi Akun Gaji (6001) atau Bank Account tidak ditemukan. Selesaikan CoA Anda!' }
  }

  for (const run of runs) {
    if (!run.journal_entry_id) continue
    
    // Check if lines are truly missing or just have basic 2 lines while should have more
    const { count } = await (supabase as any).from('journal_lines').select('*', { count: 'exact', head: true }).eq('entry_id', run.journal_entry_id)

    // Get Payslip Data to see if we HAVE more details than currently in JE
    const { data: slips } = await (supabase as any).from('payslips').select('id').eq('run_id', run.id)
    const slipIds = slips?.map((s: any) => s.id) || []
    const { data: allLines } = await (supabase as any).from('payslip_lines').select('id').in('payslip_id', slipIds)

    const detailCount = allLines?.length || 0
    
    // CONDITION: Either missing (count=0) OR only has 2 lines while we have many detail lines
    if ((count ?? 0) === 0 || ((count ?? 0) === 2 && detailCount > 0)) {
       // Proceed to fix (VOID old, create new)
       await (supabase as any).from('journal_entries').update({ 
         status: 'VOIDED', 
         void_reason: 'Deep-reconciliation to include detailed PPh/Components' 
       }).eq('id', run.journal_entry_id)

       const { data: newEntry } = await (supabase as any).from('journal_entries').insert({
         org_id: orgId,
         branch_id: run.branch_id,
         entry_date: run.payment_date,
         description: `[RE-SYNC] Pembayaran Gaji Periode ${run.period_start} s/d ${run.period_end}`,
         reference_id: run.id,
         reference_type: 'PAYROLL',
         status: 'DRAFT',
         is_auto: true
       }).select().single()

       if (newEntry) {
          // 2.1 Get and Aggregate Detailed Lines if they exist
          const { data: slips } = await (supabase as any).from('payslips').select('id').eq('run_id', run.id)
          const slipIds = slips?.map((s: any) => s.id) || []
          const { data: allLines } = await (supabase as any).from('payslip_lines').select('*').in('payslip_id', slipIds)

          const journalLinesBody: any[] = []
          
          if (allLines && allLines.length > 0) {
             const accountTotals = new Map<string, { debit: number; credit: number }>()
             for (const line of allLines) {
                // @ts-ignore
                const accId = line.account_id || accExpense.id
                const current = accountTotals.get(accId) || { debit: 0, credit: 0 }
                if (line.type === 'EARNING' || line.type === 'BENEFIT') current.debit += Number(line.amount)
                else if (line.type === 'DEDUCTION' || line.type === 'TAX') current.credit += Number(line.amount)
                accountTotals.set(accId, current)
             }

             accountTotals.forEach((val: any, accId: any) => {
               if (val.debit > 0) journalLinesBody.push({ entry_id: newEntry.id, account_id: accId, debit: val.debit, credit: 0, memo: '[AUTO-FIX] Beban Komponen' })
               if (val.credit > 0) journalLinesBody.push({ entry_id: newEntry.id, account_id: accId, debit: 0, credit: val.credit, memo: '[AUTO-FIX] Potongan/Pajak' })
             })
             
             // Balancer
             // Balancer: Use stored disbursement account or from current run
             const bankAccId = run.disbursement_account_id || firstBank.account_id
             journalLinesBody.push({ entry_id: newEntry.id, account_id: bankAccId, debit: 0, credit: run.total_net, memo: '[AUTO-FIX] Disbursement' })
          } else {
             // Fallback to simple 2-line if no details found
             const bankAccId = run.disbursement_account_id || firstBank.account_id
             journalLinesBody.push({ entry_id: newEntry.id, account_id: accExpense.id, debit: run.total_net, credit: 0, memo: '[AUTO-FIX] Beban Gaji (Glongongan)' })
             journalLinesBody.push({ entry_id: newEntry.id, account_id: bankAccId, debit: 0, credit: run.total_net, memo: '[AUTO-FIX] Disbursement' })
          }

          // Insert Ledger Lines
          const { error: linesErr } = await (supabase as any).from('journal_lines').insert(journalLinesBody)

          if (linesErr) {
            await (supabase as any).from('journal_entries').delete().eq('id', newEntry.id)
            continue
          }

          // Post it!
          await (supabase as any).from('journal_entries').update({ status: 'POSTED' }).eq('id', newEntry.id)

          // 3. Update Run Link
          await (supabase as any).from('payroll_runs').update({ journal_entry_id: newEntry.id }).eq('id', run.id)
          fixedCount++
       }
    }
  }

  revalidatePath('/hris')
  return { success: true, count: fixedCount }
}

export async function getPayrollRunDetails(orgId: string, runId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: run, error: runError } = await db
    .from('payroll_runs')
    .select('id, branch_id')
    .eq('id', runId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (runError || !run) return []

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return []
  
  const { data: slips, error } = await db
    .from('payslips')
    .select(`
      *,
      branch:branches(id, name, code),
      employee:employee_id(nik, first_name, last_name, job_title, branch_id),
      lines:payslip_lines(*)
    `)
    .eq('run_id', runId)
    .eq('branch_id', accessibleRun.branchId)

  if (error) return []
  return slips
}

export async function deletePayrollRun(runId: string, orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: run, error: runError } = await db
    .from('payroll_runs')
    .select('id, branch_id')
    .eq('id', runId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (runError) return { error: runError.message }

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  const { error } = await db
    .from('payroll_runs')
    .delete()
    .eq('id', runId)
    .eq('org_id', orgId)
    .eq('branch_id', accessibleRun.branchId)
  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function voidPayrollRun(runId: string, orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: run, error: runError } = await db
    .from('payroll_runs')
    .select('id, branch_id')
    .eq('id', runId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (runError) return { error: runError.message }

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  const { error } = await db.rpc('void_payroll_run', { p_run_id: runId })
  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}
