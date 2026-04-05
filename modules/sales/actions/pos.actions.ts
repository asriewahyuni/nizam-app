'use server'

import { getAuthUser } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'
import {
  extractDatabaseError,
  insertSaleHeader,
  toNumber,
  withDbUserContext,
} from '@/modules/sales/lib/sales-write.server'

type PosWarehouseResult =
  | { warehouseId: string }
  | { error: string }

type SalesRpcResult = {
  success?: boolean
  error?: string
  payment_id?: string
}

async function resolvePosWarehouseId(
  orgId: string,
  branchId: string,
  explicitWarehouseId?: string | null
): Promise<PosWarehouseResult> {
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
      return { error: 'Gudang POS tidak tersedia pada unit aktif.' }
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
    return { error: 'Belum ada gudang aktif di unit ini. Tambahkan gudang terlebih dahulu sebelum memakai POS.' }
  }

  if (warehouses.length > 1) {
    return { error: 'Pilih gudang POS terlebih dahulu karena unit ini memiliki lebih dari satu gudang aktif.' }
  }

  return { warehouseId: warehouses[0].id }
}

export async function processPosTransaction(
  orgId: string,
  payload: any
): Promise<
  | { success: true; saleId: string; error?: undefined }
  | { success?: false; error: string; saleId?: undefined }
> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const activeBranch = await getActiveBranch(orgId)
  if (!activeBranch?.id) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.' }
  }

  const lines: any[] = Array.isArray(payload?.lines) ? payload.lines : []
  const rawProductIds: string[] = []

  for (const line of lines) {
    const productId = String(line?.product_id || '').trim()
    if (productId) {
      rawProductIds.push(productId)
    }
  }

  const productIds: string[] = [...new Set(rawProductIds)]
  const totalAmount = lines.reduce(
    (acc: number, line: any) => acc + (toNumber(line?.quantity) * toNumber(line?.unit_price)),
    0
  )
  const taxAmount = toNumber(payload?.tax_amount)
  const discountAmount = toNumber(payload?.discount_amount)
  const grandTotal = totalAmount + taxAmount - discountAmount

  let requiresWarehouse = false

  if (productIds.length > 0) {
    const productRows = await prisma.products.findMany({
      where: {
        org_id: orgId,
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        type: true,
      },
    })

    requiresWarehouse = productRows.some((product) => String(product.type || 'INVENTORY') === 'INVENTORY')
  }

  let resolvedWarehouseId: string | null = null

  if (requiresWarehouse) {
    const resolvedWarehouse = await resolvePosWarehouseId(
      orgId,
      activeBranch.id,
      payload?.warehouse_id || null
    )

    if ('error' in resolvedWarehouse) {
      return { error: resolvedWarehouse.error }
    }

    resolvedWarehouseId = resolvedWarehouse.warehouseId
  }

  const transactionDate = new Date().toISOString().split('T')[0]
  let saleId: string

  try {
    saleId = await withDbUserContext(user.userId, async (tx) => {
      let finalCustomerId = String(payload?.customer_id || '').trim() || null

      if (!finalCustomerId && payload?.new_customer_name) {
        const newCustomer = await tx.contacts.create({
          data: {
            org_id: orgId,
            name: String(payload.new_customer_name).trim(),
            phone: String(payload?.new_customer_phone || '-').trim() || '-',
            type: 'CUSTOMER',
            is_active: true,
          },
          select: {
            id: true,
          },
        })
        finalCustomerId = newCustomer.id
      }

      if (!finalCustomerId) {
        const walkIn = await tx.contacts.findFirst({
          where: {
            org_id: orgId,
            name: 'Pelanggan Umum (Walk-In)',
          },
          select: {
            id: true,
          },
        })

        if (walkIn?.id) {
          finalCustomerId = walkIn.id
        } else {
          const newWalkIn = await tx.contacts.create({
            data: {
              org_id: orgId,
              name: 'Pelanggan Umum (Walk-In)',
              phone: '-',
              type: 'CUSTOMER',
              is_active: true,
            },
            select: {
              id: true,
            },
          })
          finalCustomerId = newWalkIn.id
        }
      }

      const createdSaleId = await insertSaleHeader(tx, {
        orgId,
        branchId: activeBranch.id,
        warehouseId: resolvedWarehouseId,
        customerId: finalCustomerId,
        saleDate: transactionDate,
        dueDate: transactionDate,
        paymentTerm: 'CASH',
        totalAmount,
        taxAmount,
        discountAmount,
        grandTotal,
        shariahMode: 'CASH',
        notes: payload?.notes || 'POS Transaction',
        createdBy: user.userId,
        status: 'DRAFT',
        paymentStatus: 'PAID',
      })

      if (lines.length > 0) {
        await tx.sales_items.createMany({
          data: lines.map((line: any) => ({
            org_id: orgId,
            branch_id: activeBranch.id,
            sale_id: createdSaleId,
            product_id: line?.product_id || null,
            description: line?.product_name || '',
            quantity: toNumber(line?.quantity),
            unit_price: toNumber(line?.unit_price),
            discount_amount: 0,
            tax_amount: 0,
          })),
        })
      }

      return createdSaleId
    })
  } catch (error) {
    return { error: extractDatabaseError(error).message }
  }

  let deliveryFailed = false

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
    deliveryFailed = true
    ;(console as any).error('Delivery error:', error)
  }

  if (!deliveryFailed && payload?.account_id) {
    try {
      const rows = await withDbUserContext(user.userId, async (tx) =>
        tx.$queryRaw<Array<{ result: SalesRpcResult }>>`
          SELECT public.process_sales_payment_atomic(
            CAST(${orgId} AS uuid),
            CAST(${saleId} AS uuid),
            CAST(${payload.account_id} AS uuid),
            ${grandTotal},
            0,
            CAST(${transactionDate} AS timestamptz),
            ${'POS Payment'},
            CAST(${user.userId} AS uuid)
          ) AS result
        `
      )

      const paymentResult = rows[0]?.result
      if (paymentResult?.success === false) {
        ;(console as any).error('POS payment error:', paymentResult.error)
      }
    } catch (error) {
      ;(console as any).error('POS payment error:', error)
    }
  }

  revalidatePath('/pos')
  revalidatePath('/sales')
  revalidatePath('/inventory')
  return { success: true, saleId, error: undefined }
}
