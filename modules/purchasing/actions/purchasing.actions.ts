'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMembership } from '@/lib/auth/permissions'
import { withDbUserContext } from '@/modules/sales/lib/sales-write.server'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { getBranchAccessScope, resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

export type CreatePurchaseData = {
  vendor_id: string
  branch_id?: string | null
  purchase_date: string
  due_date?: string
  notes?: string
  shariah_mode?: string
  payment_term?: "TEMPO" | "LUNAS" | string
  payment_account_id?: string | null
  items?: any[]
  lines?: {
    product_id?: string | null
    product_name?: string | null
    category?: string
    unit?: string
    selling_price?: number
    description?: string
    quantity: number
    unit_price: number
    tax_amount?: number
    discount_amount?: number
  }[]
}

type InventorySyncParams = {
  orgId: string
  productId: string
  warehouseId: string
  diff: number
}

function isAdjustInventoryStockSchemaCacheMiss(error: any) {
  if (!error) return false
  const message = String(error.message || '')
  return error.code === 'PGRST202' || (message.includes('adjust_inventory_stock') && message.includes('schema cache'))
}

async function fallbackInventoryStockSync({ orgId, productId, warehouseId, diff }: InventorySyncParams) {
  const stockRows = await prisma.inventory_stocks.findMany({
    where: {
      org_id: orgId,
      product_id: productId,
      warehouse_id: warehouseId,
      batch_number: null,
    },
    orderBy: { created_at: 'asc' }
  })

  const existingStock = stockRows.find(row => row.bin_id == null) || stockRows[0]

  try {
    if (existingStock?.id) {
      await prisma.inventory_stocks.update({
        where: { id: existingStock.id },
        data: { quantity: Number(existingStock.quantity || 0) + diff }
      })
    } else {
      await prisma.inventory_stocks.create({
        data: {
          org_id: orgId,
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: diff,
          batch_number: null,
        }
      })
    }
    return { success: true as const }
  } catch (error: any) {
    return { error: 'Gagal sinkron stok fisik gudang: ' + error.message }
  }
}

async function syncInventoryStock(userId: string, params: InventorySyncParams) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx.$executeRaw`SELECT adjust_inventory_stock(${params.orgId}::uuid, ${params.productId}::uuid, ${params.warehouseId}::uuid, ${params.diff}::numeric, null, null)`
    })
    return { success: true as const }
  } catch (error: any) {
    if (!isAdjustInventoryStockSchemaCacheMiss(error)) {
      return { error: 'Gagal sinkron stok fisik gudang: ' + error.message }
    }
    return fallbackInventoryStockSync(params)
  }
}

async function resolvePurchasingBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }
  return { branchId: branchSelection.branchId }
}

export async function getPurchases(orgId: string, branchId?: string | null) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return []

  const membership = await getMembership(user.id, orgId)
  if (!membership) return []

  const hasPurchasingAccess = membership.role.toLowerCase() === 'owner' || membership.role.toLowerCase() === 'admin' || (membership.permissions && membership.permissions.includes('purchasing'))
  if (!hasPurchasingAccess) {
      return []
  }

  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const whereInfo: any = { org_id: orgId }
  if (branchSelection.branchId) {
    whereInfo.branch_id = branchSelection.branchId
  }

  try {
    const data = await prisma.purchases.findMany({
      where: whereInfo,
      include: {
        branches: { select: { name: true, code: true } },
        contacts: { select: { name: true } },
        purchase_items: {
          select: {
            id: true, product_id: true, description: true, quantity: true, unit_price: true, total_amount: true,
            products: { select: { name: true, sku: true, unit: true } }
          }
        },
        purchase_payments: { select: { amount: true, discount_amount: true } },
        purchase_returns: { select: { total_amount: true } }
      },
      orderBy: [
        { purchase_date: 'desc' },
        { created_at: 'desc' }
      ]
    })
    return data
  } catch (error) {
    console.error("DEBUG: getPurchases error:", error)
    try {
        const fallbackData = await prisma.purchases.findMany({
          where: whereInfo,
          include: {
            contacts: { select: { name: true } },
            purchase_items: {
              select: {
                id: true, product_id: true, description: true, quantity: true, unit_price: true, total_amount: true,
                products: { select: { name: true, sku: true, unit: true } }
              }
            }
          },
          orderBy: [
            { purchase_date: 'desc' },
            { created_at: 'desc' }
          ]
        })
        return fallbackData
    } catch(err) {
        return []
    }
  }
}

