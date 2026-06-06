'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { FleetCargoShipment, CargoStatus, CargoPaymentStatus } from '@/types/database.types'

type DbError = { message: string; code?: string }

// Setup helper untuk FleetDb yang meniru query builder
function getSupabase() {
  return createClient()
}

export async function resolveFleetBranchSelection(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }
  return { branchId: branchSelection.branchId }
}

export async function requireFleetCreateBranchId(orgId: string, errorMessage: string) {
  const branchSelection = await resolveFleetBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }
  return { branchId: branchSelection.branchId as string }
}

export async function ensureFleetBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }
  const branchSelection = await resolveFleetBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }
  return { branchId: trimmedBranchId }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────────────────────

export async function getCargoShipments(orgId: string, branchId?: string | null) {
  const supabase = await getSupabase()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('fleet_cargo_shipments')
    .select(`
      *,
      origin:fleet_terminals!origin_terminal_id(id, name, location_name),
      destination:fleet_terminals!destination_terminal_id(id, name, location_name),
      schedule:fleet_schedules(id, departure_time, route_id)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) {
    return []
  }

  // Debug dump specific to this org
  try {
    const fs = require('fs');
    fs.writeFileSync(`/tmp/cargo-debug-${orgId}.json`, JSON.stringify({
      orgId,
      branchId,
      branchSelection,
      dataLength: data?.length,
      firstRow: data?.[0]
    }, null, 2));
  } catch(e) {}

  return data as any[]
}

export async function getCargoTracking(trackingNumber: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('fleet_cargo_shipments')
    .select(`
      id, tracking_number, sender_name, receiver_name, 
      status, created_at, payment_status,
      origin:fleet_terminals!origin_terminal_id(name, location_name),
      destination:fleet_terminals!destination_terminal_id(name, location_name)
    `)
    .eq('tracking_number', trackingNumber)
    .single()
    
  if (error || !data) return null
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createCargoShipment(orgId: string, formData: FormData) {
  const supabase = await getSupabase()
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif (Terminal) terlebih dahulu untuk membuat resi kargo.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  let trackingNumber = formData.get('tracking_number') as string
  if (!trackingNumber || trackingNumber.trim() === '') {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    trackingNumber = `AWB-${dateStr}-${randomSuffix}`
  }

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
    tracking_number: trackingNumber,
    sender_name: formData.get('sender_name') as string,
    sender_phone: formData.get('sender_phone') as string,
    receiver_name: formData.get('receiver_name') as string,
    receiver_phone: formData.get('receiver_phone') as string,
    origin_terminal_id: formData.get('origin_terminal_id') as string,
    destination_terminal_id: formData.get('destination_terminal_id') as string,
    item_description: formData.get('item_description') as string,
    weight_kg: Number(formData.get('weight_kg')) || 0,
    volume_m3: Number(formData.get('volume_m3')) || 0,
    shipping_cost: Number(formData.get('shipping_cost')) || 0,
    handling_fee: Number(formData.get('handling_fee')) || 0,
    grand_total: Number(formData.get('grand_total')) || 0,
    payment_status: (formData.get('payment_status') as CargoPaymentStatus) || 'UNPAID',
    payment_method: formData.get('payment_method') as string,
    koli_count: Number(formData.get('koli_count')) || 1,
    bus_pool_id: (formData.get('bus_pool_id') as string) || null,
    status: 'DRAFT' as CargoStatus
  }

  const { data, error } = await supabase.from('fleet_cargo_shipments').insert(payload).select().single()

  if (error) return { error: error.message }

  revalidatePath('/fleet/cargo')
  return { success: true, trackingNumber, id: data.id }
}

export async function updateCargoStatus(orgId: string, cargoId: string, status: CargoStatus) {
  const supabase = await getSupabase()
  
  const { data: cargo, error: fetchErr } = await supabase
    .from('fleet_cargo_shipments')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', cargoId)
    .single()
    
  if (fetchErr) return { error: 'Kargo tidak ditemukan.' }
  
  // Verifikasi branch access (di terminal manapun user berada, asalkan punya akses)
  const branchAccess = await ensureFleetBranchAccess(orgId, cargo.branch_id, 'Akses ditolak.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  const { error } = await supabase
    .from('fleet_cargo_shipments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', cargoId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/fleet/cargo')
  return { success: true }
}

export async function assignCargoToScheduleByBarcode(orgId: string, trackingNumber: string, scheduleId: string) {
  const supabase = await getSupabase()
  
  const { data: cargo, error: fetchErr } = await supabase
    .from('fleet_cargo_shipments')
    .select('id, branch_id, status')
    .eq('org_id', orgId)
    .eq('tracking_number', trackingNumber)
    .single()
    
  if (fetchErr) return { error: 'Barcode/Resi kargo tidak ditemukan.' }
  if (cargo.status !== 'DRAFT') return { error: `Kargo tidak valid untuk di-loading (Status saat ini: ${cargo.status}).` }
  
  const branchAccess = await ensureFleetBranchAccess(orgId, cargo.branch_id, 'Akses ditolak.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  const { error } = await supabase
    .from('fleet_cargo_shipments')
    .update({ 
      schedule_id: scheduleId, 
      status: 'MANIFESTED',
      updated_at: new Date().toISOString() 
    })
    .eq('id', cargo.id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/fleet/cargo')
  return { success: true }
}

export async function processCargoArrivalByBarcode(orgId: string, trackingNumber: string) {
  const supabase = await getSupabase()
  
  const { data: cargo, error: fetchErr } = await supabase
    .from('fleet_cargo_shipments')
    .select('id, destination_terminal_id, status')
    .eq('org_id', orgId)
    .eq('tracking_number', trackingNumber)
    .single()
    
  if (fetchErr) return { error: 'Barcode/Resi kargo tidak ditemukan.' }
  if (cargo.status !== 'IN_TRANSIT' && cargo.status !== 'MANIFESTED') {
    return { error: `Kargo tidak valid untuk proses ARRIVED (Status: ${cargo.status}).` }
  }
  
  const { error } = await supabase
    .from('fleet_cargo_shipments')
    .update({ 
      status: 'ARRIVED',
      updated_at: new Date().toISOString() 
    })
    .eq('id', cargo.id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/fleet/cargo')
  return { success: true }
}

export async function processCargoDelivery(orgId: string, cargoId: string) {
  const supabase = await getSupabase()
  
  const { data: cargo, error: fetchErr } = await supabase
    .from('fleet_cargo_shipments')
    .select('id, status, payment_status')
    .eq('org_id', orgId)
    .eq('id', cargoId)
    .single()
    
  if (fetchErr) return { error: 'Kargo tidak ditemukan.' }
  if (cargo.status !== 'ARRIVED') return { error: 'Kargo belum tiba di tujuan (Status bukan ARRIVED).' }
  
  const { error } = await supabase
    .from('fleet_cargo_shipments')
    .update({ 
      status: 'DELIVERED',
      payment_status: 'PAID', // Otomatis lunas jika dibayar di tujuan
      updated_at: new Date().toISOString() 
    })
    .eq('id', cargo.id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/fleet/cargo')
  return { success: true }
}
