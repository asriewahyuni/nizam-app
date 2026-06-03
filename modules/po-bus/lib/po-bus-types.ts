// Types untuk modul PO Bus — standalone, tidak bergantung Fleet Management
// Fixed Assets dibaca (read-only) dari modul Accounting

export type FixedAssetSummary = {
  id: string
  code: string
  name: string
  category: string
  purchase_date: string
  purchase_price: number
  salvage_value: number
  useful_life_months: number
  depreciation_method: string
  accumulated_depreciation: number
  current_book_value: number
  last_depreciation_date: string | null
  status: string
}

export type BusUnitStatus = 'TERSEDIA' | 'BEROPERASI' | 'SERVIS' | 'TIDAK_AKTIF'

export type BusUnit = {
  id: string
  org_id: string
  branch_id: string | null
  plate_number: string
  brand: string
  model: string
  year: number | null
  capacity: number | null
  body_type: string | null
  engine_number: string | null
  chassis_number: string | null
  color: string | null
  status: BusUnitStatus
  odometer: number
  purchase_price: number | null
  purchase_date: string | null
  fixed_asset_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type BusCrewRole = 'DRIVER' | 'CO_DRIVER' | 'KERNET' | 'KONDEKTUR'

export type BusCrew = {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  role: BusCrewRole
  phone: string | null
  nik: string | null
  license_number: string | null
  license_expiry: string | null
  blood_type: string | null
  join_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export type BusMechanic = {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  phone: string | null
  specialization: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type BusTireRecord = {
  id: string
  org_id: string
  branch_id: string | null
  bus_id: string
  position: string
  brand: string | null
  size: string | null
  installed_at: string | null
  odometer_at: number | null
  mileage_limit_km: number | null
  notes: string | null
  created_at: string
  bus?: Pick<BusUnit, 'id' | 'plate_number' | 'model'> | null
}

export type EmergencyCallStatus = 'BUKA' | 'DALAM_PROSES' | 'SELESAI'
export type EmergencyIssueType = 'MOGOK' | 'KECELAKAAN' | 'BAN_BOCOR' | 'OVERHEAT' | 'LAINNYA'

export type BusEmergencyCall = {
  id: string
  org_id: string
  branch_id: string | null
  bus_id: string | null
  reporter_name: string
  call_time: string
  location_description: string | null
  location_gps: string | null
  issue_type: EmergencyIssueType
  description: string | null
  assigned_mechanic_id: string | null
  status: EmergencyCallStatus
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
  bus?: Pick<BusUnit, 'id' | 'plate_number' | 'model'> | null
  mechanic?: Pick<BusMechanic, 'id' | 'name' | 'phone'> | null
}

export type BusAgent = {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  commission_pct: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type BusRoute = {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  origin: string
  destination: string
  distance_km: number | null
  duration_hours: number | null
  base_price: number
  is_active: boolean
  created_at: string
}

export type BusScheduleStatus = 'TERJADWAL' | 'BERANGKAT' | 'TIBA' | 'BATAL'

export type BusSchedule = {
  id: string
  org_id: string
  branch_id: string | null
  route_id: string
  bus_id: string
  driver_id: string | null
  helper_id: string | null
  departure_time: string
  arrival_time: string | null
  status: BusScheduleStatus
  notes: string | null
  created_at: string
  route?: Pick<BusRoute, 'id' | 'name' | 'origin' | 'destination' | 'base_price'> | null
  bus?: Pick<BusUnit, 'id' | 'plate_number' | 'model'> | null
  driver?: Pick<BusCrew, 'id' | 'name' | 'phone'> | null
  helper?: Pick<BusCrew, 'id' | 'name' | 'phone'> | null
  ticket_count?: number
}

export type BusTicketStatus = 'DIPESAN' | 'DIBAYAR' | 'DIGUNAKAN' | 'BATAL'

export type BusTicket = {
  id: string
  org_id: string
  branch_id: string | null
  schedule_id: string
  agent_id: string | null
  passenger_name: string
  passenger_phone: string | null
  seat_number: string
  price: number
  status: BusTicketStatus
  notes: string | null
  created_at: string
  schedule?: Pick<BusSchedule, 'id' | 'departure_time' | 'route'> | null
  agent?: Pick<BusAgent, 'id' | 'name'> | null
}

export type BusCheckpoint = {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  location_name: string | null
  gps_coords: string | null
  is_active: boolean
  created_at: string
}
