'use server'

// Server actions modul PO Bus — standalone, semua query ke tabel bus_*
// Tidak bergantung pada modul Fleet Management.
// Integrasi Fixed Assets: PO Bus baca dari fixed_assets (tidak menulis).

import { createClient } from '@/lib/supabase/server'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { revalidatePath } from 'next/cache'
import type {
  BusAgent, BusCheckpoint, BusCrew, BusEmergencyCall,
  BusMechanic, BusPool, BusPoolSettlement, BusPoolTopUp,
  BusRoute, BusSchedule, BusTicket,
  BusTireRecord, BusUnit, BusUnitStatus, EmergencyCallStatus,
  FixedAssetSummary,
} from '../lib/po-bus-types'

type DbError = { message: string }

async function resolveBranchId(orgId: string, branchId?: string | null): Promise<string | null> {
  const result = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in result) return null
  return result.branchId
}

// ─── FIXED ASSETS (read-only) ────────────────────────────────────────────────

export async function getFixedAssetsForBus(orgId: string): Promise<FixedAssetSummary[]> {
  const supabase = await createClient()

  // Ambil semua fixed assets — bisa difilter kategori kendaraan/bus di sisi UI
  const { data, error } = await (supabase as any)
    .from('fixed_assets')
    .select('id, code, name, category, purchase_date, purchase_price, salvage_value, useful_life_months, depreciation_method, accumulated_depreciation, current_book_value, last_depreciation_date, status')
    .eq('org_id', orgId)
    .neq('status', 'DISPOSED')
    .order('purchase_date', { ascending: false })

  if (error) return []
  return (data || []) as FixedAssetSummary[]
}

// ─── BUS UNITS ───────────────────────────────────────────────────────────────

async function autoRegisterFixedAsset(
  supabase: any,
  orgId: string,
  branchId: string,
  payload: {
    plate_number: string
    brand: string
    model: string
    purchase_price: number
    purchase_date: string
    useful_life_months?: number
    salvage_value?: number
    depreciation_method?: string
  }
): Promise<string | null> {
  const code = `BUS-${payload.plate_number.replace(/\s+/g, '').toUpperCase()}`
  const name = `Bus ${payload.brand} ${payload.model} — ${payload.plate_number.toUpperCase()}`

  const { data, error } = await supabase
    .from('fixed_assets')
    .insert([{
      org_id: orgId,
      branch_id: branchId,
      code,
      name,
      category: 'Kendaraan',
      purchase_date: payload.purchase_date,
      purchase_price: payload.purchase_price,
      salvage_value: payload.salvage_value || 0,
      useful_life_months: payload.useful_life_months || 60,
      depreciation_method: payload.depreciation_method || 'STRAIGHT_LINE',
      accumulated_depreciation: 0,
      current_book_value: payload.purchase_price,
      status: 'ACTIVE',
    }])
    .select('id')
    .single()

  if (error) return null
  return data?.id || null
}

