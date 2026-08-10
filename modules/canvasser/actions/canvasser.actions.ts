'use server'

// Server actions untuk modul Canvasser (sales lapangan / distribusi van).
// Terhubung ke slot modul 'Mobile Canvassing' yang sudah ada (/sales/co-sales).

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { formatRupiah } from '@/lib/utils'
import type {
  CanvasserVan,
  CanvasserSession,
  CanvasserVisit,
  CanvasserOrder,
  CanvasserOrderItem,
  CanvasserARCollection,
  ContactARSummary,
  ARStatus,
  PaymentMethod,
  StockItem,
  CanvasserTodayDashboard,
  CanvasserDashboardVan,
} from '@/modules/canvasser/lib/canvasser-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveBranch(orgId: string, branchId?: string | null) {
  const sel = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in sel) return { error: sel.error || 'Akses unit tidak valid.' }
  return { branchId: sel.branchId }
}

async function requireBranch(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const sel = await resolveBranch(orgId)
  if ('error' in sel || !sel.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk operasional canvasser.' }
  }
  return { branchId: sel.branchId as string }
}

function generateOrderNumber(): string {
  const now = new Date()
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 900) + 100
  return `CO/${yyyymmdd}/${rand}`
}

function computeARStatus(outstanding: number, creditLimit: number): ARStatus {
  if (creditLimit <= 0) {
    return outstanding > 0 ? 'MENDEKATI_LIMIT' : 'NORMAL'
  }
  if (outstanding >= creditLimit) return 'BLOKIR'
  if (outstanding >= creditLimit * 0.8) return 'MENDEKATI_LIMIT'
  return 'NORMAL'
}

function mapVan(r: Record<string, unknown>): CanvasserVan {
  return {
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    branchId: r.branch_id ? String(r.branch_id) : null,
    code: String(r.code || ''),
    name: String(r.name || ''),
    plateNumber: r.plate_number ? String(r.plate_number) : null,
    driverName: String(r.driver_name || ''),
    driverPhone: r.driver_phone ? String(r.driver_phone) : null,
    fixedAssetId: r.fixed_asset_id ? String(r.fixed_asset_id) : null,
    isActive: Boolean(r.is_active),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }
}

function mapSession(r: Record<string, unknown>): CanvasserSession {
  return {
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    vanId: String(r.van_id || ''),
    sessionDate: String(r.session_date || ''),
    status: (String(r.status || 'AKTIF') as CanvasserSession['status']),
    openingStock: (r.opening_stock as StockItem[]) || [],
    closingStock: (r.closing_stock as StockItem[] | null) || null,
    totalCashCollected: Number(r.total_cash_collected || 0),
    totalArCollected: Number(r.total_ar_collected || 0),
    totalSales: Number(r.total_sales || 0),
    closingJournalEntryId: r.closing_journal_entry_id ? String(r.closing_journal_entry_id) : null,
    notes: r.notes ? String(r.notes) : null,
    closedAt: r.closed_at ? String(r.closed_at) : null,
    createdAt: String(r.created_at || ''),
  }
}

function mapVisit(r: Record<string, unknown>): CanvasserVisit {
  return {
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    sessionId: String(r.session_id || ''),
    contactId: r.contact_id ? String(r.contact_id) : null,
    visitOrder: Number(r.visit_order || 0),
    contactName: String(r.contact_name || ''),
    address: r.address ? String(r.address) : null,
    status: (String(r.status || 'BELUM') as CanvasserVisit['status']),
    arOutstanding: Number(r.ar_outstanding || 0),
    creditLimit: Number(r.credit_limit || 0),
    arStatus: (String(r.ar_status || 'NORMAL') as ARStatus),
    arrivedAt: r.arrived_at ? String(r.arrived_at) : null,
    departedAt: r.departed_at ? String(r.departed_at) : null,
    gpsLat: r.gps_lat !== null && r.gps_lat !== undefined ? Number(r.gps_lat) : null,
    gpsLng: r.gps_lng !== null && r.gps_lng !== undefined ? Number(r.gps_lng) : null,
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
  }
}

