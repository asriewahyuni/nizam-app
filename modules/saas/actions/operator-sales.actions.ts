'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'

type OperatorSnapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string }>
  quotations: InvoiceRecord[]
  sales: InvoiceRecord[]
  summary: {
    totalQuotes: number
    totalOpenSales: number
    totalPaidSales: number
    totalSalesValue: number
  }
}

type InvoiceRecord = {
  id: string
  org_id: string
  package_id: string | null
  invoice_number: string
  item_name: string | null
  item_description: string | null
  amount: number
  status: string
  payment_method: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  organization?: { name: string } | null
  package?: { name: string } | null
}

type PackageLookup = {
  name: string
  price: number
}

async function assertPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error('Akses ditolak. Modul ini khusus pengelola SaaS.')
  }
  return user
}

function buildQuoteNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QTN-SAAS-${Date.now()}-${rand}`
}

function buildSalesNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `INV-SAAS-${Date.now()}-${rand}`
}

export async function getOperatorSaasSnapshot(): Promise<OperatorSnapshot> {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  const [orgRes, pkgRes, invoiceRes] = await Promise.all([
    admin.from('organizations').select('id, name').order('name', { ascending: true }),
    admin.from('saas_packages').select('id, name, price, billing').eq('is_active', true).order('price', { ascending: true }),
    admin
      .from('saas_invoices')
      .select('id, org_id, package_id, invoice_number, item_name, item_description, amount, status, payment_method, due_date, created_at, updated_at, organization:organizations(name), package:saas_packages(name)')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const orgRows = (orgRes.data || []) as Array<{ id: string; name: string }>
  const packageRows = (pkgRes.data || []) as Array<{ id: string; name: string; price: number | string; billing?: string | null }>
  const invoiceRows = (invoiceRes.data || []) as Array<{
    id: string
    org_id: string
    package_id: string | null
    invoice_number: string
    item_name: string | null
    item_description: string | null
    amount: number | string
    status: string
    payment_method: string | null
    due_date: string | null
    created_at: string
    updated_at: string
    organization?: { name: string } | null
    package?: { name: string } | null
  }>

  const orgs = orgRows.map((org) => ({ id: org.id, name: org.name }))
  const packages = packageRows.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    price: Number(pkg.price || 0),
    billing: pkg.billing || undefined,
  }))

  const invoices: InvoiceRecord[] = invoiceRows.map((inv) => ({
    ...inv,
    amount: Number(inv.amount || 0),
  }))

  const quotations = invoices.filter((inv) => String(inv.invoice_number || '').startsWith('QTN-SAAS-'))
  const sales = invoices.filter((inv) => !String(inv.invoice_number || '').startsWith('QTN-SAAS-'))

  const summary = {
    totalQuotes: quotations.length,
    totalOpenSales: sales.filter((inv) => inv.status !== 'PAID').length,
    totalPaidSales: sales.filter((inv) => inv.status === 'PAID').length,
    totalSalesValue: sales.reduce((acc, inv) => acc + Number(inv.amount || 0), 0),
  }

  return { orgs, packages, quotations, sales, summary }
}

export async function createOperatorQuotation(formData: FormData) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  const orgId = String(formData.get('org_id') || '')
  const packageId = String(formData.get('package_id') || '')
  const note = String(formData.get('note') || '').trim()
  const customAmountRaw = String(formData.get('amount') || '').trim()

  if (!orgId || !packageId) {
    return { error: 'Organisasi dan paket wajib dipilih.' }
  }

  const { data: pkgData } = await admin.from('saas_packages').select('name, price').eq('id', packageId).maybeSingle()
  const pkg = pkgData as PackageLookup | null
  if (!pkg) {
    return { error: 'Paket SaaS tidak ditemukan.' }
  }

  const amount = Number(customAmountRaw || pkg.price || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Nominal penawaran tidak valid.' }
  }

  const invoiceNumber = buildQuoteNumber()
  const { error } = await admin.from('saas_invoices').insert({
    org_id: orgId,
    package_id: packageId,
    item_name: `Penawaran SaaS: ${pkg.name}`,
    item_description: note || 'Penawaran dibuat oleh operator SaaS',
    invoice_number: invoiceNumber,
    amount,
    status: 'UNPAID',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (error) {
    return { error: `Gagal membuat penawaran: ${error.message}` }
  }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  return { success: true, invoiceNumber }
}

export async function convertQuotationToSale(invoiceId: string) {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penawaran tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, invoice_number')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'invoice_number'> | null

  if (!invoice) return { error: 'Data penawaran tidak ditemukan.' }
  if (!String(invoice.invoice_number).startsWith('QTN-SAAS-')) {
    return { error: 'Data ini bukan penawaran yang bisa dikonversi.' }
  }

  const { error } = await admin
    .from('saas_invoices')
    .update({
      invoice_number: buildSalesNumber(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) return { error: `Gagal konversi penawaran: ${error.message}` }

  revalidatePath('/saas/penawaran')
  revalidatePath('/saas/penjualan')
  return { success: true }
}

export async function markOperatorSalePaid(invoiceId: string, paymentMethod: string = 'MANUAL_TRANSFER') {
  await assertPlatformAdmin()
  const admin = await createAdminClient()

  if (!invoiceId) return { error: 'Invoice penjualan tidak valid.' }

  const { data: invoiceData } = await admin
    .from('saas_invoices')
    .select('id, org_id, package_id, status')
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invoiceData as Pick<InvoiceRecord, 'id' | 'org_id' | 'package_id' | 'status'> | null

  if (!invoice) return { error: 'Data penjualan tidak ditemukan.' }
  if (invoice.status === 'PAID') return { success: true }

  const { error: invoiceUpdateError } = await admin
    .from('saas_invoices')
    .update({
      status: 'PAID',
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (invoiceUpdateError) {
    return { error: `Gagal update status pembayaran: ${invoiceUpdateError.message}` }
  }

  if (invoice.package_id) {
    const [{ data: pkgData }, { data: orgData }] = await Promise.all([
      admin.from('saas_packages').select('name').eq('id', invoice.package_id).maybeSingle(),
      admin.from('organizations').select('settings').eq('id', invoice.org_id).maybeSingle(),
    ])
    const pkg = pkgData as { name: string } | null
    const org = orgData as { settings?: Record<string, unknown> | null } | null

    if (pkg?.name) {
      const currentSettings = (org?.settings && typeof org.settings === 'object') ? org.settings : {}
      await admin
        .from('organizations')
        .update({
          settings: {
            ...currentSettings,
            plan: pkg.name,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', invoice.org_id)
    }
  }

  revalidatePath('/saas/penjualan')
  revalidatePath('/billing')
  revalidatePath('/', 'layout')
  return { success: true }
}
