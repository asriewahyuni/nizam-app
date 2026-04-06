'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMembership } from '@/lib/auth/permissions'
import { withDbUserContext } from '@/modules/sales/lib/sales-write.server'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

export interface PurchaseLineData {
  product_id?: string
  product_name: string
  quantity: number
  unit?: string
  unit_price: number
  discount_amount?: number
  tax_amount?: number
  selling_price?: number
  category?: string
  description?: string
}

export interface CreatePurchaseData {
  vendor_id: string
  branch_id?: string | null
  purchase_date: string
  due_date?: string
  notes?: string
  discount_amount?: number
  tax_amount?: number
  shipping_amount?: number
  insurance_amount?: number
  payment_term?: 'LUNAS' | 'TEMPO'
  payment_account_id?: string | null
  shariah_mode?: 'CASH' | 'SALAM' | 'ISTISHNA'
  mode?: 'DRAFT' | 'PUBLISH'
  draft_id?: string
  lines: PurchaseLineData[]
}

type InventorySyncParams = {
  orgId: string
  productId: string
  warehouseId: string
  diff: number
}

function normalizePurchaseShariahMode(value?: string | null): 'CASH' | 'SALAM' | 'ISTISHNA' {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'SALAM' || normalized === 'ISTISHNA') return normalized
  return 'CASH'
}

function generatePurchaseNumber() {
  return `PO-${Date.now()}`
}

async function resolvePurchasingBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error || 'Akses unit tidak valid.' }
  return { branchId: branchSelection.branchId }
}

async function ensurePurchaseDocumentAccess(orgId: string, branchId: string | null) {
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  if (branchId && branchSelection.branchId !== branchId) return { error: 'Dokumen pembelian tidak tersedia pada unit aktif.' }
  return { branchId: branchSelection.branchId }
}

async function syncInventoryStock(userId: string, params: InventorySyncParams) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx.$executeRaw`SELECT adjust_inventory_stock(${params.orgId}::uuid, ${params.productId}::uuid, ${params.warehouseId}::uuid, ${params.diff}::numeric, null, null)`
    })
    return { success: true as const }
  } catch {
    const existing = await prisma.inventory_stocks.findFirst({
      where: {
        org_id: params.orgId,
        product_id: params.productId,
        warehouse_id: params.warehouseId,
        batch_number: null,
      },
      orderBy: { created_at: 'asc' },
      select: { id: true, quantity: true },
    })

    if (existing?.id) {
      await prisma.inventory_stocks.update({
        where: { id: existing.id },
        data: { quantity: Number(existing.quantity || 0) + params.diff },
      })
    } else {
      await prisma.inventory_stocks.create({
        data: {
          org_id: params.orgId,
          product_id: params.productId,
          warehouse_id: params.warehouseId,
          quantity: params.diff,
          batch_number: null,
        },
      })
    }

    return { success: true as const }
  }
}

async function markPurchaseAsReceived(orgId: string, purchaseId: string, warehouseId: string) {
  await prisma.$executeRaw`
    UPDATE public.purchases
    SET status = 'RECEIVED',
        warehouse_id = ${warehouseId}::uuid,
        updated_at = NOW()
    WHERE id = ${purchaseId}::uuid
      AND org_id = ${orgId}::uuid
  `
  return { success: true as const }
}

export async function getPurchases(orgId: string, branchId?: string | null) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return []

  const membership = await getMembership(user.id, orgId)
  if (!membership) return []

  const hasPurchasingAccess =
    membership.role.toLowerCase() === 'owner' ||
    membership.role.toLowerCase() === 'admin' ||
    membership.permissions?.includes('purchasing')
  if (!hasPurchasingAccess) return []

  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  return prisma.purchases.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      branches: { select: { name: true, code: true } },
      contacts: { select: { name: true } },
      purchase_items: {
        include: {
          products: { select: { name: true, sku: true, unit: true, category: true, selling_price: true, asset_account_id: true } },
        },
      },
      purchase_payments: { select: { amount: true, discount_amount: true } },
      purchase_returns: { select: { total_amount: true } },
    },
    orderBy: [{ purchase_date: 'desc' }, { created_at: 'desc' }],
  })
}

