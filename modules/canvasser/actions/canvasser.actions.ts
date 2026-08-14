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
  CanvasserCustomerRosterEntry,
  CanvasserCustomerLedger,
  CanvasserVanLocation,
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
    canvasserEmployeeId: r.canvasser_employee_id ? String(r.canvasser_employee_id) : null,
    driverName: String(r.driver_name || ''),
    driverPhone: r.driver_phone ? String(r.driver_phone) : null,
    fixedAssetId: r.fixed_asset_id ? String(r.fixed_asset_id) : null,
    warehouseId: r.warehouse_id ? String(r.warehouse_id) : null,
    isActive: Boolean(r.is_active),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }
}

// ── Integrasi stok riil (gudang cabang <-> gudang virtual van) ─────────────────
// Setiap van punya `warehouses` row sendiri (canvasser_vans.warehouse_id, lihat
// migrasi 1422). "Muat Stok" = mutasi (transfer) dari gudang cabang ke gudang
// van — nilai stok org tidak berubah, cuma pindah lokasi. "Catat Order" = stok
// gudang van benar-benar berkurang (barang sudah diserahkan ke pelanggan).

type StockAvailabilityCheckItem = { productId: string; productName: string; qty: number; unit: string }

async function ensureWarehouseStockAvailable(
  orgId: string, warehouseId: string, items: StockAvailabilityCheckItem[]
): Promise<{ error?: string }> {
  const positive = items.filter(i => i.qty > 0)
  if (positive.length === 0) return {}

  const { queryPostgres } = await import('@/lib/db/postgres')
  const productIds = positive.map(i => i.productId)
  const res = await queryPostgres<{ product_id: string; quantity: string }>(
    `SELECT product_id, COALESCE(SUM(quantity), 0) AS quantity
     FROM inventory_stocks WHERE org_id = $1 AND warehouse_id = $2 AND product_id = ANY($3)
     GROUP BY product_id`,
    [orgId, warehouseId, productIds]
  )
  const availableByProduct = new Map(res.rows.map(r => [r.product_id, Number(r.quantity || 0)]))

  for (const item of positive) {
    const available = availableByProduct.get(item.productId) || 0
    if (item.qty > available) {
      return { error: `Stok "${item.productName}" tidak cukup. Tersedia ${available} ${item.unit}, diminta ${item.qty} ${item.unit}.` }
    }
  }
  return {}
}

// Muat stok dari gudang cabang ke gudang van — divalidasi dulu, lalu dieksekusi
// sebagai inventory transfer (mekanisme yang sama dgn modul Inventori).
async function loadStockToVanWarehouse(
  orgId: string, sourceWarehouseId: string, vanWarehouseId: string, items: StockItem[], notes: string
): Promise<{ error?: string }> {
  const positiveItems = items.filter(i => i.qty_loaded > 0)
  if (positiveItems.length === 0) return {}

  const availability = await ensureWarehouseStockAvailable(
    orgId, sourceWarehouseId,
    positiveItems.map(i => ({ productId: i.product_id, productName: i.product_name, qty: i.qty_loaded, unit: i.unit }))
  )
  if (availability.error) return availability

  const { createInventoryTransfer } = await import('@/modules/inventory/actions/inventory.actions')
  const result = await createInventoryTransfer(orgId, {
    transfer_date: new Date().toISOString().split('T')[0],
    source_wh_id: sourceWarehouseId,
    target_wh_id: vanWarehouseId,
    notes,
    items: positiveItems.map(i => ({ product_id: i.product_id, quantity: i.qty_loaded, notes: '' })),
  })
  if (result && 'error' in result) return { error: `Gagal memuat stok ke van: ${result.error}` }
  return {}
}

