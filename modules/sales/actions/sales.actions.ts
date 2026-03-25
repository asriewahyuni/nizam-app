'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSales(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales' as any)
    .select('*, contacts(name), sales_items(*, products(name, sku)), sales_returns(status, grand_total, return_number), sales_payments(amount, discount_amount)' as any)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function createSaleEntry(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales' as any)
    .insert({
      org_id: orgId,
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

  const { error: linesErr } = await supabase
    .from('sales_items' as any)
    .insert(payload.lines.map((l: any) => ({
      org_id: orgId,
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
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: linesErr.message }
  }

  // Insert to approval flow
  const computedTotal = payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0) - (payload.discount_amount || 0) + (payload.tax_amount || 0)
  await supabase.from('approval_requests' as any).insert({
    org_id: orgId,
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
  const { data: sale } = await supabase.from('sales' as any).select('status').eq('id', saleId).single()
  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'FINISHED') return { success: true }

  const { error } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: saleId
  })

  if (error) {
    console.error('Failed to deliver sale via atomic engine:', error)
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

  // 1. Check current status — only DRAFT or FINISHED can be voided
  const { data: sale } = await supabase
    .from('sales' as any)
    .select('status')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .single()

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'VOIDED') return { success: true }

  // 2. Void related journal entry (find by reference)
  const { data: journalEntry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_id', saleId)
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .maybeSingle()

  if (journalEntry) {
    await supabase
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
  await supabase.from('sales' as any).update({ status: 'VOIDED' }).eq('id', saleId).eq('org_id', orgId)

  // 5. Cancel any pending approval requests for this order
  await supabase
    .from('approval_requests')
    .update({ status: 'VOIDED', reason: 'Sales Order Dibatalkan', decided_at: new Date().toISOString() })
    .eq('source_type', 'SALES_ORDER')
    .eq('source_id', saleId)
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
  await supabase.from('sales' as any).update({ payment_status: 'PAID' }).eq('id', saleId).eq('org_id', orgId)
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

export async function getQuotations(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sales' as any)
    .select('*, contacts(name), sales_items(*, products(name, sku))' as any)
    .eq('org_id', orgId)
    .eq('status', 'QUOTATION')
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function createQuotation(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const total = payload.lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)
  const grandTotal = total - (payload.discount_amount || 0) + (payload.tax_amount || 0)

  const { data: quote, error: quoteErr } = await supabase
    .from('sales' as any)
    .insert({
      org_id: orgId,
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

  const { error: linesErr } = await supabase
    .from('sales_items' as any)
    .insert(payload.lines.map((l: any) => ({
      org_id: orgId,
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
  const { error } = await supabase
    .from('sales' as any)
    .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/quotations')
  revalidatePath('/sales')
  return { success: true }
}

export async function updateSaleStatus(orgId: string, saleId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sales' as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/pipeline')
  revalidatePath('/sales')
  return { success: true }
}
