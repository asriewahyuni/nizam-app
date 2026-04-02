'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'

export async function processPosTransaction(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranch = await getActiveBranch(orgId)
  if (!activeBranch) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses transaksi POS.' }
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
    p_sale_id: sale.id
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
