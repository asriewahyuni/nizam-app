'use server'

/**
 * Operational Bridge — menghubungkan modul operasional ke modul inti Sales & Purchasing.
 * 
 * Pola: Modul operasional (Workshop/LMS/Fleet) memberi konteks,
 * bridge ini menjadi translator ke Sales Invoice atau Purchase Order.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import type { CreatePurchaseData } from '@/modules/purchasing/actions/purchasing.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OperationalContext =
  | { type: 'WORKSHOP'; referenceId: string; spkNumber: string }
  | { type: 'LMS_BATCH'; referenceId: string; batchName: string }
  | { type: 'FLEET'; referenceId: string; orderNumber: string }
  | { type: 'JOB_ORDER'; referenceId: string; orderNumber: string }

export interface BridgeSaleItem {
  product_name: string
  quantity: number
  unit_price: number
  product_id?: string
  unit?: string
}

export interface BridgePurchaseItem {
  product_name: string
  quantity: number
  unit_price: number
  product_id?: string
  unit?: string
  category?: string
}

// ─── Sales Bridge ─────────────────────────────────────────────────────────────

/**
 * Buat Sales Invoice dari dokumen operasional.
 * Dipanggil saat SPK bengkel DISERAHKAN, batch LMS di-CONFIRM, dll.
 */
export async function createInvoiceFromOperational(params: {
  context: OperationalContext
  customerId: string
  customerName?: string
  items: BridgeSaleItem[]
  notes?: string
  paymentTerm?: 'LUNAS' | 'TEMPO'
  dueDate?: string
  saleDate?: string
}) {
  const { createSaleEntry } = await import('@/modules/sales/actions/sales.actions')
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Not authenticated' }

  const contextNote = buildContextNote(params.context)

  const result = await createSaleEntry(orgData.org.id, {
    customer_id: params.customerId,
    customer_name: params.customerName,
    sale_date: params.saleDate || new Date().toISOString().split('T')[0],
    due_date: params.dueDate,
    payment_term: params.paymentTerm || 'LUNAS',
    notes: [contextNote, params.notes].filter(Boolean).join(' | '),
    mode: 'PUBLISH',
    shariah_mode: 'CASH',
    lines: params.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: 0,
      tax_amount: 0,
    })),
  })

  if ('error' in result) return { error: result.error }

  // Tandai dokumen operasional sudah punya invoice
  await linkInvoiceToOperational(orgData.org.id, params.context, result.saleId!)
  revalidatePath('/sales')

  return { success: true, saleId: result.saleId }
}

/**
 * Buat Sales Invoice langsung dari SPK Workshop.
 * Ambil data otomatis dari work_order + items.
 */
export async function createInvoiceFromWorkOrder(workOrderId: string) {
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const db = supabase as any

  const { data: wo, error: woErr } = await db
    .from('workshop_work_orders')
    .select('*, contact:contacts(id, name), items:workshop_work_order_items(*)')
    .eq('id', workOrderId)
    .eq('org_id', orgData.org.id)
    .single()

  if (woErr || !wo) return { error: 'SPK tidak ditemukan' }
  if (!wo.contact_id) return { error: 'SPK tidak memiliki data pelanggan. Isi kontak pelanggan terlebih dahulu.' }
  if (!wo.items?.length) return { error: 'SPK tidak memiliki item jasa/part.' }

  // Cek apakah sudah punya invoice
  const existing = await getLinkedSaleId(orgData.org.id, 'WORKSHOP', workOrderId)
  if (existing) return { error: `SPK ini sudah memiliki invoice (${existing}). Gunakan invoice yang sudah ada.` }

  const items: BridgeSaleItem[] = (wo.items as any[]).map((item: any) => ({
    product_name: String(item.name || ''),
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    product_id: item.product_id || undefined,
    unit: item.item_type === 'JASA' ? 'Jasa' : 'Pcs',
  }))

  return createInvoiceFromOperational({
    context: { type: 'WORKSHOP', referenceId: workOrderId, spkNumber: wo.spk_number },
    customerId: wo.contact_id,
    customerName: wo.contact?.name,
    items,
    notes: `SPK ${wo.spk_number}${wo.customer_complaint ? ` — ${wo.customer_complaint}` : ''}`,
    paymentTerm: 'LUNAS',
    saleDate: new Date().toISOString().split('T')[0],
  })
}

/**
 * Buat Sales Invoice dari LMS Batch Enrollment.
 * Dipanggil saat peserta dikonfirmasi.
 */
export async function createInvoiceFromLmsBatch(params: {
  batchId: string
  contactId: string
  contactName?: string
  tuitionFee: number
  batchName: string
}) {
  return createInvoiceFromOperational({
    context: { type: 'LMS_BATCH', referenceId: params.batchId, batchName: params.batchName },
    customerId: params.contactId,
    customerName: params.contactName,
    items: [{
      product_name: `Biaya Pelatihan — ${params.batchName}`,
      quantity: 1,
      unit_price: params.tuitionFee,
      unit: 'Peserta',
    }],
    notes: `Batch: ${params.batchName}`,
    paymentTerm: 'LUNAS',
    saleDate: new Date().toISOString().split('T')[0],
  })
}

// ─── Purchase Bridge ──────────────────────────────────────────────────────────

/**
 * Buat Purchase Order programatik dari modul operasional.
 * Misalnya: beli sparepart untuk SPK bengkel, beli material untuk job order.
 */
