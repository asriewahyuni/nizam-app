// Manually maintained database types
// Last updated: 2026-03-29 — comprehensive table & RPC definitions

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
export type JournalReferenceType = string

// ─── Row Types ─────────────────────────────────────────────────
export type Account = {
  id: string; org_id: string; code: string; name: string
  type: AccountType; normal_balance: NormalBalance
  parent_id: string | null; description: string | null
  is_system: boolean; is_active: boolean
  created_at: string; updated_at: string
}
export type AccountBalance = {
  org_id: string; account_id: string; code: string; name: string
  type: string; normal_balance: string; balance: number
  total_debit: number; total_credit: number
}
export type BankAccount = {
  id: string; org_id: string; account_id: string; account_name: string
  bank_name: string; account_number: string; currency: string
  current_balance: number; is_active: boolean
  created_at: string; updated_at: string
}
export type BankTransaction = {
  id: string; org_id: string; bank_account_id: string
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
  settings: Json; is_active: boolean; created_at: string; updated_at: string
}
export type Warehouse = {
  id: string; org_id: string; code: string; name: string
  address: string | null; is_active: boolean; created_at: string; updated_at: string
}
export type InventoryStock = {
  id: string; org_id: string; product_id: string; warehouse_id: string
  quantity: number; batch_number: string | null; expiry_date: string | null
  created_at: string; updated_at: string
}
export type StockMovement = {
  id: string; org_id: string; product_id: string; movement_date: string
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
  id: string; org_id: string; entry_number: string; entry_date: string
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

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Account>
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
      // All other RPC functions — typed permissively to avoid TS2345 errors
      [key: string]: { Args: Record<string, any>; Returns: any }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

export type NizamDatabase = Database
