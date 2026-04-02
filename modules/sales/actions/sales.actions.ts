'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

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

export async function getSales(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId
  let query = supabase
    .from('sales' as any)
    .select('*, branches(name, code), contacts(name), sales_items(*, products(name, sku, unit)), sales_returns(status, grand_total, return_number), sales_payments(amount, discount_amount)' as any)
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function createSaleEntry(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      customer_id: payload.customer_id,
      sale_date: payload.sale_date,
      due_date: payload.due_date, // ADDED
      payment_term: payload.payment_term, // ADDED
      total_amount: payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0),
      tax_amount: payload.tax_amount || 0,
      discount_amount: payload.discount_amount || 0,
      grand_total: (payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)) - (payload.discount_amount || 0) + (payload.tax_amount || 0),
      shariah_mode: payload.shariah_mode || 'CASH',
      notes: payload.notes,
      created_by: user.id,
      status: 'DRAFT'
    })
    .select('id')
    .single()

  if (saleErr) return { error: saleErr.message }

  const { error: linesErr } = await (supabase as any)
    .from('sales_items')
    .insert(payload.lines.map((l: any) => ({
      org_id: orgId,
      branch_id: activeBranchId,
      sale_id: sale.id,
      product_id: l.product_id,
      description: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount || 0,
      tax_amount: l.tax_amount || 0
    })))

  if (linesErr) {
    // Cleanup if lines fail
    await (supabase as any).from('sales').delete().eq('id', sale.id)
    return { error: linesErr.message }
  }

  // Insert to approval flow
  const computedTotal = payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0) - (payload.discount_amount || 0) + (payload.tax_amount || 0)
  await (supabase as any).from('approval_requests' as any).insert({
    org_id: orgId,
    branch_id: activeBranchId,
    requester_id: user.id,
    source_type: 'SALES_ORDER',
    source_id: sale.id,
    status: 'PENDING',
    reason: `Sales Order Baru (${payload.shariah_mode || 'CASH'}) - Customer: ${payload.customer_name || ''} - ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(computedTotal)}`
  })

  revalidatePath('/sales')
  return { success: true, saleId: sale.id }
}

export async function deliverSale(orgId: string, saleId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengirim sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales' as any)
    .select('status')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .single()
  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'FINISHED') return { success: true }

  const { error } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: saleId
  })

  if (error) {
    (console as any).error('Failed to deliver sale via atomic engine:', error)
    return { error: `[RPC ERROR]: ${error.message} (Code: ${error.code})` }
  }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  return { success: true }
}

export async function voidSale(orgId: string, saleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membatalkan sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // 1. Check current status — only DRAFT or FINISHED can be voided
  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('status')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'VOIDED') return { success: true }

  // 2. Void related journal entry (find by reference)
  const { data: journalEntry } = await (supabase as any)
    .from('journal_entries')
    .select('id')
    .eq('reference_id', saleId)
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .maybeSingle()

  if (journalEntry) {
    await (supabase as any)
      .from('journal_entries')
      .update({ status: 'VOIDED', void_reason: 'Pembatalan Sales Order', voided_by: user.id, voided_at: new Date().toISOString() })
      .eq('id', journalEntry.id)
  }

  // 3. Revert stock movements caused by this sale
  await supabase
    .from('stock_movements')
    .delete()
    .eq('reference_id', saleId)
    .eq('reference_type', 'SALE')

  // 4. Update sales status
  await (supabase as any).from('sales' as any).update({ status: 'VOIDED' }).eq('id', saleId).eq('org_id', orgId)
    .eq('branch_id', activeBranchId)

  // 5. Cancel any pending approval requests for this order
  await (supabase as any)
    .from('approval_requests')
    .update({ status: 'VOIDED', reason: 'Sales Order Dibatalkan', decided_at: new Date().toISOString() })
    .eq('source_type', 'SALES_ORDER')
    .eq('source_id', saleId)
    .eq('branch_id', activeBranchId)
    .eq('status', 'PENDING')

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting/journal')
  return { success: true }
}

export async function paySale(orgId: string, saleId: string) {
  // ⚠️ Deprecated: gunakan processSalesPayment() untuk mencatat pembayaran dengan jurnal yang benar.
  // Fungsi ini hanya update flag dan TIDAK membuat jurnal penerimaan kas.
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menerima pembayaran.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  await (supabase as any)
    .from('sales' as any)
    .update({ payment_status: 'PAID' })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
  revalidatePath('/sales')
  return { success: true }
}


