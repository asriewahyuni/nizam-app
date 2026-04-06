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

function normalizePurchaseShariahMode(value?: string | null): 'CASH' | 'SALAM' | 'ISTISHNA' {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  if (normalized === 'SALAM' || normalized === 'ISTISHNA') {
    return normalized
  }

  return 'CASH'
}

function isAdjustInventoryStockUnavailable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()

  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P10') {
    return true
  }

  if (!message.includes('adjust_inventory_stock')) {
    return false
  }

  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('undefined function')
    || message.includes('no unique or exclusion constraint matching the on conflict specification')
  )
}

function isPurchaseWarehouseColumnSchemaCacheMiss(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false
  const message = String(error.message || '')
  return (
    error.code === 'PGRST204' ||
    (message.includes("Could not find the 'warehouse_id' column of 'purchases'") &&
      message.includes('schema cache'))
  )
}

async function markPurchaseAsReceived(
  supabase: any,
  {
    orgId,
    purchaseId,
    warehouseId,
  }: {
    orgId: string
    purchaseId: string
    warehouseId: string
  }
) {
  const basePayload = {
    status: 'RECEIVED',
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await (supabase as any)
    .from('purchases')
    .update({
      ...basePayload,
      warehouse_id: warehouseId,
    })
    .eq('id', purchaseId)
    .eq('org_id', orgId)

  if (!updateError) {
    return { success: true as const }
  }

  if (!isPurchaseWarehouseColumnSchemaCacheMiss(updateError)) {
    return { error: updateError.message }
  }

  const { error: fallbackError } = await (supabase as any)
    .from('purchases')
    .update(basePayload)
    .eq('id', purchaseId)
    .eq('org_id', orgId)

  if (fallbackError) {
    return { error: fallbackError.message }
  }

  return { success: true as const }
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

  if (!isAdjustInventoryStockUnavailable(inventorySyncError)) {
    return { error: 'Gagal sinkron stok fisik gudang: ' + inventorySyncError.message }
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

  // Read with admin client after explicit permission check so server-rendered
  // purchasing data is not dropped by mismatched line-item RLS policies.
  const adminClient = await createAdminClient()

  let query = (adminClient as any)
    .from('purchases' as any)
    .select(`
      *,
      branches (name, code),
      contacts (name),
      purchase_items (
        id,
        product_id,
        description,
        quantity,
        unit_price,
        total_amount,
        products (name, sku, unit, category, selling_price)
      ),
      purchase_payments (amount, discount_amount),
      purchase_returns (total_amount)
    ` as any)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    (console as any).error("DEBUG: getPurchases error:", error)
    // If it's a field error, try pulling without the new tables
    let fallbackQuery = (adminClient as any)
      .from('purchases' as any)
      .select(`
        *,
        contacts (name),
        purchase_items (
          id,
          product_id,
          description,
          quantity,
          unit_price,
          total_amount,
          products (name, sku, unit, category, selling_price)
        )
      ` as any)
      .eq('org_id', orgId)

    if (branchSelection.branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', branchSelection.branchId)
    }
  }
  return data
}

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
  payment_term: 'LUNAS' | 'TEMPO'
  payment_account_id?: string
  shariah_mode?: 'CASH' | 'SALAM' | 'ISTISHNA'
  mode?: 'DRAFT' | 'PUBLISH'
  draft_id?: string
  lines: PurchaseLineData[]
}

