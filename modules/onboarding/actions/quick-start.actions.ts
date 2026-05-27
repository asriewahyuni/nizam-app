'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickStartAlert = {
  type: 'warning' | 'info' | 'success'
  message: string
  href: string
  cta: string
}

export type QuickStartStep = {
  id: string
  label: string
  description: string
  href: string
  done: boolean
}

export type QuickStartData = {
  orgName: string
  userName: string
  alerts: QuickStartAlert[]
  steps: QuickStartStep[]
  allDone: boolean
}

// ─── Main Action ──────────────────────────────────────────────────────────────

export async function getQuickStartData(): Promise<QuickStartData | null> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return null

  const supabase = await createClient()
  const db = supabase as any
  const orgId = orgData.org.id
  const branch = await getActiveBranch(orgId)
  const branchId = branch?.id ?? null
  const userName = (orgData.user?.user_metadata?.full_name as string | undefined) || orgData.user?.email?.split('@')[0] || 'Kamu'

  // ─── Paralel query semua data yang dibutuhkan ──────────────────────────────
  const [
    { count: customerCount },
    { count: supplierCount },
    { count: productCount },
    { count: saleCount },
    { count: unpaidSaleCount },
    { count: unpaidPurchaseCount },
    { count: draftJournalCount },
    { data: orgRow },
    { data: bankAccounts },
    { data: openingArSales },
  ] = await Promise.all([
    db.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('type', 'CUSTOMER'),
    db.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('type', 'SUPPLIER'),
    db.from('products').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    db.from('sales').select('*', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'DRAFT').neq('status', 'VOIDED'),
    db.from('sales').select('*', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'DRAFT').neq('status', 'VOIDED').eq('payment_status', 'UNPAID'),
    db.from('purchases').select('*', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'DRAFT').neq('status', 'VOIDED').eq('payment_status', 'UNPAID'),
    db.from('journal_entries').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'DRAFT'),
    db.from('organizations').select('name, address, logo_url').eq('id', orgId).maybeSingle(),
    db.from('bank_accounts').select('id').eq('org_id', orgId).limit(1),
    db.from('sales').select('id').eq('org_id', orgId).like('notes', '%AUTO_MIGRATION_OPENING_AR%').limit(1),
  ])

  const hasProfile = Boolean(orgRow?.address)
  const hasCustomer = (customerCount || 0) > 0
  const hasProduct = (productCount || 0) > 0
  const hasCash = Array.isArray(bankAccounts) && bankAccounts.length > 0
  const hasSale = (saleCount || 0) > 0
  const hasOpeningAr = Array.isArray(openingArSales) && openingArSales.length > 0
  const unpaidSales = unpaidSaleCount || 0
  const unpaidPurchases = unpaidPurchaseCount || 0
  const draftJournals = draftJournalCount || 0

  // ─── Steps ────────────────────────────────────────────────────────────────
  const steps: QuickStartStep[] = [
    {
      id: 'profile',
      label: 'Perkenalkan bisnis kamu',
      description: 'Isi nama, alamat, dan logo usaha agar tampil di dokumen dan invoice.',
      href: '/settings/business',
      done: hasProfile,
    },
    {
      id: 'customer',
      label: 'Tambah pelanggan pertama',
      description: 'Siapa yang akan membeli dari kamu? Tambah minimal satu pelanggan.',
      href: '/contacts?type=CUSTOMER',
      done: hasCustomer,
    },
    {
      id: 'product',
      label: 'Tambah produk atau layanan',
      description: 'Apa yang kamu jual? Tambah produk atau jasa yang ditawarkan.',
      href: '/inventory/products',
      done: hasProduct,
    },
    {
      id: 'cash',
      label: 'Masukkan saldo kas sekarang',
      description: 'Berapa uang kamu saat ini? Ini jadi titik awal laporan keuangan.',
      href: '/settings/migration',
      done: hasCash,
    },
    {
      id: 'sale',
      label: 'Buat penjualan pertama',
      description: 'Coba catat satu transaksi penjualan — lihat betapa mudahnya.',
      href: '/sales/new',
      done: hasSale,
    },
    {
      id: 'report',
      label: 'Lihat laporan pertama kamu',
      description: 'Buka laporan laba rugi dan lihat kondisi keuangan bisnis kamu.',
      href: '/reports/profit-loss',
      done: hasSale, // bisa dilihat setelah ada transaksi
    },
  ]

  const allDone = steps.every(s => s.done)

  // ─── Alerts dinamis ───────────────────────────────────────────────────────
  const alerts: QuickStartAlert[] = []

  if (unpaidSales > 0) {
    alerts.push({
      type: 'warning',
      message: `${unpaidSales} tagihan pelanggan belum dibayar`,
      href: '/accounting/aging',
      cta: 'Cek Piutang',
    })
  }

  if (unpaidPurchases > 0) {
    alerts.push({
      type: 'warning',
      message: `${unpaidPurchases} tagihan supplier belum dilunasi`,
      href: '/accounting/aging',
      cta: 'Cek Hutang',
    })
  }

  if (draftJournals > 0) {
    alerts.push({
      type: 'info',
      message: `${draftJournals} jurnal keuangan menunggu diposting`,
      href: '/accounting/journal',
      cta: 'Buka Jurnal',
    })
  }

  if (alerts.length === 0 && allDone) {
    alerts.push({
      type: 'success',
      message: 'Semua berjalan baik hari ini',
      href: '/dashboard',
      cta: 'Lihat Dashboard',
    })
  }

  return {
    orgName: orgRow?.name || orgData.org.name || 'Bisnis Kamu',
    userName,
    alerts,
    steps,
    allDone,
  }
}