export async function createPurchaseEntry(orgId: string, payload: CreatePurchaseData) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Not authenticated' }

  const createMode = String(payload.mode || 'PUBLISH').toUpperCase() === 'DRAFT' ? 'DRAFT' : 'PUBLISH'
  const normalizedLines = (payload.lines || []).filter((line) => String(line?.product_name || '').trim().length > 0)
  if (!payload.vendor_id || normalizedLines.length === 0) return { error: 'Vendor dan baris produk wajib diisi.' }

  const explicitBranchSelection = await resolvePurchasingBranchId(orgId, payload.branch_id)
  if ('error' in explicitBranchSelection) return { error: 'Unit aktif tidak valid untuk organisasi ini.' }

  const branchSelection = await resolvePurchasingBranchId(orgId, payload.branch_id)
  if ('error' in branchSelection || !branchSelection.branchId) return { error: 'Pilih unit aktif terlebih dahulu untuk membuat pembelian.' }

  const purchaseBranchId = branchSelection.branchId
  const shariahMode = normalizePurchaseShariahMode(payload.shariah_mode)
  const resolvedPaymentTerm: 'LUNAS' | 'TEMPO' = shariahMode === 'SALAM' ? 'LUNAS' : payload.payment_term === 'TEMPO' ? 'TEMPO' : 'LUNAS'
  const resolvedDueDate = resolvedPaymentTerm === 'TEMPO' || shariahMode === 'SALAM' ? (payload.due_date || null) : null

  const processedLines: Array<{
    product_id: string | null
    description: string
    quantity: number
    unit_price: number
    tax_amount: number
    discount_amount: number
    total_amount: number
  }> = []

  for (const line of normalizedLines) {
    let finalProductId = line.product_id || null
    const qty = Number(line.quantity) || 1
    const price = Number(line.unit_price) || 0
    const tax = Number(line.tax_amount) || 0
    const disc = Number(line.discount_amount) || 0
    const unitPrice = qty > 0 ? price / qty : price
    const totalAmount = qty * unitPrice - disc + tax

    if (!finalProductId && line.product_name) {
      const product = await prisma.products.create({
        data: {
          org_id: orgId,
          name: line.product_name,
          type: 'INVENTORY',
          category: line.category || 'Bahan',
          unit: line.unit || 'Pcs',
          purchase_price: unitPrice,
          selling_price: line.selling_price || unitPrice * 1.25,
        },
        select: { id: true },
      })
      finalProductId = product.id
    } else if (finalProductId) {
      await prisma.products.updateMany({
        where: { id: finalProductId, org_id: orgId },
        data: {
          purchase_price: unitPrice,
          selling_price: line.selling_price || unitPrice * 1.25,
          ...(line.category ? { category: line.category } : {}),
          ...(line.unit ? { unit: line.unit } : {}),
        },
      })
    }

    processedLines.push({
      product_id: finalProductId,
      description: line.description || line.product_name,
      quantity: qty,
      unit_price: unitPrice,
      tax_amount: tax,
      discount_amount: disc,
      total_amount: totalAmount,
    })
  }

  const headerSubtotal = processedLines.reduce((acc, line) => acc + line.quantity * line.unit_price, 0)
  const headerDiscount = Number(payload.discount_amount || processedLines.reduce((acc, line) => acc + line.discount_amount, 0))
  const headerTax = Number(payload.tax_amount || processedLines.reduce((acc, line) => acc + line.tax_amount, 0))
  const headerShipping = Number(payload.shipping_amount || 0)
  const headerInsurance = Number(payload.insurance_amount || 0)
  const headerGrand = headerSubtotal - headerDiscount + headerTax + headerShipping + headerInsurance
  const notesWithTerm = `[TERMIN: ${resolvedPaymentTerm}] ${payload.payment_account_id ? `[ACC: ${payload.payment_account_id}] ` : ''}${payload.notes || ''}`

  if (payload.draft_id) {
    const existingPurchase = await prisma.purchases.findFirst({
      where: { id: payload.draft_id, org_id: orgId },
      select: { id: true, status: true, branch_id: true },
    })
    if (!existingPurchase) return { error: 'Draft PO tidak ditemukan.' }
    if (existingPurchase.status !== 'DRAFT') return { error: 'Hanya dokumen PO berstatus DRAFT yang bisa diedit atau diterbitkan ulang.' }

    const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, existingPurchase.branch_id)
    if ('error' in purchaseAccess) return { error: purchaseAccess.error }

    await prisma.purchases.update({
      where: { id: payload.draft_id },
      data: {
        vendor_id: payload.vendor_id,
        branch_id: purchaseBranchId,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: headerShipping,
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        status: createMode === 'DRAFT' ? 'DRAFT' : 'ORDERED',
        updated_at: new Date(),
      },
    })
    await prisma.purchase_items.deleteMany({ where: { org_id: orgId, purchase_id: payload.draft_id } })
    await prisma.purchase_items.createMany({
      data: processedLines.map((line) => ({
        org_id: orgId,
        purchase_id: payload.draft_id as string,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: line.discount_amount,
        tax_amount: line.tax_amount,
        total_amount: line.total_amount,
      })),
    })

      await prisma.$executeRaw`
        UPDATE public.approval_requests
        SET status = 'VOIDED',
            reason = ${createMode === 'PUBLISH' ? 'Approval PO lama diganti oleh versi draft terbaru' : 'Draft PO diperbarui sebelum diterbitkan'},
            decided_at = NOW()
        WHERE org_id = ${orgId}::uuid
          AND source_type = 'PURCHASE_ORDER'
          AND source_id = ${payload.draft_id}::uuid
          AND status = 'PENDING'
      `

    if (createMode === 'PUBLISH') {
      await prisma.approval_requests.create({
        data: {
          org_id: orgId,
          branch_id: purchaseBranchId,
          requester_id: user.id,
          source_type: 'PURCHASE_ORDER',
          source_id: payload.draft_id,
          status: 'PENDING',
          reason: `Purchase Order Baru (${shariahMode})`,
        },
      })
    }

    revalidatePath('/purchasing')
    return { success: true, purchaseId: payload.draft_id }
  }

  if (createMode === 'DRAFT') {
    const draftPurchase = await prisma.purchases.create({
      data: {
        purchase_number: generatePurchaseNumber(),
        org_id: orgId,
        branch_id: purchaseBranchId,
        vendor_id: payload.vendor_id,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: headerShipping,
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        status: 'DRAFT',
        created_by: user.id,
      },
      select: { id: true },
    })
    await prisma.purchase_items.createMany({
      data: processedLines.map((line) => ({
        org_id: orgId,
        purchase_id: draftPurchase.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: line.discount_amount,
        tax_amount: line.tax_amount,
        total_amount: line.total_amount,
      })),
    })
    revalidatePath('/purchasing')
    return { success: true, purchaseId: draftPurchase.id }
  }

  const rpcRows = await withDbUserContext(user.id, async (tx) =>
    tx.$queryRaw<Array<{ result: { success?: boolean; message?: string; purchase_id?: string } }>>`
      SELECT public.process_purchase_atomic(
        ${orgId}::uuid,
        ${payload.vendor_id}::uuid,
        ${payload.purchase_date || new Date().toISOString()}::timestamptz,
        ${resolvedDueDate}::date,
        ${headerSubtotal},
        ${headerTax},
        ${headerShipping},
        ${headerGrand},
        ${notesWithTerm},
        ${shariahMode},
        ${JSON.stringify(processedLines)}::jsonb,
        ${user.id}::uuid,
        ${purchaseBranchId}::uuid
      ) AS result
    `
  )
  const rpcRes = rpcRows[0]?.result
  if (!rpcRes?.success) return { error: rpcRes?.message || 'Gagal menyimpan transaksi.' }

  revalidatePath('/purchasing')
  return { success: true, purchase_id: rpcRes.purchase_id }
}