export async function getBusUnits(orgId: string, branchId?: string | null): Promise<BusUnit[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_units')
    .select('*')
    .eq('org_id', orgId)
    .order('plate_number', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusUnit[]
}

export async function createBusUnit(orgId: string, payload: {
  plate_number: string
  brand: string
  model: string
  year?: number
  capacity?: number
  body_type?: string
  color?: string
  engine_number?: string
  chassis_number?: string
  purchase_price?: number
  purchase_date?: string
  useful_life_months?: number
  salvage_value?: number
  depreciation_method?: string
  fixed_asset_id?: string
  notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.plate_number?.trim() || !payload.model?.trim() || !payload.brand?.trim()) {
    return { error: 'Nomor plat, merek, dan model wajib diisi.' }
  }

  // Auto-register ke Fixed Assets jika harga beli & tanggal beli diisi
  let fixedAssetId = payload.fixed_asset_id || null
  if (!fixedAssetId && payload.purchase_price && payload.purchase_date && resolvedBranchId) {
    fixedAssetId = await autoRegisterFixedAsset(supabase as any, orgId, resolvedBranchId, {
      plate_number: payload.plate_number.trim(),
      brand: payload.brand.trim(),
      model: payload.model.trim(),
      purchase_price: payload.purchase_price,
      purchase_date: payload.purchase_date,
      useful_life_months: payload.useful_life_months,
      salvage_value: payload.salvage_value,
      depreciation_method: payload.depreciation_method,
    })
  }

  const { data, error } = await (supabase as any)
    .from('bus_units')
    .insert([{
      org_id: orgId,
      branch_id: resolvedBranchId,
      plate_number: payload.plate_number.trim().toUpperCase(),
      brand: payload.brand.trim(),
      model: payload.model.trim(),
      year: payload.year || null,
      capacity: payload.capacity || null,
      body_type: payload.body_type?.trim() || null,
      color: payload.color?.trim() || null,
      engine_number: payload.engine_number?.trim() || null,
      chassis_number: payload.chassis_number?.trim() || null,
      purchase_price: payload.purchase_price || null,
      purchase_date: payload.purchase_date || null,
      fixed_asset_id: fixedAssetId,
      status: 'TERSEDIA',
      odometer: 0,
      notes: payload.notes?.trim() || null,
    }])
    .select()
    .single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  revalidatePath('/accounting/assets')
  return { data }
}

export async function updateBusUnit(orgId: string, busId: string, payload: Partial<{
  plate_number: string
  brand: string
  model: string
  year: number
  capacity: number
  body_type: string
  color: string
  engine_number: string
  chassis_number: string
  purchase_price: number
  purchase_date: string
  notes: string
}>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_units')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', busId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function deleteBusUnit(orgId: string, busId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_units')
    .update({ status: 'TIDAK_AKTIF', updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', busId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function updateBusUnitStatus(orgId: string, busId: string, status: BusUnitStatus) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_units')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', busId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function updateBusOdometer(orgId: string, busId: string, odometer: number) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_units')
    .update({ odometer, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', busId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── CREW ─────────────────────────────────────────────────────────────────────

export async function getBusCrew(orgId: string, branchId?: string | null): Promise<BusCrew[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_crew')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusCrew[]
}

export async function createBusCrew(orgId: string, payload: {
  name: string
  role: string
  phone?: string
  nik?: string
  license_number?: string
  license_expiry?: string
  blood_type?: string
  join_date?: string
  notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.name?.trim()) return { error: 'Nama kru wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_crew')
    .insert([{
      org_id: orgId,
      branch_id: resolvedBranchId,
      name: payload.name.trim(),
      role: payload.role || 'DRIVER',
      phone: payload.phone?.trim() || null,
      nik: payload.nik?.trim() || null,
      license_number: payload.license_number?.trim() || null,
      license_expiry: payload.license_expiry || null,
      blood_type: payload.blood_type || null,
      join_date: payload.join_date || null,
      notes: payload.notes?.trim() || null,
      is_active: true,
    }])
    .select()
    .single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateBusCrew(orgId: string, crewId: string, payload: Partial<{
  name: string; role: string; phone: string; nik: string
  license_number: string; license_expiry: string; blood_type: string; is_active: boolean; notes: string
}>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_crew')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', crewId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function deleteBusCrew(orgId: string, crewId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_crew')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', crewId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── MECHANICS ────────────────────────────────────────────────────────────────

export async function getBusMechanics(orgId: string, branchId?: string | null): Promise<BusMechanic[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_mechanics')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusMechanic[]
}

export async function createBusMechanic(orgId: string, payload: {
  name: string; phone?: string; specialization?: string; notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.name?.trim()) return { error: 'Nama mekanik wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_mechanics')
    .insert([{
      org_id: orgId,
      branch_id: resolvedBranchId,
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      specialization: payload.specialization?.trim() || null,
      notes: payload.notes?.trim() || null,
      is_active: true,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateBusMechanic(orgId: string, mechanicId: string, payload: Partial<{
  name: string; phone: string; specialization: string; notes: string; is_active: boolean
}>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_mechanics')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', mechanicId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function deleteBusMechanic(orgId: string, mechanicId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_mechanics')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', mechanicId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── SERVICE RECORDS ──────────────────────────────────────────────────────────
// Menggunakan bus_service_records (standalone, FK → bus_units)
// karena sejak migration 1320 bus_units tidak bergantung pada fleet_assets.

export async function getBusServiceRecords(orgId: string, busId?: string | null) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bus_service_records')
    .select('*, bus:bus_units(id, plate_number, model)')
    .eq('org_id', orgId)
    .order('service_date', { ascending: false })

  if (busId) query = query.eq('bus_id', busId)

  const { data, error } = await query
  if (error) return []
  return data || []
}

export async function createBusServiceRecord(orgId: string, payload: {
  bus_id: string; service_date: string; description: string
  maintenance_type: string; cost: number; odometer_at: number
  technician_name?: string; next_service_km?: number; next_service_date?: string
}) {
  const supabase = await createClient()

  if (!payload.bus_id || !payload.description?.trim()) {
    return { error: 'Armada dan deskripsi servis wajib diisi.' }
  }

  const { data: bus } = await (supabase as any)
    .from('bus_units')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', payload.bus_id)
    .maybeSingle()

  if (!bus) return { error: 'Unit bus tidak ditemukan.' }

  const { data, error } = await (supabase as any)
    .from('bus_service_records')
    .insert([{
      org_id: orgId,
      branch_id: bus.branch_id,
      bus_id: payload.bus_id,
      service_date: payload.service_date,
      description: payload.description.trim(),
      maintenance_type: payload.maintenance_type || 'ROUTINE',
      cost: payload.cost || 0,
      odometer_at: payload.odometer_at || 0,
      technician_name: payload.technician_name?.trim() || null,
      next_service_km: payload.next_service_km || null,
      next_service_date: payload.next_service_date || null,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── TIRE RECORDS ─────────────────────────────────────────────────────────────

export async function getBusTireRecords(orgId: string, busId?: string | null): Promise<BusTireRecord[]> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bus_tire_records')
    .select('*, bus:bus_units(id, plate_number, model)')
    .eq('org_id', orgId)
    .order('installed_at', { ascending: false })

  if (busId) query = query.eq('bus_id', busId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as unknown as BusTireRecord[]
}

export async function createBusTireRecord(orgId: string, payload: {
  bus_id: string; position: string; brand?: string; size?: string
  installed_at?: string; odometer_at?: number; mileage_limit_km?: number; notes?: string
}) {
  const supabase = await createClient()

  if (!payload.bus_id || !payload.position) {
    return { error: 'Armada dan posisi ban wajib diisi.' }
  }

  const { data: bus } = await (supabase as any)
    .from('bus_units')
    .select('id, branch_id')
    .eq('org_id', orgId).eq('id', payload.bus_id)
    .maybeSingle()

  if (!bus) return { error: 'Unit bus tidak ditemukan.' }

  const { data, error } = await (supabase as any)
    .from('bus_tire_records')
    .insert([{
      org_id: orgId,
      branch_id: bus.branch_id,
      bus_id: payload.bus_id,
      position: payload.position,
      brand: payload.brand?.trim() || null,
      size: payload.size?.trim() || null,
      installed_at: payload.installed_at || null,
      odometer_at: payload.odometer_at || null,
      mileage_limit_km: payload.mileage_limit_km || null,
      notes: payload.notes?.trim() || null,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── EMERGENCY CALLS ─────────────────────────────────────────────────────────

export async function getBusEmergencyCalls(orgId: string, branchId?: string | null): Promise<BusEmergencyCall[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_emergency_calls')
    .select('*, bus:bus_units(id, plate_number, model), mechanic:bus_mechanics(id, name, phone)')
    .eq('org_id', orgId)
    .order('call_time', { ascending: false })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as unknown as BusEmergencyCall[]
}

export async function createBusEmergencyCall(orgId: string, payload: {
  bus_id?: string; reporter_name: string; call_time?: string
  location_description?: string; location_gps?: string
  issue_type: string; description?: string; assigned_mechanic_id?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.reporter_name?.trim()) return { error: 'Nama pelapor wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_emergency_calls')
    .insert([{
      org_id: orgId,
      branch_id: resolvedBranchId,
      bus_id: payload.bus_id || null,
      reporter_name: payload.reporter_name.trim(),
      call_time: payload.call_time || new Date().toISOString(),
      location_description: payload.location_description?.trim() || null,
      location_gps: payload.location_gps || null,
      issue_type: payload.issue_type || 'LAINNYA',
      description: payload.description?.trim() || null,
      assigned_mechanic_id: payload.assigned_mechanic_id || null,
      status: 'BUKA',
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateEmergencyCallStatus(
  orgId: string, callId: string, status: EmergencyCallStatus,
  resolutionNotes?: string, assignedMechanicId?: string
) {
  const supabase = await createClient()
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'SELESAI') { update.resolved_at = new Date().toISOString(); update.resolution_notes = resolutionNotes || null }
  if (assignedMechanicId) update.assigned_mechanic_id = assignedMechanicId

  const { error } = await (supabase as any)
    .from('bus_emergency_calls')
    .update(update)
    .eq('org_id', orgId).eq('id', callId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── AGENTS ───────────────────────────────────────────────────────────────────

export async function getBusAgents(orgId: string, branchId?: string | null): Promise<BusAgent[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_agents')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusAgent[]
}

export async function createBusAgent(orgId: string, payload: {
  name: string; phone?: string; email?: string; address?: string
  city?: string; commission_pct?: number; notes?: string; pool_id?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.name?.trim()) return { error: 'Nama agen wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_agents')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      commission_pct: payload.commission_pct || 0,
      notes: payload.notes?.trim() || null,
      pool_id: payload.pool_id || null,
      is_active: true,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateBusAgent(orgId: string, agentId: string, payload: Partial<{
  name: string; phone: string; email: string; address: string
  city: string; commission_pct: number; notes: string; is_active: boolean; pool_id: string
}>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_agents')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', agentId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

export async function deleteBusAgent(orgId: string, agentId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_agents')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', agentId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

export async function getBusRoutes(orgId: string, branchId?: string | null): Promise<BusRoute[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_routes')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusRoute[]
}

export async function createBusRoute(orgId: string, payload: {
  name: string; origin: string; destination: string
  distance_km?: number; duration_hours?: number; base_price?: number
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.name?.trim() || !payload.origin?.trim() || !payload.destination?.trim()) {
    return { error: 'Nama rute, asal, dan tujuan wajib diisi.' }
  }

  const { data, error } = await (supabase as any)
    .from('bus_routes')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      name: payload.name.trim(),
      origin: payload.origin.trim(),
      destination: payload.destination.trim(),
      distance_km: payload.distance_km || null,
      duration_hours: payload.duration_hours || null,
      base_price: payload.base_price || 0,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── SCHEDULES ────────────────────────────────────────────────────────────────

export async function getBusSchedules(orgId: string, branchId?: string | null): Promise<BusSchedule[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_schedules')
    .select(`
      *,
      route:bus_routes(id, name, origin, destination, base_price),
      bus:bus_units(id, plate_number, model),
      driver:bus_crew!bus_schedules_driver_id_fkey(id, name, phone),
      helper:bus_crew!bus_schedules_helper_id_fkey(id, name, phone)
    `)
    .eq('org_id', orgId)
    .order('departure_time', { ascending: false })
    .limit(100)

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as unknown as BusSchedule[]
}

export async function createBusSchedule(orgId: string, payload: {
  route_id: string; bus_id: string; driver_id?: string
  helper_id?: string; departure_time: string; arrival_time?: string; notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.route_id || !payload.bus_id || !payload.departure_time) {
    return { error: 'Rute, armada, dan waktu keberangkatan wajib diisi.' }
  }

  const { data, error } = await (supabase as any)
    .from('bus_schedules')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      route_id: payload.route_id,
      bus_id: payload.bus_id,
      driver_id: payload.driver_id || null,
      helper_id: payload.helper_id || null,
      departure_time: payload.departure_time,
      arrival_time: payload.arrival_time || null,
      notes: payload.notes?.trim() || null,
      status: 'TERJADWAL',
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateBusScheduleStatus(orgId: string, scheduleId: string, status: BusSchedule['status']) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_schedules')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', scheduleId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── TICKETS ──────────────────────────────────────────────────────────────────

export async function getBusTickets(orgId: string, scheduleId?: string | null): Promise<BusTicket[]> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bus_tickets')
    .select('*, schedule:bus_schedules(id, departure_time, route:bus_routes(name, origin, destination)), agent:bus_agents(id, name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (scheduleId) query = query.eq('schedule_id', scheduleId)

  const { data, error } = await query.limit(200)
  if (error) return []
  return (data || []) as unknown as BusTicket[]
}

export async function createBusTicket(orgId: string, payload: {
  schedule_id: string; passenger_name: string; passenger_phone?: string
  seat_number: string; price: number; agent_id?: string; pool_id?: string; notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.schedule_id || !payload.passenger_name?.trim() || !payload.seat_number) {
    return { error: 'Jadwal, nama penumpang, dan nomor kursi wajib diisi.' }
  }

  const { data, error } = await (supabase as any)
    .from('bus_tickets')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      schedule_id: payload.schedule_id,
      passenger_name: payload.passenger_name.trim(),
      passenger_phone: payload.passenger_phone?.trim() || null,
      seat_number: payload.seat_number.trim(),
      price: payload.price || 0,
      agent_id: payload.agent_id || null,
      pool_id: payload.pool_id || null,
      notes: payload.notes?.trim() || null,
      status: 'DIPESAN',
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── CHECKPOINTS ──────────────────────────────────────────────────────────────

export async function getBusCheckpoints(orgId: string, branchId?: string | null): Promise<BusCheckpoint[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_checkpoints')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusCheckpoint[]
}

export async function createBusCheckpoint(orgId: string, payload: {
  name: string; location?: string; gps_coordinates?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.name?.trim()) return { error: 'Nama checkpoint wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_checkpoints')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      name: payload.name.trim(),
      location_name: payload.location?.trim() || null,
      gps_coords: payload.gps_coordinates || null,
      is_active: true,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── POOLS ────────────────────────────────────────────────────────────────────

export async function getBusPools(orgId: string, branchId?: string | null): Promise<BusPool[]> {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('bus_pools')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  if (resolvedBranchId) query = query.eq('branch_id', resolvedBranchId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BusPool[]
}

export async function createBusPool(orgId: string, payload: {
  code: string; name: string; pool_type?: string
  owner_name?: string; pic_name?: string; phone?: string; whatsapp?: string; email?: string
  address?: string; city?: string; province?: string
  commission_pct?: number; credit_limit?: number
  bank_name?: string; bank_account?: string; bank_account_name?: string
  notes?: string
}) {
  const supabase = await createClient()
  const resolvedBranchId = await resolveBranchId(orgId)

  if (!payload.code?.trim()) return { error: 'Kode pool wajib diisi.' }
  if (!payload.name?.trim()) return { error: 'Nama pool wajib diisi.' }

  const { data, error } = await (supabase as any)
    .from('bus_pools')
    .insert([{
      org_id: orgId, branch_id: resolvedBranchId,
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      pool_type: payload.pool_type || 'AGEN_RESMI',
      owner_name: payload.owner_name?.trim() || null,
      pic_name: payload.pic_name?.trim() || null,
      phone: payload.phone?.trim() || null,
      whatsapp: payload.whatsapp?.trim() || null,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      province: payload.province?.trim() || null,
      commission_pct: payload.commission_pct ?? 0,
      deposit_balance: 0,
      credit_limit: payload.credit_limit ?? 0,
      bank_name: payload.bank_name?.trim() || null,
      bank_account: payload.bank_account?.trim() || null,
      bank_account_name: payload.bank_account_name?.trim() || null,
      is_active: true,
      notes: payload.notes?.trim() || null,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function updateBusPool(orgId: string, poolId: string, payload: Partial<{
  code: string; name: string; pool_type: string
  owner_name: string; pic_name: string; phone: string; whatsapp: string; email: string
  address: string; city: string; province: string
  commission_pct: number; credit_limit: number
  bank_name: string; bank_account: string; bank_account_name: string
  is_active: boolean; notes: string
}>) {
  const supabase = await createClient()

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  const strFields = ['name','owner_name','pic_name','phone','whatsapp','email','address','city','province','bank_name','bank_account','bank_account_name','notes']
  for (const f of strFields) {
    if (f in payload) updates[f] = (payload as any)[f]?.trim() || null
  }
  if ('code' in payload && payload.code) updates.code = payload.code.trim().toUpperCase()
  if ('pool_type' in payload) updates.pool_type = payload.pool_type
  if ('commission_pct' in payload) updates.commission_pct = payload.commission_pct
  if ('credit_limit' in payload) updates.credit_limit = payload.credit_limit
  if ('is_active' in payload) updates.is_active = payload.is_active

  const { data, error } = await (supabase as any)
    .from('bus_pools')
    .update(updates)
    .eq('org_id', orgId)
    .eq('id', poolId)
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

export async function deleteBusPool(orgId: string, poolId: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bus_pools')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', poolId)

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { success: true }
}

// ─── POOL TOP-UPS ─────────────────────────────────────────────────────────────

export async function getBusPoolTopUps(orgId: string, poolId?: string | null): Promise<BusPoolTopUp[]> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bus_pool_top_ups')
    .select('*, pool:bus_pools(id, code, name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (poolId) query = query.eq('pool_id', poolId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as unknown as BusPoolTopUp[]
}

export async function createBusPoolTopUp(orgId: string, payload: {
  pool_id: string; amount: number; payment_method?: string; reference_no?: string; notes?: string
}) {
  if (!payload.pool_id) return { error: 'Pool wajib dipilih.' }
  if (!payload.amount || payload.amount <= 0) return { error: 'Jumlah top-up harus lebih dari 0.' }

  const { queryPostgres } = await import('@/lib/db/postgres')

  let insertedRow: Record<string, unknown>
  try {
    const insertResult = await queryPostgres(
      `INSERT INTO bus_pool_top_ups (org_id, pool_id, amount, payment_method, reference_no, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, payload.pool_id, payload.amount,
       payload.payment_method || 'TRANSFER',
       payload.reference_no?.trim() || null,
       payload.notes?.trim() || null]
    )
    insertedRow = insertResult.rows[0]
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan top-up.' }
  }

  await queryPostgres(
    `UPDATE bus_pools SET deposit_balance = deposit_balance + $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3`,
    [payload.amount, payload.pool_id, orgId]
  )

  revalidatePath('/po-bus')
  return { data: insertedRow }
}

// ─── POOL SETTLEMENTS ─────────────────────────────────────────────────────────

export async function getBusPoolSettlements(orgId: string, poolId?: string | null): Promise<BusPoolSettlement[]> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('bus_pool_settlements')
    .select('*, pool:bus_pools(id, code, name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (poolId) query = query.eq('pool_id', poolId)

  const { data, error } = await query
  if (error) return []
  return (data || []) as unknown as BusPoolSettlement[]
}

export async function createBusPoolSettlement(orgId: string, payload: {
  pool_id: string; period_start: string; period_end: string
  total_tickets: number; total_revenue: number; commission_pct: number
  payment_method?: string; reference_no?: string; notes?: string
}) {
  if (!payload.pool_id) return { error: 'Pool wajib dipilih.' }
  if (!payload.period_start || !payload.period_end) return { error: 'Periode wajib diisi.' }

  const supabase = await createClient()
  const commissionAmount = Math.round(payload.total_revenue * (payload.commission_pct / 100) * 100) / 100

  const { data, error } = await (supabase as any)
    .from('bus_pool_settlements')
    .insert([{
      org_id: orgId, pool_id: payload.pool_id,
      period_start: payload.period_start, period_end: payload.period_end,
      total_tickets: payload.total_tickets || 0,
      total_revenue: payload.total_revenue || 0,
      commission_pct: payload.commission_pct || 0,
      commission_amount: commissionAmount,
      payment_method: payload.payment_method || 'TRANSFER',
      reference_no: payload.reference_no?.trim() || null,
      status: 'PENDING', notes: payload.notes?.trim() || null,
    }])
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}

// ─── SINGLE-RECORD FETCHES (for detail pages) ─────────────────────────────────

export async function getBusPoolById(orgId: string, poolId: string): Promise<BusPool | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bus_pools')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', poolId)
    .single()
  if (error || !data) return null
  return data as BusPool
}

export async function getBusPoolByCode(orgId: string, code: string): Promise<BusPool | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bus_pools')
    .select('*')
    .eq('org_id', orgId)
    .eq('code', code.toUpperCase())
    .single()
  if (error || !data) return null
  return data as BusPool
}

export async function getBusCrewById(orgId: string, crewId: string): Promise<BusCrew | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bus_crew')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', crewId)
    .single()
  if (error || !data) return null
  return data as BusCrew
}

export async function getBusCrewByNik(orgId: string, nik: string): Promise<BusCrew | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bus_crew')
    .select('*')
    .eq('org_id', orgId)
    .eq('nik', nik)
    .single()
  if (error || !data) return null
  return data as BusCrew
}

export async function getSchedulesByCrewId(orgId: string, crewId: string): Promise<BusSchedule[]> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bus_schedules')
    .select('*, route:bus_routes(id,name,origin,destination,base_price), bus:bus_units(id,plate_number,model)')
    .eq('org_id', orgId)
    .or(`driver_id.eq.${crewId},helper_id.eq.${crewId}`)
    .order('departure_time', { ascending: false })
    .limit(50)
  if (error) return []
  return (data || []) as BusSchedule[]
}

export async function getCargoCountByPool(orgId: string): Promise<Record<string, number>> {
  const { queryPostgres } = await import('@/lib/db/postgres')
  try {
    const result = await queryPostgres(
      `SELECT bus_pool_id, COUNT(*) as cnt
       FROM fleet_cargo_shipments
       WHERE org_id = $1 AND bus_pool_id IS NOT NULL
       GROUP BY bus_pool_id`,
      [orgId]
    )
    return Object.fromEntries((result.rows as { bus_pool_id: string; cnt: string }[]).map(r => [r.bus_pool_id, Number(r.cnt)]))
  } catch {
    return {}
  }
}

export async function markSettlementPaid(orgId: string, settlementId: string, referenceNo?: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('bus_pool_settlements')
    .update({ status: 'DIBAYAR', paid_at: new Date().toISOString(), reference_no: referenceNo?.trim() || null })
    .eq('org_id', orgId).eq('id', settlementId)
    .select().single()

  if (error) return { error: (error as DbError).message }
  revalidatePath('/po-bus')
  return { data }
}
