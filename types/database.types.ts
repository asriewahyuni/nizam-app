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
