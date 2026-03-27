// Manually maintained database types
// Last updated: 2026-03-25

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  org_id: string
  sku: string | null
  barcode: string | null
  name: string
  type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE'
  category: 'Bahan' | 'Setengah Jadi' | 'Barang Jadi' | string | null
  description: string | null
  unit: string
  purchase_price: number
  selling_price: number
  track_inventory: boolean | null
  is_active: boolean | null
  created_at: string
  updated_at: string
}

export interface Warehouse {
  id: string
  org_id: string
  name: string
  address: string | null
  is_active: boolean | null
  created_at: string
  updated_at: string
}

export interface WarehouseBin {
  id: string
  org_id: string
  warehouse_id: string
  code: string
  description: string | null
  created_at: string
}

export interface StockMovement {
  id: string
  org_id: string
  product_id: string
  warehouse_id: string | null
  bin_id: string | null
  movement_type: string
  quantity: number
  unit_price: number
  total_value: number
  reference_type: string | null
  reference_id: string | null
  batch_number: string | null
  expiry_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface InventoryAdjustment {
  id: string
  org_id: string
  adj_number: string
  adj_date: string
  type: 'STOCK_COUNT' | 'WRITE_OFF'
  status: string
  total_value: number
  notes: string | null
  journal_entry_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InventoryAdjustmentItem {
  id: string
  org_id: string
  adjustment_id: string
  product_id: string
  warehouse_id: string | null
  actual_quantity: number
  diff_quantity: number
  unit_cost: number
  total_value: number
  notes: string | null
  created_at: string
}

export interface InventoryTransfer {
  id: string
  org_id: string
  transfer_number: string
  transfer_date: string
  source_warehouse_id: string
  target_warehouse_id: string
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Accounting Types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | string;
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  org_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  parent_id: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  id?: string;
  org_id: string;
  account_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  current_balance: number;
  total_debit: number;
  total_credit: number;
}

// Database Schema Root (Permissive to avoid Invalid Relationship errors)
export type NizamDatabase = {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: { id?: string; name: string; slug: string; logo_url?: string | null; settings?: any; is_active?: boolean; created_at?: string; updated_at?: string }; Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; settings?: any; is_active?: boolean; created_at?: string; updated_at?: string }; Relationships: any[] };
      products: { Row: Product; Insert: { id?: string; org_id: string; sku?: string | null; barcode?: string | null; name: string; type: string; category?: string | null; description?: string | null; unit: string; purchase_price: number; selling_price: number; track_inventory?: boolean | null; is_active?: boolean | null; created_at?: string; updated_at?: string; average_cost?: number }; Update: { id?: string; org_id?: string; sku?: string | null; barcode?: string | null; name?: string; type?: string; category?: string | null; description?: string | null; unit?: string; purchase_price?: number; selling_price?: number; track_inventory?: boolean| null; is_active?: boolean | null; created_at?: string; updated_at?: string; average_cost?: number }; Relationships: any[] };
      warehouses: { Row: Warehouse; Insert: { id?: string; org_id: string; name: string; code?: string; address?: string | null; is_active?: boolean | null; created_at?: string; updated_at?: string }; Update: { id?: string; org_id?: string; name?: string; code?: string; address?: string| null; is_active?: boolean | null; created_at?: string; updated_at?: string }; Relationships: any[] };
      warehouse_bins: { Row: WarehouseBin; Insert: { id?: string; org_id: string; warehouse_id: string; code: string; description?: string | null; created_at?: string }; Update: { id?: string; org_id?: string; warehouse_id?: string; code?: string; description?: string | null; created_at?: string }; Relationships: any[] };
      stock_movements: { Row: StockMovement; Insert: { id?: string; org_id: string; product_id: string; warehouse_id?: string | null; bin_id?: string | null; movement_type: string; quantity: number; unit_price: number; total_value: number; reference_type?: string | null; reference_id?: string | null; batch_number?: string | null; expiry_date?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }; Update: { id?: string; org_id?: string; product_id?: string; warehouse_id?: string | null; bin_id?: string | null; movement_type?: string; quantity?: number; unit_price?: number; total_value?: number; reference_type?: string | null; reference_id?: string | null; batch_number?: string | null; expiry_date?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }; Relationships: any[] };
      inventory_adjustments: { Row: InventoryAdjustment; Insert: { id?: string; org_id: string; adj_number: string; adj_date: string; type: string; status?: string; total_value: number; notes?: string | null; journal_entry_id?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }; Update: { id?: string; org_id?: string; adj_number?: string; adj_date?: string; type?: string; status?: string; total_value?: number; notes?: string | null; journal_entry_id?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }; Relationships: any[] };
      inventory_adjustment_items: { Row: InventoryAdjustmentItem; Insert: { id?: string; org_id: string; adjustment_id: string; product_id: string; warehouse_id?: string | null; actual_quantity: number; diff_quantity: number; unit_cost: number; total_value: number; notes?: string | null; created_at?: string }; Update: { id?: string; org_id?: string; adjustment_id?: string; product_id?: string; warehouse_id?: string | null; actual_quantity?: number; diff_quantity?: number; unit_cost?: number; total_value?: number; notes?: string | null; created_at?: string }; Relationships: any[] };
      inventory_transfers: { Row: InventoryTransfer; Insert: { id?: string; org_id: string; transfer_number: string; transfer_date: string; source_warehouse_id: string; target_warehouse_id: string; status?: string; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }; Update: { id?: string; org_id?: string; transfer_number?: string; transfer_date?: string; source_warehouse_id?: string; target_warehouse_id?: string; status?: string; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }; Relationships: any[] };
      accounts: { Row: Account; Insert: { id?: string; org_id: string; code: string; name: string; type: string; normal_balance: string; parent_id?: string | null; description?: string | null; is_system?: boolean; is_active?: boolean; created_at?: string; updated_at?: string }; Update: { id?: string; org_id?: string; code?: string; name?: string; type?: string; normal_balance?: string; parent_id?: string | null; description?: string | null; is_system?: boolean; is_active?: boolean; created_at?: string; updated_at?: string }; Relationships: any[] };
      org_members: { Row: any; Insert: { org_id: string; user_id: string; role: string; is_active?: boolean; joined_at?: string }; Update: { org_id?: string; user_id?: string; role?: string; is_active?: boolean; joined_at?: string }; Relationships: any[] };
      branches: { Row: any; Insert: { org_id: string; name: string; code: string; address?: string; is_active?: boolean }; Update: { org_id?: string; name?: string; code?: string; address?: string; is_active?: boolean }; Relationships: any[] };
      fixed_assets: { Row: any; Insert: { org_id: string; name: string; code: string; status?: string; purchase_price: number; purchase_date: string; useful_life_months: number; salvage_value?: number; asset_account_id: string; dep_expense_account_id: string; accum_dep_account_id: string; acquisition_method?: string; [key: string]: any }; Update: { org_id?: string; name?: string; code?: string; status?: string; purchase_price?: number; purchase_date?: string; useful_life_months?: number; salvage_value?: number; asset_account_id?: string; dep_expense_account_id?: string; accum_dep_account_id?: string; last_depreciation_date?: string; accumulated_depreciation?: number; current_book_value?: number; [key: string]: any }; Relationships: any[] };
      asset_depreciation_logs: { Row: any; Insert: { asset_id: string; org_id: string; period_date: string; amount: number; journal_entry_id?: string | null }; Update: { asset_id?: string; org_id?: string; period_date?: string; amount?: number; journal_entry_id?: string | null }; Relationships: any[] };
      journal_entries: { Row: any; Insert: { org_id: string; entry_date: string; description: string; reference_type?: string | null; reference_id?: string | null; status?: string; is_auto?: boolean; void_reason?: string | null }; Update: { org_id?: string; entry_date?: string; description?: string; reference_type?: string | null; reference_id?: string | null; status?: string; is_auto?: boolean; void_reason?: string | null; journal_entry_id?: string }; Relationships: any[] };
      journal_lines: { Row: any; Insert: { entry_id: string; account_id: string; debit: number; credit: number; memo?: string | null }; Update: { entry_id?: string; account_id?: string; debit?: number; credit?: number; memo?: string | null }; Relationships: any[] };
      expense_claims: { Row: any; Insert: { org_id: string; employee_id: string; amount: number; category: string; description: string; claim_date: string; status?: string }; Update: { org_id?: string; employee_id?: string; amount?: number; category?: string; description?: string; claim_date?: string; status?: string }; Relationships: any[] };
      payroll_components: { Row: any; Insert: { org_id: string; name: string; type: string; is_taxable: boolean; is_percentage: boolean; default_amount: number; percentage_value?: number | null; account_id?: string | null }; Update: { org_id?: string; name?: string; type?: string; is_taxable?: boolean; is_percentage?: boolean; default_amount?: number; percentage_value?: number | null; account_id?: string | null }; Relationships: any[] };
      payroll_runs: { Row: any; Insert: { org_id: string; period_start: string; period_end: string; payment_date: string; status?: string; disbursement_account_id?: string | null; journal_entry_id?: string | null }; Update: { org_id?: string; period_start?: string; period_end?: string; payment_date?: string; status?: string; disbursement_account_id?: string | null; journal_entry_id?: string | null }; Relationships: any[] };
      payslips: { Row: any; Insert: any; Update: any; Relationships: any[] };
      payslip_lines: { Row: any; Insert: any; Update: any; Relationships: any[] };
      approval_requests: { Row: any; Insert: { org_id: string; source_type: string; source_id: string; status?: string; requested_at?: string; requested_by?: string; [key: string]: any }; Update: { status?: string; notes?: string; approver_id?: string; decided_at?: string; [key: string]: any }; Relationships: any[] };
      reimbursements: { Row: any; Insert: any; Update: any; Relationships: any[] };
      reimbursement_items: { Row: any; Insert: any; Update: any; Relationships: any[] };
      bank_accounts: { Row: any; Insert: any; Update: any; Relationships: any[] };
      employees: { Row: any; Insert: any; Update: any; Relationships: any[] };
      purchases: { Row: any; Insert: any; Update: any; Relationships: any[] };
      purchase_items: { Row: any; Insert: any; Update: any; Relationships: any[] };
      sales: { Row: any; Insert: any; Update: any; Relationships: any[] };
      sales_items: { Row: any; Insert: any; Update: any; Relationships: any[] };
      contacts: { Row: any; Insert: any; Update: any; Relationships: any[] };
      attendance: { Row: any; Insert: any; Update: any; Relationships: any[] };
      audit_logs: { Row: any; Insert: any; Update: any; Relationships: any[] };
      bank_mutations: { Row: any; Insert: any; Update: any; Relationships: any[] };
      bank_transactions: { Row: any; Insert: any; Update: any; Relationships: any[] };
      budgets: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fiscal_periods: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_assets: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_bookings: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_maintenance_labs: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_routes: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_schedules: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_terminals: { Row: any; Insert: any; Update: any; Relationships: any[] };
      fleet_tickets: { Row: any; Insert: any; Update: any; Relationships: any[] };
      inventory_stocks: { Row: any; Insert: any; Update: any; Relationships: any[] };
      production_bom_items: { Row: any; Insert: any; Update: any; Relationships: any[] };
      production_boms: { Row: any; Insert: any; Update: any; Relationships: any[] };
      production_wo_costs: { Row: any; Insert: any; Update: any; Relationships: any[] };
      production_work_orders: { Row: any; Insert: any; Update: any; Relationships: any[] };
      purchase_payments: { Row: any; Insert: any; Update: any; Relationships: any[] };
      purchase_requests: { Row: any; Insert: { id?: string; org_id: string; request_number?: string; requester_id: string; product_id?: string | null; product_name: string; quantity: number; unit?: string | null; status?: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED'; priority?: string | null; notes?: string | null; source_type?: string | null; source_id?: string | null; created_at?: string; updated_at?: string }; Update: { id?: string; org_id?: string; request_number?: string; requester_id?: string; product_id?: string | null; product_name?: string; quantity?: number; unit?: string | null; status?: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED'; priority?: string | null; notes?: string | null; source_type?: string | null; source_id?: string | null; created_at?: string; updated_at?: string }; Relationships: any[] };
      purchase_returns: { Row: any; Insert: any; Update: any; Relationships: any[] };
      receipts: { Row: any; Insert: any; Update: any; Relationships: any[] };
      roles: { Row: any; Insert: any; Update: any; Relationships: any[] };
      sales_payments: { Row: any; Insert: any; Update: any; Relationships: any[] };
      sales_returns: { Row: any; Insert: any; Update: any; Relationships: any[] };
      service_orders: { Row: any; Insert: any; Update: any; Relationships: any[] };
      [key: string]: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: any[];
      };
    };
    Views: {
      account_balances: { Row: AccountBalance };
      [key: string]: {
        Row: any;
      };
    };
    Functions: {
      generate_payslips_for_run: { Args: { p_run_id: string }; Returns: any };
      process_payroll_payment: { Args: { p_run_id: string; p_bank_account_id: string; p_created_by: string }; Returns: any };
      process_asset_disposal: { Args: { p_org_id: string; p_asset_id: string; p_sale_price: number; p_sale_date: string; p_cash_account_id: string; p_notes?: string | null }; Returns: any };
      void_payroll_run: { Args: { p_run_id: string }; Returns: any };
      approve_expense_claim: { Args: { p_claim_id: string; p_approved_by: string; p_expense_account_id: string; p_payable_account_id: string }; Returns: any };
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: {
      pr_status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
      [key: string]: any;
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
}