// Potong stok gudang van secara riil saat order dicatat (canvasser = instant
// delivery — barang sudah diserahkan ke pelanggan saat ini). Best-effort: order
// sudah tersimpan sebelum ini dipanggil, jadi kegagalan di sini di-log, bukan
// membatalkan order (barang secara fisik sudah pindah tangan).
async function settleCanvasserOrderStock(orgId: string, args: {
  orderId: string
  orderNumber: string
  branchId: string | null
  vanWarehouseId: string
  items: { productId: string; productName: string; qty: number; avgCost: number }[]
}): Promise<void> {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const today = new Date().toISOString().split('T')[0]

  for (const item of args.items) {
    if (item.qty <= 0) continue
    try {
      // adjust_inventory_stock punya 2 overload (4 & 6 parameter, yang 6-param
      // punya DEFAULT utk 2 parameter terakhir) — memanggil dgn persis 4 argumen
      // selalu ambigu ("function is not unique") krn cocok dgn overload manapun.
      // Harus selalu isi 6 argumen eksplisit (batch_number/bin_id = NULL) utk
      // menghindari ambiguitas ini sama sekali.
      await queryPostgres(
        `SELECT adjust_inventory_stock($1::uuid, $2::uuid, $3::uuid, $4::numeric, NULL::text, NULL::uuid)`,
        [orgId, item.productId, args.vanWarehouseId, -Math.abs(item.qty)]
      )
      await queryPostgres(
        `INSERT INTO stock_movements
           (org_id, branch_id, product_id, movement_date, quantity, unit_price, reference_type, reference_id, notes)
         VALUES ($1, $2, $3, $4::date, $5, $6, 'CANVASSER_SALE', $7, $8)`,
        [orgId, args.branchId, item.productId, today, -Math.abs(item.qty), item.avgCost, args.orderId, `Order canvasser ${args.orderNumber}`]
      )
    } catch (err) {
      (console as any).error('settleCanvasserOrderStock: gagal potong stok van', { orderId: args.orderId, productId: item.productId, err })
    }
  }

  try {
    const cogsResult = await ERPBridge.recordCOGS({
      orgId,
      branchId: args.branchId ?? undefined,
      saleId: args.orderId,
      saleDate: today,
      saleNumber: args.orderNumber,
      lines: args.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.qty, avgCost: i.avgCost })),
    })
    if (cogsResult && 'error' in cogsResult) {
      (console as any).warn('settleCanvasserOrderStock: recordCOGS warning', cogsResult.error, { orderId: args.orderId })
    }
  } catch (err) {
    (console as any).warn('settleCanvasserOrderStock: recordCOGS exception', err, { orderId: args.orderId })
  }
}