export async function createPurchaseEntry(orgId: string, payload: CreatePurchaseData) {
  const supabase = await createClient()

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const createMode: 'DRAFT' | 'PUBLISH' =
    String(payload.mode || 'PUBLISH').toUpperCase() === 'DRAFT'
      ? 'DRAFT'
      : 'PUBLISH'

  const normalizedLines = (payload.lines || []).filter((line) => String(line?.product_name || '').trim().length > 0)
  if (!payload.vendor_id || normalizedLines.length === 0) {
    return { error: 'Vendor dan baris produk wajib diisi.' }
  }

  const branchSelection = await resolvePurchasingBranchId(orgId, payload.branch_id)
  if ('error' in branchSelection) {
    return { error: 'Unit aktif tidak valid untuk organisasi ini.' }
  }

  const branchSelection = await resolvePurchasingBranchId(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat pembelian.' }
  }
  const purchaseBranchId = branchSelection.branchId
  const shariahMode = normalizePurchaseShariahMode(payload.shariah_mode)
  const isSalamPurchase = shariahMode === 'SALAM'

  if (isSalamPurchase && !payload.due_date) {
    return { error: 'Akad SALAM pembelian wajib menetapkan tanggal barang disediakan.' }
  }

  const resolvedPaymentTerm: 'LUNAS' | 'TEMPO' = isSalamPurchase ? 'LUNAS' : payload.payment_term
  const resolvedDueDate = resolvedPaymentTerm === 'TEMPO' || isSalamPurchase
    ? (payload.due_date || null)
    : null

  // 1. Calculate Subtotals to perform Value-Based Allocation for Landed Costs
  const totalOverhead = (payload.shipping_amount || 0) + (payload.insurance_amount || 0)
  const grossSubTotal = normalizedLines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price) - (l.discount_amount || 0), 0)

  const processedLines: any[] = []
  for (const line of normalizedLines) {
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

  // 2. ATOMIC TRANSACTION
  const headerSubtotal = processedLines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price), 0)
  const headerDiscount = payload.discount_amount || processedLines.reduce((acc: any, l: any) => acc + l.discount_amount, 0)
  const headerTax = payload.tax_amount || processedLines.reduce((acc: any, l: any) => acc + l.tax_amount, 0)
  const headerShipping = payload.shipping_amount || 0
  const headerGrand = headerSubtotal - headerDiscount + headerTax + headerShipping

  // Simpan info termin di metadata/notes sementara atau via RPC (Saya asumsikan RPC sudah diupdate atau kita pakai p_notes)
  const notesWithTerm = `[TERMIN: ${resolvedPaymentTerm}] ${payload.payment_account_id ? `[ACC: ${payload.payment_account_id}] ` : ''}${payload.notes || ''}`

  const approvalReason = `Purchase Order Baru (${shariahMode})`

  if (payload.draft_id) {
    const { data: existingPurchase, error: existingPurchaseError } = await (supabase as any)
      .from('purchases')
      .select('id, status, branch_id')
      .eq('id', payload.draft_id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (existingPurchaseError || !existingPurchase) {
      return { error: 'Draft PO tidak ditemukan.' }
    }

    const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, existingPurchase.branch_id)
    if ('error' in purchaseAccess) return { error: purchaseAccess.error }

    if (existingPurchase.status !== 'DRAFT') {
      return { error: 'Hanya dokumen PO berstatus DRAFT yang bisa diedit atau diterbitkan ulang.' }
    }

    const { error: updatePurchaseError } = await (supabase as any)
      .from('purchases')
      .update({
        vendor_id: payload.vendor_id,
        branch_id: purchaseBranchId,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: Number(payload.shipping_amount || 0),
        insurance_amount: Number(payload.insurance_amount || 0),
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        status: createMode === 'DRAFT' ? 'DRAFT' : 'ORDERED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.draft_id)
      .eq('org_id', orgId)

    if (updatePurchaseError) {
      return { error: 'Gagal memperbarui draft PO: ' + updatePurchaseError.message }
    }

    const { error: deleteItemsError } = await (supabase as any)
      .from('purchase_items')
      .delete()
      .eq('org_id', orgId)
      .eq('purchase_id', payload.draft_id)

    if (deleteItemsError) {
      return { error: 'Gagal memperbarui baris item draft PO: ' + deleteItemsError.message }
    }

    const { error: insertItemsError } = await (supabase as any)
      .from('purchase_items')
      .insert(
        processedLines.map((line) => ({
          org_id: orgId,
          purchase_id: payload.draft_id,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_amount: line.tax_amount || 0,
        }))
      )

    if (insertItemsError) {
      return { error: 'Gagal menyimpan item draft PO: ' + insertItemsError.message }
    }

    if (createMode === 'PUBLISH') {
      await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'VOIDED',
          reason: 'Approval PO lama diganti oleh versi draft terbaru',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('source_type', 'PURCHASE_ORDER')
        .eq('source_id', payload.draft_id)
        .eq('status', 'PENDING')

      const { error: approvalError } = await (supabase as any)
        .from('approval_requests')
        .insert({
          org_id: orgId,
          branch_id: purchaseBranchId,
          requester_id: user.id,
          source_type: 'PURCHASE_ORDER',
          source_id: payload.draft_id,
          status: 'PENDING',
          reason: approvalReason,
        })

      if (approvalError) {
        return { error: 'Draft PO tersimpan, tapi gagal kirim approval: ' + approvalError.message }
      }
    } else {
      await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'VOIDED',
          reason: 'Draft PO diperbarui sebelum diterbitkan',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('source_type', 'PURCHASE_ORDER')
        .eq('source_id', payload.draft_id)
        .eq('status', 'PENDING')
    }

    revalidatePath('/purchasing')
    return { success: true, purchaseId: payload.draft_id }
  }

  if (createMode === 'DRAFT') {
    const { data: draftPurchase, error: draftInsertError } = await (supabase as any)
      .from('purchases')
      .insert({
        org_id: orgId,
        branch_id: purchaseBranchId,
        vendor_id: payload.vendor_id,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: Number(payload.shipping_amount || 0),
        insurance_amount: Number(payload.insurance_amount || 0),
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        status: 'DRAFT',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (draftInsertError || !draftPurchase?.id) {
      return { error: 'Gagal menyimpan draft PO: ' + (draftInsertError?.message || 'Unknown error') }
    }

    const { error: draftItemsError } = await (supabase as any)
      .from('purchase_items')
      .insert(
        processedLines.map((line) => ({
          org_id: orgId,
          purchase_id: draftPurchase.id,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_amount: line.tax_amount || 0,
        }))
      )

    if (draftItemsError) {
      await (supabase as any).from('purchases').delete().eq('id', draftPurchase.id).eq('org_id', orgId)
      return { error: 'Gagal menyimpan item draft PO: ' + draftItemsError.message }
    }

    revalidatePath('/purchasing')
    return { success: true, purchaseId: draftPurchase.id }
  }

  const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('process_purchase_atomic', {
      p_org_id: orgId,
      p_vendor_id: payload.vendor_id,
      p_date: payload.purchase_date || new Date().toISOString(),
      p_due_date: resolvedDueDate,
      p_total: headerSubtotal,
      p_tax: headerTax,
      p_shipping: headerShipping,
      p_grand_total: headerGrand,
      p_notes: notesWithTerm,
      p_shariah_mode: shariahMode,
      p_lines: processedLines,
      p_user_id: user.id,
      p_branch_id: purchaseBranchId,
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
  const supabase = await createClient()
  
  // 1. Fetch info
  const { data: purchase } = await (supabase as any)
    .from('purchases' as any)
    .select('*, purchase_items(*, products(asset_account_id))')
    .eq('id', purchaseId)
    .eq('org_id', orgId)
    .single()

  if (!purchase) return { error: 'PO tidak ditemukan.' }
  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }
  if (purchase.status === 'RECEIVED') return { success: true }
  if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM' && purchase.payment_status !== 'PAID') {
    return { error: 'Akad SALAM pembelian wajib lunas terlebih dahulu sebelum penerimaan barang.' }
  }

  const shipping = purchase.shipping_amount || 0
  const insurance = purchase.insurance_amount || 0
  const totalLandedOverhead = shipping + insurance
  const totalItemsValue = purchase.total_amount || 1
  let receiptWarehouse: { id: string; branch_id: string | null } | null = null

  if (purchase.warehouse_id) {
    const { data: explicitWarehouse, error: warehouseError } = await (supabase as any)
      .from('warehouses')
      .select('id, branch_id')
      .eq('id', purchase.warehouse_id)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (warehouseError || !explicitWarehouse) {
      return { error: 'Gudang penerimaan untuk PO ini tidak ditemukan atau tidak aktif.' }
    }

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

  // Idempotency guard:
  // If stock movement already exists for this PO but status is not yet RECEIVED
  // (e.g. previous run failed after stock posting), avoid double-posting.
  const stockMovementTable = (supabase as any).from('stock_movements')
  if (typeof stockMovementTable?.select === 'function') {
    const { count: existingMovementCount } = await stockMovementTable
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('reference_type', 'PURCHASE')
      .eq('reference_id', purchase.id)

    if ((existingMovementCount || 0) > 0) {
      const statusSyncResult = await markPurchaseAsReceived(supabase as any, {
        orgId,
        purchaseId,
        warehouseId: purchase.warehouse_id || receiptWarehouse.id,
      })

      if ('error' in statusSyncResult) {
        return { error: 'Gagal menyinkronkan status PO existing: ' + statusSyncResult.error }
      }

      revalidatePath('/purchasing')
      revalidatePath('/inventory')
      return { success: true }
    }
  }

  const stockMovements: any[] = []
  const inventoryDebitAllocations: Array<{ assetAccountId: string | null; amount: number }> = []

  // 3. Process Items for WAC & Stock Card
  for (const item of purchase.purchase_items) {
    if (!item.product_id) continue
    
    // Landed Cost Calculation (Allocated based on Value)
    const itemSubtotal = (item.quantity * item.unit_price) - (item.discount_amount || 0)
    const allocatedOverhead = (itemSubtotal / totalItemsValue) * totalLandedOverhead
    const landedTotal = itemSubtotal + allocatedOverhead
    const landedUnitPrice = landedTotal / item.quantity

    // A. Update Average Cost (HPP) in Master Data
    await (supabase as any).rpc('update_product_average_cost', {
        p_product_id: item.product_id,
        p_new_cost: landedUnitPrice
    }).then((r: any) => { if (r.error) (console as any).error("WAC error", r.error) })

    // B. Replaced by direct update in PO Creation (createPurchaseEntry)
    // No action needed here anymore since selling price is established upfront.

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

    const productRel = Array.isArray((item as any).products) ? (item as any).products[0] : (item as any).products
    const rawAssetAccountId = productRel?.asset_account_id
    inventoryDebitAllocations.push({
      assetAccountId: typeof rawAssetAccountId === 'string' ? rawAssetAccountId : null,
      amount: landedTotal,
    })
  }

  // 4. Persistence: Stock Movements (Sub-Ledger) & WMS Sync (Physical Stock)
  if (stockMovements.length > 0) {
     const { error: smErr } = await (supabase as any).from('stock_movements').insert(stockMovements)
     if (smErr) {
       return { error: 'Gagal mencatat kartu stok pembelian: ' + smErr.message }
     }
     
     // CRITICAL: Sync with physical inventory (inventory_stocks)
     const whId = receiptWarehouse.id

     for (const m of stockMovements) {
       const inventorySyncResult = await syncInventoryStock(supabase, {
         orgId,
         productId: m.product_id,
         warehouseId: whId,
         diff: m.quantity,
       })

       if ('error' in inventorySyncResult) {
         return inventorySyncResult
       }
     }
  }

  // 5. GL Synchronization (Journal)
  const { data: accounts } = await (supabase as any)
    .from('accounts' as any)
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', ['1205', '1301', '1401', '1403', '1404', '2101'])

  const accPersediaan = accounts?.find((a:any) => a.code === '1301')?.id
  const accPpnMasukan = accounts?.find((a:any) => a.code === '1401')?.id
  const accUangMuka = accounts?.find((a:any) => a.code === '1403')?.id
  const accIstishnaAsset = accounts?.find((a:any) => a.code === '1205')?.id
  const accPiutangSalamVendor = accounts?.find((a:any) => a.code === '1404')?.id
  const defaultAccHutang = accounts?.find((a:any) => a.code === '2101')?.id
 
  let finalAccCredit = defaultAccHutang
  const isLunas = purchase.notes?.includes('[TERMIN: LUNAS]')
  let LunasAccountId = null;
  if (isLunas) {
     const match = purchase.notes.match(/\[ACC: ([a-f0-9-]+)\]/)
     if (match && match[1]) LunasAccountId = match[1]
  }

  // Syariah Mod:
  // - SALAM: clear Piutang Salam Vendor (1404) on goods receipt
  // - ISTISHNA: clear Uang Muka Pembelian (1403)
  if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM') {
     if (!accPiutangSalamVendor) {
       return { error: 'Akun Piutang Salam Vendor (1404) belum tersedia di CoA. Jalankan migrasi terbaru / aktifkan akun syariah.' }
     }
     finalAccCredit = accPiutangSalamVendor
  } else if (String(purchase.shariah_mode || '').toUpperCase() === 'ISTISHNA') {
     // Gunakan akun 1205 (Piutang Barang Istishna) jika ada, fallback ke 1403 (Uang Muka)
     if (accIstishnaAsset) {
        finalAccCredit = accIstishnaAsset
     } else if (accUangMuka) {
        finalAccCredit = accUangMuka
     }
  }

  if (finalAccCredit) {
    const pajakVal = purchase.tax_amount || 0
    const grandVal = purchase.grand_total

    // Check if overhead was paid separately in cash!
    let vendorApAmount = grandVal
    let overheadCashAmount = 0
    let overheadAccId = null

    const overheadMatch = purchase.notes?.match(/\[OVERHEAD_ACC: ([a-f0-9-]+)\]/)
    if (overheadMatch && overheadMatch[1] && (shipping > 0 || insurance > 0)) {
       overheadCashAmount = shipping + insurance
       vendorApAmount = grandVal - overheadCashAmount
       overheadAccId = overheadMatch[1]
    }
  }

    const inventoryDebitByAccount: Record<string, number> = {}
    for (const allocation of inventoryDebitAllocations) {
      const accountId = allocation.assetAccountId || accPersediaan || null
      if (!accountId) continue
      inventoryDebitByAccount[accountId] = (inventoryDebitByAccount[accountId] || 0) + Number(allocation.amount || 0)
    }

    if (Object.keys(inventoryDebitByAccount).length === 0 && inventoryDebitAllocations.length > 0) {
      return { error: 'Akun persediaan produk belum lengkap. Set asset account produk atau siapkan akun 1301.' }
    }

    const journalLines: any[] = Object.entries(inventoryDebitByAccount).map(([accountId, amount]) => ({
      account_id: accountId,
      debit: amount,
      credit: 0,
      memo: 'Persediaan (Landed) ' + (purchase.purchase_number || '')
    }))

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
    const jErr = (journalResult as any).error
    if (jErr) (console as any).error("Journal creation failed:", jErr)
    
    // Auto-Lunas Payment trigger for Bank history & AP clearing
    if (LunasAccountId && vendorApAmount > 0 && String(purchase.shariah_mode || '').toUpperCase() !== 'SALAM') {
       await createPurchasePayment(orgId, {
          purchase_id: purchase.id,
          account_id: LunasAccountId,
          amount: vendorApAmount,
          discount: 0,
          payment_date: new Date().toISOString().split('T')[0],
          notes: 'Auto-Lunas Saat Terima Barang'
       });
    }
  }

  const statusResult = await markPurchaseAsReceived(supabase as any, {
    orgId,
    purchaseId,
    warehouseId: purchase.warehouse_id || receiptWarehouse.id,
  })

  if ('error' in statusResult) return { error: 'Gagal memperbarui status PO: ' + statusResult.error }

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