export async function createPurchaseEntry(orgId: string, payload: CreatePurchaseData) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat pembelian.' }
  }
  const purchaseBranchId = branchSelection.branchId

  let headerSubtotal = 0
  let headerTax = 0
  let headerDiscount = 0
  let headerGrand = 0
  let headerShipping = 0

  const processedLines: any[] = []

  const processableLines = payload.lines || payload.items || []

  for (const line of processableLines) {
    let finalProductId = line.product_id
    const qty = Number(line.quantity) || 1
    const price = Number(line.unit_price) || 0
    const tax = Number(line.tax_amount) || 0
    const disc = Number(line.discount_amount) || 0
    
    const trueHpp = price / qty
    const lineTotal = (qty * trueHpp) - disc + tax

    headerSubtotal += (qty * trueHpp)
    headerTax += tax
    headerDiscount += disc
    headerGrand += lineTotal

    if (!finalProductId && line.product_name) {
      const newProd = await prisma.products.create({
        data: {
          org_id: orgId,
          name: line.product_name,
          type: 'INVENTORY',
          category: line.category || 'Bahan',
          unit: line.unit || 'Pcs',
          purchase_price: trueHpp,
          selling_price: line.selling_price || trueHpp * 1.25
        }
      })
      if (newProd) finalProductId = newProd.id
    } else if (finalProductId) {
       await prisma.products.updateMany({
         where: { id: finalProductId, org_id: orgId },
         data: {
            purchase_price: trueHpp,
            selling_price: line.selling_price || trueHpp * 1.25,
            ...(line.category ? { category: line.category } : {}),
            ...(line.unit ? { unit: line.unit } : {})
         }
       })
    }

    if (!finalProductId) {
      return { error: 'Sistem gagal membuat/menemukan product ID untuk line item: ' + line.description }
    }

    processedLines.push({
      product_id: finalProductId,
      description: line.description || line.product_name,
      quantity: qty,
      unit_price: trueHpp,
      tax_amount: tax,
      discount_amount: disc,
      total_amount: lineTotal
    })
  }

  const dueDateTerm = payload.due_date ? new Date(payload.due_date) : null
  const termString = dueDateTerm ? 'TEMPO' : 'CASH'
  const notesWithTerm = `[${termString}] ${payload.notes || ''}`.trim()

  try {
    const rpcRes: any = await withDbUserContext(user.id, async (tx) => {
        const result = await tx.$queryRaw`
            SELECT process_purchase_atomic(
                ${orgId}::uuid,
                ${payload.vendor_id}::uuid,
                ${new Date(payload.purchase_date)}::date,
                ${dueDateTerm}::date,
                ${headerSubtotal}::numeric,
                ${headerTax}::numeric,
                ${headerShipping}::numeric,
                ${headerGrand}::numeric,
                ${notesWithTerm},
                ${payload.shariah_mode || 'CASH'}::public.shariah_mode,
                ${JSON.stringify(processedLines)}::jsonb,
                ${user.id}::uuid,
                ${purchaseBranchId}::uuid
            ) as result
        `
        return (result as any[])[0]?.result
    })

    if (!rpcRes?.success) {
      return { error: rpcRes?.message || 'Gagal menyimpan transaksi.' }
    }

    revalidatePath('/purchasing')
    return { success: true, purchase_id: rpcRes.purchase_id }
  } catch (error: any) {
    console.error('Purchase creation error:', error)
    return { error: 'Gagal membuat tagihan: ' + error.message }
  }
}

