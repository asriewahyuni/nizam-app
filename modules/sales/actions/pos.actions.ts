'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getDateInTimeZone } from '@/lib/utils'
import { getPosShiftConfig, isPosShiftSchemaMissing } from '@/modules/sales/lib/pos-shift'
import { listActiveSalesWarehouses } from '@/modules/sales/lib/warehouse-branch-compat.server'

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
  supabase: any,
  orgId: string,
  branchId: string,
  explicitWarehouseId?: string | null
) {
  const warehousesResult = await listActiveSalesWarehouses(supabase, orgId, branchId, {
    warehouseId: explicitWarehouseId,
    limit: explicitWarehouseId ? undefined : 2,
  })

  if ('error' in warehousesResult) {
    return { error: 'Gagal memuat gudang POS.' }
  }

  const warehouses = warehousesResult.warehouses

  if (explicitWarehouseId) {
    if (!warehouses[0]?.id) {
      return { error: 'Gudang POS tidak tersedia pada unit aktif.' }
    }

    return { warehouseId: warehouses[0].id }
  }

  if (warehouses.length === 0) {
    return { error: 'Belum ada gudang aktif di unit ini. Tambahkan gudang terlebih dahulu sebelum memakai POS.' }
  }

  if (warehouses.length > 1) {
    return { error: 'Pilih gudang POS terlebih dahulu karena unit ini memiliki lebih dari satu gudang aktif.' }
  }

  return { warehouseId: warehouses[0].id }
}

