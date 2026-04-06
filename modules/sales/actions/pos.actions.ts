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

type PosStockRequirement = {
  productId: string
  productName: string
  requiredQty: number
}

const STOCK_EPSILON = 0.000001

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  if (Math.abs(rounded) < STOCK_EPSILON) return '0'
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(6).replace(/\.?0+$/, '')
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

async function ensurePosStockAvailability(
  orgId: string,
  warehouseId: string,
  requirements: PosStockRequirement[]
) {
  if (!requirements.length) return { success: true as const }

  const productIds = requirements.map((item) => item.productId)
  let stockRows: Array<{ product_id: string; quantity: unknown }> = []
  try {
    stockRows = await prisma.inventory_stocks.findMany({
      where: {
        org_id: orgId,
        warehouse_id: warehouseId,
        product_id: { in: productIds },
      },
      select: {
        product_id: true,
        quantity: true,
      },
    })
  } catch (error: any) {
    return { error: 'Gagal memvalidasi stok POS: ' + (error?.message || 'Unknown error') }
  }

  const availableByProduct: Record<string, number> = {}
  for (const row of (stockRows as any[]) || []) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue
    availableByProduct[productId] = (availableByProduct[productId] || 0) + Number((row as any).quantity || 0)
  }

  const shortages = requirements
    .map((item) => {
      const availableQty = Number(availableByProduct[item.productId] || 0)
      return {
        ...item,
        availableQty,
        shortage: item.requiredQty - availableQty,
      }
    })
    .filter((item) => item.shortage > STOCK_EPSILON)

  if (!shortages.length) return { success: true as const }

  const first = shortages[0]
  return {
    error: `Stok POS tidak cukup untuk produk "${first.productName}". Dibutuhkan ${formatQuantity(
      first.requiredQty
    )}, tersedia ${formatQuantity(Math.max(
      0,
      first.availableQty
    ))}. Penjualan tidak boleh melebihi stok (kecuali akad SALAM).`,
  }
}

export async function processPosTransaction(orgId: string, payload: any) {
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
  let inventoryRequirements: PosStockRequirement[] = []

  if (productIds.length > 0) {
    let productRows: Array<{ id: string; type: string | null; name: string | null }> = []
    try {
      productRows = await prisma.products.findMany({
        where: {
          org_id: orgId,
          id: { in: productIds },
        },
        select: {
          id: true,
          type: true,
          name: true,
        },
      })
    } catch (error: any) {
      return { error: 'Gagal memvalidasi produk POS: ' + (error?.message || 'Unknown error') }
    }

    const productById = new Map<string, { type: string; name: string }>()
    for (const product of (productRows as any[]) || []) {
      productById.set(String(product?.id || ''), {
        type: String(product?.type || 'INVENTORY').toUpperCase(),
        name: String(product?.name || product?.id || 'Produk'),
      })
    }

    const requirementMap = new Map<string, PosStockRequirement>()
    for (const line of (payload.lines || []) as any[]) {
      const productId = String(line?.product_id || '')
      if (!productId) continue
      const product = productById.get(productId)
      if (!product || product.type !== 'INVENTORY') continue

      const qty = Number(line?.quantity || 0)
      if (!Number.isFinite(qty) || qty <= 0) continue

      const current = requirementMap.get(productId)
      if (current) {
        current.requiredQty += qty
      } else {
        requirementMap.set(productId, {
          productId,
          productName: product.name,
          requiredQty: qty,
        })
      }
    }

    inventoryRequirements = Array.from(requirementMap.values())
    requiresWarehouse = inventoryRequirements.length > 0
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

    const stockCheck = await ensurePosStockAvailability(
      orgId,
      resolvedWarehouseId as string,
      inventoryRequirements
    )
    if ('error' in stockCheck) {
      return { error: stockCheck.error }
    }
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