export async function processSalesReturn(orgId: string, payload: {
  sale_id: string, return_number: string, nota_retur: string,
  items: Array<{ product_id: string, quantity: number, unit_price: number, sale_item_id: string }>,
  refund_account_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses retur penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('id')
    .eq('id', payload.sale_id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .maybeSingle()

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  const { data, error } = await (supabase as any).rpc('process_sales_return_atomic', {
    p_org_id: orgId, p_sale_id: payload.sale_id, p_return_number: payload.return_number,
    p_nota_retur: payload.nota_retur, p_items: payload.items, p_user_id: user.id,
    p_refund_account_id: payload.refund_account_id || null
  })

  if (error || !data?.success) return { error: 'Gagal memproses retur: ' + (data?.error || error?.message) }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting/ledgers')
  revalidatePath('/accounting/reports')
  return { success: true, returnId: data.return_id }
}

export async function processSalesPayment(orgId: string, payload: {
  sale_id: string, account_id: string, amount: number, payment_date: string, notes?: string, discount_amount?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses pembayaran penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('id')
    .eq('id', payload.sale_id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .maybeSingle()

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  const { data, error } = await (supabase as any).rpc('process_sales_payment_atomic', {
    p_org_id: orgId, p_sale_id: payload.sale_id, p_account_id: payload.account_id,
    p_amount: payload.amount, p_discount: payload.discount_amount || 0,
    p_payment_date: payload.payment_date, p_notes: payload.notes || '',
    p_user_id: user.id
  })

  if (error || !data?.success) return { error: 'Gagal memproses pembayaran: ' + (data?.error || error?.message) }

  revalidatePath('/sales')
  revalidatePath('/accounting/ledgers')
  revalidatePath('/accounting/reports')
  return { success: true, paymentId: data.payment_id }
}

export async function getQuotations(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId
  let query = supabase
    .from('sales' as any)
    .select('*, branches(name, code), contacts(name), sales_items(*, products(name, sku, unit))' as any)
    .eq('org_id', orgId)
    .eq('status', 'QUOTATION')

  if (effectiveBranchId) {
    query = query.eq('branch_id', effectiveBranchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function createQuotation(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const total = payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)
  const grandTotal = total - (payload.discount_amount || 0) + (payload.tax_amount || 0)

  const { data: quote, error: quoteErr } = await (supabase as any)
    .from('sales')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      customer_id: payload.customer_id,
      sale_date: payload.sale_date,
      due_date: payload.due_date,
      payment_term: payload.payment_term || 'TEMPO',
      total_amount: total,
      tax_amount: payload.tax_amount || 0,
      discount_amount: payload.discount_amount || 0,
      grand_total: grandTotal,
      shariah_mode: payload.shariah_mode || 'CASH',
      notes: payload.notes,
      created_by: user.id,
      status: 'QUOTATION'
    })
    .select('id')
    .single()

  if (quoteErr) return { error: quoteErr.message }

  const { error: linesErr } = await (supabase as any)
    .from('sales_items')
    .insert(payload.lines.map((l: any) => ({
      org_id: orgId,
      branch_id: activeBranchId,
      sale_id: quote.id,
      product_id: l.product_id,
      description: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount || 0,
    })))

  if (linesErr) return { error: linesErr.message }

  revalidatePath('/sales/quotations')
  return { success: true, quotationId: quote.id }
}

export async function convertQuotationToOrder(orgId: string, quoteId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengonversi quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const { error } = await (supabase as any)
    .from('sales')
    .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/quotations')
  revalidatePath('/sales')
  return { success: true }
}

export async function updateSaleStatus(orgId: string, saleId: string, status: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah status pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const { error } = await (supabase as any)
    .from('sales')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/pipeline')
  revalidatePath('/sales')
  return { success: true }
}

export async function createQuickKanbanCard(
  orgId: string, 
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // 1. Create a rapid generic contact
  const { data: contact, error: contactErr } = await (supabase as any)
    .from('contacts')
    .insert({
      org_id: orgId,
      name: payload.name || 'Anonymous Lead',
      type: 'CUSTOMER',
      phone: payload.phone || null,
      email: payload.email || null,
    })
    .select('id')
    .single()

  if (contactErr) return { error: 'Gagal membuat kontak: ' + contactErr.message }

  // 2. Create the Sale (Kanban Card)
  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      customer_id: contact.id,
      sale_date: new Date().toISOString().split('T')[0],
      total_amount: payload.amount,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: payload.amount,
      status: payload.status,
      shariah_mode: 'CASH',
      notes: payload.notes || 'via Kanban Add Card',
      created_by: user.id
    })
    .select('id')
    .single()

  if (saleErr) return { error: 'Gagal membuat card: ' + saleErr.message }

  revalidatePath('/sales/pipeline')
  return { success: true, saleId: sale.id }
}

export async function updateSalesCard(
  orgId: string,
  saleId: string,
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('customer_id')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (!sale) return { error: 'Card tidak ditemukan' }

  // Update contact
  await (supabase as any)
    .from('contacts')
    .update({
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
    })
    .eq('id', sale.customer_id)
    .eq('org_id', orgId)

  // Update sale
  const { error: saleErr } = await (supabase as any)
    .from('sales')
    .update({
      total_amount: payload.amount,
      grand_total: payload.amount,
      notes: payload.notes,
      status: payload.status,
    })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)

  if (saleErr) return { error: 'Gagal mengedit card: ' + saleErr.message }

  revalidatePath('/sales/pipeline')
  return { success: true }
}

export async function deleteSalesCard(orgId: string, saleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('sales')
    .delete()
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: 'Gagal menghapus card: ' + error.message }
  revalidatePath('/sales/pipeline')
  return { success: true }
}
