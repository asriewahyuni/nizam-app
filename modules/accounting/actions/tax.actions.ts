import { prisma } from '@/lib/prisma'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

function emptyTaxSummary(startDate: string, endDate: string) {
  return {
    vatIn: { total: 0, items: [] },
    vatOut: { total: 0, items: [] },
    pph21: { total: 0, items: [] },
    pph23: { total: 0, items: [] },
    netVat: 0,
    startDate,
    endDate,
  }
}

export async function getTaxSummary(orgId: string, startDate?: string, endDate?: string, branchId?: string | null) {
  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

  let effectiveBranchId: string | undefined
  if (branchId) {
    const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
    if ('error' in branchSelection || !branchSelection.branchId) {
      return emptyTaxSummary(sDate, eDate)
    }
    effectiveBranchId = branchSelection.branchId
  }

  const TAX_CODES = ['1401', '2201', '2202', '2203']
  const taxAccounts = await prisma.accounts.findMany({
    where: {
      org_id: orgId,
      code: { in: TAX_CODES },
    },
    select: {
      id: true,
      code: true,
    },
  })

  if (!taxAccounts.length) {
    return emptyTaxSummary(sDate, eDate)
  }

  const taxAccountIds = taxAccounts.map((account) => account.id)

  const entryWhere: any = {
    org_id: orgId,
    status: 'POSTED',
    entry_date: {
      gte: new Date(`${sDate}T00:00:00.000Z`),
      lte: new Date(`${eDate}T00:00:00.000Z`),
    },
  }

  if (effectiveBranchId) {
    entryWhere.branch_id = effectiveBranchId
  }

  const entries = await prisma.journal_entries.findMany({
    where: entryWhere,
    select: { id: true },
  })

  if (!entries.length) {
    return emptyTaxSummary(sDate, eDate)
  }

  const entryIds = entries.map((entry) => entry.id)

  const lines = await prisma.journal_lines.findMany({
    where: {
      entry_id: { in: entryIds },
      account_id: { in: taxAccountIds },
    },
    include: {
      accounts: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normal_balance: true,
        },
      },
      journal_entries: {
        select: {
          entry_number: true,
          entry_date: true,
          description: true,
        },
      },
    },
  })

  if (!lines.length) {
    return emptyTaxSummary(sDate, eDate)
  }

  const vatInItems: any[] = []
  const vatOutItems: any[] = []
  const pph21Items: any[] = []
  const pph23Items: any[] = []

  let totalVatIn = 0
  let totalVatOut = 0
  let totalPph21 = 0
  let totalPph23 = 0

  lines.forEach((line) => {
    const code = line.accounts.code
    const item = {
      date: line.journal_entries.entry_date.toISOString().slice(0, 10),
      ref: line.journal_entries.entry_number,
      description: line.journal_entries.description,
      memo: line.memo,
    }

    if (code === '1401') {
      const net = Number(line.debit) - Number(line.credit)
      if (net !== 0) {
        totalVatIn += net
        vatInItems.push({ ...item, amount: net })
      }
    } else if (code === '2201') {
      const net = Number(line.credit) - Number(line.debit)
      if (net !== 0) {
        totalVatOut += net
        vatOutItems.push({ ...item, amount: net })
      }
    } else if (code === '2202') {
      const net = Number(line.credit) - Number(line.debit)
      if (net !== 0) {
        totalPph21 += net
        pph21Items.push({ ...item, amount: net })
      }
    } else if (code === '2203') {
      const net = Number(line.credit) - Number(line.debit)
      if (net !== 0) {
        totalPph23 += net
        pph23Items.push({ ...item, amount: net })
      }
    }
  })

  return {
    vatIn: { total: totalVatIn, items: vatInItems },
    vatOut: { total: totalVatOut, items: vatOutItems },
    pph21: { total: totalPph21, items: pph21Items },
    pph23: { total: totalPph23, items: pph23Items },
    netVat: totalVatOut - totalVatIn,
    startDate: sDate,
    endDate: eDate,
  }
}
