'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBillingInvoice(orgId: string, item: { id: string, name: string, price: number, type: 'PACKAGE' | 'ADDON' }) {
  const supabase = await createClient()

  // 1. Cek apakah sudah ada invoice UNPAID untuk item ini di org ini (agar tidak double)
  const { data: existing } = await (supabase as any)
    .from('saas_invoices')
    .select('id, invoice_number, amount')
    .eq('org_id', orgId)
    .eq('package_id', item.type === 'PACKAGE' ? item.id : (null as any))
    .eq('status', 'UNPAID')
    .ilike('invoice_number', `%${item.id}%`) 
    .maybeSingle()

  if (existing) {
    return { success: true, invoiceNumber: (existing as any).invoice_number, amount: Number((existing as any).amount), message: 'Harap selesaikan pembayaran invoice sebelumnya.' }
  }

  // 2. Generate Concise Invoice Number (e.g., INV-8Q1V8X)
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  const invoiceNumber = `INV-${randomStr}`

  // 3. Insert Invoice
  const { data, error } = await (supabase as any)
    .from('saas_invoices')
    .insert({
      org_id: orgId,
      package_id: item.type === 'PACKAGE' ? item.id : null,
      item_name: item.name,
      invoice_number: invoiceNumber,
      amount: item.price,
      status: 'UNPAID',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
    } as any)
    .select()
    .single()

  if (error) {
    (console as any).error('Gagal membuat invoice SaaS:', error)
    return { error: 'Gagal membuat tagihan: ' + error.message }
  }

  revalidatePath('/billing')
  return { success: true, id: (data as any).id, invoiceNumber: (data as any).invoice_number, amount: Number((data as any).amount) }
}

export async function submitPaymentProof(orgId: string, invoiceId: string, proofUrl: string, method: string) {
  const supabase = await createClient()

  // 1. Fetch invoice info for activation
  const { data: inv } = await (supabase as any)
    .from('saas_invoices')
    .select('*, saas_packages(name)')
    .eq('id', invoiceId)
    .single()

  // 2. Update Invoice to PAID
  await (supabase as any).from('saas_invoices')
    .update({ 
      status: 'PAID',
      payment_method: method,
      payment_proof_url: proofUrl,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', invoiceId)

  // 3. Update Org Settings (Instant Upgrade for Demo)
  if ((inv as any)?.saas_packages && (inv as any).saas_packages.name) {
    await (supabase as any).from('organizations')
      .update({
        settings: {
          plan: (inv as any).saas_packages.name,
          updated_at: new Date().toISOString()
        } as any
      } as any)
      .eq('id', orgId)
  }

  revalidatePath('/billing')
  revalidatePath('/', 'layout') 
  return { success: true }
}

export async function applyVoucher(orgId: string, voucherCode: string) {
  const supabase = await createClient()

  // 1. Validasi Voucher
  const { data: voucher, error: vErr } = await (supabase as any)
    .from('saas_vouchers')
    .select('*, saas_packages(*)')
    .eq('code', voucherCode)
    .eq('is_active', true)
    .single()

  if (vErr || !voucher) {
    return { error: 'Voucher tidak ditemukan atau sudah tidak aktif.' }
  }

  // 2. Cek kuota dan masa berlaku
  if ((voucher as any).uses_count >= (voucher as any).max_uses) {
    return { error: 'Kuota voucher sudah habis.' }
  }

  if (new Date((voucher as any).expires_at) < new Date()) {
    return { error: 'Voucher sudah kedaluwarsa.' }
  }

  // 3. Ambil paket ABS (Default if not specified in voucher)
  let targetPackage = (voucher as any).saas_packages
  if (!targetPackage) {
    const { data: absPkg } = await (supabase as any)
      .from('saas_packages')
      .select('*')
      .eq('name', 'ABS Special')
      .maybeSingle()
    targetPackage = absPkg
  }

  if (!targetPackage) {
    return { error: 'Paket ABS Special belum tersedia di sistem.' }
  }

  // 4. Buat Invoice PAID Langsung (100% discount)
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  const invoiceNumber = `ABS-${randomStr}`

  const { error: invErr } = await (supabase as any)
    .from('saas_invoices')
    .insert({
      org_id: orgId,
      package_id: targetPackage.id,
      item_name: `Voucher: ${targetPackage.name}`,
      invoice_number: invoiceNumber,
      amount: 0,
      status: 'PAID',
      payment_method: 'VOUCHER',
      due_date: new Date().toISOString()
    } as any)

  if (invErr) {
    return { error: 'Gagal aktivasi: ' + invErr.message }
  }

  // 5. Update Org Settings
  await (supabase as any).from('organizations')
    .update({
      settings: {
        plan: targetPackage.name,
        updated_at: new Date().toISOString()
      } as any
    } as any)
    .eq('id', orgId)

  // 6. Increment Voucher Count
  await (supabase as any).from('saas_vouchers')
    .update({ uses_count: (voucher as any).uses_count + 1 } as any)
    .eq('id', (voucher as any).id)

  revalidatePath('/billing')
  revalidatePath('/', 'layout')
  return { success: true, message: `Berhasil! Paket ${targetPackage.name} telah aktif.` }
}
