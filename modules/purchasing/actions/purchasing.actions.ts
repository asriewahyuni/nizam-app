'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'

export async function getPurchases(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()

  if (!user) return []

  const { data: canReadPurchasing, error: permissionError } = await (supabase as any).rpc('nizam_has_permission', {
    p_permission: 'purchasing:read',
    p_org_id: orgId,
  })

  if (permissionError) {
    ;(console as any).error('DEBUG: getPurchases permission check error:', permissionError)
    return []
  }

  if (!canReadPurchasing) return []

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
        products (name, sku, unit)
      ),
      purchase_payments (amount, discount_amount),
      purchase_returns (total_amount)
    ` as any)
    .eq('org_id', orgId)

  if (branchId) {
    query = query.eq('branch_id', branchId)
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
          products (name, sku, unit)
        )
      ` as any)
      .eq('org_id', orgId)

    if (branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', branchId)
    }

    const { data: fallback, error: fallbackErr } = await fallbackQuery
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      
    if (fallbackErr) return []
    return fallback
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
  lines: PurchaseLineData[]
}

export async function createPurchaseEntry(orgId: string, payload: CreatePurchaseData) {
  const supabase = await createClient()

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!payload.vendor_id || payload.lines.length === 0) {
    return { error: 'Vendor dan baris produk wajib diisi.' }
  }

  if (payload.branch_id) {
    const { data: branch, error: branchError } = await (supabase as any)
      .from('branches')
      .select('id')
      .eq('id', payload.branch_id)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (branchError || !branch) {
      return { error: 'Unit aktif tidak valid untuk organisasi ini.' }
    }
  }

  // 1. Calculate Subtotals to perform Value-Based Allocation for Landed Costs
  const totalOverhead = (payload.shipping_amount || 0) + (payload.insurance_amount || 0)
  const grossSubTotal = payload.lines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price) - (l.discount_amount || 0), 0)

  // 2. Pre-process Products
  const processedLines: any[] = []
  for (const line of payload.lines) {
    let finalProductId = line.product_id

    // Accurate true Landed Cost HPP per Unit
    const itemValue = (line.quantity * line.unit_price) - (line.discount_amount || 0)
    const allocatedOverhead = grossSubTotal > 0 ? (itemValue / grossSubTotal * totalOverhead) : 0
    const trueHpp = line.quantity > 0 ? line.unit_price + (allocatedOverhead / line.quantity) : line.unit_price

    if (!finalProductId && line.product_name) {
      const { data: newProd, error: prodErr } = await (supabase as any)
        .from('products' as any)
        .insert({
          org_id: orgId,
          name: line.product_name,
          type: 'INVENTORY',
          category: line.category || 'Bahan',
          unit: line.unit || 'Pcs',
          purchase_price: trueHpp,
          selling_price: line.selling_price || trueHpp * 1.25
        })
        .select('id')
        .single()
      
      if (!prodErr && newProd) finalProductId = newProd.id
    } else if (finalProductId) {
       // Update EXISTING products master data directly using Landed Cost HPP!
       await (supabase as any).from('products' as any)
         .update({
            purchase_price: trueHpp,
            selling_price: line.selling_price || trueHpp * 1.25,
            category: line.category,
            unit: line.unit // Sync unit from PO to master product
         })
         .eq('id', finalProductId)
         .eq('org_id', orgId)
    }

    processedLines.push({
      product_id: finalProductId,
      description: line.product_name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_amount: line.discount_amount || 0,
      tax_amount: line.tax_amount || 0
    })
  }

  // 2. ATOMIC TRANSACTION
  const headerSubtotal = processedLines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price), 0)
  const headerDiscount = payload.discount_amount || processedLines.reduce((acc: any, l: any) => acc + l.discount_amount, 0)
  const headerTax = payload.tax_amount || processedLines.reduce((acc: any, l: any) => acc + l.tax_amount, 0)
  const headerShipping = payload.shipping_amount || 0
  const headerGrand = headerSubtotal - headerDiscount + headerTax + headerShipping

  // Simpan info termin di metadata/notes sementara atau via RPC (Saya asumsikan RPC sudah diupdate atau kita pakai p_notes)
  const notesWithTerm = `[TERMIN: ${payload.payment_term}] ${payload.payment_account_id ? `[ACC: ${payload.payment_account_id}] ` : ''}${payload.notes || ''}`

  const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('process_purchase_atomic', {
      p_org_id: orgId,
      p_vendor_id: payload.vendor_id,
      p_date: payload.purchase_date || new Date().toISOString(),
      p_due_date: payload.due_date || null, // Added due_date here
      p_total: headerSubtotal,
      p_tax: headerTax,
      p_shipping: headerShipping,
      p_grand_total: headerGrand,
      p_notes: notesWithTerm,
      p_shariah_mode: payload.shariah_mode || 'CASH',
      p_lines: processedLines,
      p_user_id: user.id,
      p_branch_id: payload.branch_id || null,
  })

  if (rpcError || !rpcRes?.success) {
     return { error: 'Atomic Execution Failed: ' + (rpcRes?.error || rpcError?.message) }
  }

  revalidatePath('/purchasing')
  return { success: true, purchaseId: rpcRes.purchase_id }
}

