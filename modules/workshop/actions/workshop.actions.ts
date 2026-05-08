'use server'

// Server actions untuk modul operasional bengkel motor.

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
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

  revalidatePath('/workshop')
  return { success: true }
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

  const { error: itemError } = await db.from('workshop_work_order_items').insert({
    work_order_id: workOrderId,
    item_type: (formData.get('item_type') as string) || 'JASA',
    name: formData.get('name') as string,
    quantity: qty,
    unit_price: unitPrice,
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
