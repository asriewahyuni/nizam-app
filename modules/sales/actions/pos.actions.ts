'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'

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
  let query = (supabase as any)
    .from('warehouses')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .eq('branch_id', branchId)

  if (explicitWarehouseId) {
    const { data, error } = await query.eq('id', explicitWarehouseId).maybeSingle()
    if (error || !data) {
      return { error: 'Gudang POS tidak tersedia pada unit aktif.' }
    }

    return { warehouseId: data.id }
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(2)
  if (error) {
    return { error: 'Gagal memuat gudang POS.' }
  }

  const warehouses = (data as Array<{ id: string }>) || []
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

export async function processPosTransaction(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranch = await getActiveBranch(orgId)
  if (!activeBranch) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.' }
  }

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
      resolvedWarehouseId,
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
  
  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales' as any)
    .insert({
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
      payment_status: 'PAID'
    })
    .select('id')
    .single()

  if (saleErr) return { error: saleErr.message }

  const { error: linesErr } = await (supabase as any)
    .from('sales_items' as any)
    .insert(payload.lines.map((l: any) => ({
      org_id: orgId,
      branch_id: activeBranch.id,
      sale_id: sale.id,
      product_id: l.product_id,
      description: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: 0,
      tax_amount: 0
    })))

  if (linesErr) {
    await (supabase as any).from('sales').delete().eq('id', sale.id)
    return { error: linesErr.message }
  }

  // Auto-deliver (reduce stock)
  const { error: deliverErr } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: sale.id,
    p_warehouse_id: resolvedWarehouseId,
  })

  // Auto-pay (create journal entry)
  if (!deliverErr && payload.account_id) {
    await (supabase as any).rpc('process_sales_payment_atomic', {
      p_org_id: orgId, 
      p_sale_id: sale.id, 
      p_account_id: payload.account_id,
      p_amount: grandTotal, 
      p_discount: 0,
      p_payment_date: new Date().toISOString().split('T')[0],
      p_notes: 'POS Payment',
      p_user_id: user.id
    })
  } else if (deliverErr) {
      (console as any).error("Delivery error:", deliverErr)
  }

  revalidatePath('/pos')
  revalidatePath('/sales')
  revalidatePath('/inventory')
  return { success: true, saleId: sale.id }
}