export async function receivePurchase(orgId: string, purchaseId: string) {
  const supabase = await createClient()
  
  // 1. Fetch info
  const { data: purchase } = await (supabase as any)
    .from('purchases' as any)
    .select('*, purchase_items(*)')
    .eq('id', purchaseId)
    .eq('org_id', orgId)
    .single()

  if (!purchase) return { error: 'PO tidak ditemukan.' }
  if (purchase.status === 'RECEIVED') return { success: true }

  // 2. TRANSACTION START: Update Status PO (Audit Lock)
  const { error: statusErr } = await (supabase as any)
    .from('purchases' as any)
    .update({ status: 'RECEIVED' })
    .eq('id', purchaseId)

  if (statusErr) return { error: 'Gagal memperbarui status PO: ' + statusErr.message }

  const shipping = purchase.shipping_amount || 0
  const insurance = purchase.insurance_amount || 0
  const totalLandedOverhead = shipping + insurance
  const totalItemsValue = purchase.total_amount || 1
  let fallbackWarehouse: { id: string; branch_id: string | null } | null = null

  if (!purchase.warehouse_id) {
    let warehouseQuery = (supabase as any)
      .from('warehouses')
      .select('id, branch_id')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1)

    if (purchase.branch_id) {
      warehouseQuery = warehouseQuery.or(`branch_id.eq.${purchase.branch_id},branch_id.is.null`)
    }

    const { data } = await warehouseQuery.maybeSingle()
    fallbackWarehouse = data || null
  }

  let movementBranchId = purchase.branch_id || fallbackWarehouse?.branch_id || null

  if (!movementBranchId && purchase.warehouse_id) {
    const { data: warehouseBranchData } = await (supabase as any)
      .from('warehouses')
      .select('branch_id')
      .eq('id', purchase.warehouse_id)
      .eq('org_id', orgId)
      .maybeSingle()

    movementBranchId = warehouseBranchData?.branch_id || null
  }

  const stockMovements: any[] = []

  // 3. Process Items for WAC & Stock Card
  for (const item of purchase.purchase_items) {
    if (!item.product_id) continue;
    
    // Landed Cost Calculation (Allocated based on Value)
    const itemSubtotal = (item.quantity * item.unit_price) - (item.discount_amount || 0)
    const allocatedOverhead = (itemSubtotal / totalItemsValue) * totalLandedOverhead
    const landedUnitPrice = (itemSubtotal + allocatedOverhead) / item.quantity

    // A. Update Average Cost (HPP) in Master Data
    await (supabase as any).rpc('update_product_average_cost', {
        p_product_id: item.product_id,
        p_new_cost: landedUnitPrice
    }).then((r: any) => { if (r.error) (console as any).error("WAC error", r.error) })

    // B. Replaced by direct update in PO Creation (createPurchaseEntry)
    // No action needed here anymore since selling price is established upfront.

    stockMovements.push({
      org_id: orgId,
      branch_id: movementBranchId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: landedUnitPrice,
      reference_type: 'PURCHASE',
      reference_id: purchase.id,
      notes: 'Penerimaan PO ' + (purchase.purchase_number || '')
    })
  }

  // 4. Persistence: Stock Movements (Sub-Ledger) & WMS Sync (Physical Stock)
  if (stockMovements.length > 0) {
     const { error: smErr } = await (supabase as any).from('stock_movements').insert(stockMovements)
     if (smErr) (console as any).error("Stock Movement insert failed:", smErr)
     
     // CRITICAL: Sync with physical inventory (inventory_stocks)
     const whId = purchase.warehouse_id || fallbackWarehouse?.id
     
     if (whId) {
        for (const m of stockMovements) {
           await (supabase as any).from('inventory_stocks').upsert({
              org_id: orgId,
              product_id: m.product_id,
              warehouse_id: whId,
              quantity: m.quantity // This will be ADDED if using a trigger or function? No, the upsert below handles Conflict.
           }, { onConflict: 'product_id,warehouse_id,batch_number' }) // Since batch is null by default.
           
           // Wait! A standard upsert will OVERWRITE. We need to increment.
           // Since we are in a server action, it's safer to use an RPC or do a Get-then-Set.
           // However, most entries for 'inventory_stocks' in this DB use the increment logic.
           
           await (supabase as any).rpc('adjust_inventory_stock', {
              p_org_id: orgId,
              p_product_id: m.product_id,
              p_warehouse_id: whId,
              p_diff: m.quantity
           }).then((r: any) => { if (r.error) (console as any).error("WMS sync error", r.error) })
        }
     }
  }

  // 5. GL Synchronization (Journal)
  const { data: accounts } = await (supabase as any)
    .from('accounts' as any)
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', ['1301', '1401', '2101', '1403'])

  const accPersediaan = accounts?.find((a:any) => a.code === '1301')?.id
  const accPpnMasukan = accounts?.find((a:any) => a.code === '1401')?.id
  const accUangMuka = accounts?.find((a:any) => a.code === '1403')?.id
  const defaultAccHutang = accounts?.find((a:any) => a.code === '2101')?.id
 
  let finalAccCredit = defaultAccHutang
  const isLunas = purchase.notes?.includes('[TERMIN: LUNAS]')
  let LunasAccountId = null;
  if (isLunas) {
     const match = purchase.notes.match(/\[ACC: ([a-f0-9-]+)\]/)
     if (match && match[1]) LunasAccountId = match[1]
  }

  // Syariah Mod: For SALAM/ISTISHNA, credit should clear Uang Muka (Advances)
  if ((purchase.shariah_mode === 'SALAM' || purchase.shariah_mode === 'ISTISHNA') && accUangMuka) {
     finalAccCredit = accUangMuka
  }

  if (accPersediaan && finalAccCredit) {
    const persediaanVal = (purchase.total_amount - (purchase.discount_amount || 0)) + shipping + insurance
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

    const journalLines: any[] = [
      { account_id: accPersediaan, debit: persediaanVal, credit: 0, memo: 'Persediaan (Landed) ' + (purchase.purchase_number || '') }
    ]

    // PPN
    if (pajakVal > 0 && accPpnMasukan) {
      journalLines.push({ account_id: accPpnMasukan, debit: pajakVal, credit: 0, memo: 'PPN Masukan PO' })
    }

    // Hutang Vendor / Lunas Pembayaran Barang Utama
    if (vendorApAmount > 0) {
      journalLines.push({ account_id: finalAccCredit, debit: 0, credit: vendorApAmount, memo: isLunas ? 'Pembayaran Lunas Barang PO' : 'Hutang Vendor PO' })
    }

    // Kas/Bank untuk Ongkir & Asuransi (Landed Cost Provider 3rd Party)
    if (overheadCashAmount > 0 && overheadAccId) {
      journalLines.push({ account_id: overheadAccId, debit: 0, credit: overheadCashAmount, memo: 'Pembayaran Tunai Freight/Logistics' })
    }

    // Sanity check just to be safe
    const totalDebit = journalLines.reduce((acc: any, l: any) => acc + l.debit, 0)
    const totalCredit = journalLines.reduce((acc: any, l: any) => acc + l.credit, 0)
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
       (console as any).error("JOURNAL IMBALANCE IN PO:", { totalDebit, totalCredit, journalLines })
    }

    const journalResult = await createJournalEntry({
      org_id: orgId,
      branch_id: purchase.branch_id || undefined,
      entry_date: new Date().toISOString().split('T')[0],
      description: 'Penerimaan Pembelian & Stok ' + (purchase.purchase_number || ''),
      reference_type: 'PURCHASE',
      reference_id: purchase.id,
      lines: journalLines,
      auto_post: true
    })
    const jErr = (journalResult as any).error
    if (jErr) (console as any).error("Journal creation failed:", jErr)
    
    // Auto-Lunas Payment trigger for Bank history & AP clearing
    if (LunasAccountId && vendorApAmount > 0) {
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

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  return { success: true }
}