function mapOrder(r: Record<string, unknown>): CanvasserOrder {
  return {
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    sessionId: String(r.session_id || ''),
    visitId: String(r.visit_id || ''),
    contactId: r.contact_id ? String(r.contact_id) : null,
    orderNumber: String(r.order_number || ''),
    paymentMethod: (String(r.payment_method || 'TUNAI') as PaymentMethod),
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    total: Number(r.total || 0),
    status: (String(r.status || 'SELESAI') as CanvasserOrder['status']),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
  }
}

function mapOrderItem(r: Record<string, unknown>): CanvasserOrderItem {
  return {
    id: String(r.id || ''),
    orderId: String(r.order_id || ''),
    productId: r.product_id ? String(r.product_id) : null,
    productName: String(r.product_name || ''),
    qty: Number(r.qty || 0),
    unit: String(r.unit || 'pcs'),
    unitPrice: Number(r.unit_price || 0),
    subtotal: Number(r.subtotal || 0),
  }
}

function mapARCollection(r: Record<string, unknown>): CanvasserARCollection {
  return {
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    sessionId: String(r.session_id || ''),
    visitId: String(r.visit_id || ''),
    contactId: String(r.contact_id || ''),
    amount: Number(r.amount || 0),
    paymentMethod: (String(r.payment_method || 'TUNAI') as PaymentMethod),
    referenceNo: r.reference_no ? String(r.reference_no) : null,
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
  }
}

// ── Van Management ────────────────────────────────────────────────────────────

export async function getCanvasserVans(orgId: string): Promise<CanvasserVan[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('canvasser_vans')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('code', { ascending: true })
  if (error) { console.error('getCanvasserVans:', error); return [] }
  return (data || []).map(mapVan)
}

