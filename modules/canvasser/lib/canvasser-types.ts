// Tipe data untuk modul Canvasser (sales lapangan / distribusi van).

export interface CanvasserVan {
  id: string
  orgId: string
  branchId: string | null
  code: string
  name: string
  plateNumber: string | null
  canvasserEmployeeId: string | null
  driverName: string
  driverPhone: string | null
  fixedAssetId: string | null
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeOption {
  id: string
  name: string
  phone: string | null
}

export type SessionStatus = 'AKTIF' | 'SELESAI'

export interface StockItem {
  product_id: string
  product_name: string
  qty_loaded: number
  qty_sold?: number
  qty_return?: number
  unit: string
}

export interface CanvasserSession {
  id: string
  orgId: string
  vanId: string
  sessionDate: string
  status: SessionStatus
  openingStock: StockItem[]
  closingStock: StockItem[] | null
  totalCashCollected: number
  totalArCollected: number
  totalSales: number
  closingJournalEntryId: string | null
  notes: string | null
  closedAt: string | null
  createdAt: string
  van?: Pick<CanvasserVan, 'id' | 'code' | 'name' | 'driverName'>
}

export type VisitStatus = 'BELUM' | 'DALAM_PERJALANAN' | 'SELESAI' | 'SKIP'
export type ARStatus = 'NORMAL' | 'MENDEKATI_LIMIT' | 'BLOKIR'

export interface CanvasserVisit {
  id: string
  orgId: string
  sessionId: string
  contactId: string | null
  visitOrder: number
  contactName: string
  address: string | null
  status: VisitStatus
  arOutstanding: number
  creditLimit: number
  arStatus: ARStatus
  arrivedAt: string | null
  departedAt: string | null
  gpsLat: number | null
  gpsLng: number | null
  notes: string | null
  createdAt: string
  orders?: CanvasserOrder[]
  arCollections?: CanvasserARCollection[]
}

export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'KREDIT'

export interface CanvasserOrder {
  id: string
  orgId: string
  sessionId: string
  visitId: string
  contactId: string | null
  orderNumber: string
  paymentMethod: PaymentMethod
  subtotal: number
  discount: number
  total: number
  status: 'SELESAI' | 'BATAL'
  notes: string | null
  createdAt: string
  items?: CanvasserOrderItem[]
}

export interface CanvasserOrderItem {
  id: string
  orderId: string
  productId: string | null
  productName: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface CanvasserARCollection {
  id: string
  orgId: string
  sessionId: string
  visitId: string
  contactId: string
  amount: number
  paymentMethod: PaymentMethod
  referenceNo: string | null
  notes: string | null
  createdAt: string
}

// AR display per contact — dihitung dari sales/sales_payments/sales_returns.
export interface ContactARSummary {
  contactId: string
  contactName: string
  creditLimit: number
  outstandingTotal: number
  overdue30: number
  overdue60: number
  overdue90Plus: number
  arStatus: ARStatus
  lastPaymentDate: string | null
}

export interface CanvasserDashboardVan extends CanvasserVan {
  session: CanvasserSession | null
  visitsDone: number
  visitsTotal: number
}

export interface CanvasserTodayDashboard {
  activeVans: number
  totalSalesToday: number
  totalCashCollected: number
  totalArCollected: number
  vans: CanvasserDashboardVan[]
}

// ─── Customer roster & ledger (AR per konsumen per canvasser) ─────────────────

export interface CanvasserCustomerRosterEntry {
  contactId: string
  contactName: string
  address: string | null
  arOutstanding: number
  creditLimit: number
  arStatus: ARStatus
  lifetimeOrderCount: number
  lifetimeSalesTotal: number
  lastVisitDate: string | null
}

export interface CanvasserCustomerLedger {
  contact: ContactARSummary
  orders: CanvasserOrder[]
  arCollections: CanvasserARCollection[]
}

// ─── GPS lokasi terakhir van ────────────────────────────────────────────────

export interface CanvasserVanLocation {
  vanId: string
  orgId: string
  lat: number
  lng: number
  accuracyM: number | null
  updatedAt: string
}

// ─── Laporan performa harian ────────────────────────────────────────────────

export interface CanvasserPerformanceReportRow {
  vanId: string
  vanCode: string
  vanName: string
  sessionDate: string
  salesTotal: number
  cashCollected: number
  arCollected: number
  visitsDone: number
  visitsTotal: number
}

export interface CanvasserPerformanceReport {
  from: string
  to: string
  rows: CanvasserPerformanceReportRow[]
  totals: {
    salesTotal: number
    cashCollected: number
    arCollected: number
    visitsDone: number
    visitsTotal: number
  }
}
