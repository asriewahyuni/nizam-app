'use server'

// Server actions untuk modul operasional bengkel motor.

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import type { WorkshopWorkOrder, WorkshopVehicle, WorkshopStatus } from '@/modules/workshop/lib/workshop-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveBranch(orgId: string, branchId?: string | null) {
  const sel = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in sel) return { error: sel.error || 'Akses unit tidak valid.' }
  return { branchId: sel.branchId }
}

async function requireBranch(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const sel = await resolveBranch(orgId)
  if ('error' in sel || !sel.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat data bengkel.' }
  }
  return { branchId: sel.branchId as string }
}

function generateSpkNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `SPK/${yy}${mm}${dd}/${rand}`
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function getWorkshopVehicles(orgId: string, branchId?: string | null): Promise<WorkshopVehicle[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const sel = await resolveBranch(orgId, branchId)
  if ('error' in sel) return []

  let q = db
    .from('workshop_vehicles')
    .select('*, contact:contacts(id, name)')
    .eq('org_id', orgId)

  if (sel.branchId) q = q.eq('branch_id', sel.branchId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) { console.error('getWorkshopVehicles:', error); return [] }

  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    branchId: r.branch_id ? String(r.branch_id) : null,
    contactId: r.contact_id ? String(r.contact_id) : null,
    contactName: String(((r.contact as { name?: unknown } | null)?.name) || ''),
    plateNumber: String(r.plate_number || ''),
    brand: String(r.brand || ''),
    model: String(r.model || ''),
    year: r.year ? Number(r.year) : null,
    color: r.color ? String(r.color) : null,
    engineNumber: r.engine_number ? String(r.engine_number) : null,
    chassisNumber: r.chassis_number ? String(r.chassis_number) : null,
    fuelType: String(r.fuel_type || 'BENSIN'),
    transmission: String(r.transmission || 'MANUAL'),
    lastOdometer: Number(r.last_odometer || 0),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at || ''),
  }))
}

export async function createWorkshopVehicle(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branch = await requireBranch(orgId)
  if ('error' in branch) return { error: branch.error }

  const payload = {
    org_id: orgId,
    branch_id: branch.branchId,
    contact_id: (formData.get('contact_id') as string) || null,
    plate_number: formData.get('plate_number') as string,
    brand: formData.get('brand') as string,
    model: formData.get('model') as string,
    year: formData.get('year') ? Number(formData.get('year')) : null,
    color: (formData.get('color') as string) || null,
    engine_number: (formData.get('engine_number') as string) || null,
    chassis_number: (formData.get('chassis_number') as string) || null,
    fuel_type: (formData.get('fuel_type') as string) || 'BENSIN',
    transmission: (formData.get('transmission') as string) || 'MANUAL',
    last_odometer: Number(formData.get('last_odometer') || 0),
    notes: (formData.get('notes') as string) || null,
  }

  const { error } = await db.from('workshop_vehicles').insert(payload)
  if (error) return { error: error.message }

  revalidatePath('/workshop')
  return { success: true }
}

// ─── Work Orders ──────────────────────────────────────────────────────────────

export async function getWorkshopWorkOrders(orgId: string, branchId?: string | null): Promise<WorkshopWorkOrder[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const sel = await resolveBranch(orgId, branchId)
  if ('error' in sel) return []

  let q = db
    .from('workshop_work_orders')
    .select(`
      *,
      contact:contacts(id, name),
      vehicle:workshop_vehicles(id, plate_number, brand, model),
      items:workshop_work_order_items(*)
    `)
    .eq('org_id', orgId)

  if (sel.branchId) q = q.eq('branch_id', sel.branchId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) { console.error('getWorkshopWorkOrders:', error); return [] }

  return (data || []).map((r: Record<string, unknown>) => {
    const vehicle = r.vehicle as Record<string, unknown> | null
    const items = (r.items as Record<string, unknown>[] | null) || []
    return {
      id: String(r.id || ''),
      orgId: String(r.org_id || ''),
      branchId: r.branch_id ? String(r.branch_id) : null,
      spkNumber: String(r.spk_number || ''),
      vehicleId: r.vehicle_id ? String(r.vehicle_id) : null,
      vehicle: vehicle ? {
        plateNumber: String(vehicle.plate_number || ''),
        brand: String(vehicle.brand || ''),
        model: String(vehicle.model || ''),
      } : null,
      contactId: r.contact_id ? String(r.contact_id) : null,
      contactName: String(((r.contact as { name?: unknown } | null)?.name) || ''),
      mechanicName: r.mechanic_name ? String(r.mechanic_name) : null,
      status: String(r.status || 'ANTRI') as WorkshopStatus,
      customerComplaint: r.customer_complaint ? String(r.customer_complaint) : null,
      diagnosis: r.diagnosis ? String(r.diagnosis) : null,
      odometerIn: r.odometer_in ? Number(r.odometer_in) : null,
      odometerOut: r.odometer_out ? Number(r.odometer_out) : null,
      estimatedFinish: r.estimated_finish ? String(r.estimated_finish) : null,
      actualFinish: r.actual_finish ? String(r.actual_finish) : null,
      subtotal: Number(r.subtotal || 0),
      discount: Number(r.discount || 0),
      total: Number(r.total || 0),
      notes: r.notes ? String(r.notes) : null,
      items: items.map((item) => ({
        id: String(item.id || ''),
        workOrderId: String(item.work_order_id || ''),
        itemType: String(item.item_type || 'JASA') as 'JASA' | 'PART',
        name: String(item.name || ''),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || 0),
        subtotal: Number(item.subtotal || 0),
        notes: item.notes ? String(item.notes) : null,
      })),
      createdAt: String(r.created_at || ''),
    }
  })
}