async function ensurePosStockAvailability(
  supabase: any,
  orgId: string,
  warehouseId: string,
  requirements: PosStockRequirement[]
) {
  if (!requirements.length) return { success: true as const }

  const productIds = requirements.map((item) => item.productId)
  const { data: stockRows, error } = await (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
    .in('product_id', productIds)

  if (error) {
    return { error: 'Gagal memvalidasi stok POS: ' + error.message }
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

async function trySyncMembershipRoleFromEmployee(
  admin: any,
  orgId: string,
  userId: string
) {
  const { data: memberRow, error: memberErr } = await (admin as any)
    .from('org_members')
    .select('id, role_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (memberErr || !memberRow?.id) {
    return { synced: false as const, hint: null as string | null }
  }

  const currentRoleId = String(memberRow.role_id || '').trim()
  if (currentRoleId) {
    return { synced: false as const, hint: null as string | null }
  }

  const { data: employeeRow } = await (admin as any)
    .from('employees')
    .select('role_id, job_title')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  let nextRoleId = String(employeeRow?.role_id || '').trim()

  if (!nextRoleId) {
    const fallbackRoleName = String(employeeRow?.job_title || '').trim()
    if (fallbackRoleName) {
      const { data: fallbackRole } = await (admin as any)
        .from('roles')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', fallbackRoleName)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      nextRoleId = String(fallbackRole?.id || '').trim()
    }
  }

  if (!nextRoleId) {
    return {
      synced: false as const,
      hint: 'Role user belum tertaut ke membership. Buka HRIS > Edit Karyawan, lalu pilih Role/Jabatan yang benar.',
    }
  }

  const { error: syncErr } = await (admin as any)
    .from('org_members')
    .update({ role_id: nextRoleId })
    .eq('id', memberRow.id)

  if (syncErr) {
    return { synced: false as const, hint: null as string | null }
  }

  return {
    synced: true as const,
    hint: 'Role membership berhasil disinkronkan otomatis. Coba simpan transaksi lagi.',
  }
}

async function validatePosShiftSession(
  supabase: any,
  orgId: string,
  branchId: string,
  userId: string,
  payloadSessionId?: string | null
) {
  const normalizedSessionId = String(payloadSessionId || '').trim()

  const { data: orgRow } = await (supabase as any)
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  const config = getPosShiftConfig(orgRow?.settings)
  const requiresOpenShift = config.requireOpenShift

  if (!normalizedSessionId && !requiresOpenShift) {
    return { sessionId: null as string | null }
  }

  if (!normalizedSessionId) {
    const { error } = await (supabase as any)
      .from('pos_shift_sessions')
      .select('id')
      .eq('org_id', orgId)
      .eq('branch_id', branchId)
      .eq('cashier_user_id', userId)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (isPosShiftSchemaMissing(error)) {
      return { sessionId: null as string | null }
    }

    return { error: 'Buka shift POS terlebih dahulu sebelum checkout.' }
  }

  const { data: sessionRow, error } = await (supabase as any)
    .from('pos_shift_sessions')
    .select('id, status, branch_id, cashier_user_id')
    .eq('org_id', orgId)
    .eq('id', normalizedSessionId)
    .maybeSingle()

  if (isPosShiftSchemaMissing(error)) {
    return { sessionId: null as string | null }
  }

  if (error || !sessionRow?.id) {
    return { error: 'Shift POS tidak ditemukan. Muat ulang halaman lalu buka shift baru.' }
  }

  if (String(sessionRow.status || '').toUpperCase() !== 'OPEN') {
    return { error: 'Shift POS sudah ditutup. Buka shift baru sebelum melanjutkan transaksi.' }
  }

  if (String(sessionRow.branch_id || '') !== branchId) {
    return { error: 'Shift POS tidak berada pada unit aktif.' }
  }

  if (String(sessionRow.cashier_user_id || '') !== userId) {
    return { error: 'Shift POS aktif terdaftar untuk user lain.' }
  }

  return { sessionId: normalizedSessionId }
}

export async function processPosTransaction(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranch = await getActiveBranch(orgId)
  if (!activeBranch) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.' }
  }

  const posShiftValidation = await validatePosShiftSession(
    supabase as any,
    orgId,
    activeBranch.id,
    user.id,
    payload.pos_shift_session_id || null
  )
  if ('error' in posShiftValidation) {
    return { error: posShiftValidation.error }
  }
  const posShiftSessionId = posShiftValidation.sessionId

  const productIds = [...new Set((payload.lines || []).map((line: any) => line.product_id).filter(Boolean))]
  let requiresWarehouse = false
  let inventoryRequirements: PosStockRequirement[] = []

  if (productIds.length > 0) {
    const { data: productRows, error: productError } = await (supabase as any)
      .from('products')
      .select('id, type, name')
      .eq('org_id', orgId)
      .in('id', productIds)

    if (productError) {
      return { error: 'Gagal memvalidasi produk POS: ' + productError.message }
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
      supabase as any,
      orgId,
      activeBranch.id,
      payload.warehouse_id || null
    )
    if ('error' in resolvedWarehouse) {
      return { error: resolvedWarehouse.error }
    }

    resolvedWarehouseId = resolvedWarehouse.warehouseId

    const stockCheck = await ensurePosStockAvailability(
      supabase as any,
      orgId,
      resolvedWarehouseId as string,
      inventoryRequirements
    )
    if ('error' in stockCheck) {
      return { error: stockCheck.error }
    }
  }

  // 1. Tuntaskan CRM dan Relational Integrity untuk Pelanggan (Cegah Not Null Constraints)
  let finalCustomerId = payload.customer_id
  
  if (!finalCustomerId && payload.new_customer_name) {
    // A. Buat pelanggan baru untuk disimpan di CRM
    const { data: newCust } = await (supabase as any).from('contacts').insert({
      org_id: orgId,
      name: payload.new_customer_name,
      phone: payload.new_customer_phone || '-',
      type: 'CUSTOMER'
    }).select('id').single()
    if (newCust) finalCustomerId = newCust.id
  }

  if (!finalCustomerId) {
    // B. Tangkap pelanggan numpang lewat / Walk-in
    const { data: walkIn } = await (supabase as any).from('contacts')
      .select('id').eq('org_id', orgId).eq('name', 'Pelanggan Umum (Walk-In)').single()

    if (walkIn) {
      finalCustomerId = walkIn.id
    } else {
      const { data: newWalkIn } = await (supabase as any).from('contacts').insert({
        org_id: orgId,
        name: 'Pelanggan Umum (Walk-In)',
        phone: '-',
        type: 'CUSTOMER'
      }).select('id').single()
      if (newWalkIn) finalCustomerId = newWalkIn.id
    }
  }

  // Calculate totals
  const totalAmount = payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)
  const taxAmount = payload.tax_amount || 0
  const discountAmount = payload.discount_amount || 0
  const grandTotal = totalAmount + taxAmount - discountAmount

  const normalizedPaymentMethod = String(payload.payment_method || '').trim().toUpperCase() || null
  const posAmountTendered = Number(payload.amount_tendered)
  const posChangeAmount = Number(payload.change_amount)
  const baseSaleInsertPayload = {
    org_id: orgId,
    branch_id: activeBranch.id,
    warehouse_id: resolvedWarehouseId,
    customer_id: finalCustomerId,
    sale_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    payment_term: 'CASH',
    total_amount: totalAmount,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    grand_total: grandTotal,
    shariah_mode: 'CASH',
    notes: payload.notes || 'POS Transaction',
    created_by: user.id,
    status: 'DRAFT',
    payment_status: 'PAID',
  }

  let sale: { id: string } | null = null
  let saleErr: { code?: string | null; message?: string | null } | null = null

  const saleWithPosMetadata = {
    ...baseSaleInsertPayload,
    pos_session_id: posShiftSessionId,
    pos_payment_method: normalizedPaymentMethod,
    pos_amount_tendered: Number.isFinite(posAmountTendered) ? posAmountTendered : null,
    pos_change_amount: Number.isFinite(posChangeAmount) ? posChangeAmount : 0,
  }

  const saleInsertWithMetadata = await (supabase as any)
    .from('sales' as any)
    .insert(saleWithPosMetadata)
    .select('id')
    .single()

  sale = saleInsertWithMetadata.data || null
  saleErr = saleInsertWithMetadata.error || null

  if (saleErr && isPosShiftSchemaMissing(saleErr)) {
    const fallbackSaleInsert = await (supabase as any)
      .from('sales' as any)
      .insert(baseSaleInsertPayload)
      .select('id')
      .single()

    sale = fallbackSaleInsert.data || null
    saleErr = fallbackSaleInsert.error || null
  }

  if (saleErr || !sale?.id) return { error: saleErr?.message || 'Gagal membuat transaksi POS.' }

  const salesItemPayload = payload.lines.map((l: any) => ({
    org_id: orgId,
    branch_id: activeBranch.id,
    sale_id: sale.id,
    product_id: l.product_id,
    description: l.product_name,
    quantity: l.quantity,
    unit_price: l.unit_price,
    discount_amount: 0,
    tax_amount: 0
  }))

  const cleanupDraftSale = async () => {
    const { error: deleteErr } = await (supabase as any).from('sales').delete().eq('id', sale.id)
    if (!deleteErr) return

    // Fallback cleanup for transitional environments with stricter legacy RLS.
    try {
      const admin = await createAdminClient()
      await (admin as any).from('sales').delete().eq('id', sale.id)
    } catch (_cleanupError) {
      // Ignore cleanup fallback errors to preserve original action response.
    }
  }

  let { error: linesErr } = await (supabase as any)
    .from('sales_items' as any)
    .insert(salesItemPayload)

  if (linesErr && /row-level security policy/i.test(String(linesErr.message || '')) && /sales_items/i.test(String(linesErr.message || ''))) {
    const checkPosOrSalesWritePermission = async () => {
      const [salesCheck, posCheck] = await Promise.all([
        (supabase as any).rpc('nizam_has_permission', {
          p_permission: 'sales:write',
          p_org_id: orgId,
        }),
        (supabase as any).rpc('nizam_has_permission', {
          p_permission: 'pos:write',
          p_org_id: orgId,
        }),
      ])

      const hasSalesWrite = salesCheck.data === true
      const hasPosWrite = posCheck.data === true
      const bothChecksErrored = Boolean(salesCheck.error) && Boolean(posCheck.error)
      return {
        hasWrite: hasSalesWrite || hasPosWrite,
        bothChecksErrored,
      }
    }

    let permissionCheck = await checkPosOrSalesWritePermission()
    let permissionHint: string | null = null

    if (!permissionCheck.hasWrite) {
      try {
        const admin = await createAdminClient()
        const syncResult = await trySyncMembershipRoleFromEmployee(admin as any, orgId, user.id)
        permissionHint = syncResult.hint

        if (syncResult.synced) {
          permissionCheck = await checkPosOrSalesWritePermission()
        }
      } catch (_syncError) {
        // Keep original permission result when admin fallback is unavailable.
      }
    }

    if (!permissionCheck.hasWrite) {
      await cleanupDraftSale()
      const baseMessage = 'Akun tidak punya izin pos:write atau sales:write untuk unit aktif. Minta admin aktifkan permission tersebut pada role Anda.'
      const extraHint = permissionHint ? ` ${permissionHint}` : ' Pastikan role user di HRIS sudah sinkron ke membership (org_members.role_id).'
      const debugHint = permissionCheck.bothChecksErrored
        ? ' Sistem gagal memverifikasi permission karena RPC permission check bermasalah.'
        : ''
      return { error: `${baseMessage}${extraHint}${debugHint}` }
    }

    const admin = await createAdminClient()
    const { error: adminLinesErr } = await (admin as any)
      .from('sales_items' as any)
      .insert(salesItemPayload)
    linesErr = adminLinesErr || null
  }

  if (linesErr) {
    await cleanupDraftSale()
    return { error: linesErr.message }
  }

  // Auto-deliver (reduce stock)
  const { error: deliverErr } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: sale.id,
    p_warehouse_id: resolvedWarehouseId,
  })

  if (deliverErr) {
    await cleanupDraftSale()
    const rawMessage = String(deliverErr.message || '').trim()
    if (/insufficient permission/i.test(rawMessage)) {
      return {
        error:
          'POS gagal finalisasi stok/jurnal karena permission delivery belum memenuhi syarat. Pastikan role kasir punya pos:write (atau sales:write jika DB belum update migration 1174).',
      }
    }
    return { error: `Gagal memproses delivery POS: ${rawMessage || 'Unknown delivery error.'}` }
  }

  // Auto-pay (create journal entry)
  if (payload.account_id) {
    const paymentDate = getDateInTimeZone('Asia/Jakarta')
    const { data: paymentResult, error: paymentErr } = await (supabase as any).rpc('process_sales_payment_atomic', {
      p_org_id: orgId, 
      p_sale_id: sale.id, 
      p_account_id: payload.account_id,
      p_amount: grandTotal, 
      p_discount: 0,
      p_payment_date: paymentDate,
      p_notes: 'POS Payment',
      p_user_id: user.id
    })

    if (paymentErr) {
      return {
        success: true,
        saleId: sale.id,
        warning: `Penjualan selesai, tetapi pembayaran otomatis gagal: ${paymentErr.message}`,
      }
    }

    if (paymentResult && paymentResult.success === false) {
      return {
        success: true,
        saleId: sale.id,
        warning: `Penjualan selesai, tetapi pembayaran otomatis gagal: ${String(paymentResult.error || 'Unknown payment error.')}`,
      }
    }
  }

  revalidatePath('/pos')
  revalidatePath('/sales')
  revalidatePath('/inventory')
  return { success: true, saleId: sale.id }
}
