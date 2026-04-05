'use server'

import { Prisma } from '@prisma/client'
import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import {
  extractDatabaseError,
  insertSaleHeader,
  toNumber,
  withDbUserContext,
} from '@/modules/sales/lib/sales-write.server'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

type DeliveryWarehouseResult =
  | { warehouseId: string }
  | { error: string }

type SalesRpcResult = {
  success?: boolean
  error?: string
  return_id?: string
  payment_id?: string
}

const saleSnapshotSelect = {
  id: true,
  org_id: true,
  sale_number: true,
  sale_date: true,
  customer_id: true,
  total_amount: true,
  tax_amount: true,
  discount_amount: true,
  grand_total: true,
  status: true,
  payment_status: true,
  due_date: true,
  notes: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  shariah_mode: true,
  payment_term: true,
  branch_id: true,
  warehouse_id: true,
  branches: {
    select: {
      name: true,
      code: true,
    },
  },
  contacts: {
    select: {
      name: true,
      phone: true,
      email: true,
    },
  },
  sales_items: {
    select: {
      id: true,
      org_id: true,
      sale_id: true,
      product_id: true,
      description: true,
      quantity: true,
      unit_price: true,
      discount_amount: true,
      tax_amount: true,
      total_amount: true,
      created_at: true,
      updated_at: true,
      branch_id: true,
      products: {
        select: {
          name: true,
          sku: true,
          unit: true,
          type: true,
        },
      },
    },
  },
  sales_returns: {
    select: {
      status: true,
      grand_total: true,
      return_number: true,
    },
  },
  sales_payments: {
    select: {
      amount: true,
      discount_amount: true,
    },
  },
} as const satisfies Prisma.salesSelect

type SaleSnapshotRecord = Prisma.salesGetPayload<{ select: typeof saleSnapshotSelect }>