export async function createWorkshopWorkOrder(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branch = await requireBranch(orgId)
  if ('error' in branch) return { error: branch.error }

  const spkNumber = generateSpkNumber()

  const payload = {
    org_id: orgId,
    branch_id: branch.branchId,
    spk_number: spkNumber,
    vehicle_id: (formData.get('vehicle_id') as string) || null,
    contact_id: (formData.get('contact_id') as string) || null,
    mechanic_name: (formData.get('mechanic_name') as string) || null,
    status: 'ANTRI',
    customer_complaint: (formData.get('customer_complaint') as string) || null,
    odometer_in: formData.get('odometer_in') ? Number(formData.get('odometer_in')) : null,
    estimated_finish: (formData.get('estimated_finish') as string) || null,
    notes: (formData.get('notes') as string) || null,
    subtotal: 0,
    discount: 0,
    total: 0,
  }

  const { data: order, error } = await db
    .from('workshop_work_orders')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/workshop')
  return { success: true, id: order?.id as string }
}

export async function updateWorkOrderStatus(orgId: string, orderId: string, status: WorkshopStatus) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const updates: Record<string, unknown> = { status }
  if (status === 'SELESAI' || status === 'DISERAHKAN') {
    updates.actual_finish = new Date().toISOString()
  }

  const { error } = await db
    .from('workshop_work_orders')
    .update(updates)
    .eq('id', orderId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  // Posting jurnal otomatis saat SPK diserahkan ke pelanggan
  if (status === 'DISERAHKAN') {
    const journalResult = await postWorkshopJournal(orgId, orderId, db)
    if ('error' in journalResult) {
      console.error('postWorkshopJournal error:', journalResult.error)
    }
    // Deduct stok spare part dari inventori
    await deductWorkshopPartInventory(orgId, orderId)
  }

  revalidatePath('/workshop')
  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─── Journal Posting ──────────────────────────────────────────────────────────

async function postWorkshopJournal(orgId: string, orderId: string, db: LooseDb) {
  // Ambil data SPK + items
  const { data: order, error: orderErr } = await db
    .from('workshop_work_orders')
    .select('*, items:workshop_work_order_items(*)')
    .eq('id', orderId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (orderErr || !order) return { error: 'SPK tidak ditemukan untuk posting jurnal.' }

  const total = Number((order as Record<string, unknown>).total || 0)
  if (total <= 0) return { success: true } // Tidak ada nilai, lewati

  const branchId = (order as Record<string, unknown>).branch_id as string | null
  const spkNumber = String((order as Record<string, unknown>).spk_number || '')
  const items = ((order as Record<string, unknown>).items as Record<string, unknown>[]) || []

  // Hitung total per tipe item
  const totalJasa = items
    .filter(i => String(i.item_type) === 'JASA')
    .reduce((s, i) => s + Number(i.subtotal || 0), 0)
  const totalPart = items
    .filter(i => String(i.item_type) === 'PART')
    .reduce((s, i) => s + Number(i.subtotal || 0), 0)

  // Lookup akun: Piutang Usaha (1201) & Pendapatan (4001)
  let finalArId: string | undefined
  let finalRevId: string | undefined

  // Cari akun AR berdasarkan kode, fallback ke nama
  const { data: accAR } = await db
    .from('accounts').select('id').eq('org_id', orgId).eq('code', '1201').maybeSingle()
  finalArId = (accAR as any)?.id as string | undefined

  if (!finalArId) {
    const { queryPostgres } = await import('@/lib/db/postgres')
    const res = await queryPostgres<{ id: string }>(
      `SELECT id FROM public.accounts WHERE org_id=$1 AND LOWER(name) LIKE '%piutang usaha%' LIMIT 1`,
      [orgId]
    )
    finalArId = res.rows[0]?.id
  }
  if (!finalArId) return { error: 'Akun Piutang Usaha (1201) tidak ditemukan. Periksa COA.' }

  // Cari akun Pendapatan berdasarkan kode, fallback ke nama
  const { data: accRevenue } = await db
    .from('accounts').select('id').eq('org_id', orgId).eq('code', '4001').maybeSingle()
  finalRevId = (accRevenue as any)?.id as string | undefined

  if (!finalRevId) {
    const { queryPostgres } = await import('@/lib/db/postgres')
    const res = await queryPostgres<{ id: string }>(
      `SELECT id FROM public.accounts WHERE org_id=$1 AND LOWER(name) LIKE '%pendapatan%' LIMIT 1`,
      [orgId]
    )
    finalRevId = res.rows[0]?.id
  }
  if (!finalRevId) return { error: 'Akun Pendapatan (4001) tidak ditemukan. Periksa COA.' }

  // Susun baris jurnal
  const lines: { account_id: string; debit: number; credit: number; memo: string }[] = []

  // Debit: Piutang Usaha (total SPK)
  lines.push({ account_id: finalArId, debit: total, credit: 0, memo: `Piutang bengkel ${spkNumber}` })

  // Credit: Pendapatan Jasa
  if (totalJasa > 0) {
    lines.push({ account_id: finalRevId, debit: 0, credit: totalJasa, memo: `Pendapatan jasa servis ${spkNumber}` })
  }
  // Credit: Pendapatan Part
  if (totalPart > 0) {
    lines.push({ account_id: finalRevId, debit: 0, credit: totalPart, memo: `Pendapatan spare part ${spkNumber}` })
  }

  if (lines.length < 2) return { success: true }

  return createJournalEntry({
    org_id: orgId,
    branch_id: branchId ?? undefined,
    entry_date: new Date().toISOString().split('T')[0],
    description: `Pendapatan Bengkel — ${spkNumber}`,
    reference_type: 'WORKSHOP',
    reference_id: orderId,
    auto_post: true,
    skipRevalidate: true,
    lines,
  })
}


export async function addWorkOrderItem(
  orgId: string,
  workOrderId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const qty = Number(formData.get('quantity') || 1)
  const unitPrice = Number(formData.get('unit_price') || 0)
  const productId = (formData.get('product_id') as string) || null
  const itemType = (formData.get('item_type') as string) || 'JASA'

  const { error: itemError } = await db.from('workshop_work_order_items').insert({
    org_id: orgId,
    work_order_id: workOrderId,
    item_type: itemType,
    name: formData.get('name') as string,
    quantity: qty,
    unit_price: unitPrice,
    product_id: productId,
    notes: (formData.get('notes') as string) || null,
  })

  if (itemError) return { error: itemError.message }

  // Recalculate order totals
  const { data: allItems, error: fetchError } = await db
    .from('workshop_work_order_items')
    .select('subtotal')
    .eq('work_order_id', workOrderId)

  if (fetchError) return { error: fetchError.message }

  const subtotal = (allItems || []).reduce(
    (acc: number, i: Record<string, unknown>) => acc + Number(i.subtotal || 0),
    0
  )

  const { data: order } = await db
    .from('workshop_work_orders')
    .select('discount')
    .eq('id', workOrderId)
    .maybeSingle()

  const discount = Number((order as Record<string, unknown> | null)?.discount || 0)
  const total = Math.max(0, subtotal - discount)

  const { error: updateError } = await db
    .from('workshop_work_orders')
    .update({ subtotal, total })
    .eq('id', workOrderId)
    .eq('org_id', orgId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/workshop')
  return { success: true }
}

export async function deleteWorkOrderItem(orgId: string, workOrderId: string, itemId: string) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { error } = await db
    .from('workshop_work_order_items')
    .delete()
    .eq('id', itemId)
    .eq('work_order_id', workOrderId)

  if (error) return { error: error.message }

  // Recalculate totals
  const { data: allItems } = await db
    .from('workshop_work_order_items')
    .select('subtotal')
    .eq('work_order_id', workOrderId)

  const subtotal = (allItems || []).reduce(
    (acc: number, i: Record<string, unknown>) => acc + Number(i.subtotal || 0),
    0
  )

  const { data: order } = await db
    .from('workshop_work_orders')
    .select('discount')
    .eq('id', workOrderId)
    .maybeSingle()

  const discount = Number((order as Record<string, unknown> | null)?.discount || 0)
  const total = Math.max(0, subtotal - discount)

  await db
    .from('workshop_work_orders')
    .update({ subtotal, total })
    .eq('id', workOrderId)
    .eq('org_id', orgId)

  revalidatePath('/workshop')
  return { success: true }
}

// ─── Inventory Deduction ──────────────────────────────────────────────────────

/**
 * Deduct stok spare part dari inventori saat SPK diserahkan.
 * Dipanggil otomatis dari updateWorkOrderStatus saat status = DISERAHKAN.
 */
export async function deductWorkshopPartInventory(orgId: string, workOrderId: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')

  // Ambil semua item PART yang punya product_id
  const items = await queryPostgres<{
    product_id: string
    quantity: number
  }>(`
    SELECT product_id, quantity
    FROM public.workshop_work_order_items
    WHERE work_order_id = $1
      AND item_type = 'PART'
      AND product_id IS NOT NULL
  `, [workOrderId])

  if (items.rows.length === 0) return { success: true }

  // Ambil warehouse default org
  const warehouseRes = await queryPostgres<{ id: string }>(
    `SELECT id FROM public.warehouses WHERE org_id = $1 AND is_default = true LIMIT 1`,
    [orgId]
  )
  const warehouseId = warehouseRes.rows[0]?.id
  if (!warehouseId) return { success: true } // Tidak ada warehouse, skip

  // Deduct stok setiap part
  const errors: string[] = []
  for (const item of items.rows) {
    try {
      // 1. Catat ke stock_movements
      await queryPostgres(`
        INSERT INTO public.stock_movements
        (org_id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, date)
        VALUES ($1, $2, $3, 'OUT', $4, 'WORKSHOP_SPK', $5, CURRENT_TIMESTAMP)
      `, [orgId, item.product_id, warehouseId, item.quantity, workOrderId])

      // 2. Update inventory_stocks
      await queryPostgres(`
        UPDATE public.inventory_stocks
        SET quantity = GREATEST(0, quantity - $1)
        WHERE org_id = $2
          AND product_id = $3
          AND warehouse_id = $4
      `, [item.quantity, orgId, item.product_id, warehouseId])
    } catch (err: any) {
      errors.push(`Part ${item.product_id}: ${err.message}`)
    }
  }

  if (errors.length > 0) {
    console.error('[deductWorkshopPartInventory] errors:', errors)
  }

  return { success: true }
}

// ─── Service Rates CRUD ───────────────────────────────────────────────────────

export interface WorkshopServiceRate {
  id: string
  name: string
  description: string | null
  unitPrice: number
  category: string
  isActive: boolean
}

export async function getWorkshopServiceRates(orgId: string): Promise<WorkshopServiceRate[]> {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const res = await queryPostgres<Record<string, unknown>>(
    `SELECT id, name, description, unit_price, category, is_active
     FROM public.workshop_service_rates
     WHERE org_id = $1 AND is_active = true
     ORDER BY category, name`,
    [orgId]
  )
  return res.rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    unitPrice: Number(r.unit_price),
    category: String(r.category || 'UMUM'),
    isActive: Boolean(r.is_active),
  }))
}

