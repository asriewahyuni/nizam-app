// Manually maintained database types
// Last updated: 2026-05-07 — comprehensive table & RPC definitions

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Shared Enums ──────────────────────────────────────────────
export type NormalBalance = 'DEBIT' | 'CREDIT'
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
export type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING'
export type CoAManagementMode = 'INHERITED' | 'LOCAL'
export type JournalReferenceType = string

// ─── Row Types ─────────────────────────────────────────────────
export type Account = {
  id: string; org_id: string; code: string; name: string
  type: AccountType; normal_balance: NormalBalance
  parent_id: string | null; description: string | null
  cash_flow_category?: CashFlowCategory | null
  is_system: boolean; is_active: boolean
  created_at: string; updated_at: string
}
export type AccountBalance = {
  org_id: string; account_id: string; code: string; name: string
  type: string; normal_balance: string; balance: number
  total_debit: number; total_credit: number
}
export type BankAccount = {
  id: string; org_id: string; branch_id: string; account_id: string; account_name: string
  bank_name: string; account_number: string | null; currency: string
  current_balance: number; is_active: boolean
  created_at: string; updated_at: string
}
export type BankTransaction = {
  id: string; org_id: string; branch_id: string; bank_account_id: string
  transaction_date: string; description: string
  amount: number; type: string; reference_id: string | null
  journal_entry_id: string | null; balance_after: number
  status: string; is_reconciled: boolean; created_at: string
}
export type Product = {
  id: string; org_id: string; sku: string | null; barcode: string | null
  name: string; type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE'
  description: string | null; unit: string; category: string
  purchase_price: number; selling_price: number
  asset_account_id: string | null; income_account_id: string | null
  expense_account_id: string | null; is_active: boolean
  created_at: string; updated_at: string
}
export type Organization = {
  id: string; name: string; slug: string; logo_url: string | null
  parent_org_id?: string | null
  coa_management_mode?: CoAManagementMode | null
  settings: Json; is_active: boolean; created_at: string; updated_at: string
}
export type CoaConsolidationMapping = {
  id: string
  parent_org_id: string
  child_org_id: string
  local_account_id: string
  group_account_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export type Warehouse = {
  id: string; org_id: string; code: string; name: string
  branch_id: string | null; address: string | null; is_active: boolean; created_at: string; updated_at: string
}
export type InventoryStock = {
  id: string; org_id: string; product_id: string; warehouse_id: string
  quantity: number; batch_number: string | null; expiry_date: string | null
  created_at: string; updated_at: string
}
export type StockMovement = {
  id: string; org_id: string; branch_id: string | null; product_id: string; movement_date: string
  quantity: number; unit_price: number; reference_type: string
  reference_id: string; notes: string | null; created_at: string
}
export type InventoryAdjustment = {
  id: string; org_id: string; adj_number: string; adj_date: string
  type: string; status: string; total_value: number; notes: string | null
  journal_entry_id: string | null; created_by: string | null
  created_at: string; updated_at: string
}
export type JournalEntry = {
  id: string; org_id: string; branch_id: string | null; entry_number: string; entry_date: string
  description: string; reference_type: string; reference_id: string | null
  status: string; is_auto: boolean; notes: string | null
  created_by: string | null; posted_at: string | null
  voided_at: string | null; voided_by: string | null; void_reason: string | null
  created_at: string; updated_at: string
}
export type JournalLine = {
  id: string; entry_id: string; account_id: string
  debit: number; credit: number; memo: string | null
}
export type Contact = {
  id: string; org_id: string; type: string; name: string
  email: string | null; phone: string | null; address: string | null
  is_active: boolean; created_at: string; updated_at: string
}
export type AuditLog = {
  id: string; org_id: string; user_id: string | null
  action: string; table_name: string; record_id: string | null
  old_data: Json | null; new_data: Json | null
  ip_address: string | null; user_agent: string | null; created_at: string
}
export type Employee = {
  id: string; org_id: string; user_id: string | null
  branch_id: string | null
  nik: string; first_name: string; last_name: string | null
  email: string | null; phone: string | null
  date_of_birth: string | null; gender: string | null
  marital_status: string | null; tax_status: string | null
  job_title: string; department: string | null; department_id: string | null
  join_date: string; end_date: string | null
  employment_status: string; registration_status: string
  bank_name: string | null; bank_account_number: string | null; bank_account_holder: string | null
  basic_salary: number; license_number: string | null; license_expiry: string | null
  blood_type: string | null; created_at: string; updated_at: string
}
export type Attendance = {
  id: string; org_id: string; branch_id: string | null; employee_id: string
  record_date: string; check_in: string | null; check_out: string | null
  status: string; notes: string | null
  location_gps: string | null; qr_scanned_payload: string | null; meta: Json
  created_at: string; updated_at: string
}
export type ExpenseClaim = {
  id: string; org_id: string; branch_id: string; employee_id: string
  claim_date: string; category: string; amount: number
  description: string; receipt_url: string | null; status: string
  approved_by: string | null; journal_entry_id: string | null
  created_at: string; updated_at: string
}
export type LeaveRequest = {
  id: string; org_id: string; branch_id: string; employee_id: string
  leave_type: string; start_date: string; end_date: string; days_taken: number
  reason: string; status: string; approved_by: string | null; approved_at: string | null
  created_at: string; updated_at: string
}
export type FleetAsset = {
  id: string; org_id: string; branch_id: string; plate_number: string; model: string
  brand: string | null; type: string; status: string
  odometer: number; daily_rate: number; notes: string | null
  metadata: Json | null; capacity: number | null
  created_at: string; updated_at: string
}
export type FleetBooking = {
  id: string; org_id: string; branch_id: string; asset_id: string; contact_id: string
  start_date: string; end_date: string; status: string
  total_amount: number; deposit: number; payment_status: string | null
  notes: string | null; created_at: string; updated_at: string
}
export type FleetRoute = {
  id: string; org_id: string; branch_id: string; name: string
  origin: string; destination: string
  distance_km: number | null; base_price: number
  created_at: string; updated_at: string
}
export type FleetSchedule = {
  id: string; org_id: string; branch_id: string; route_id: string; asset_id: string
  driver_id: string | null; helper_id: string | null
  departure_time: string; arrival_time: string | null
  status: string; created_at: string; updated_at: string
}
export type FleetTicket = {
  id: string; org_id: string; branch_id: string; schedule_id: string; passenger_id: string
  seat_number: string; price: number; status: string
  notes: string | null; created_at: string; updated_at: string
}
export type FleetMaintenanceLab = {
  id: string; org_id: string; branch_id: string; asset_id: string; service_date: string
  description: string; cost: number; odometer_at: number | null
  next_service_km: number | null; maintenance_number: string | null
  maintenance_type: string | null; vendor_name: string | null; technician_name: string | null
  parts_replaced: Json; lab_notes: string | null; next_service_date: string | null
  attachment_url: string | null; technician_rating: number | null
  created_at: string
}
export type FleetTerminal = {
  id: string; org_id: string; branch_id: string; name: string
  location_name: string | null; gps_coords: string | null
  radius_meters: number | null; qr_code_token: string | null
  created_at: string
}

export type CargoStatus = 'DRAFT' | 'MANIFESTED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'CANCELLED'
export type CargoPaymentStatus = 'UNPAID' | 'PAID'

export type FleetCargoShipment = {
  id: string
  org_id: string
  branch_id?: string | null
  tracking_number: string
  sender_name: string
  sender_phone: string
  receiver_name: string
  receiver_phone: string
  origin_terminal_id: string
  destination_terminal_id: string
  item_description?: string | null
  weight_kg: number
  volume_m3: number
  shipping_cost: number
  handling_fee: number
  grand_total: number
  payment_status: CargoPaymentStatus
  payment_method?: string | null
  schedule_id?: string | null
  status: CargoStatus
  created_at: string
  updated_at: string
}

export type FixedAsset = {
  id: string; org_id: string; branch_id: string; code: string
  name: string; description: string | null; category: string | null
  purchase_date: string; purchase_price: number; salvage_value: number
  useful_life_months: number; asset_account_id: string | null
  accum_dep_account_id: string | null; dep_expense_account_id: string | null
  depreciation_method: string; status: string
  accumulated_depreciation: number; current_book_value: number
  last_depreciation_date: string | null; created_at: string; updated_at: string
}
export type AssetDepreciationLog = {
  id: string; asset_id: string; org_id: string; branch_id: string
  period_date: string; amount: number; journal_entry_id: string | null
  created_at: string
}
export type ProductionBom = {
  id: string; org_id: string; branch_id: string | null; product_id: string
  code: string; description: string | null; is_active: boolean
  created_at: string; updated_at: string
}
export type ProductionBomItem = {
  id: string; bom_id: string; product_id: string
  quantity: number; unit: string | null; created_at: string
}
export type ProductionWorkOrder = {
  id: string; org_id: string; branch_id: string | null; bom_id: string
  wo_number: string; quantity_planned: number; quantity_actual: number
  status: string; released_at: string | null; completed_at: string | null
  notes: string | null; created_at: string; updated_at: string
}
export type ProductionWorkOrderCost = {
  id: string; wo_id: string; description: string; amount: number
  cost_type: string; created_at: string
}
export type TrainingCourseAssessment = {
  id: string
  org_id: string
  course_slug: string
  assessment_version: string
  participant_name: string
  participant_reference: string | null
  participant_role: string | null
  assessor_user_id: string | null
  assessor_name: string
  decision: 'COMPETENT' | 'NOT_YET_COMPETENT'
  theory_status: 'UNDERSTOOD' | 'PARTIAL' | 'NOT_YET'
  practice_status: 'SUCCESS' | 'NEEDS_SUPPORT' | 'FAILED'
  checklist_results: Json
  evidence_summary: string | null
  strengths: string | null
  repeated_errors: string | null
  follow_up: string | null
  metadata: Json
  created_at: string
  updated_at: string
}
export type TrainingCourseAnswerSubmission = {
  id: string
  org_id: string
  course_slug: string
  assessment_version: string
  participant_user_id: string | null
  participant_name: string
  participant_reference: string | null
  participant_role: string | null
  theory_answers: Json
  practical_answers: Json
  general_notes: string | null
  status: 'SUBMITTED' | 'REVIEWED'
  reviewer_user_id: string | null
  reviewer_name: string | null
  reviewer_note: string | null
  reviewed_at: string | null
  metadata: Json
  created_at: string
  updated_at: string
}
export type HrisCompetencyTraining = {
  id: string
  org_id: string
  branch_id: string | null
  title: string
  skill_category: string
  target_role: string | null
  training_type: 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION' | 'COACHING'
  delivery_mode: 'CLASSROOM' | 'ONLINE' | 'HYBRID' | 'ON_THE_JOB'
  scope_type: 'ORG' | 'BRANCH'
  status: 'DRAFT' | 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED'
  facilitator_name: string | null
  start_date: string | null
  end_date: string | null
  duration_hours: number
  objective: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export type HrisCompetencyTrainingParticipant = {
  id: string
  training_id: string
  org_id: string
  employee_id: string
  status: 'ASSIGNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  assigned_at: string
  assigned_by: string | null
  completed_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}
export type HrisCompetencyTrainingSession = {
  id: string
  training_id: string
  org_id: string
  branch_id: string | null
  title: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  facilitator_name: string | null
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED'
  note: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export type HrisCompetencyTrainingEvaluation = {
  id: string
  training_id: string
  org_id: string
  participant_id: string
  session_id: string | null
  evaluator_name: string
  evaluation_type: 'PRETEST' | 'POSTTEST' | 'OBSERVATION' | 'ASSESSMENT' | 'CERTIFICATION'
  result_status: 'OBSERVED' | 'PASS' | 'REMEDIAL' | 'FAIL'
  score: number | null
  note: string | null
  evaluated_at: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// ─── Workshop / Bengkel Motor ─────────────────────────────────────────────────

export type WorkshopVehicleRow = {
  id: string
  org_id: string
  branch_id: string | null
  contact_id: string | null
  plate_number: string
  brand: string
  model: string
  year: number | null
  color: string | null
  engine_number: string | null
  chassis_number: string | null
  fuel_type: string
  transmission: string
  last_odometer: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type WorkshopWorkOrderRow = {
  id: string
  org_id: string
  branch_id: string | null
  spk_number: string
  vehicle_id: string | null
  contact_id: string | null
  mechanic_name: string | null
  status: 'ANTRI' | 'DIKERJAKAN' | 'MENUNGGU_PART' | 'SELESAI' | 'DISERAHKAN' | 'CANCEL'
  customer_complaint: string | null
  diagnosis: string | null
  odometer_in: number | null
  odometer_out: number | null
  estimated_finish: string | null
  actual_finish: string | null
  subtotal: number
  discount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type WorkshopWorkOrderItemRow = {
  id: string
  work_order_id: string
  item_type: 'JASA' | 'PART'
  name: string
  quantity: number
  unit_price: number
  subtotal: number
  notes: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Account>
        Relationships: []
      }
      bank_accounts: {
        Row: {
          id: string
          org_id: string
          branch_id: string
          account_id: string
          bank_name: string
          account_number: string | null
          account_holder: string | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          branch_id: string
          account_id: string
          bank_name: string
          account_number?: string | null
          account_holder?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: string
          org_id: string
          branch_id: string
          account_id: string
          bank_name: string
          account_number: string | null
          account_holder: string | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }>
        Relationships: []
      }
      bank_transactions: {
        Row: {
          id: string
          org_id: string
          branch_id: string
          bank_account_id: string
          transaction_date: string
          description: string
          amount: number
          type: 'IN' | 'OUT'
          reference_number: string | null
          category_id: string | null
          journal_entry_id: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          branch_id: string
          bank_account_id: string
          transaction_date?: string
          description: string
          amount: number
          type: 'IN' | 'OUT'
          reference_number?: string | null
          category_id?: string | null
          journal_entry_id?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: string
          org_id: string
          branch_id: string
          bank_account_id: string
          transaction_date: string
          description: string
          amount: number
          type: 'IN' | 'OUT'
          reference_number: string | null
          category_id: string | null
          journal_entry_id: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }>
        Relationships: []
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Product>
        Relationships: []
      }
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Organization>
        Relationships: []
      }
      coa_consolidation_mappings: {
        Row: CoaConsolidationMapping
        Insert: Omit<CoaConsolidationMapping, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<CoaConsolidationMapping>
        Relationships: []
      }
      training_course_assessments: {
        Row: TrainingCourseAssessment
        Insert: Omit<TrainingCourseAssessment, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<TrainingCourseAssessment>
        Relationships: []
      }
      training_course_answer_submissions: {
        Row: TrainingCourseAnswerSubmission
        Insert: Omit<TrainingCourseAnswerSubmission, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<TrainingCourseAnswerSubmission>
        Relationships: []
      }
      hris_competency_trainings: {
        Row: HrisCompetencyTraining
        Insert: Omit<HrisCompetencyTraining, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<HrisCompetencyTraining>
        Relationships: []
      }
      hris_competency_training_participants: {
        Row: HrisCompetencyTrainingParticipant
        Insert: Omit<HrisCompetencyTrainingParticipant, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<HrisCompetencyTrainingParticipant>
        Relationships: []
      }
      hris_competency_training_sessions: {
        Row: HrisCompetencyTrainingSession
        Insert: Omit<HrisCompetencyTrainingSession, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<HrisCompetencyTrainingSession>
        Relationships: []
      }
      hris_competency_training_evaluations: {
        Row: HrisCompetencyTrainingEvaluation
        Insert: Omit<HrisCompetencyTrainingEvaluation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<HrisCompetencyTrainingEvaluation>
        Relationships: []
      }
      warehouses: {
        Row: Warehouse
        Insert: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Warehouse>
        Relationships: []
      }
      inventory_stocks: {
        Row: InventoryStock
        Insert: Omit<InventoryStock, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<InventoryStock>
        Relationships: []
      }
      stock_movements: {
        Row: StockMovement
        Insert: Omit<StockMovement, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<StockMovement>
        Relationships: []
      }
      inventory_adjustments: {
        Row: InventoryAdjustment
        Insert: Omit<InventoryAdjustment, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<InventoryAdjustment>
        Relationships: []
      }
      inventory_adjustment_items: {
        Row: { id: string; org_id: string; adjustment_id: string; product_id: string; warehouse_id: string | null; actual_quantity: number; diff_quantity: number; unit_cost: number; total_value: number; notes: string | null; created_at: string }
        Insert: { id?: string; org_id: string; adjustment_id: string; product_id: string; warehouse_id?: string | null; actual_quantity: number; diff_quantity: number; unit_cost: number; total_value: number; notes?: string | null; created_at?: string }
        Update: Partial<{ id: string; org_id: string; adjustment_id: string; product_id: string; warehouse_id: string | null; actual_quantity: number; diff_quantity: number; unit_cost: number; total_value: number; notes: string | null; created_at: string }>
        Relationships: []
      }
      journal_entries: {
        Row: JournalEntry
        Insert: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<JournalEntry>
        Relationships: []
      }
      journal_lines: {
        Row: JournalLine
        Insert: Omit<JournalLine, 'id'> & { id?: string }
        Update: Partial<JournalLine>
        Relationships: []
      }
      zakat_haul: {
        Row: { id: string; org_id: string; haul_start_date: string; gold_price_per_gram: number; silver_price_per_gram: number; nishab_gold: number; nishab_silver: number; status: string; batal_reason: string | null; gold_price_source: string; gold_price_evidence_url: string | null; gold_price_set_by: string | null; gold_price_set_at: string; created_at: string; updated_at: string }
        Insert: { id?: string; org_id: string; haul_start_date: string; gold_price_per_gram: number; silver_price_per_gram: number; nishab_gold: number; nishab_silver: number; status?: string; batal_reason?: string | null; gold_price_source?: string; gold_price_evidence_url?: string | null; gold_price_set_by?: string | null; gold_price_set_at?: string; created_at?: string; updated_at?: string }
        Update: Partial<{ id: string; org_id: string; haul_start_date: string; gold_price_per_gram: number; silver_price_per_gram: number; nishab_gold: number; nishab_silver: number; status: string; batal_reason: string | null; created_at: string; updated_at: string }>
        Relationships: []
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Contact>
        Relationships: []
      }
      employees: {
        Row: Employee
        Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Employee>
        Relationships: []
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Attendance>
        Relationships: []
      }
      fixed_assets: {
        Row: FixedAsset
        Insert: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FixedAsset>
        Relationships: []
      }
      asset_depreciation_logs: {
        Row: AssetDepreciationLog
        Insert: Omit<AssetDepreciationLog, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<AssetDepreciationLog>
        Relationships: []
      }
      production_boms: {
        Row: ProductionBom
        Insert: Omit<ProductionBom, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<ProductionBom>
        Relationships: []
      }
      production_bom_items: {
        Row: ProductionBomItem
        Insert: Omit<ProductionBomItem, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<ProductionBomItem>
        Relationships: []
      }
      production_work_orders: {
        Row: ProductionWorkOrder
        Insert: Omit<ProductionWorkOrder, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<ProductionWorkOrder>
        Relationships: []
      }
      production_wo_costs: {
        Row: ProductionWorkOrderCost
        Insert: Omit<ProductionWorkOrderCost, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<ProductionWorkOrderCost>
        Relationships: []
      }
      expense_claims: {
        Row: ExpenseClaim
        Insert: Omit<ExpenseClaim, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<ExpenseClaim>
        Relationships: []
      }
      leave_requests: {
        Row: LeaveRequest
        Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<LeaveRequest>
        Relationships: []
      }
      fleet_assets: {
        Row: FleetAsset
        Insert: Omit<FleetAsset, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FleetAsset>
        Relationships: []
      }
      fleet_bookings: {
        Row: FleetBooking
        Insert: Omit<FleetBooking, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FleetBooking>
        Relationships: []
      }
      fleet_routes: {
        Row: FleetRoute
        Insert: Omit<FleetRoute, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FleetRoute>
        Relationships: []
      }
      fleet_schedules: {
        Row: FleetSchedule
        Insert: Omit<FleetSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FleetSchedule>
        Relationships: []
      }
      fleet_tickets: {
        Row: FleetTicket
        Insert: Omit<FleetTicket, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<FleetTicket>
        Relationships: []
      }
      fleet_maintenance_labs: {
        Row: FleetMaintenanceLab
        Insert: Omit<FleetMaintenanceLab, 'id' | 'maintenance_number' | 'created_at'> & { id?: string; maintenance_number?: string | null; created_at?: string }
        Update: Partial<FleetMaintenanceLab>
        Relationships: []
      }
      fleet_terminals: {
        Row: FleetTerminal
        Insert: Omit<FleetTerminal, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<FleetTerminal>
        Relationships: []
      }
      saas_vouchers: {
        Row: { id: string; code: string; discount_percent: number; package_id: string | null; max_uses: number; uses_count: number; is_active: boolean; expires_at: string; created_at: string }
        Insert: { id?: string; code: string; discount_percent?: number; package_id?: string | null; max_uses?: number; uses_count?: number; is_active?: boolean; expires_at?: string; created_at?: string }
        Update: Partial<{ id: string; code: string; discount_percent: number; package_id: string | null; max_uses: number; uses_count: number; is_active: boolean; expires_at: string }>
        Relationships: []
      }
      saas_invoices: {
        Row: { id: string; org_id: string; package_id: string | null; item_name: string; invoice_number: string; amount: number; status: string; payment_method: string | null; payment_proof_url: string | null; due_date: string; created_at: string; updated_at: string }
        Insert: { id?: string; org_id: string; package_id?: string | null; item_name: string; invoice_number: string; amount: number; status: string; payment_method?: string | null; payment_proof_url?: string | null; due_date: string; created_at?: string; updated_at?: string }
        Update: Partial<{ id: string; org_id: string; status: string; payment_method: string | null; payment_proof_url: string | null; updated_at: string }>
        Relationships: []
      }
      saas_packages: {
        Row: { id: string; name: string; description: string | null; price: number; billing: string; modules: Json; duration_days: number; is_active: boolean }
        Insert: any
        Update: any
        Relationships: []
      }
      // All remaining tables typed as generic to avoid 'never' errors
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
    }
    Views: {
      account_balances: {
        Row: AccountBalance
      }
      [key: string]: {
        Row: Record<string, any>
      }
    }
    Functions: {
      seed_default_coa: { Args: { p_org_id: string }; Returns: any }
      process_inventory_adjustment: { Args: { p_adj_id: string; p_user_id: string }; Returns: any }
      create_fleet_medical_record: {
        Args: {
          p_org_id: string
          p_asset_id: string
          p_service_date: string
          p_description: string
          p_maintenance_type: string
          p_cost: number
          p_odometer_at: number
          p_technician_name?: string | null
          p_vendor_name?: string | null
          p_parts_replaced?: Json
          p_next_service_km?: number | null
          p_next_service_date?: string | null
          p_attachment_url?: string | null
        }
        Returns: string
      }
      // All other RPC functions — typed permissively to avoid TS2345 errors
      [key: string]: { Args: Record<string, any>; Returns: any }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

export type NizamDatabase = Database