export async function createCanvasserVan(orgId: string, payload: {
  code: string
  name: string
  driver_name: string
  plate_number?: string
  driver_phone?: string
  fixed_asset_id?: string
  notes?: string
}): Promise<{ data?: CanvasserVan; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branch = await requireBranch(orgId)
  if ('error' in branch) return { error: branch.error }

  const { data, error } = await db
    .from('canvasser_vans')
    .insert({
      org_id: orgId,
      branch_id: branch.branchId,
      code: payload.code,
      name: payload.name,
      driver_name: payload.driver_name,
      plate_number: payload.plate_number || null,
      driver_phone: payload.driver_phone || null,
      fixed_asset_id: payload.fixed_asset_id || null,
      notes: payload.notes || null,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return { data: mapVan(data as Record<string, unknown>) }
}

export async function updateCanvasserVan(orgId: string, vanId: string, payload: Partial<{
  name: string
  driver_name: string
  plate_number: string
  driver_phone: string
  is_active: boolean
  notes: string
}>): Promise<{ data?: CanvasserVan; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data, error } = await db
    .from('canvasser_vans')
    .update(payload)
    .eq('id', vanId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return { data: mapVan(data as Record<string, unknown>) }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getTodaySession(orgId: string, vanId: string): Promise<CanvasserSession | null> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('canvasser_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('van_id', vanId)
    .eq('session_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapSession(data as Record<string, unknown>)
}

export async function createSession(orgId: string, payload: {
  van_id: string
  opening_stock: StockItem[]
}): Promise<{ data?: CanvasserSession; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const existing = await getTodaySession(orgId, payload.van_id)
  if (existing && existing.status === 'AKTIF') {
    return { error: 'Van ini sudah punya sesi AKTIF hari ini.' }
  }

  const { data, error } = await db
    .from('canvasser_sessions')
    .insert({
      org_id: orgId,
      van_id: payload.van_id,
      opening_stock: payload.opening_stock,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return { data: mapSession(data as Record<string, unknown>) }
}

export async function closeSession(orgId: string, sessionId: string, payload: {
  closing_stock: StockItem[]
  notes?: string
}): Promise<{ data?: CanvasserSession; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data: sessionRow, error: sessionErr } = await db
    .from('canvasser_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (sessionErr || !sessionRow) return { error: 'Sesi tidak ditemukan.' }
  const session = sessionRow as Record<string, unknown>
  if (String(session.status) === 'SELESAI') return { error: 'Sesi ini sudah ditutup.' }

  const { data: orderRows, error: orderErr } = await db
    .from('canvasser_orders')
    .select('payment_method, total, status')
    .eq('session_id', sessionId)
    .eq('status', 'SELESAI')
  if (orderErr) return { error: orderErr.message }

  const orders = (orderRows || []) as Record<string, unknown>[]
  const cashSales = orders.filter(o => o.payment_method === 'TUNAI' || o.payment_method === 'TRANSFER')
    .reduce((s, o) => s + Number(o.total || 0), 0)
  const creditSales = orders.filter(o => o.payment_method === 'KREDIT')
    .reduce((s, o) => s + Number(o.total || 0), 0)
  const totalSales = cashSales + creditSales

  const { data: arRows, error: arErr } = await db
    .from('canvasser_ar_collections')
    .select('amount')
    .eq('session_id', sessionId)
  if (arErr) return { error: arErr.message }
  const arCollected = ((arRows || []) as Record<string, unknown>[]).reduce((s, r) => s + Number(r.amount || 0), 0)

  // Susun jurnal penutupan sesi — hanya jika ada nilai untuk dijurnal.
  let closingJournalEntryId: string | null = null
  if (totalSales > 0 || arCollected > 0) {
    const [kasId, piutangId, pendapatanId] = await Promise.all([
      ERPBridge.getDefaultAccount(orgId, '1101'),
      ERPBridge.getDefaultAccount(orgId, '1201'),
      ERPBridge.getDefaultAccount(orgId, '4001'),
    ])
    if (!kasId) return { error: 'Akun Kas (1101) tidak ditemukan. Periksa COA.' }
    if (creditSales > 0 && !piutangId) return { error: 'Akun Piutang Usaha (1201) tidak ditemukan. Periksa COA.' }
    if (totalSales > 0 && !pendapatanId) return { error: 'Akun Pendapatan Penjualan (4001) tidak ditemukan. Periksa COA.' }
    if (arCollected > 0 && !piutangId) return { error: 'Akun Piutang Usaha (1201) tidak ditemukan. Periksa COA.' }

    const lines: { account_id: string; debit: number; credit: number; memo: string }[] = []
    const kasDebit = cashSales + arCollected
    if (kasDebit > 0) lines.push({ account_id: kasId, debit: kasDebit, credit: 0, memo: 'Kas dari penjualan tunai + tagihan AR' })
    if (creditSales > 0 && piutangId) lines.push({ account_id: piutangId, debit: creditSales, credit: 0, memo: 'Penjualan kredit canvasser' })
    if (totalSales > 0 && pendapatanId) lines.push({ account_id: pendapatanId, debit: 0, credit: totalSales, memo: 'Pendapatan penjualan canvasser' })
    if (arCollected > 0 && piutangId) lines.push({ account_id: piutangId, debit: 0, credit: arCollected, memo: 'Pelunasan piutang oleh canvasser' })

    if (lines.length >= 2) {
      const van = await db.from('canvasser_vans').select('name').eq('id', String(session.van_id)).maybeSingle()
      const vanName = String((van.data as Record<string, unknown> | null)?.name || 'Van')
      const journalResult = await createJournalEntry({
        org_id: orgId,
        branch_id: (session.branch_id as string) ?? undefined,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Setoran Canvasser ${vanName} — ${session.session_date}`,
        reference_type: 'CANVASSER_SESSION_CLOSE',
        reference_id: sessionId,
        auto_post: true,
        lines,
      })
      if ((journalResult as { error?: string }).error) {
        return { error: `Gagal mencatat jurnal setoran: ${(journalResult as { error?: string }).error}` }
      }
      closingJournalEntryId = (journalResult as { entryId?: string }).entryId ?? null
    }
  }

  const { data: updated, error: updateError } = await db
    .from('canvasser_sessions')
    .update({
      status: 'SELESAI',
      closing_stock: payload.closing_stock,
      total_cash_collected: cashSales,
      total_ar_collected: arCollected,
      total_sales: totalSales,
      closing_journal_entry_id: closingJournalEntryId,
      notes: payload.notes ?? session.notes ?? null,
      closed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError) return { error: updateError.message }
  revalidatePath('/sales/co-sales')
  revalidatePath('/accounting/journal')
  return { data: mapSession(updated as Record<string, unknown>) }
}

// ── Visits ────────────────────────────────────────────────────────────────────

export async function getSessionVisits(orgId: string, sessionId: string): Promise<CanvasserVisit[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data: visitRows, error } = await db
    .from('canvasser_visits')
    .select('*')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .order('visit_order', { ascending: true })
  if (error) { console.error('getSessionVisits:', error); return [] }

  const visits = (visitRows || []).map(mapVisit)
  if (visits.length === 0) return visits

  const [ordersRes, collectionsRes] = await Promise.all([
    db.from('canvasser_orders').select('*, items:canvasser_order_items(*)').eq('session_id', sessionId),
    db.from('canvasser_ar_collections').select('*').eq('session_id', sessionId),
  ])

  const ordersByVisit = new Map<string, CanvasserOrder[]>()
  for (const row of (ordersRes.data || []) as Record<string, unknown>[]) {
    const order = mapOrder(row)
    order.items = ((row.items as Record<string, unknown>[]) || []).map(mapOrderItem)
    const list = ordersByVisit.get(order.visitId) || []
    list.push(order)
    ordersByVisit.set(order.visitId, list)
  }

  const collectionsByVisit = new Map<string, CanvasserARCollection[]>()
  for (const row of (collectionsRes.data || []) as Record<string, unknown>[]) {
    const collection = mapARCollection(row)
    const list = collectionsByVisit.get(collection.visitId) || []
    list.push(collection)
    collectionsByVisit.set(collection.visitId, list)
  }

  return visits.map((v: CanvasserVisit) => ({
    ...v,
    orders: ordersByVisit.get(v.id) || [],
    arCollections: collectionsByVisit.get(v.id) || [],
  }))
}

export async function addVisit(orgId: string, sessionId: string, payload: {
  contact_id: string
  visit_order: number
  address?: string
}): Promise<{ data?: CanvasserVisit; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, name, credit_limit')
    .eq('id', payload.contact_id)
    .eq('org_id', orgId)
    .maybeSingle()
  if (contactErr || !contact) return { error: 'Pelanggan tidak ditemukan.' }
  const contactRec = contact as Record<string, unknown>
  const creditLimit = Number(contactRec.credit_limit || 0)

  const summary = await getContactARSummary(orgId, payload.contact_id)
  const arStatus = computeARStatus(summary.outstandingTotal, creditLimit)

  const { data, error } = await db
    .from('canvasser_visits')
    .insert({
      org_id: orgId,
      session_id: sessionId,
      contact_id: payload.contact_id,
      visit_order: payload.visit_order,
      contact_name: String(contactRec.name || ''),
      address: payload.address || null,
      ar_outstanding: summary.outstandingTotal,
      credit_limit: creditLimit,
      ar_status: arStatus,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return { data: mapVisit(data as Record<string, unknown>) }
}

export async function updateVisitStatus(orgId: string, visitId: string,
  status: CanvasserVisit['status'], gps?: { lat: number; lng: number }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const updates: Record<string, unknown> = { status }
  if (status === 'DALAM_PERJALANAN') updates.arrived_at = new Date().toISOString()
  if (status === 'SELESAI' || status === 'SKIP') updates.departed_at = new Date().toISOString()
  if (gps) { updates.gps_lat = gps.lat; updates.gps_lng = gps.lng }

  const { error } = await db
    .from('canvasser_visits')
    .update(updates)
    .eq('id', visitId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return {}
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function createOrder(orgId: string, payload: {
  session_id: string
  visit_id: string
  contact_id: string
  payment_method: PaymentMethod
  items: { product_id: string; qty: number; unit_price: number }[]
  notes?: string
}): Promise<{ data?: CanvasserOrder; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  if (payload.items.length === 0) return { error: 'Order minimal punya 1 item.' }

  const { data: visitRow, error: visitErr } = await db
    .from('canvasser_visits')
    .select('ar_status')
    .eq('id', payload.visit_id)
    .eq('org_id', orgId)
    .maybeSingle()
  if (visitErr || !visitRow) return { error: 'Kunjungan tidak ditemukan.' }

  if (payload.payment_method === 'KREDIT' && String((visitRow as Record<string, unknown>).ar_status) === 'BLOKIR') {
    return { error: 'Customer ini diblokir karena melebihi credit limit. Hanya transaksi TUNAI atau TRANSFER yang diizinkan.' }
  }

  const productIds = payload.items.map(i => i.product_id)
  const { data: productRows, error: productErr } = await db
    .from('products')
    .select('id, name, unit, selling_price')
    .eq('org_id', orgId)
    .in('id', productIds)
  if (productErr) return { error: productErr.message }
  const productsById = new Map(((productRows || []) as Record<string, unknown>[]).map(p => [String(p.id), p]))

  for (const item of payload.items) {
    const product = productsById.get(item.product_id)
    if (!product) return { error: 'Produk tidak ditemukan.' }
    const sellingPrice = Number((product as Record<string, unknown>).selling_price || 0)
    if (Math.abs(item.unit_price - sellingPrice) > 0.01) {
      return { error: `Harga produk "${(product as Record<string, unknown>).name}" tidak sesuai price list. Harga HQ: ${formatRupiah(sellingPrice)}` }
    }
  }

  const orderItems = payload.items.map(item => {
    const product = productsById.get(item.product_id) as Record<string, unknown>
    const subtotal = item.qty * item.unit_price
    return {
      product_id: item.product_id,
      product_name: String(product.name || ''),
      qty: item.qty,
      unit: String(product.unit || 'pcs'),
      unit_price: item.unit_price,
      subtotal,
    }
  })
  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)

  const { data: order, error: orderError } = await db
    .from('canvasser_orders')
    .insert({
      org_id: orgId,
      session_id: payload.session_id,
      visit_id: payload.visit_id,
      contact_id: payload.contact_id,
      order_number: generateOrderNumber(),
      payment_method: payload.payment_method,
      subtotal,
      discount: 0,
      total: subtotal,
      notes: payload.notes || null,
    })
    .select('*')
    .single()

  if (orderError) return { error: orderError.message }
  const orderId = (order as Record<string, unknown>).id as string

  const { error: itemsError } = await db
    .from('canvasser_order_items')
    .insert(orderItems.map(i => ({ ...i, order_id: orderId })))

  if (itemsError) {
    await db.from('canvasser_orders').delete().eq('id', orderId)
    return { error: 'Gagal menyimpan item order.' }
  }

  revalidatePath('/sales/co-sales')
  return { data: mapOrder(order as Record<string, unknown>) }
}

export async function cancelOrder(orgId: string, orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { error } = await db
    .from('canvasser_orders')
    .update({ status: 'BATAL' })
    .eq('id', orderId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return {}
}

// ── AR Collection ─────────────────────────────────────────────────────────────

export async function recordARCollection(orgId: string, payload: {
  session_id: string
  visit_id: string
  contact_id: string
  amount: number
  payment_method: PaymentMethod
  reference_no?: string
  notes?: string
}): Promise<{ data?: CanvasserARCollection; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  if (payload.amount <= 0) return { error: 'Jumlah pembayaran harus lebih dari 0.' }

  const { data, error } = await db
    .from('canvasser_ar_collections')
    .insert({
      org_id: orgId,
      session_id: payload.session_id,
      visit_id: payload.visit_id,
      contact_id: payload.contact_id,
      amount: payload.amount,
      payment_method: payload.payment_method,
      reference_no: payload.reference_no || null,
      notes: payload.notes || null,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  // Pencatatan ke journal/AR dilakukan saat session ditutup (closeSession)
  // agar tidak ada partial posting.
  revalidatePath('/sales/co-sales')
  return { data: mapARCollection(data as Record<string, unknown>) }
}

// ── AR Summary ─────────────────────────────────────────────────────────────────

export async function getContactARSummary(orgId: string, contactId: string): Promise<ContactARSummary> {
  const { queryPostgres } = await import('@/lib/db/postgres')

  const res = await queryPostgres<Record<string, unknown>>(
    `SELECT
       c.id, c.name, c.credit_limit,
       COALESCE(SUM(s.grand_total - COALESCE(sp.total_paid, 0) - COALESCE(sr.total_returned, 0)), 0) AS outstanding,
       COALESCE(SUM(CASE WHEN s.due_date IS NULL OR s.due_date >= CURRENT_DATE
         THEN s.grand_total - COALESCE(sp.total_paid, 0) - COALESCE(sr.total_returned, 0) ELSE 0 END), 0) AS overdue_30,
       COALESCE(SUM(CASE WHEN s.due_date < CURRENT_DATE AND s.due_date >= CURRENT_DATE - INTERVAL '60 days'
         THEN s.grand_total - COALESCE(sp.total_paid, 0) - COALESCE(sr.total_returned, 0) ELSE 0 END), 0) AS overdue_60,
       COALESCE(SUM(CASE WHEN s.due_date < CURRENT_DATE - INTERVAL '60 days'
         THEN s.grand_total - COALESCE(sp.total_paid, 0) - COALESCE(sr.total_returned, 0) ELSE 0 END), 0) AS overdue_90plus,
       MAX(sp.last_payment_date) AS last_payment_date
     FROM contacts c
     LEFT JOIN sales s
       ON s.customer_id = c.id AND s.org_id = c.org_id
       AND s.status != 'VOIDED' AND s.payment_status != 'PAID'
     LEFT JOIN LATERAL (
       SELECT SUM(amount + discount_amount) AS total_paid, MAX(payment_date) AS last_payment_date
       FROM sales_payments WHERE sale_id = s.id
     ) sp ON true
     LEFT JOIN LATERAL (
       SELECT SUM(grand_total) AS total_returned FROM sales_returns WHERE sale_id = s.id
     ) sr ON true
     WHERE c.id = $1 AND c.org_id = $2
     GROUP BY c.id, c.name, c.credit_limit`,
    [contactId, orgId]
  )

  const row = res.rows[0]
  if (!row) {
    return {
      contactId, contactName: '', creditLimit: 0, outstandingTotal: 0,
      overdue30: 0, overdue60: 0, overdue90Plus: 0, arStatus: 'NORMAL', lastPaymentDate: null,
    }
  }

  const creditLimit = Number(row.credit_limit || 0)
  const outstandingTotal = Number(row.outstanding || 0)

  return {
    contactId: String(row.id),
    contactName: String(row.name || ''),
    creditLimit,
    outstandingTotal,
    overdue30: Number(row.overdue_30 || 0),
    overdue60: Number(row.overdue_60 || 0),
    overdue90Plus: Number(row.overdue_90plus || 0),
    arStatus: computeARStatus(outstandingTotal, creditLimit),
    lastPaymentDate: row.last_payment_date ? String(row.last_payment_date) : null,
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getTodayDashboard(orgId: string): Promise<CanvasserTodayDashboard> {
  const vans = await getCanvasserVans(orgId)
  const today = new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data: sessionsData, error: sessionsErr } = await db
    .from('canvasser_sessions').select('*').eq('org_id', orgId).eq('session_date', today)
  if (sessionsErr) console.error('getTodayDashboard sessions:', sessionsErr)

  const sessions = ((sessionsData || []) as Record<string, unknown>[]).map(mapSession)
  const sessionByVan = new Map(sessions.map(s => [s.vanId, s]))
  const sessionIds = sessions.map(s => s.id)

  const visitsBySession = new Map<string, { done: number; total: number }>()
  if (sessionIds.length > 0) {
    const { data: visitsData, error: visitsErr } = await db
      .from('canvasser_visits')
      .select('id, session_id, status')
      .eq('org_id', orgId)
      .in('session_id', sessionIds)
    if (visitsErr) console.error('getTodayDashboard visits:', visitsErr)
    for (const row of (visitsData || []) as Record<string, unknown>[]) {
      const sessId = String(row.session_id)
      const entry = visitsBySession.get(sessId) || { done: 0, total: 0 }
      entry.total += 1
      if (row.status === 'SELESAI' || row.status === 'SKIP') entry.done += 1
      visitsBySession.set(sessId, entry)
    }
  }

  const dashboardVans: CanvasserDashboardVan[] = vans.map(van => {
    const session = sessionByVan.get(van.id) || null
    const visitStats = session ? (visitsBySession.get(session.id) || { done: 0, total: 0 }) : { done: 0, total: 0 }
    return { ...van, session, visitsDone: visitStats.done, visitsTotal: visitStats.total }
  })

  return {
    activeVans: sessions.filter(s => s.status === 'AKTIF').length,
    totalSalesToday: sessions.reduce((s, sess) => s + sess.totalSales, 0),
    totalCashCollected: sessions.reduce((s, sess) => s + sess.totalCashCollected, 0),
    totalArCollected: sessions.reduce((s, sess) => s + sess.totalArCollected, 0),
    vans: dashboardVans,
  }
}