export async function createPurchaseFromOperational(params: {
  context: OperationalContext
  vendorId: string
  items: BridgePurchaseItem[]
  notes?: string
  paymentTerm?: 'LUNAS' | 'TEMPO'
  dueDate?: string
}) {
  const { createPurchaseEntry } = await import('@/modules/purchasing/actions/purchasing.actions')
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Not authenticated' }

  const contextNote = buildContextNote(params.context)

  const purchaseData: CreatePurchaseData = {
    vendor_id: params.vendorId,
    purchase_date: new Date().toISOString().split('T')[0],
    due_date: params.dueDate,
    payment_term: params.paymentTerm || 'TEMPO',
    notes: [contextNote, params.notes].filter(Boolean).join(' | '),
    mode: 'DRAFT', // Selalu draft dulu — user konfirmasi sebelum diterbitkan
    shariah_mode: 'CASH',
    lines: params.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit: item.unit || 'Pcs',
      category: item.category || 'Operasional',
    })),
  }

  const result = await createPurchaseEntry(orgData.org.id, purchaseData)
  if ('error' in result) return { error: result.error }

  // Simpan link PO ke dokumen operasional di metadata
  await linkPurchaseToOperational(orgData.org.id, params.context, result.purchaseId!)
  revalidatePath('/purchasing')

  return { success: true, purchaseId: result.purchaseId }
}

// ─── Vehicle Auto-fill Helper ─────────────────────────────────────────────────

/**
 * Ambil data kendaraan untuk auto-fill form SPK bengkel.
 * Dipanggil di client saat user memilih kendaraan dari lookup.
 */
export async function getVehicleForSpkPrefill(vehicleId: string) {
  const orgData = await getActiveOrg()
  if (!orgData) return null

  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('workshop_vehicles')
    .select(`
      id,
      plate_number,
      brand,
      model,
      year,
      color,
      engine_number,
      chassis_number,
      fuel_type,
      transmission,
      last_odometer,
      notes,
      contact_id,
      contact:contacts(id, name, phone, phone_wa, address)
    `)
    .eq('id', vehicleId)
    .eq('org_id', orgData.org.id)
    .single()

  if (error || !data) return null

  return {
    vehicleId: data.id,
    plateNumber: data.plate_number,
    brand: data.brand,
    model: data.model,
    year: data.year,
    color: data.color,
    engineNumber: data.engine_number,
    chassisNumber: data.chassis_number,
    fuelType: data.fuel_type,
    transmission: data.transmission,
    lastOdometer: data.last_odometer,
    notes: data.notes,
    // Data pelanggan pemilik kendaraan — auto-fill ke field pelanggan SPK
    contactId: data.contact_id,
    contactName: data.contact?.name ?? null,
    contactPhone: data.contact?.phone_wa ?? data.contact?.phone ?? null,
    contactAddress: data.contact?.address ?? null,
  }
}

// ─── Linking Helpers ──────────────────────────────────────────────────────────

/**
 * Simpan link antara dokumen operasional dan Sales Invoice.
 * Menggunakan kolom reference_type / reference_id di tabel sales,
 * ATAU kolom notes sebagai fallback.
 */
async function linkInvoiceToOperational(
  orgId: string,
  context: OperationalContext,
  saleId: string
) {
  try {
    const supabase = await createClient()
    const db = supabase as any

    // Coba update kolom reference di sales (jika ada)
    await db
      .from('sales')
      .update({
        reference_type: context.type,
        reference_id: context.referenceId,
      })
      .eq('id', saleId)
      .eq('org_id', orgId)

    // Untuk workshop: update work_order dengan sale_id jika ada kolom tersebut
    if (context.type === 'WORKSHOP') {
      await db
        .from('workshop_work_orders')
        .update({ sale_id: saleId })
        .eq('id', context.referenceId)
        .eq('org_id', orgId)
    }
  } catch {
    // Non-critical: link gagal tidak blok invoice
    console.warn('[bridge] linkInvoiceToOperational failed silently')
  }
}

async function linkPurchaseToOperational(
  orgId: string,
  context: OperationalContext,
  purchaseId: string
) {
  try {
    const supabase = await createClient()
    const db = supabase as any

    await db
      .from('purchases')
      .update({
        reference_type: context.type,
        reference_id: context.referenceId,
      })
      .eq('id', purchaseId)
      .eq('org_id', orgId)
  } catch {
    console.warn('[bridge] linkPurchaseToOperational failed silently')
  }
}

async function getLinkedSaleId(
  orgId: string,
  referenceType: string,
  referenceId: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    const db = supabase as any

    const { data } = await db
      .from('sales')
      .select('id, sale_number')
      .eq('org_id', orgId)
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .not('status', 'eq', 'VOIDED')
      .maybeSingle()

    return data ? String(data.sale_number || data.id) : null
  } catch {
    return null
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function buildContextNote(context: OperationalContext): string {
  switch (context.type) {
    case 'WORKSHOP':
      return `Ref: SPK ${context.spkNumber}`
    case 'LMS_BATCH':
      return `Ref: Batch ${context.batchName}`
    case 'FLEET':
      return `Ref: Order ${context.orderNumber}`
    case 'JOB_ORDER':
      return `Ref: Job ${context.orderNumber}`
  }
}
