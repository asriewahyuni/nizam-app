// Tipe data untuk modul operasional bengkel motor.

export type WorkshopStatus =
  | 'ANTRI'
  | 'DIKERJAKAN'
  | 'MENUNGGU_PART'
  | 'SELESAI'
  | 'DISERAHKAN'
  | 'CANCEL'

export type WorkshopItemType = 'JASA' | 'PART'

export interface WorkshopVehicle {
  id: string
  orgId: string
  branchId: string | null
  contactId: string | null
  contactName: string
  plateNumber: string
  brand: string
  model: string
  year: number | null
  color: string | null
  engineNumber: string | null
  chassisNumber: string | null
  fuelType: string
  transmission: string
  lastOdometer: number
  notes: string | null
  createdAt: string
}

export interface WorkshopWorkOrderItem {
  id: string
  workOrderId: string
  itemType: WorkshopItemType
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  notes: string | null
}

export interface WorkshopWorkOrder {
  id: string
  orgId: string
  branchId: string | null
  spkNumber: string
  vehicleId: string | null
  vehicle: Pick<WorkshopVehicle, 'plateNumber' | 'brand' | 'model'> | null
  contactId: string | null
  contactName: string
  mechanicName: string | null
  status: WorkshopStatus
  customerComplaint: string | null
  diagnosis: string | null
  odometerIn: number | null
  odometerOut: number | null
  estimatedFinish: string | null
  actualFinish: string | null
  subtotal: number
  discount: number
  total: number
  notes: string | null
  items: WorkshopWorkOrderItem[]
  createdAt: string
}
