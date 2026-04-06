'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

async function getAccessibleBankAccountBranch(orgId: string, bankAccountId: string) {
  const bankAccount = await prisma.bank_accounts.findFirst({
    where: {
      id: bankAccountId,
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

  if (!bankAccount.branch_id) {
    return { error: 'Rekening kas/bank belum memiliki konteks unit.' }
  }

  const branchSelection = await resolveAccessibleBranchSelection(orgId, bankAccount.branch_id)
  if ('error' in branchSelection) return { error: branchSelection.error }

  return { branchId: bankAccount.branch_id as string }
}

function parseCsvLine(line: string) {
  const columns: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      columns.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  columns.push(current.trim())
  return columns
}

function parseSupportedCsvDate(rawDate: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate)
  if (isoMatch) {
    const normalized = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    const parsed = new Date(`${normalized}T00:00:00Z`)
    if (!isNaN(parsed.getTime()) && parsed.toISOString().startsWith(normalized)) {
      return normalized
    }
  }

  const localMatch = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(rawDate)
  if (localMatch) {
    const normalized = `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`
    const parsed = new Date(`${normalized}T00:00:00Z`)
    if (!isNaN(parsed.getTime()) && parsed.toISOString().startsWith(normalized)) {
      return normalized
    }
  }

  return null
}

function parseNumericCsvValue(rawValue: string) {
  const normalized = rawValue.replace(/\s+/g, '').replace(/,/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function isHeaderRow(columns: string[]) {
  const firstColumn = (columns[0] || '').trim().toLowerCase()
  return firstColumn === 'date' || firstColumn === 'tanggal'
}

function normalizeMutation(row: any) {
  return {
    ...row,
    mutation_date: row.mutation_date instanceof Date ? row.mutation_date.toISOString().slice(0, 10) : row.mutation_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    amount: Number(row.amount || 0),
    balance: row.balance == null ? null : Number(row.balance),
  }
}

/**
 * processBankCSV
 * Takes raw CSV string and parses it into bank_mutations.
 * Expected columns: [date, description, amount, type, balance]
 */
export async function processBankCSV(orgId: string, bankAccountId: string, csvContent: string) {
  const bankAccountBranch = await getAccessibleBankAccountBranch(orgId, bankAccountId)
  if ('error' in bankAccountBranch) return { error: bankAccountBranch.error }

  const normalizedContent = csvContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalizedContent) {
    return { error: 'File CSV kosong.' }
  }

  const lines = normalizedContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { error: 'File CSV kosong.' }
  }

  const firstRow = parseCsvLine(lines[0])
  const startIndex = isHeaderRow(firstRow) ? 1 : 0
  const mutations = []

  for (let index = startIndex; index < lines.length; index += 1) {
    const columns = parseCsvLine(lines[index])
    if (columns.length < 4) {
      return { error: `Baris ${index + 1} tidak memiliki kolom yang cukup.` }
    }

    const mutationDate = parseSupportedCsvDate(columns[0])
    if (!mutationDate) {
      return { error: `Format tanggal pada baris ${index + 1} tidak didukung. Gunakan YYYY-MM-DD atau DD/MM/YYYY.` }
    }

    const description = (columns[1] || '').trim()
    if (!description) {
      return { error: `Deskripsi pada baris ${index + 1} wajib diisi.` }
    }

    const parsedAmount = parseNumericCsvValue(columns[2] || '')
    if (parsedAmount === null || parsedAmount === 0) {
      return { error: `Nominal pada baris ${index + 1} tidak valid.` }
    }

    const rawType = (columns[3] || '').trim().toUpperCase()
    const type = rawType === 'IN' || rawType === 'OUT'
      ? rawType
      : parsedAmount > 0
        ? 'IN'
        : 'OUT'

    const parsedBalance = columns[4] ? parseNumericCsvValue(columns[4]) : null
    if (columns[4] && parsedBalance === null) {
      return { error: `Saldo pada baris ${index + 1} tidak valid.` }
    }

    mutations.push({
      org_id: orgId,
      branch_id: bankAccountBranch.branchId,
      bank_account_id: bankAccountId,
      mutation_date: new Date(`${mutationDate}T00:00:00.000Z`),
      description,
      amount: Math.abs(parsedAmount),
      type,
      balance: parsedBalance,
      is_matched: false,
    })
  }

  if (mutations.length === 0) {
    return { error: 'CSV tidak berisi mutasi yang bisa diproses.' }
  }

  try {
    await prisma.bank_mutations.createMany({
      data: mutations as any,
    })
  } catch (error: any) {
    return { error: 'Gagal mengunggah mutasi: ' + (error?.message || 'Unknown error') }
  }

  revalidatePath('/cash')
  return { success: true, count: mutations.length }
}

/**
 * getUnmatchedMutations
 */
export async function getUnmatchedMutations(orgId: string, bankAccountId?: string, branchId?: string | null) {
  let effectiveBranchId: string | undefined

  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) return []
    effectiveBranchId = branchSelection.branchId
  }

  try {
    const data = await prisma.bank_mutations.findMany({
      where: {
        org_id: orgId,
        is_matched: false,
        ...(bankAccountId ? { bank_account_id: bankAccountId } : {}),
        ...(effectiveBranchId ? { branch_id: effectiveBranchId } : {}),
      },
      orderBy: {
        mutation_date: 'desc',
      },
    })

    return data.map(normalizeMutation)
  } catch {
    return []
  }
}
