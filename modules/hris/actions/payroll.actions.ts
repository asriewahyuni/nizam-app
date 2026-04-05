'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

type ActionResult =
  | { success: true; error?: undefined }
  | { success?: undefined; error: string }

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
  const components = await prisma.payroll_components.findMany({
    where: { org_id: orgId },
    include: {
      accounts: { select: { name: true, code: true } },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return components.map((component) => ({
    ...component,
    account: component.accounts,
    accounts: undefined,
  }))
}

export async function createPayrollComponent(orgId: string, formData: FormData): Promise<ActionResult> {
  const isPercentage = formData.get('is_percentage') === 'on'
  const isTaxable = formData.get('is_taxable') === 'on'

  try {
    await prisma.payroll_components.create({
      data: {
        org_id: orgId,
        name: formData.get('name') as string,
        type: (formData.get('type') as any) || 'EARNING',
        is_taxable: isTaxable,
        is_percentage: isPercentage,
        default_amount: isPercentage ? 0 : Number(formData.get('amount') || 0),
        percentage_value: isPercentage ? Number(formData.get('amount') || 0) : null,
        account_id: (formData.get('account_id') as string) || null,
      },
    })
  } catch (error) {
    console.error('createPayrollComponent Error:', error)
    return { error: 'Gagal menambahkan komponen payroll.' }
  }

  revalidatePath('/hris')
  return { success: true }
}

export async function deletePayrollComponent(componentId: string): Promise<ActionResult> {
  try {
    await prisma.payroll_components.deleteMany({ where: { id: componentId } })
  } catch (error) {
    console.error('deletePayrollComponent Error:', error)
    return { error: 'Gagal menghapus komponen payroll.' }
  }

  revalidatePath('/hris')
  return { success: true }
}
export async function getPayrollRuns(orgId: string, branchId?: string | null) {
  const branchSelection = await resolvePayrollBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const runs = await prisma.payroll_runs.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: { branches: { select: { id: true, name: true, code: true } } },
    orderBy: { period_start: 'desc' },
  })

  return runs.map((run) => ({
    ...run,
    branch: run.branches,
    branches: undefined,
  }))
}

export async function generatePayrollRun(orgId: string, formData: FormData) {
  const activeBranch = await requirePayrollRunBranch(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat payroll run.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }
  
  const periodStart = formData.get('period_start') as string
  const periodEnd = formData.get('period_end') as string
  const paymentDate = formData.get('payment_date') as string

  // 1. Create the Run Header
  const run = await prisma.payroll_runs.create({
    data: {
      org_id: orgId,
      branch_id: activeBranch.branchId,
      period_start: new Date(`${periodStart}T00:00:00.000Z`),
      period_end: new Date(`${periodEnd}T00:00:00.000Z`),
      payment_date: new Date(`${paymentDate}T00:00:00.000Z`),
      status: 'DRAFT',
    },
    select: { id: true },
  })

  try {
    await prisma.$executeRaw`SELECT public.generate_payslips_for_run(${run.id}::uuid)`
  } catch (error) {
    console.error('generatePayrollRun Error:', error)
    return { error: 'Gagal memproses payslip.' }
  }

  revalidatePath('/hris')
  return { success: true }
}