export async function upsertWorkshopServiceRate(orgId: string, formData: FormData) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const id = (formData.get('id') as string) || null
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string) || null
  const unitPrice = Number(formData.get('unit_price') || 0)
  const category = (formData.get('category') as string) || 'UMUM'

  if (!name) return { error: 'Nama tarif wajib diisi.' }
  if (unitPrice < 0) return { error: 'Harga tidak boleh negatif.' }

  if (id) {
    await queryPostgres(
      `UPDATE public.workshop_service_rates
       SET name=$1, description=$2, unit_price=$3, category=$4, updated_at=NOW()
       WHERE id=$5 AND org_id=$6`,
      [name, description, unitPrice, category, id, orgId]
    )
  } else {
    await queryPostgres(
      `INSERT INTO public.workshop_service_rates (org_id, name, description, unit_price, category)
       VALUES ($1,$2,$3,$4,$5)`,
      [orgId, name, description, unitPrice, category]
    )
  }

  revalidatePath('/workshop')
  revalidatePath('/workshop/settings')
  return { success: true }
}

export async function deleteWorkshopServiceRate(orgId: string, rateId: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  await queryPostgres(
    `UPDATE public.workshop_service_rates SET is_active=false WHERE id=$1 AND org_id=$2`,
    [rateId, orgId]
  )
  revalidatePath('/workshop')
  revalidatePath('/workshop/settings')
  return { success: true }
}

// Ambil produk inventori (spare part) untuk lookup di form item SPK
export async function getWorkshopPartProducts(orgId: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const res = await queryPostgres<{ id: string; name: string; sku: string; selling_price: number; quantity: number }>(
    `SELECT p.id, p.name, p.sku, p.selling_price,
            COALESCE(SUM(s.quantity), 0) AS quantity
     FROM public.products p
     LEFT JOIN public.inventory_stocks s ON s.product_id = p.id AND s.org_id = p.org_id
     WHERE p.org_id = $1
       AND p.type IN ('INVENTORY', 'PART', 'SPAREPART')
     GROUP BY p.id, p.name, p.sku, p.selling_price
     ORDER BY p.name`,
    [orgId]
  )
  return res.rows
}