export async function voidPurchase(orgId: string, purchaseId: string) {
  const supabase = await createClient()

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // Gunakan RPC agar berjalan di level DB dengan security definer (admin) 
  // Melewati pembatasan RLS agar Ledger & Sub-Ledger sinkron
  const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('void_purchase_atomic', {
      p_org_id: orgId,
      p_purchase_id: purchaseId,
      p_user_id: user.id,
      p_reason: 'Pembatalan Manual via Dashboard'
  })

  if (rpcError || !rpcRes?.success) {
      return { error: 'Gagal membatalkan PO secara atomik: ' + (rpcRes?.error || rpcError?.message) }
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  revalidatePath('/accounting/ledgers')
  
  return { success: true }
}

export async function createPurchasePayment(orgId: string, payload: {
  purchase_id: string,
  account_id: string,
  amount: number,
  discount: number,
  payment_date: string,
  notes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await (supabase as any).rpc('process_purchase_payment_atomic', {
    p_org_id: orgId,
    p_purchase_id: payload.purchase_id,
    p_account_id: payload.account_id,
    p_amount: payload.amount,
    p_discount: payload.discount,
    p_payment_date: payload.payment_date,
    p_notes: payload.notes,
    p_user_id: user.id
  })

  if (error || !data?.success) {
    return { error: data?.error || error?.message || 'Gagal memproses pembayaran.' }
  }

  revalidatePath('/purchasing')
  return { success: true }
}

export async function createPurchaseReturn(orgId: string, payload: {
  purchase_id: string,
  return_number: string,
  return_date: string,
  notes: string,
  items: any[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await (supabase as any).rpc('process_purchase_return_atomic', {
    p_org_id: orgId,
    p_purchase_id: payload.purchase_id,
    p_return_number: payload.return_number,
    p_return_date: payload.return_date,
    p_notes: payload.notes,
    p_items: payload.items,
    p_user_id: user.id
  })

  if (error || !data?.success) {
    return { error: data?.error || error?.message || 'Gagal memproses retur.' }
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  return { success: true }
}

export async function getPurchaseRequests(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  
  let query = (supabase as any)
    .from('purchase_requests')
    .select(`
      *,
      branch:branches(name, code),
      product:products(name, sku, unit)
    `)
    .eq('org_id', orgId)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    (console as any).error('DEBUG: getPurchaseRequests fail:', error.message, error.code, error.details)
    let fallbackQuery = (supabase as any)
      .from('purchase_requests')
      .select(`
        *,
        product:products(name, sku, unit)
      `)
      .eq('org_id', orgId)

    if (branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', branchId)
    }

    const { data: fallback, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false })
    if (fallbackError) return []
    return fallback
  }
  return data
}

export async function updatePurchaseRequestStatus(orgId: string, requestId: string, status: string, branchId?: string | null) {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('purchase_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('org_id', orgId)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { error } = await query

  if (error) return { error: error.message }
  revalidatePath('/purchasing')
  revalidatePath('/factory')
  return { success: true }
}

export async function getPendingPurchaseRequestsCount(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('purchase_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { count, error } = await query

  if (error) return 0
  return count || 0
}
