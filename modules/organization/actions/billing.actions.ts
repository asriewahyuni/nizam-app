'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBillingInvoice(
  orgId: string,
  item: {
    id: string
    name: string
    price: number
    type: 'PACKAGE' | 'ADDON' | 'AI_TOKEN_TOPUP'
    topupPackageId?: string
    tokens?: number
  },
) {
  const supabase = await createClient()
  const invoiceKey = `${item.type}-${item.id}`
  const isPackage = item.type === 'PACKAGE'
  const isTopup = item.type === 'AI_TOKEN_TOPUP'

  // 1. Cek apakah sudah ada invoice UNPAID untuk item ini di org ini (agar tidak double)
  const { data: existing } = await (supabase as any)
    .from('saas_invoices')
    .select('id, invoice_number, amount')
    .eq('org_id', orgId)
    .eq('package_id', isPackage ? item.id : (null as any))
    .eq('status', 'UNPAID')
    .ilike('invoice_number', `%${invoiceKey}%`)
    .maybeSingle()

  if (existing) {
    return {
      success: true,
      id: (existing as any).id,
      invoiceNumber: (existing as any).invoice_number,
      amount: Number((existing as any).amount),
      message: 'Harap selesaikan pembayaran invoice sebelumnya.',
    }
  }

  // 2. Generate Concise Invoice Number
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  const prefix = isPackage ? 'PKG' : isTopup ? 'TOK' : 'ADD'
  const invoiceNumber = `INV-${prefix}-${invoiceKey}-${randomStr}`
  const itemName = isTopup && item.tokens
    ? `AI Token Topup: ${item.name} (${Number(item.tokens).toLocaleString('id-ID')} token)`
    : item.name

  // 3. Insert Invoice
  const { data, error } = await (supabase as any)
    .from('saas_invoices')
    .insert({
      org_id: orgId,
      package_id: isPackage ? item.id : null,
      item_name: itemName,
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

  if (isTopup) {
    if (!item.topupPackageId || !item.tokens) {
      return { error: 'Konfigurasi paket token tidak lengkap.' }
    }

    const { error: topupError } = await (supabase as any)
      .from('ai_token_topup_orders')
      .insert({
        org_id: orgId,
        package_id: item.topupPackageId,
        invoice_id: (data as any).id,
        status: 'PENDING',
        tokens: Math.max(1, Number(item.tokens)),
        price_idr: item.price,
      })

    if (topupError) {
      return { error: 'Tagihan dibuat, tetapi gagal membuat order topup token: ' + topupError.message }
    }
  }

  revalidatePath('/billing')
  revalidatePath('/', 'layout')
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

  const { data: topupOrder } = await (supabase as any)
    .from('ai_token_topup_orders')
    .select('*')
    .eq('invoice_id', invoiceId)
    .maybeSingle()

  // 2. Update Invoice to PAID
  await (supabase as any).from('saas_invoices')
    .update({ 
      status: 'PAID',
      payment_method: method,
      payment_proof_url: proofUrl,
      updated_at: new Date().toISOString()
    } as any)
    .eq('id', invoiceId)

  // 2.1 Apply token topup if invoice linked to ai_token_topup_orders
  if (topupOrder) {
    if ((topupOrder as any).status === 'PAID') {
      revalidatePath('/billing')
      revalidatePath('/', 'layout')
      return { success: true }
    }

    const tokenAmount = Number((topupOrder as any).tokens || 0)
    const { data: wallet } = await (supabase as any)
      .from('ai_token_wallets')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if ((wallet as any)?.org_id) {
      await (supabase as any)
        .from('ai_token_wallets')
        .update({
          balance_tokens: Number((wallet as any).balance_tokens || 0) + tokenAmount,
          total_purchased_tokens: Number((wallet as any).total_purchased_tokens || 0) + tokenAmount,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('org_id', orgId)
    } else {
      await (supabase as any)
        .from('ai_token_wallets')
        .insert({
          org_id: orgId,
          balance_tokens: tokenAmount,
          total_purchased_tokens: tokenAmount,
          total_used_tokens: 0,
        } as any)
    }

    await (supabase as any)
      .from('ai_token_usage_logs')
      .insert({
        org_id: orgId,
        source: 'topup',
        direction: 'CREDIT',
        tokens: tokenAmount,
        related_invoice_id: invoiceId,
        note: `Topup token AI dari invoice ${invoiceId}`,
        meta: { topup_order_id: (topupOrder as any).id, package_id: (topupOrder as any).package_id },
      } as any)

    await (supabase as any)
      .from('ai_token_topup_orders')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', (topupOrder as any).id)

    revalidatePath('/billing')
    revalidatePath('/', 'layout')
    return { success: true }
  }

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