async function resolveEmployeeSnapshot(orgId: string, employeeId: string): Promise<{ name: string; phone: string | null } | { error: string }> {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const res = await queryPostgres<{ first_name: string; last_name: string | null; phone: string | null }>(
    `SELECT first_name, last_name, phone FROM employees WHERE id = $1 AND org_id = $2`,
    [employeeId, orgId]
  )
  const row = res.rows[0]
  if (!row) return { error: 'Karyawan tidak ditemukan.' }
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return { name: name || '(Tanpa nama)', phone: row.phone || null }
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
  canvasser_employee_id: string
  plate_number?: string
  fixed_asset_id?: string
  notes?: string
}): Promise<{ data?: CanvasserVan; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branch = await requireBranch(orgId)
  if ('error' in branch) return { error: branch.error }

  const snapshot = await resolveEmployeeSnapshot(orgId, payload.canvasser_employee_id)
  if ('error' in snapshot) return { error: snapshot.error }

  const { data, error } = await db
    .from('canvasser_vans')
    .insert({
      org_id: orgId,
      branch_id: branch.branchId,
      code: payload.code,
      name: payload.name,
      canvasser_employee_id: payload.canvasser_employee_id,
      driver_name: snapshot.name,
      driver_phone: snapshot.phone,
      plate_number: payload.plate_number || null,
      fixed_asset_id: payload.fixed_asset_id || null,
      notes: payload.notes || null,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  const vanId = String((data as Record<string, unknown>).id)

  // Setiap van butuh gudang virtual sendiri — lokasi stok yang dimutasi dari
  // gudang cabang saat "Muat Stok" dan berkurang riil saat "Catat Order".
  const { data: warehouseRow, error: warehouseError } = await db
    .from('warehouses')
    .insert({
      org_id: orgId,
      code: `VAN-${payload.code}`,
      name: `Van - ${payload.name}`,
      branch_id: branch.branchId,
      is_active: true,
    })
    .select('id')
    .single()

  if (warehouseError) {
    await db.from('canvasser_vans').delete().eq('id', vanId)
    return { error: `Gagal membuat gudang van: ${warehouseError.message}` }
  }

  const { data: updatedVan, error: updateError } = await db
    .from('canvasser_vans')
    .update({ warehouse_id: (warehouseRow as Record<string, unknown>).id })
    .eq('id', vanId)
    .select('*')
    .single()

  if (updateError) return { error: updateError.message }

  revalidatePath('/sales/co-sales')
  return { data: mapVan(updatedVan as Record<string, unknown>) }
}

export async function updateCanvasserVan(orgId: string, vanId: string, payload: Partial<{
  name: string
  canvasser_employee_id: string
  plate_number: string
  is_active: boolean
  notes: string
}>): Promise<{ data?: CanvasserVan; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const updates: Record<string, unknown> = { ...payload }
  if (payload.canvasser_employee_id) {
    const snapshot = await resolveEmployeeSnapshot(orgId, payload.canvasser_employee_id)
    if ('error' in snapshot) return { error: snapshot.error }
    updates.driver_name = snapshot.name
    updates.driver_phone = snapshot.phone
  }

  const { data, error } = await db
    .from('canvasser_vans')
    .update(updates)
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
  source_warehouse_id?: string
  opening_stock: StockItem[]
}): Promise<{ data?: CanvasserSession; error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const existing = await getTodaySession(orgId, payload.van_id)
  if (existing && existing.status === 'AKTIF') {
    return { error: 'Van ini sudah punya sesi AKTIF hari ini.' }
  }

  if (payload.opening_stock.some(i => i.qty_loaded > 0)) {
    const { data: vanRow, error: vanErr } = await db
      .from('canvasser_vans')
      .select('warehouse_id, name')
      .eq('id', payload.van_id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (vanErr || !vanRow) return { error: 'Van tidak ditemukan.' }
    const van = vanRow as Record<string, unknown>
    const vanWarehouseId = van.warehouse_id ? String(van.warehouse_id) : null
    if (!vanWarehouseId) return { error: 'Van ini belum punya gudang. Hubungi admin.' }
    if (!payload.source_warehouse_id) return { error: 'Pilih gudang sumber stok terlebih dahulu.' }

    const loadResult = await loadStockToVanWarehouse(
      orgId, payload.source_warehouse_id, vanWarehouseId, payload.opening_stock,
      `Muat stok awal sesi - ${String(van.name || '')}`
    )
    if (loadResult.error) return { error: loadResult.error }
  }

  const { data, error } = await db
    .from('canvasser_sessions')
    .insert({
      org_id: orgId,
      van_id: payload.van_id,
      // JSON.stringify eksplisit: array kosong lolos tanpa di-stringify oleh
      // _serializeDbParam (heuristik hasStructured vacuous-false utk array
      // kosong), lalu ke-bind pg sebagai literal array Postgres alih-alih
      // JSON — jadi kolom jsonb ini kebaca sebagai objek {} bukan array [].
      opening_stock: JSON.stringify(payload.opening_stock),
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return { data: mapSession(data as Record<string, unknown>) }
}

// Menambah stok ke sesi yang sudah AKTIF (mis. canvasser lupa isi stok saat
// Mulai Sesi, atau ambil tambahan stok di tengah hari). Di-merge ke
// opening_stock yang sudah ada berdasarkan product_id, bukan menimpa.
export async function addStockToSession(
  orgId: string, sessionId: string, sourceWarehouseId: string, items: StockItem[]
): Promise<{ data?: CanvasserSession; error?: string }> {
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
  if (String(session.status) !== 'AKTIF') return { error: 'Sesi ini sudah ditutup, tidak bisa menambah stok.' }

  if (!items.some(i => i.qty_loaded > 0)) return { error: 'Isi minimal 1 qty produk yang ingin ditambahkan.' }
  if (!sourceWarehouseId) return { error: 'Pilih gudang sumber stok terlebih dahulu.' }

  const { data: vanRow, error: vanErr } = await db
    .from('canvasser_vans')
    .select('warehouse_id, name')
    .eq('id', String(session.van_id))
    .eq('org_id', orgId)
    .maybeSingle()
  if (vanErr || !vanRow) return { error: 'Van tidak ditemukan.' }
  const van = vanRow as Record<string, unknown>
  const vanWarehouseId = van.warehouse_id ? String(van.warehouse_id) : null
  if (!vanWarehouseId) return { error: 'Van ini belum punya gudang. Hubungi admin.' }

  const loadResult = await loadStockToVanWarehouse(
    orgId, sourceWarehouseId, vanWarehouseId, items, `Tambah stok sesi - ${String(van.name || '')}`
  )
  if (loadResult.error) return { error: loadResult.error }

  const currentStock = (session.opening_stock as StockItem[]) || []
  const merged = new Map<string, StockItem>()
  for (const s of currentStock) merged.set(s.product_id, { ...s })
  for (const item of items) {
    if (item.qty_loaded <= 0) continue
    const existing = merged.get(item.product_id)
    if (existing) existing.qty_loaded += item.qty_loaded
    else merged.set(item.product_id, { ...item })
  }

  const { data, error } = await db
    .from('canvasser_sessions')
    .update({ opening_stock: JSON.stringify(Array.from(merged.values())) })
    .eq('id', sessionId)
    .eq('org_id', orgId)
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
    // Beberapa org merestrukturisasi CoA-nya jadi akun pendapatan yang lebih rinci
    // (4101 Penjualan Tunai / 4102 Penjualan Piutang) dan menonaktifkan 4001 generik.
    // Coba akun rinci dulu, fallback ke 4001 kalau org belum punya split itu — supaya
    // penutupan sesi tidak gagal hanya karena penamaan akun pendapatan berbeda.
    const [kasId, piutangId, pendapatanTunaiId, pendapatanKreditId, pendapatanUmumId] = await Promise.all([
      ERPBridge.getDefaultAccount(orgId, '1101'),
      ERPBridge.getDefaultAccount(orgId, '1201'),
      ERPBridge.getDefaultAccount(orgId, '4101'),
      ERPBridge.getDefaultAccount(orgId, '4102'),
      ERPBridge.getDefaultAccount(orgId, '4001'),
    ])
    const pendapatanTunaiFinalId = pendapatanTunaiId || pendapatanUmumId
    const pendapatanKreditFinalId = pendapatanKreditId || pendapatanUmumId

    if (!kasId) return { error: 'Akun Kas (1101) tidak ditemukan. Periksa COA.' }
    if (creditSales > 0 && !piutangId) return { error: 'Akun Piutang Usaha (1201) tidak ditemukan. Periksa COA.' }
    if (cashSales > 0 && !pendapatanTunaiFinalId) return { error: 'Akun Pendapatan Penjualan Tunai (4101/4001) tidak ditemukan. Periksa COA.' }
    if (creditSales > 0 && !pendapatanKreditFinalId) return { error: 'Akun Pendapatan Penjualan Kredit (4102/4001) tidak ditemukan. Periksa COA.' }
    if (arCollected > 0 && !piutangId) return { error: 'Akun Piutang Usaha (1201) tidak ditemukan. Periksa COA.' }

    const lines: { account_id: string; debit: number; credit: number; memo: string }[] = []
    const kasDebit = cashSales + arCollected
    if (kasDebit > 0) lines.push({ account_id: kasId, debit: kasDebit, credit: 0, memo: 'Kas dari penjualan tunai + tagihan AR' })
    if (creditSales > 0 && piutangId) lines.push({ account_id: piutangId, debit: creditSales, credit: 0, memo: 'Penjualan kredit canvasser' })
    if (cashSales > 0 && pendapatanTunaiFinalId) lines.push({ account_id: pendapatanTunaiFinalId, debit: 0, credit: cashSales, memo: 'Pendapatan penjualan tunai canvasser' })
    if (creditSales > 0 && pendapatanKreditFinalId) lines.push({ account_id: pendapatanKreditFinalId, debit: 0, credit: creditSales, memo: 'Pendapatan penjualan kredit canvasser' })
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
      // Sama seperti opening_stock — stringify eksplisit agar array kosong
      // tidak ke-bind sebagai literal array Postgres di kolom jsonb.
      closing_stock: JSON.stringify(payload.closing_stock),
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

  const { data: sessionRow, error: sessionErr } = await db
    .from('canvasser_sessions')
    .select('van_id')
    .eq('id', payload.session_id)
    .eq('org_id', orgId)
    .maybeSingle()
  if (sessionErr || !sessionRow) return { error: 'Sesi tidak ditemukan.' }

  const { data: vanRow, error: vanErr } = await db
    .from('canvasser_vans')
    .select('warehouse_id, branch_id')
    .eq('id', String((sessionRow as Record<string, unknown>).van_id))
    .eq('org_id', orgId)
    .maybeSingle()
  if (vanErr || !vanRow) return { error: 'Van tidak ditemukan.' }
  const van = vanRow as Record<string, unknown>
  const vanWarehouseId = van.warehouse_id ? String(van.warehouse_id) : null
  if (!vanWarehouseId) return { error: 'Van ini belum punya gudang. Hubungi admin.' }

  const productIds = payload.items.map(i => i.product_id)
  const { data: productRows, error: productErr } = await db
    .from('products')
    .select('id, name, unit, selling_price, average_cost, purchase_price')
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

  // Validasi stok riil di gudang van — barang yang dijual canvasser harus benar-benar
  // sudah dimuat ke van lewat "Muat Stok"/"Tambah Stok" sebelumnya.
  const stockCheck = await ensureWarehouseStockAvailable(
    orgId, vanWarehouseId,
    payload.items.map(i => ({
      productId: i.product_id,
      productName: String((productsById.get(i.product_id) as Record<string, unknown> | undefined)?.name || ''),
      qty: i.qty,
      unit: String((productsById.get(i.product_id) as Record<string, unknown> | undefined)?.unit || ''),
    }))
  )
  if (stockCheck.error) return { error: stockCheck.error }

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

  // Barang sudah diserahkan ke pelanggan saat order ini dicatat — potong stok
  // gudang van secara riil + jurnal HPP. Order sudah tersimpan; kegagalan di sini
  // di-log tapi tidak membatalkan order (lihat komentar settleCanvasserOrderStock).
  await settleCanvasserOrderStock(orgId, {
    orderId,
    orderNumber: String((order as Record<string, unknown>).order_number || ''),
    branchId: van.branch_id ? String(van.branch_id) : null,
    vanWarehouseId,
    items: payload.items.filter(i => i.qty > 0).map(i => {
      const product = productsById.get(i.product_id) as Record<string, unknown>
      return {
        productId: i.product_id,
        productName: String(product?.name || ''),
        qty: i.qty,
        avgCost: Number(product?.average_cost ?? product?.purchase_price ?? 0),
      }
    }),
  })

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

// ── Customer Roster & Ledger (AR per konsumen per canvasser) ───────────────────

export async function getVanCustomerRoster(orgId: string, vanId: string): Promise<CanvasserCustomerRosterEntry[]> {
  const { queryPostgres } = await import('@/lib/db/postgres')

  const res = await queryPostgres<Record<string, unknown>>(
    `SELECT
       c.id, c.name, c.address,
       COALESCE(o.order_count, 0) AS order_count,
       COALESCE(o.sales_total, 0) AS sales_total,
       lv.last_visit_date
     FROM contacts c
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS order_count, SUM(total) AS sales_total
       FROM canvasser_orders
       WHERE contact_id = c.id AND org_id = c.org_id AND status = 'SELESAI'
     ) o ON true
     LEFT JOIN LATERAL (
       SELECT MAX(cs.session_date) AS last_visit_date
       FROM canvasser_visits cv
       JOIN canvasser_sessions cs ON cs.id = cv.session_id
       WHERE cv.contact_id = c.id AND cv.org_id = c.org_id AND cv.status = 'SELESAI'
     ) lv ON true
     WHERE c.org_id = $1 AND c.assigned_van_id = $2
     ORDER BY c.name ASC`,
    [orgId, vanId]
  )

  return Promise.all(res.rows.map(async (row): Promise<CanvasserCustomerRosterEntry> => {
    const summary = await getContactARSummary(orgId, String(row.id))
    return {
      contactId: String(row.id),
      contactName: String(row.name || ''),
      address: row.address ? String(row.address) : null,
      arOutstanding: summary.outstandingTotal,
      creditLimit: summary.creditLimit,
      arStatus: summary.arStatus,
      lifetimeOrderCount: Number(row.order_count || 0),
      lifetimeSalesTotal: Number(row.sales_total || 0),
      lastVisitDate: row.last_visit_date ? String(row.last_visit_date) : null,
    }
  }))
}

export async function getCustomerLedger(orgId: string, contactId: string): Promise<CanvasserCustomerLedger> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const [contact, ordersRes, collectionsRes] = await Promise.all([
    getContactARSummary(orgId, contactId),
    db.from('canvasser_orders').select('*, items:canvasser_order_items(*)')
      .eq('org_id', orgId).eq('contact_id', contactId).eq('status', 'SELESAI')
      .order('created_at', { ascending: false }),
    db.from('canvasser_ar_collections').select('*')
      .eq('org_id', orgId).eq('contact_id', contactId)
      .order('created_at', { ascending: false }),
  ])

  const orders = ((ordersRes.data || []) as Record<string, unknown>[]).map(row => {
    const order = mapOrder(row)
    order.items = ((row.items as Record<string, unknown>[]) || []).map(mapOrderItem)
    return order
  })
  const arCollections = ((collectionsRes.data || []) as Record<string, unknown>[]).map(mapARCollection)

  return { contact, orders, arCollections }
}

export async function assignCustomerToVan(orgId: string, contactId: string, vanId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { error } = await db
    .from('contacts')
    .update({ assigned_van_id: vanId })
    .eq('id', contactId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/sales/co-sales')
  return {}
}

// ── Reorder kunjungan (manual, naik/turun) ──────────────────────────────────────

export async function reorderVisits(orgId: string, sessionId: string, orderedVisitIds: string[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  for (let i = 0; i < orderedVisitIds.length; i++) {
    const { error } = await db
      .from('canvasser_visits')
      .update({ visit_order: i + 1 })
      .eq('id', orderedVisitIds[i])
      .eq('org_id', orgId)
      .eq('session_id', sessionId)
    if (error) return { error: error.message }
  }

  revalidatePath('/sales/co-sales')
  return {}
}

// ── GPS lokasi terakhir van ──────────────────────────────────────────────────

function mapVanLocation(r: Record<string, unknown>): CanvasserVanLocation {
  return {
    vanId: String(r.van_id || ''),
    orgId: String(r.org_id || ''),
    lat: Number(r.lat || 0),
    lng: Number(r.lng || 0),
    accuracyM: r.accuracy_m !== null && r.accuracy_m !== undefined ? Number(r.accuracy_m) : null,
    updatedAt: String(r.updated_at || ''),
  }
}

export async function pingVanLocation(orgId: string, vanId: string, lat: number, lng: number, accuracyM?: number): Promise<{ error?: string }> {
  const { queryPostgres } = await import('@/lib/db/postgres')

  try {
    await queryPostgres(
      `INSERT INTO canvasser_van_locations (van_id, org_id, lat, lng, accuracy_m, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (van_id) DO UPDATE SET
         lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy_m = EXCLUDED.accuracy_m, updated_at = NOW()`,
      [vanId, orgId, lat, lng, accuracyM ?? null]
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan lokasi.' }
  }
  return {}
}

export async function getVanLocations(orgId: string): Promise<CanvasserVanLocation[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data, error } = await db
    .from('canvasser_van_locations')
    .select('*')
    .eq('org_id', orgId)
  if (error) { console.error('getVanLocations:', error); return [] }
  return (data || []).map(mapVanLocation)
}
