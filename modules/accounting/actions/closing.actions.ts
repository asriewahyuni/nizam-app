'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ensureAccountingAccess, formatDateOnly, getCurrentUserId, parseDateOnly } from '@/modules/accounting/lib/reporting.server'

function normalizeFiscalPeriod(period: {
  id: string
  org_id: string
  name: string
  start_date: Date
  end_date: Date
  is_closed: boolean
  closed_at: Date | null
  closed_by: string | null
  created_at: Date
}) {
  return {
    id: period.id,
    org_id: period.org_id,
    name: period.name,
    start_date: formatDateOnly(period.start_date),
    end_date: formatDateOnly(period.end_date),
    is_closed: period.is_closed,
    closed_at: period.closed_at?.toISOString() || null,
    closed_by: period.closed_by,
    created_at: period.created_at.toISOString(),
  }
}

export async function getFiscalPeriods(orgId: string) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return []

  const periods = await prisma.fiscal_periods.findMany({
    where: { org_id: orgId },
    orderBy: { start_date: 'desc' },
  })

  return periods.map(normalizeFiscalPeriod)
}

export async function createFiscalPeriod(orgId: string, input: {
  name: string
  start_date: string
  end_date: string
}) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  try {
    await prisma.fiscal_periods.create({
      data: {
        org_id: orgId,
        name: input.name,
        start_date: parseDateOnly(input.start_date),
        end_date: parseDateOnly(input.end_date),
        is_closed: false,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'Nama periode ini sudah ada.' }
    }
    return { error: 'Gagal membuat periode fiskal.' }
  }

  revalidatePath('/accounting/closing')
  return { success: true }
}

export async function closeFiscalPeriod(id: string, orgId: string) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Tidak terautentikasi.' }

  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const result = await prisma.fiscal_periods.updateMany({
    where: {
      id,
      org_id: orgId,
    },
    data: {
      is_closed: true,
      closed_at: new Date(),
      closed_by: userId,
    },
  })

  if (result.count === 0) return { error: 'Gagal menutup periode.' }

  revalidatePath('/accounting/closing')
  return { success: true }
}

export async function openFiscalPeriod(id: string, orgId: string) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const result = await prisma.fiscal_periods.updateMany({
    where: {
      id,
      org_id: orgId,
    },
    data: {
      is_closed: false,
      closed_at: null,
      closed_by: null,
    },
  })

  if (result.count === 0) return { error: 'Gagal membuka kembali periode.' }

  revalidatePath('/accounting/closing')
  return { success: true }
}