export async function payPayrollRun(runId: string, orgId: string, accountId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const run = await prisma.payroll_runs.findFirst({
    where: { id: runId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  // 1. Update the run with selected bank account before processing
  await prisma.payroll_runs.updateMany({
    where: { id: runId, org_id: orgId, branch_id: accessibleRun.branchId },
    data: { disbursement_account_id: accountId, updated_at: new Date() },
  })

  try {
    await prisma.$executeRaw`SELECT public.process_payroll_payment(${runId}::uuid, ${accountId}::uuid, ${userId}::uuid)`
  } catch (error) {
    console.error('payPayrollRun Error:', error)
    return { error: 'Gagal memproses pembayaran.' }
  }

  revalidatePath('/hris')
  return { success: true }
}


export async function fixEmptyPayrollJournals(orgId: string) {
  const activeBranch = await requirePayrollRunBranch(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menjalankan perbaikan jurnal payroll.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const runs = await prisma.payroll_runs.findMany({
    where: {
      org_id: orgId,
      branch_id: activeBranch.branchId,
      status: 'PAID',
    },
  })

  let fixedCount = 0
  // 1. SMART ACCOUNT LOOKUP (CDO Logic: No Hardcode)
  let accExpense = await prisma.accounts.findFirst({
    where: { org_id: orgId, code: '6001' },
    select: { id: true },
  })
  if (!accExpense) {
    accExpense = await prisma.accounts.findFirst({
      where: { org_id: orgId, name: { contains: 'Beban Gaji', mode: 'insensitive' } },
      select: { id: true },
    })
  }

  const firstBank = await prisma.bank_accounts.findFirst({
    where: { org_id: orgId, branch_id: activeBranch.branchId },
    select: { account_id: true },
    orderBy: { created_at: 'asc' },
  })

  if (!accExpense?.id || !firstBank?.account_id) {
    return { error: 'Konfigurasi Akun Gaji (6001) atau Bank Account tidak ditemukan. Selesaikan CoA Anda!' }
  }

  for (const run of runs) {
    const journalEntryId = run.journal_entry_id
    if (!journalEntryId) continue
    
    // Check if lines are truly missing or just have basic 2 lines while should have more
    const journalLineCount = await prisma.journal_lines.count({
      where: { entry_id: journalEntryId },
    })

    const slips = await prisma.payslips.findMany({
      where: { run_id: run.id },
      select: { id: true },
    })
    const slipIds = slips.map((s) => s.id)
    const detailCount = slipIds.length
      ? await prisma.payslip_lines.count({ where: { payslip_id: { in: slipIds } } })
      : 0
    
    // CONDITION: Either missing (count=0) OR only has 2 lines while we have many detail lines
    if (journalLineCount === 0 || (journalLineCount === 2 && detailCount > 0)) {
       // Proceed to fix (VOID old, create new)
      try {
        await prisma.$transaction(async (tx) => {
          await tx.journal_entries.updateMany({
            where: { id: journalEntryId },
            data: {
              status: 'VOIDED',
              void_reason: 'Deep-reconciliation to include detailed PPh/Components',
              updated_at: new Date(),
            },
          })

          const newEntry = await tx.journal_entries.create({
            data: {
              org_id: orgId,
              branch_id: run.branch_id,
              entry_number: '',
              entry_date: run.payment_date,
              description: `[RE-SYNC] Pembayaran Gaji Periode ${run.period_start.toISOString().split('T')[0]} s/d ${run.period_end.toISOString().split('T')[0]}`,
              reference_id: run.id,
              reference_type: 'PAYROLL',
              status: 'DRAFT',
              is_auto: true,
              created_by: userId,
            },
            select: { id: true },
          })

          const journalLinesBody: Array<{ entry_id: string; account_id: string; debit: any; credit: any; memo: string }> = []

          if (slipIds.length) {
            const allLines = await tx.payslip_lines.findMany({
              where: { payslip_id: { in: slipIds } },
              select: { account_id: true, type: true, amount: true },
            })

            if (allLines.length) {
              const accountTotals = new Map<string, { debit: number; credit: number }>()
              for (const line of allLines) {
                const accId = line.account_id || accExpense.id
                const current = accountTotals.get(accId) || { debit: 0, credit: 0 }
                const amount = Number(line.amount || 0)
                if (line.type === 'EARNING' || line.type === 'BENEFIT') current.debit += amount
                else if (line.type === 'DEDUCTION' || line.type === 'TAX') current.credit += amount
                accountTotals.set(accId, current)
              }

              accountTotals.forEach((val, accId) => {
                if (val.debit > 0) journalLinesBody.push({ entry_id: newEntry.id, account_id: accId, debit: val.debit, credit: 0, memo: '[AUTO-FIX] Beban Komponen' })
                if (val.credit > 0) journalLinesBody.push({ entry_id: newEntry.id, account_id: accId, debit: 0, credit: val.credit, memo: '[AUTO-FIX] Potongan/Pajak' })
              })

              const bankAccId = run.disbursement_account_id || firstBank.account_id
              journalLinesBody.push({ entry_id: newEntry.id, account_id: bankAccId, debit: 0, credit: run.total_net, memo: '[AUTO-FIX] Disbursement' })
            }
          }

          if (journalLinesBody.length === 0) {
            const bankAccId = run.disbursement_account_id || firstBank.account_id
            journalLinesBody.push({ entry_id: newEntry.id, account_id: accExpense.id, debit: run.total_net, credit: 0, memo: '[AUTO-FIX] Beban Gaji (Glongongan)' })
            journalLinesBody.push({ entry_id: newEntry.id, account_id: bankAccId, debit: 0, credit: run.total_net, memo: '[AUTO-FIX] Disbursement' })
          }

          await tx.journal_lines.createMany({ data: journalLinesBody })

          await tx.journal_entries.updateMany({
            where: { id: newEntry.id },
            data: { status: 'POSTED', updated_at: new Date() },
          })

          await tx.payroll_runs.updateMany({
            where: { id: run.id },
            data: { journal_entry_id: newEntry.id, updated_at: new Date() },
          })
        })
        fixedCount++
      } catch (error) {
        console.error('fixEmptyPayrollJournals Error:', error)
      }
    }
  }

  revalidatePath('/hris')
  return { success: true, count: fixedCount }
}

export async function getPayrollRunDetails(orgId: string, runId: string) {
  const run = await prisma.payroll_runs.findFirst({
    where: { id: runId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  if (!run) return []

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return []

  const slips = await prisma.payslips.findMany({
    where: { run_id: runId, branch_id: accessibleRun.branchId },
    include: {
      branches: { select: { id: true, name: true, code: true } },
      employees: { select: { nik: true, first_name: true, last_name: true, job_title: true, branch_id: true } },
      payslip_lines: true,
    },
  })

  return slips.map((slip) => ({
    ...slip,
    branch: slip.branches,
    employee: slip.employees,
    lines: slip.payslip_lines,
    branches: undefined,
    employees: undefined,
    payslip_lines: undefined,
  }))
}

export async function deletePayrollRun(runId: string, orgId: string) {
  const run = await prisma.payroll_runs.findFirst({
    where: { id: runId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  await prisma.payroll_runs.deleteMany({
    where: { id: runId, org_id: orgId, branch_id: accessibleRun.branchId },
  })

  revalidatePath('/hris')
  return { success: true }
}

export async function voidPayrollRun(runId: string, orgId: string) {
  const run = await prisma.payroll_runs.findFirst({
    where: { id: runId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleRun = await ensurePayrollBranchAccess(
    orgId,
    run?.branch_id ?? null,
    'Payroll run tidak ditemukan.'
  )
  if ('error' in accessibleRun) return { error: accessibleRun.error }

  try {
    await prisma.$executeRaw`SELECT public.void_payroll_run(${runId}::uuid)`
  } catch (error) {
    console.error('voidPayrollRun Error:', error)
    return { error: 'Gagal membatalkan payroll run.' }
  }

  revalidatePath('/hris')
  return { success: true }
}