function normalizeDateOnly(value: Date | null | undefined) {
  if (!value) return null

  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function formatRpcError(error: unknown) {
  const detail = extractDatabaseError(error)
  return detail.code
    ? `[RPC ERROR]: ${detail.message} (Code: ${detail.code})`
    : `[RPC ERROR]: ${detail.message}`
}

function buildSaleTotals(lines: any[], taxAmountValue?: unknown, discountAmountValue?: unknown) {
  const totalAmount = (lines || []).reduce(
    (acc: number, line: any) => acc + (toNumber(line?.quantity) * toNumber(line?.unit_price)),
    0
  )
  const taxAmount = toNumber(taxAmountValue)
  const discountAmount = toNumber(discountAmountValue)

  return {
    totalAmount,
    taxAmount,
    discountAmount,
    grandTotal: totalAmount - discountAmount + taxAmount,
  }
}

async function requireUser(errorMessage: string) {
  const user = await getAuthUser()
  if (!user) {
    return { error: errorMessage } as const
  }

  return user
}

function normalizeSale(record: SaleSnapshotRecord) {
  return {
    id: record.id,
    org_id: record.org_id,
    sale_number: record.sale_number,
    sale_date: normalizeDateOnly(record.sale_date),
    customer_id: record.customer_id,
    total_amount: toNumber(record.total_amount),
    tax_amount: toNumber(record.tax_amount),
    discount_amount: toNumber(record.discount_amount),
    grand_total: toNumber(record.grand_total),
    status: record.status,
    payment_status: record.payment_status,
    due_date: normalizeDateOnly(record.due_date),
    notes: record.notes,
    created_by: record.created_by,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    shariah_mode: record.shariah_mode,
    payment_term: record.payment_term,
    branch_id: record.branch_id,
    warehouse_id: record.warehouse_id,
    branches: record.branches
      ? {
          name: record.branches.name,
          code: record.branches.code,
        }
      : null,
    contacts: record.contacts
      ? {
          name: record.contacts.name,
          phone: record.contacts.phone,
          email: record.contacts.email,
        }
      : null,
    sales_items: record.sales_items.map((item) => ({
      id: item.id,
      org_id: item.org_id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      discount_amount: toNumber(item.discount_amount),
      tax_amount: toNumber(item.tax_amount),
      total_amount: toNumber(item.total_amount),
      created_at: normalizeDateTime(item.created_at),
      updated_at: normalizeDateTime(item.updated_at),
      branch_id: item.branch_id,
      products: item.products
        ? {
            name: item.products.name,
            sku: item.products.sku,
            unit: item.products.unit,
            type: item.products.type,
          }
        : null,
    })),
    sales_returns: record.sales_returns.map((saleReturn) => ({
      status: saleReturn.status,
      grand_total: toNumber(saleReturn.grand_total),
      return_number: saleReturn.return_number,
    })),
    sales_payments: record.sales_payments.map((payment) => ({
      amount: toNumber(payment.amount),
      discount_amount: toNumber(payment.discount_amount),
    })),
  }
}

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

async function resolveDeliveryWarehouseId(
  orgId: string,
  branchId: string,
  explicitWarehouseId?: string | null
): Promise<DeliveryWarehouseResult> {
  if (explicitWarehouseId) {
    const warehouse = await prisma.warehouses.findFirst({
      where: {
        id: explicitWarehouseId,
        org_id: orgId,
        is_active: true,
        branch_id: branchId,
      },
      select: {
        id: true,
      },
    })

    if (!warehouse) {
      return { error: 'Gudang pengiriman tidak tersedia pada unit aktif.' }
    }

    return { warehouseId: warehouse.id }
  }

  const warehouses = await prisma.warehouses.findMany({
    where: {
      org_id: orgId,
      is_active: true,
      branch_id: branchId,
    },
    select: {
      id: true,
    },
    orderBy: {
      name: 'asc',
    },
    take: 2,
  })

  if (warehouses.length === 0) {
    return { error: 'Belum ada gudang aktif di unit ini. Tambahkan gudang terlebih dahulu.' }
  }

  if (warehouses.length > 1) {
    return { error: 'Pilih gudang pengiriman terlebih dahulu karena unit ini memiliki lebih dari satu gudang aktif.' }
  }

  return { warehouseId: warehouses[0].id }
}

export async function getSales(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const data = await prisma.sales.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    select: saleSnapshotSelect,
    orderBy: {
      created_at: 'desc',
    },
  })

  return data.map(normalizeSale)
}

export async function createSaleEntry(
  orgId: string,
  payload: any
): Promise<
  | { success: true; saleId: string; error?: undefined }
  | { success?: false; error: string; saleId?: undefined }
> {
  const user = await requireUser('Not authenticated')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const lines = Array.isArray(payload?.lines) ? payload.lines : []
  const totals = buildSaleTotals(lines, payload?.tax_amount, payload?.discount_amount)
  const reason = `Sales Order Baru (${payload?.shariah_mode || 'CASH'}) - Customer: ${payload?.customer_name || ''} - ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.grandTotal)}`

  try {
    const saleId = await withDbUserContext(user.userId, async (tx) => {
      const createdSaleId = await insertSaleHeader(tx, {
        orgId,
        branchId: activeBranchResult.branchId,
        customerId: payload?.customer_id || null,
        saleDate: payload?.sale_date,
        dueDate: payload?.due_date || null,
        paymentTerm: payload?.payment_term || 'TEMPO',
        totalAmount: totals.totalAmount,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        grandTotal: totals.grandTotal,
        shariahMode: payload?.shariah_mode || 'CASH',
        notes: payload?.notes || null,
        createdBy: user.userId,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
      })

      if (lines.length > 0) {
        await tx.sales_items.createMany({
          data: lines.map((line: any) => ({
            org_id: orgId,
            branch_id: activeBranchResult.branchId,
            sale_id: createdSaleId,
            product_id: line?.product_id || null,
            description: line?.product_name || '',
            quantity: toNumber(line?.quantity),
            unit_price: toNumber(line?.unit_price),
            discount_amount: toNumber(line?.discount_amount),
            tax_amount: toNumber(line?.tax_amount),
          })),
        })
      }

      await tx.approval_requests.create({
        data: {
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
          requester_id: user.userId,
          source_type: 'SALES_ORDER',
          source_id: createdSaleId,
          status: 'PENDING',
          reason,
        },
      })

      return createdSaleId
    })

    revalidatePath('/sales')
    return { success: true, saleId, error: undefined }
  } catch (error) {
    return { error: extractDatabaseError(error).message }
  }
}

