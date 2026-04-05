import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type SaleInsertInput = {
  orgId: string
  branchId: string
  warehouseId?: string | null
  customerId?: string | null
  saleDate: string
  dueDate?: string | null
  paymentTerm: string
  totalAmount: number
  taxAmount: number
  discountAmount: number
  grandTotal: number
  shariahMode: string
  notes?: string | null
  createdBy: string
  status: string
  paymentStatus: string
}

export function toNumber(value: unknown) {
  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

export function extractDatabaseError(error: unknown) {
  const metaMessage = typeof (error as any)?.meta?.message === 'string'
    ? String((error as any).meta.message)
    : null
  const metaCode = typeof (error as any)?.meta?.code === 'string'
    ? String((error as any).meta.code)
    : null
  const errorCode = typeof (error as any)?.code === 'string'
    ? String((error as any).code)
    : null

  return {
    message: metaMessage || (error instanceof Error ? error.message : 'Unknown error'),
    code: metaCode || errorCode,
  }
}

export async function withDbUserContext<T>(
  userId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
    return action(tx)
  })
}

export async function insertSaleHeader(tx: Prisma.TransactionClient, input: SaleInsertInput) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.sales (
      org_id,
      branch_id,
      warehouse_id,
      customer_id,
      sale_date,
      due_date,
      payment_term,
      total_amount,
      tax_amount,
      discount_amount,
      grand_total,
      shariah_mode,
      notes,
      created_by,
      status,
      payment_status
    )
    VALUES (
      CAST(${input.orgId} AS uuid),
      CAST(${input.branchId} AS uuid),
      CAST(${input.warehouseId ?? null} AS uuid),
      CAST(${input.customerId ?? null} AS uuid),
      CAST(${input.saleDate} AS date),
      CAST(${input.dueDate ?? null} AS date),
      ${input.paymentTerm},
      ${input.totalAmount},
      ${input.taxAmount},
      ${input.discountAmount},
      ${input.grandTotal},
      CAST(${input.shariahMode} AS public.shariah_mode),
      ${input.notes ?? null},
      CAST(${input.createdBy} AS uuid),
      CAST(${input.status} AS public.document_status),
      CAST(${input.paymentStatus} AS public.payment_status)
    )
    RETURNING id::text AS id
  `

  const saleId = rows[0]?.id
  if (!saleId) {
    throw new Error('Gagal menyimpan header penjualan.')
  }

  return saleId
}