export async function receivePurchase(orgId: string, purchaseId: string) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const purchase = await prisma.purchases.findFirst({
    where: { id: purchaseId, org_id: orgId },
    include: { purchase_items: true }
  })

  if (!purchase) return { error: 'Transaksi tidak ditemukan' }
  if (purchase.status === 'RECEIVED' || purchase.status === 'VOIDED') {
    return { error: 'Status transaksi tidak valid untuk penerimaan. (Mungkin sudah selesai atau dibatalkan)' }
  }

  if (purchase.shariah_mode && (['QARDH', 'MURABAHAH', 'MUSYARAKAH'].includes(purchase.shariah_mode))) {
    if (purchase.payment_status === 'UNPAID') {
      return { error: 'Skema pembiayaan (Qardh/Murabahah/Musyarakah) mewajibkan pembayaran via kas sebelum PO bisa dikirim sebagai hak milik dan diterima gudang. Selesaikan pembayaran terlebih dahulu (Cash & Carry / COD Scheme).' }
    }
  }

  let effectiveWarehouseId = purchase.warehouse_id

  if (!effectiveWarehouseId) {
    const fallbackWarehouse = await prisma.warehouses.findFirst({
      where: { org_id: orgId, is_active: true, ...(purchase.branch_id ? { branch_id: purchase.branch_id } : {}) },
      select: { id: true, branch_id: true },
      orderBy: { name: 'asc' }
    })
    if (!fallbackWarehouse) return { error: 'Gudang operasional tidak ditemukan pada cabang terkait' }
    effectiveWarehouseId = fallbackWarehouse.id
  }

  const stockMovements: any[] = []
  
  for (const item of purchase.purchase_items) {
    if (!item.product_id) continue
    
    // Distribute shipping cost
    const shippingAlloc = Number(purchase.shipping_amount ?? 0) * (Number(item.total_amount ?? 0) / Number(purchase.total_amount || 1))
    const landedTotal = Number(item.total_amount ?? 0) + shippingAlloc
    const landedUnitPrice = landedTotal / Number(item.quantity)

    stockMovements.push({
      org_id: orgId,
      product_id: item.product_id,
      warehouse_id: effectiveWarehouseId,
      quantity: item.quantity,
      unit_price: landedUnitPrice,
      reference_id: purchaseId,
      reference_type: 'PURCHASE_RECEIPT',
      created_by: user.id,
      branch_id: purchase.branch_id
    })
    
    try {
        await withDbUserContext(user.id, async (tx) => {
            await tx.$executeRaw`SELECT update_product_average_cost(${item.product_id}::uuid, ${landedUnitPrice}::numeric)`
        })
    } catch(err) {
        console.error("DEBUG: update_product_average_cost error:", err)
    }
  }

  try {
    await prisma.stock_movements.createMany({
        data: stockMovements
    })

    for (const m of stockMovements) {
      const inventorySyncResult = await syncInventoryStock(user.id, {
        orgId: orgId,
        productId: m.product_id,
        warehouseId: m.warehouse_id,
        diff: m.quantity
      })
      if (inventorySyncResult.error) {
        throw new Error('Gagal sync stok fisik gudang: ' + inventorySyncResult.error)
      }
    }

    const accounts = await prisma.accounts.findMany({
      where: { org_id: orgId, code: { in: ['1301', '1401', '2101', '1403'] } },
      select: { id: true, code: true }
    })

    const apAcc = accounts.find((a: any) => a.code === '2101')
    const invAcc = accounts.find((a: any) => a.code === '1301')
    const ppnInvAcc = accounts.find((a: any) => a.code === '1401')

    if (apAcc && invAcc) {
      const headerGrand = Number(purchase.grand_total)
      const headerTax = Number(purchase.tax_amount)
      const isPaidCash = purchase.shariah_mode === 'CASH' && purchase.payment_status === 'PAID'
      
      const glRef = purchase.purchase_number + '-RCV'
      const checkDouble = await prisma.journal_entries.findFirst({
        where: { org_id: orgId, reference_id: glRef }
      })
      
      if (!checkDouble && !isPaidCash) {
        await createJournalEntry({
          org_id: orgId,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Penerimaan Barang ${purchase.purchase_number}`,
          reference_id: glRef,
          reference_type: 'PURCHASE_RECEIPT',
          branch_id: purchase.branch_id ?? undefined,
          auto_post: true,
          lines: [
            {
              account_id: invAcc.id,
              debit: headerGrand - headerTax,
              credit: 0
            },
            ...(headerTax > 0 && ppnInvAcc ? [{
              account_id: ppnInvAcc.id,
              debit: headerTax,
              credit: 0
            }] : []),
            {
              account_id: apAcc.id,
              debit: 0,
              credit: headerGrand
            }
          ]
        })
      }
    }

    await prisma.purchases.update({
      where: { id: purchaseId },
      data: { status: 'RECEIVED' }
    })

    revalidatePath('/purchasing')
    return { success: true }
  } catch (error: any) {
    return { error: 'Gagal memproses penerimaan: ' + error.message }
  }
}

export async function voidPurchase(orgId: string, purchaseId: string) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  try {
    const rpcRes: any = await withDbUserContext(user.id, async (tx) => {
        const result = await tx.$queryRaw`
            SELECT void_purchase_atomic(
                ${orgId}::uuid,
                ${purchaseId}::uuid,
                ${user.id}::uuid,
                'Pembatalan Manual via Dashboard'
            ) as result
        `
        return (result as any[])[0]?.result
    })

    if (!rpcRes?.success) return { error: rpcRes?.message || 'Gagal' }
    revalidatePath('/purchasing')
    return { success: true }
  } catch (error: any) {
    return { error: 'Sistem error: ' + error.message }
  }
}

export async function createPurchasePayment(
  orgId: string,
  payload: {
    purchase_id: string;
    account_id: string;
    amount: number;
    discount: number;
    payment_date: string;
    notes: string;
  }
) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu' }
  }

  try {
    const rpcRes: any = await withDbUserContext(user.id, async (tx) => {
        const result = await tx.$queryRaw`
            SELECT process_purchase_payment_atomic(
                ${orgId}::uuid,
                ${payload.purchase_id}::uuid,
                ${payload.account_id}::uuid,
                ${payload.amount}::numeric,
                ${payload.discount}::numeric,
                ${new Date(payload.payment_date)}::date,
                ${payload.notes},
                ${user.id}::uuid
            ) as result
        `
        return (result as any[])[0]?.result
    })

    if (!rpcRes?.success) return { error: rpcRes?.message || 'Gagal menyimpan pembayaran.' }
    
    revalidatePath('/purchasing')
    return { success: true }
  } catch (error: any) {
    return { error: 'Sistem error: ' + error.message }
  }
}

export async function createPurchaseReturn(
  orgId: string,
  payload: {
    purchase_id: string;
    return_number: string;
    return_date: string;
    notes: string;
    items: {
      purchase_item_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
    }[];
  }
) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu' }
  }

  try {
    const rpcRes: any = await withDbUserContext(user.id, async (tx) => {
        const result = await tx.$queryRaw`
            SELECT process_purchase_return_atomic(
                ${orgId}::uuid,
                ${payload.purchase_id}::uuid,
                ${payload.return_number},
                ${new Date(payload.return_date)}::date,
                ${payload.notes},
                ${JSON.stringify(payload.items)}::jsonb,
                ${user.id}::uuid
            ) as result
        `
        return (result as any[])[0]?.result
    })

    if (!rpcRes?.success) return { error: rpcRes?.message || 'Gagal melakukan return.' }
    
    revalidatePath('/purchasing')
    return { success: true }
  } catch (error: any) {
    return { error: 'Sistem error: ' + error.message }
  }
}

export async function getPurchaseRequests(orgId: string, branchId?: string | null) {
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  const whereInfo: any = { org_id: orgId }
  if (branchSelection.branchId) {
    whereInfo.branch_id = branchSelection.branchId
  }

  try {
    const data = await prisma.purchase_requests.findMany({
      where: whereInfo,
      include: {
        branches: { select: { name: true, code: true } },
        products: { select: { name: true, sku: true, unit: true } }
      },
      orderBy: { created_at: 'desc' }
    })
    return data.map((d: any) => ({
      ...d,
      branch: d.branches,
      product: d.products
    }))
  } catch (error) {
    try {
      const fallback = await prisma.purchase_requests.findMany({
        where: whereInfo,
        include: {
          products: { select: { name: true, sku: true, unit: true } }
        },
        orderBy: { created_at: 'desc' }
      })
      return fallback.map((d: any) => ({ ...d, product: d.products }))
    } catch (e) {
      return []
    }
  }
}

export async function getPendingPurchaseRequestsCount(orgId: string, branchId?: string | null) {
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return 0
  
  const whereInfo: any = {
    org_id: orgId,
    status: 'PENDING'
  }
  if (branchSelection.branchId) {
    whereInfo.branch_id = branchSelection.branchId
  }

  const count = await prisma.purchase_requests.count({ where: whereInfo })
  return count || 0
}

export async function approvePurchaseRequest(orgId: string, requestId: string, actionId?: string) {
  try {
    await prisma.purchase_requests.update({
      where: { id: requestId },
      data: { status: 'APPROVED' as any }
    })
    revalidatePath('/purchasing/requests')
    return { success: true }
  } catch (error: any) {
    return { error: 'Gagal menyetujui request: ' + error.message }
  }
}

export async function rejectPurchaseRequest(orgId: string, requestId: string, actionId?: string) {
  try {
    await prisma.purchase_requests.update({
      where: { id: requestId },
      data: { status: 'REJECTED' as any }
    })
    revalidatePath('/purchasing/requests')
    return { success: true }
  } catch (error: any) {
    return { error: 'Gagal menolak request: ' + error.message }
  }
}

export async function updatePurchaseRequestStatus(orgId: string, requestId: string, status: string, notes?: string) {
  if (status === 'APPROVED') {
    return approvePurchaseRequest(orgId, requestId, notes)
  }
  return rejectPurchaseRequest(orgId, requestId, notes)
}