export async function deliverSale(orgId: string, saleId: string, warehouseId?: string | null) {
  const user = await requireUser('Tidak terautentikasi.')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengirim sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const sale = await prisma.sales.findFirst({
    where: {
      id: saleId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    select: {
      status: true,
      warehouse_id: true,
    },
  })

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'FINISHED') return { success: true, error: undefined }

  let resolvedWarehouseId: string | null = null
  if (warehouseId || sale.warehouse_id) {
    const resolvedWarehouse = await resolveDeliveryWarehouseId(
      orgId,
      activeBranchResult.branchId,
      warehouseId || sale.warehouse_id || null
    )

    if ('error' in resolvedWarehouse) {
      return { error: resolvedWarehouse.error }
    }

    resolvedWarehouseId = resolvedWarehouse.warehouseId
  }

  try {
    await withDbUserContext(user.userId, async (tx) => {
      await tx.$executeRaw`
        SELECT public.process_sales_delivery_atomic(
          CAST(${orgId} AS uuid),
          CAST(${saleId} AS uuid),
          CAST(${resolvedWarehouseId} AS uuid)
        )
      `
    })
  } catch (error) {
    ;(console as any).error('Failed to deliver sale via atomic engine:', error)
    return { error: formatRpcError(error) }
  }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  return { success: true, error: undefined }
}

export async function voidSale(orgId: string, saleId: string) {
  const user = await requireUser('Tidak terautentikasi.')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membatalkan sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const sale = await prisma.sales.findFirst({
    where: {
      id: saleId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    select: {
      status: true,
    },
  })

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'VOIDED') return { success: true, error: undefined }

  try {
    await withDbUserContext(user.userId, async (tx) => {
      const journalEntry = await tx.journal_entries.findFirst({
        where: {
          reference_id: saleId,
          org_id: orgId,
          status: 'POSTED',
        },
        select: {
          id: true,
        },
      })

      if (journalEntry?.id) {
        await tx.journal_entries.update({
          where: { id: journalEntry.id },
          data: {
            status: 'VOIDED',
            void_reason: 'Pembatalan Sales Order',
            voided_by: user.userId,
            voided_at: new Date(),
          },
        })
      }

      await tx.stock_movements.deleteMany({
        where: {
          reference_id: saleId,
          reference_type: 'SALE',
        },
      })

      await tx.sales.updateMany({
        where: {
          id: saleId,
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
        },
        data: {
          status: 'VOIDED',
          updated_at: new Date(),
        },
      })

      await tx.approval_requests.updateMany({
        where: {
          source_type: 'SALES_ORDER',
          source_id: saleId,
          branch_id: activeBranchResult.branchId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          reason: 'Sales Order Dibatalkan',
          decided_at: new Date(),
        },
      })
    })
  } catch (error) {
    return { error: extractDatabaseError(error).message }
  }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting/journal')
  return { success: true, error: undefined }
}