export async function receivePurchase(orgId: string, purchaseId: string) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const purchase = await prisma.purchases.findFirst({
    where: { id: purchaseId, org_id: orgId },
    include: {
      purchase_items: {
        include: { products: { select: { asset_account_id: true } } },
      },
    },
  })
  if (!purchase) return { error: 'PO tidak ditemukan.' }

  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }
  if (purchase.status === 'RECEIVED') return { success: true }
  if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM' && purchase.payment_status !== 'PAID') {
    return { error: 'Akad SALAM pembelian wajib lunas terlebih dahulu sebelum penerimaan barang.' }
  }

  let effectiveWarehouseId = purchase.warehouse_id
  if (!effectiveWarehouseId) {
    const fallbackWarehouse = await prisma.warehouses.findFirst({
      where: { org_id: orgId, is_active: true, ...(purchase.branch_id ? { branch_id: purchase.branch_id } : {}) },
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    if (!fallbackWarehouse) return { error: 'Gudang operasional tidak ditemukan pada cabang terkait' }
    effectiveWarehouseId = fallbackWarehouse.id
  }

  const existingMovementCount = await prisma.stock_movements.count({
    where: { org_id: orgId, reference_type: 'PURCHASE', reference_id: purchase.id },
  })
  if (existingMovementCount > 0) {
    await markPurchaseAsReceived(orgId, purchaseId, effectiveWarehouseId)
    revalidatePath('/purchasing')
    revalidatePath('/inventory')
    return { success: true }
  }

  const shipping = Number(purchase.shipping_amount || 0)
  const insurance = 0
  const totalLandedOverhead = shipping + insurance
  const totalItemsValue = Number(purchase.total_amount || 1)

  const stockMovements: Array<{
    org_id: string
    product_id: string
    warehouse_id: string
    quantity: number
    unit_price: number
    reference_id: string
    reference_type: string
    created_by: string
    branch_id: string | null
  }> = []
  const inventoryDebitAllocations: Array<{ assetAccountId: string | null; amount: number }> = []

  for (const item of purchase.purchase_items) {
    if (!item.product_id) continue
    const itemSubtotal = Number(item.quantity) * Number(item.unit_price) - Number(item.discount_amount || 0)
    const allocatedOverhead = (itemSubtotal / totalItemsValue) * totalLandedOverhead
    const landedTotal = itemSubtotal + allocatedOverhead
    const landedUnitPrice = landedTotal / Number(item.quantity)

    await prisma.products.updateMany({
      where: { id: item.product_id, org_id: orgId },
      data: { purchase_price: landedUnitPrice },
    })

    stockMovements.push({
      org_id: orgId,
      product_id: item.product_id,
      warehouse_id: effectiveWarehouseId,
      quantity: Number(item.quantity),
      unit_price: landedUnitPrice,
      reference_id: purchaseId,
      reference_type: 'PURCHASE_RECEIPT',
      created_by: user.id,
      branch_id: purchase.branch_id,
    })

    inventoryDebitAllocations.push({
      assetAccountId: item.products?.asset_account_id || null,
      amount: landedTotal,
    })
  }

  if (stockMovements.length > 0) {
    await prisma.stock_movements.createMany({ data: stockMovements })
    for (const movement of stockMovements) {
      const inventorySyncResult = await syncInventoryStock(user.id, {
        orgId,
        productId: movement.product_id,
        warehouseId: movement.warehouse_id,
        diff: movement.quantity,
      })
      if ('error' in inventorySyncResult) return inventorySyncResult
    }
  }

  const accounts = await prisma.accounts.findMany({
    where: { org_id: orgId, code: { in: ['1205', '1301', '1401', '1403', '1404', '2101'] } },
    select: { id: true, code: true },
  })
  const accPersediaan = accounts.find((account) => account.code === '1301')?.id || null
  const accPpnMasukan = accounts.find((account) => account.code === '1401')?.id || null
  const accUangMuka = accounts.find((account) => account.code === '1403')?.id || null
  const accIstishnaAsset = accounts.find((account) => account.code === '1205')?.id || null
  const accPiutangSalamVendor = accounts.find((account) => account.code === '1404')?.id || null
  const defaultAccHutang = accounts.find((account) => account.code === '2101')?.id || null

  let finalAccCredit = defaultAccHutang
  if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM') {
    finalAccCredit = accPiutangSalamVendor
  } else if (String(purchase.shariah_mode || '').toUpperCase() === 'ISTISHNA') {
    finalAccCredit = accIstishnaAsset || accUangMuka
  }

  if (finalAccCredit) {
    const inventoryDebitByAccount: Record<string, number> = {}
    for (const allocation of inventoryDebitAllocations) {
      const accountId = allocation.assetAccountId || accPersediaan
      if (!accountId) continue
      inventoryDebitByAccount[accountId] = (inventoryDebitByAccount[accountId] || 0) + Number(allocation.amount || 0)
    }

    const lines = Object.entries(inventoryDebitByAccount).map(([account_id, amount]) => ({
      account_id,
      debit: amount,
      credit: 0,
      memo: `Persediaan ${purchase.purchase_number || ''}`,
    }))

    if (Number(purchase.tax_amount || 0) > 0 && accPpnMasukan) {
      lines.push({ account_id: accPpnMasukan, debit: Number(purchase.tax_amount || 0), credit: 0, memo: 'PPN Masukan' })
    }

    lines.push({
      account_id: finalAccCredit,
      debit: 0,
      credit: Number(purchase.grand_total || 0),
      memo: `Hutang pembelian ${purchase.purchase_number || ''}`,
    })

    await createJournalEntry({
      org_id: orgId,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Penerimaan Barang ${purchase.purchase_number || purchase.id}`,
      reference_id: `${purchase.purchase_number || purchase.id}-RCV`,
      reference_type: 'PURCHASE_RECEIPT',
      branch_id: purchase.branch_id || undefined,
      auto_post: true,
      lines,
    })
  }

  await markPurchaseAsReceived(orgId, purchaseId, effectiveWarehouseId)
  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  return { success: true }
}

export async function voidPurchase(orgId: string, purchaseId: string) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  try {
    const rpcRes = await withDbUserContext(user.id, async (tx) => {
      const result = await tx.$queryRaw<Array<{ result: { success?: boolean; message?: string } }>>`
        SELECT void_purchase_atomic(${orgId}::uuid, ${purchaseId}::uuid, ${user.id}::uuid, 'Pembatalan Manual via Dashboard') AS result
      `
      return result[0]?.result
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
  payload: { purchase_id: string; account_id: string; amount: number; discount: number; payment_date: string; notes: string }
) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) return { error: 'Pilih unit aktif terlebih dahulu' }

  try {
    const rpcRes = await withDbUserContext(user.id, async (tx) => {
      const result = await tx.$queryRaw<Array<{ result: { success?: boolean; message?: string } }>>`
        SELECT process_purchase_payment_atomic(
          ${orgId}::uuid,
          ${payload.purchase_id}::uuid,
          ${payload.account_id}::uuid,
          ${payload.amount}::numeric,
          ${payload.discount}::numeric,
          ${new Date(payload.payment_date)}::date,
          ${payload.notes},
          ${user.id}::uuid
        ) AS result
      `
      return result[0]?.result
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
  payload: { purchase_id: string; return_number: string; return_date: string; notes: string; items: { purchase_item_id: string; product_id: string; quantity: number; unit_price: number }[] }
) {
  const authSession = await auth()
  const user = authSession?.user
  if (!user?.id) return { error: 'Unauthorized' }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) return { error: 'Pilih unit aktif terlebih dahulu' }

  try {
    const rpcRes = await withDbUserContext(user.id, async (tx) => {
      const result = await tx.$queryRaw<Array<{ result: { success?: boolean; message?: string } }>>`
        SELECT process_purchase_return_atomic(
          ${orgId}::uuid,
          ${payload.purchase_id}::uuid,
          ${payload.return_number},
          ${new Date(payload.return_date)}::date,
          ${payload.notes},
          ${JSON.stringify(payload.items)}::jsonb,
          ${user.id}::uuid
        ) AS result
      `
      return result[0]?.result
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

  const data = await prisma.purchase_requests.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      branches: { select: { name: true, code: true } },
      products: { select: { name: true, sku: true, unit: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return data.map((item) => ({ ...item, branch: item.branches, product: item.products }))
}

export async function getPendingPurchaseRequestsCount(orgId: string, branchId?: string | null) {
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return 0

  return prisma.purchase_requests.count({
    where: {
      org_id: orgId,
      status: 'PENDING',
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
  })
}

export async function approvePurchaseRequest(orgId: string, requestId: string, actionId?: string) {
  try {
    await prisma.purchase_requests.update({ where: { id: requestId }, data: { status: 'APPROVED' as any } })
    revalidatePath('/purchasing/requests')
    return { success: true }
  } catch (error: any) {
    return { error: 'Gagal menyetujui request: ' + error.message }
  }
}

export async function rejectPurchaseRequest(orgId: string, requestId: string, actionId?: string) {
  try {
    await prisma.purchase_requests.update({ where: { id: requestId }, data: { status: 'REJECTED' as any } })
    revalidatePath('/purchasing/requests')
    return { success: true }
  } catch (error: any) {
    return { error: 'Gagal menolak request: ' + error.message }
  }
}

export async function updatePurchaseRequestStatus(orgId: string, requestId: string, status: string, notes?: string) {
  if (status === 'APPROVED') return approvePurchaseRequest(orgId, requestId, notes)
  return rejectPurchaseRequest(orgId, requestId, notes)
}
