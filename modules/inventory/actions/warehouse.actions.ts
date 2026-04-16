'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { nudgeEduModeValidation } from '@/modules/edu/lib/progress-hooks.server'

type WarehousePayload = {
  code: string
  name: string
  address?: string | null
  is_active?: boolean
}
type NormalizedWarehousePayload = {
  code: string
  name: string
  address: string | null
  is_active: boolean
}

type WarehouseMutationResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }

type DeleteWarehouseResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

type WarehouseAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
  is_active: boolean
}

type WarehouseBinAccessRecord = {
  id: string
  warehouse_id: string
  warehouses: {
    branch_id: string | null
  } | null
}

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

type WarehouseBinStockItem = {
  product_id: string
  product_name: string
  product_sku: string | null
  product_unit: string | null
  batch_number: string | null
  expiry_date: string | null
  quantity: number
  unit_cost: number
  stock_value: number
}

type WarehouseBinRow = {
  id: string
  org_id: string
  warehouse_id: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  barcode: string | null
  warehouses: {
    name: string | null
    code: string | null
    branch_id: string | null
  }
  stock_summary: {
    sku_count: number
    batch_count: number
    total_quantity: number
    total_asset_value: number
  }
  stock_items: WarehouseBinStockItem[]
}

type WarehouseBinPayload = {
  warehouse_id: string
  code: string
  description?: string | null
  barcode?: string | null
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeWarehouseBinStockItem(item: any): WarehouseBinStockItem {
  return {
    product_id: String(item?.product_id || ''),
    product_name: String(item?.product_name || 'Tanpa Nama Produk'),
    product_sku: item?.product_sku ? String(item.product_sku) : null,
    product_unit: item?.product_unit ? String(item.product_unit) : null,
    batch_number: item?.batch_number ? String(item.batch_number) : null,
    expiry_date: item?.expiry_date ? String(item.expiry_date) : null,
    quantity: toFiniteNumber(item?.quantity),
    unit_cost: toFiniteNumber(item?.unit_cost),
    stock_value: toFiniteNumber(item?.stock_value),
  }
}

function normalizeWarehouseBinRow(row: any): WarehouseBinRow {
  const stockItemsValue = typeof row?.stock_items === 'string'
    ? (() => {
        try {
          return JSON.parse(row.stock_items)
        } catch {
          return []
        }
      })()
    : row?.stock_items

  const stockItems = Array.isArray(stockItemsValue)
    ? stockItemsValue.map(normalizeWarehouseBinStockItem).filter((item) => item.product_id)
    : []

  return {
    id: String(row?.id || ''),
    org_id: String(row?.org_id || ''),
    warehouse_id: String(row?.warehouse_id || ''),
    code: String(row?.code || ''),
    description: row?.description ? String(row.description) : null,
    is_active: row?.is_active !== false,
    created_at: String(row?.created_at || ''),
    updated_at: String(row?.updated_at || ''),
    barcode: row?.barcode ? String(row.barcode) : null,
    warehouses: {
      name: row?.warehouse_name ? String(row.warehouse_name) : null,
      code: row?.warehouse_code ? String(row.warehouse_code) : null,
      branch_id: row?.warehouse_branch_id ? String(row.warehouse_branch_id) : null,
    },
    stock_summary: {
      sku_count: Math.max(0, Math.round(toFiniteNumber(row?.sku_count))),
      batch_count: Math.max(0, Math.round(toFiniteNumber(row?.batch_count))),
      total_quantity: toFiniteNumber(row?.total_quantity),
      total_asset_value: toFiniteNumber(row?.total_asset_value),
    },
    stock_items: stockItems,
  }
}

function normalizeWarehousePayload(payload: WarehousePayload): NormalizedWarehousePayload | { error: string } {
  const code = payload.code?.trim().toUpperCase() || ''
  const name = payload.name?.trim() || ''
  const address = payload.address?.trim() || null

  if (!code || !name) {
    return { error: 'Kode dan nama gudang wajib diisi.' as const }
  }

  return {
    code,
    name,
    address,
    is_active: payload.is_active ?? true,
  }
}

function revalidateWarehousePages(warehouseId?: string) {
  revalidatePath('/inventory')
  revalidatePath('/inventory/warehouses')
  revalidatePath('/factory')
  if (warehouseId) {
    revalidatePath(`/inventory/warehouses/${warehouseId}`)
  }
}

async function resolveActiveBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

function applyWarehouseBranchFilter(query: any, branchId: string | null) {
  if (!branchId) return query
  return query.eq('branch_id', branchId)
}

async function getAccessibleWarehouse(
  supabase: any,
  orgId: string,
  warehouseId: string,
  branchId: string | null
): Promise<WarehouseAccessRecord | null> {
  let query = supabase
    .from('warehouses')
    .select('id, org_id, branch_id, is_active')
    .eq('id', warehouseId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  query = applyWarehouseBranchFilter(query, branchId)

  const { data, error } = await query.maybeSingle()
  if (error) return null
  return (data as WarehouseAccessRecord | null) ?? null
}

async function getAccessibleWarehouseBin(
  supabase: any,
  orgId: string,
  binId: string,
  branchId: string | null
): Promise<WarehouseBinAccessRecord | null> {
  const { queryPostgres } = await import('@/lib/db/postgres')

  let sql = `
    SELECT wb.id, wb.warehouse_id, w.branch_id as warehouse_branch_id
    FROM public.warehouse_bins wb
    JOIN public.warehouses w ON w.id = wb.warehouse_id
    WHERE wb.id = $1 AND wb.org_id = $2
  `
  const params: unknown[] = [binId, orgId]

  if (branchId) {
    params.push(branchId)
    sql += ` AND (w.branch_id = $${params.length} OR w.branch_id IS NULL)`
  }

  try {
    const { rows } = await queryPostgres<any>(sql, params)
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id,
      warehouse_id: r.warehouse_id,
      warehouses: { branch_id: r.warehouse_branch_id }
    } as any
  } catch {
    return null
  }
}

export async function getWarehouses(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('warehouses')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  query = applyWarehouseBranchFilter(query, effectiveBranchId)

  const { data, error } = await query.order('name', { ascending: true })

  if (error) return []
  return data
}

export async function getWarehouseBins(
  orgId: string,
  warehouseId?: string,
  branchId?: string | null
): Promise<WarehouseBinRow[]> {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const { queryPostgres } = await import('@/lib/db/postgres')

  let sql = `
    WITH filtered_bins AS (
      SELECT
        wb.id,
        wb.org_id,
        wb.warehouse_id,
        wb.code,
        wb.description,
        wb.is_active,
        wb.created_at,
        wb.updated_at,
        wb.barcode,
        w.name AS warehouse_name,
        w.code AS warehouse_code,
        w.branch_id AS warehouse_branch_id
      FROM public.warehouse_bins wb
      JOIN public.warehouses w ON w.id = wb.warehouse_id
      WHERE wb.org_id = $1
        AND wb.is_active = TRUE
        AND w.is_active = TRUE
    ),
    bin_inventory AS (
      SELECT
        s.bin_id,
        s.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        p.unit AS product_unit,
        s.batch_number,
        s.expiry_date,
        SUM(COALESCE(s.quantity, 0))::numeric AS quantity,
        COALESCE(p.average_cost, p.purchase_price, 0)::numeric AS unit_cost,
        SUM(COALESCE(s.quantity, 0) * COALESCE(p.average_cost, p.purchase_price, 0))::numeric AS stock_value
      FROM public.inventory_stocks s
      JOIN filtered_bins fb ON fb.id = s.bin_id
      JOIN public.products p ON p.id = s.product_id
      WHERE s.org_id = $1
      GROUP BY
        s.bin_id,
        s.product_id,
        p.name,
        p.sku,
        p.unit,
        s.batch_number,
        s.expiry_date,
        p.average_cost,
        p.purchase_price
    ),
    bin_summary AS (
      SELECT
        bin_id,
        COUNT(DISTINCT product_id)::int AS sku_count,
        COUNT(*)::int AS batch_count,
        COALESCE(SUM(quantity), 0)::numeric AS total_quantity,
        COALESCE(SUM(stock_value), 0)::numeric AS total_asset_value
      FROM bin_inventory
      WHERE ABS(COALESCE(quantity, 0)) > 0.0001
      GROUP BY bin_id
    )
    SELECT
      fb.*,
      COALESCE(bs.sku_count, 0) AS sku_count,
      COALESCE(bs.batch_count, 0) AS batch_count,
      COALESCE(bs.total_quantity, 0) AS total_quantity,
      COALESCE(bs.total_asset_value, 0) AS total_asset_value,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'product_id', bi.product_id,
            'product_name', bi.product_name,
            'product_sku', bi.product_sku,
            'product_unit', bi.product_unit,
            'batch_number', bi.batch_number,
            'expiry_date', bi.expiry_date,
            'quantity', bi.quantity,
            'unit_cost', bi.unit_cost,
            'stock_value', bi.stock_value
          )
          ORDER BY bi.product_name ASC, bi.batch_number ASC NULLS LAST, bi.expiry_date ASC NULLS LAST
        ) FILTER (WHERE bi.bin_id IS NOT NULL AND ABS(COALESCE(bi.quantity, 0)) > 0.0001),
        '[]'::jsonb
      ) AS stock_items
    FROM filtered_bins fb
    LEFT JOIN bin_summary bs ON bs.bin_id = fb.id
    LEFT JOIN bin_inventory bi ON bi.bin_id = fb.id
    WHERE 1 = 1
  `
  const params: unknown[] = [orgId]

  if (warehouseId) {
    params.push(warehouseId)
    sql += ` AND fb.warehouse_id = $${params.length}`
  }

  if (effectiveBranchId) {
    params.push(effectiveBranchId)
    sql += ` AND (fb.warehouse_branch_id = $${params.length} OR fb.warehouse_branch_id IS NULL)`
  }

  sql += `
    GROUP BY
      fb.id,
      fb.org_id,
      fb.warehouse_id,
      fb.code,
      fb.description,
      fb.is_active,
      fb.created_at,
      fb.updated_at,
      fb.barcode,
      fb.warehouse_name,
      fb.warehouse_code,
      fb.warehouse_branch_id,
      bs.sku_count,
      bs.batch_count,
      bs.total_quantity,
      bs.total_asset_value
    ORDER BY fb.warehouse_code ASC, fb.code ASC
  `

  try {
    const { rows } = await queryPostgres<Record<string, unknown>>(sql, params)
    return rows.map((row) => normalizeWarehouseBinRow(row))
  } catch(err) {
    console.error(err)
    return []
  }
}

export async function createWarehouseBin(orgId: string, payload: WarehouseBinPayload) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const warehouse = await getAccessibleWarehouse(supabase as any, orgId, payload.warehouse_id, activeBranchId)

  if (!warehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const sanitizedPayload = {
    warehouse_id: payload.warehouse_id,
    code: payload.code?.trim().toUpperCase(),
    description: payload.description?.trim() || null,
    barcode: payload.barcode?.trim() || null,
  }

  const { data, error } = await (supabase as any)
    .from('warehouse_bins')
    .insert([{ ...sanitizedPayload, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(sanitizedPayload.warehouse_id)
  return {
    success: true,
    data: normalizeWarehouseBinRow({
      ...data,
      warehouse_branch_id: warehouse.branch_id,
      sku_count: 0,
      batch_count: 0,
      total_quantity: 0,
      total_asset_value: 0,
      stock_items: [],
    })
  }
}

export async function createWarehouse(orgId: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .insert([{ ...normalized, org_id: orgId, branch_id: activeBranchId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(data?.id)
  await nudgeEduModeValidation('inventory.create.warehouse')
  return { success: true, data }
}

export async function updateWarehouse(orgId: string, id: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetWarehouse = await getAccessibleWarehouse(supabase as any, orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .update({
      ...normalized,
      branch_id: activeBranchId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(id)
  return { success: true, data }
}

export async function deleteWarehouse(orgId: string, id: string): Promise<DeleteWarehouseResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetWarehouse = await getAccessibleWarehouse(supabase as any, orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('warehouses')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: error.message }
  revalidateWarehousePages(id)
  return { success: true }
}

export async function deleteWarehouseBin(orgId: string, id: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetBin = await getAccessibleWarehouseBin(supabase as any, orgId, id, activeBranchId)

  if (!targetBin) {
    return { error: 'Bin tidak tersedia pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('warehouse_bins')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidateWarehousePages(targetBin.warehouse_id)
  return { success: true }
}