export async function paySale(orgId: string, saleId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menerima pembayaran.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  await prisma.sales.updateMany({
    where: {
      id: saleId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    data: {
      payment_status: 'PAID',
      updated_at: new Date(),
    },
  })

  revalidatePath('/sales')
  return { success: true, error: undefined }
}

export async function processSalesReturn(orgId: string, payload: {
  sale_id: string
  return_number: string
  nota_retur: string
  items: Array<{ product_id: string; quantity: number; unit_price: number; sale_item_id: string }>
  refund_account_id?: string
}) {
  const user = await requireUser('Tidak terautentikasi.')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses retur penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const sale = await prisma.sales.findFirst({
    where: {
      id: payload.sale_id,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    select: {
      id: true,
    },
  })

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  try {
    const rows = await withDbUserContext(user.userId, async (tx) =>
      tx.$queryRaw<Array<{ result: SalesRpcResult }>>`
        SELECT public.process_sales_return_atomic(
          CAST(${orgId} AS uuid),
          CAST(${payload.sale_id} AS uuid),
          ${payload.return_number},
          ${payload.nota_retur},
          CAST(${JSON.stringify(payload.items || [])} AS jsonb),
          CAST(${user.userId} AS uuid),
          CAST(${payload.refund_account_id || null} AS uuid)
        ) AS result
      `
    )

    const result = rows[0]?.result
    if (!result?.success) {
      return { error: 'Gagal memproses retur: ' + (result?.error || 'Unknown error') }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')
    revalidatePath('/accounting/ledgers')
    revalidatePath('/accounting/reports')
    return { success: true, returnId: result.return_id, error: undefined }
  } catch (error) {
    return { error: 'Gagal memproses retur: ' + extractDatabaseError(error).message }
  }
}

export async function processSalesPayment(orgId: string, payload: {
  sale_id: string
  account_id: string
  amount: number
  payment_date: string
  notes?: string
  discount_amount?: number
}) {
  const user = await requireUser('Tidak terautentikasi.')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses pembayaran penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const sale = await prisma.sales.findFirst({
    where: {
      id: payload.sale_id,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    select: {
      id: true,
    },
  })

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  try {
    const rows = await withDbUserContext(user.userId, async (tx) =>
      tx.$queryRaw<Array<{ result: SalesRpcResult }>>`
        SELECT public.process_sales_payment_atomic(
          CAST(${orgId} AS uuid),
          CAST(${payload.sale_id} AS uuid),
          CAST(${payload.account_id} AS uuid),
          ${toNumber(payload.amount)},
          ${toNumber(payload.discount_amount)},
          CAST(${payload.payment_date} AS timestamptz),
          ${payload.notes || ''},
          CAST(${user.userId} AS uuid)
        ) AS result
      `
    )

    const result = rows[0]?.result
    if (!result?.success) {
      return { error: 'Gagal memproses pembayaran: ' + (result?.error || 'Unknown error') }
    }

    revalidatePath('/sales')
    revalidatePath('/accounting/ledgers')
    revalidatePath('/accounting/reports')
    return { success: true, paymentId: result.payment_id, error: undefined }
  } catch (error) {
    return { error: 'Gagal memproses pembayaran: ' + extractDatabaseError(error).message }
  }
}

export async function getQuotations(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const data = await prisma.sales.findMany({
    where: {
      org_id: orgId,
      status: 'QUOTATION',
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    select: saleSnapshotSelect,
    orderBy: {
      created_at: 'desc',
    },
  })

  return data.map(normalizeSale)
}

export async function createQuotation(orgId: string, payload: any) {
  const user = await requireUser('Not authenticated')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const lines = Array.isArray(payload?.lines) ? payload.lines : []
  const totals = buildSaleTotals(lines, payload?.tax_amount, payload?.discount_amount)

  try {
    const quotationId = await withDbUserContext(user.userId, async (tx) => {
      const createdSaleId = await insertSaleHeader(tx, {
        orgId,
        branchId: activeBranchResult.branchId,
        customerId: payload?.customer_id || null,
        saleDate: payload?.sale_date,
        dueDate: payload?.due_date || null,
        paymentTerm: payload?.payment_term || 'TEMPO',
        totalAmount: totals.totalAmount,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        grandTotal: totals.grandTotal,
        shariahMode: payload?.shariah_mode || 'CASH',
        notes: payload?.notes || null,
        createdBy: user.userId,
        status: 'QUOTATION',
        paymentStatus: 'UNPAID',
      })

      if (lines.length > 0) {
        await tx.sales_items.createMany({
          data: lines.map((line: any) => ({
            org_id: orgId,
            branch_id: activeBranchResult.branchId,
            sale_id: createdSaleId,
            product_id: line?.product_id || null,
            description: line?.product_name || '',
            quantity: toNumber(line?.quantity),
            unit_price: toNumber(line?.unit_price),
            discount_amount: toNumber(line?.discount_amount),
            tax_amount: toNumber(line?.tax_amount),
          })),
        })
      }

      return createdSaleId
    })

    revalidatePath('/sales/quotations')
    return { success: true, quotationId, error: undefined }
  } catch (error) {
    return { error: extractDatabaseError(error).message }
  }
}

export async function convertQuotationToOrder(orgId: string, quoteId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengonversi quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  await prisma.sales.updateMany({
    where: {
      id: quoteId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    data: {
      status: 'DRAFT',
      updated_at: new Date(),
    },
  })

  revalidatePath('/sales/quotations')
  revalidatePath('/sales')
  return { success: true, error: undefined }
}

export async function updateSaleStatus(orgId: string, saleId: string, status: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah status pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  await prisma.sales.updateMany({
    where: {
      id: saleId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    data: {
      status: status as any,
      updated_at: new Date(),
    },
  })

  revalidatePath('/sales/pipeline')
  revalidatePath('/sales')
  return { success: true, error: undefined }
}

export async function createQuickKanbanCard(
  orgId: string,
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const user = await requireUser('Not authenticated')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  try {
    const saleId = await withDbUserContext(user.userId, async (tx) => {
      const contact = await tx.contacts.create({
        data: {
          org_id: orgId,
          name: payload.name || 'Anonymous Lead',
          type: 'CUSTOMER',
          phone: payload.phone || null,
          email: payload.email || null,
        },
        select: {
          id: true,
        },
      })

      return insertSaleHeader(tx, {
        orgId,
        branchId: activeBranchResult.branchId,
        customerId: contact.id,
        saleDate: new Date().toISOString().split('T')[0],
        dueDate: null,
        paymentTerm: 'TEMPO',
        totalAmount: toNumber(payload.amount),
        taxAmount: 0,
        discountAmount: 0,
        grandTotal: toNumber(payload.amount),
        shariahMode: 'CASH',
        notes: payload.notes || 'via Kanban Add Card',
        createdBy: user.userId,
        status: payload.status,
        paymentStatus: 'UNPAID',
      })
    })

    revalidatePath('/sales/pipeline')
    return { success: true, saleId, error: undefined }
  } catch (error) {
    return { error: 'Gagal membuat card: ' + extractDatabaseError(error).message }
  }
}

export async function updateSalesCard(
  orgId: string,
  saleId: string,
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const user = await requireUser('Not authenticated')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const sale = await prisma.sales.findFirst({
    where: {
      id: saleId,
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
    },
    select: {
      customer_id: true,
    },
  })

  if (!sale?.customer_id) return { error: 'Card tidak ditemukan' }

  const customerId = sale.customer_id

  try {
    await withDbUserContext(user.userId, async (tx) => {
      await tx.contacts.updateMany({
        where: {
          id: customerId,
          org_id: orgId,
        },
        data: {
          name: payload.name,
          phone: payload.phone || null,
          email: payload.email || null,
          updated_at: new Date(),
        },
      })

      await tx.sales.updateMany({
        where: {
          id: saleId,
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
        },
        data: {
          total_amount: toNumber(payload.amount),
          grand_total: toNumber(payload.amount),
          notes: payload.notes,
          status: payload.status as any,
          updated_at: new Date(),
        },
      })
    })
  } catch (error) {
    return { error: 'Gagal mengedit card: ' + extractDatabaseError(error).message }
  }

  revalidatePath('/sales/pipeline')
  return { success: true, error: undefined }
}

export async function deleteSalesCard(orgId: string, saleId: string) {
  const user = await requireUser('Not authenticated')
  if ('error' in user) return user

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  try {
    await withDbUserContext(user.userId, async (tx) => {
      await tx.sales.deleteMany({
        where: {
          id: saleId,
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
        },
      })
    })
  } catch (error) {
    return { error: 'Gagal menghapus card: ' + extractDatabaseError(error).message }
  }

  revalidatePath('/sales/pipeline')
  return { success: true, error: undefined }
}
