/**
 * Backward-compatible warehouse lookup helpers for sales flows.
 * Keeps branch-scoped queries working when legacy schemas do not store `branch_id` on warehouses.
 */

export type SalesWarehouseScopeRecord = {
  id: string
  branch_id: string | null
  is_active: boolean
  name?: string | null
}

type ActiveSalesWarehouseRecord = {
  id: string
  name: string | null
  branch_id: string | null
}

type QueryError = {
  code?: string | null
  message?: string | null
}

type QueryResponse<T> = {
  data: T | null
  error: QueryError | null
}

type WarehouseRow = {
  id?: string | null
  name?: string | null
  branch_id?: string | null
  is_active?: boolean | null
}

type WarehouseQuery = PromiseLike<QueryResponse<WarehouseRow[]>> & {
  select(columns: string): WarehouseQuery
  eq(column: string, value: unknown): WarehouseQuery
  in(column: string, values: string[]): WarehouseQuery
  order(column: string, options: { ascending: boolean }): WarehouseQuery
  limit(value: number): WarehouseQuery
  maybeSingle(): Promise<QueryResponse<WarehouseRow>>
}

type WarehouseSupabaseClient = {
  from(table: 'warehouses'): WarehouseQuery
}

function isSchemaColumnMissing(
  error: { code?: string | null; message?: string | null } | null | undefined,
  tableName: string,
  columnName: string
) {
  if (!error) return false

  const message = String(error.message || '')
  const normalized = message.toLowerCase()

  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (
      normalized.includes(tableName.toLowerCase()) &&
      normalized.includes(columnName.toLowerCase()) &&
      (
        normalized.includes('does not exist') ||
        normalized.includes('could not find')
      )
    )
  )
}

export function isWarehousesBranchSchemaMissing(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  return isSchemaColumnMissing(error, 'warehouses', 'branch_id')
}

function normalizeActiveWarehouseRows(rows: WarehouseRow[] | null | undefined, branchId: string | null) {
  return (rows || [])
    .map((row) => ({
      id: String(row?.id || ''),
      name: row?.name ? String(row.name) : null,
      branch_id: branchId,
    }))
    .filter((row) => row.id)
}

function normalizeScopedWarehouseRows(rows: WarehouseRow[] | null | undefined) {
  return (rows || [])
    .map((row) => ({
      id: String(row?.id || ''),
      branch_id: row?.branch_id ? String(row.branch_id) : null,
      is_active: Boolean(row?.is_active),
      name: row?.name ? String(row.name) : null,
    }))
    .filter((row) => row.id)
}

export async function getScopedSalesWarehouses(
  supabase: WarehouseSupabaseClient,
  orgId: string,
  warehouseIds: string[],
  branchId: string | null
): Promise<{ warehouses: SalesWarehouseScopeRecord[] } | { error: string }> {
  const uniqueIds = [...new Set(warehouseIds.map((id) => String(id || '')).filter(Boolean))]
  if (uniqueIds.length === 0) return { warehouses: [] }

  let query = supabase
    .from('warehouses')
    .select('id, branch_id, is_active, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('id', uniqueIds)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (!error) {
    return { warehouses: normalizeScopedWarehouseRows(data) }
  }

  if (!isWarehousesBranchSchemaMissing(error)) {
    return { error: error.message || 'Gagal memuat gudang aktif.' }
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('warehouses')
    .select('id, is_active, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('id', uniqueIds)

  if (legacyError) {
    return { error: legacyError.message || 'Gagal memuat gudang aktif.' }
  }

  return {
    warehouses: normalizeScopedWarehouseRows((legacyData || []).map((row) => ({
      ...row,
      branch_id: null,
    }))),
  }
}

export async function listActiveSalesWarehouses(
  supabase: WarehouseSupabaseClient,
  orgId: string,
  branchId: string | null,
  options?: {
    warehouseId?: string | null
    limit?: number
  }
): Promise<{ warehouses: ActiveSalesWarehouseRecord[] } | { error: string }> {
  let query = supabase
    .from('warehouses')
    .select('id, name, branch_id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (options?.warehouseId) {
    query = query.eq('id', options.warehouseId)

    const { data, error } = await query.maybeSingle()
    if (!error) {
      return {
        warehouses: data
          ? normalizeActiveWarehouseRows(
              [data],
              data?.branch_id ? String(data.branch_id) : null
            )
          : [],
      }
    }

    if (!isWarehousesBranchSchemaMissing(error)) {
      return { error: error.message || 'Gagal memuat gudang aktif.' }
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from('warehouses')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .eq('id', options.warehouseId)
      .maybeSingle()

    if (legacyError) {
      return { error: legacyError.message || 'Gagal memuat gudang aktif.' }
    }

    return { warehouses: legacyData ? normalizeActiveWarehouseRows([legacyData], null) : [] }
  }

  query = query.order('name', { ascending: true })
  if (options?.limit && Number.isFinite(options.limit) && options.limit > 0) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (!error) {
    return {
      warehouses: (data || [])
        .map((row) => ({
          id: String(row?.id || ''),
          name: row?.name ? String(row.name) : null,
          branch_id: row?.branch_id ? String(row.branch_id) : null,
        }))
        .filter((row) => row.id),
    }
  }

  if (!isWarehousesBranchSchemaMissing(error)) {
    return { error: error.message || 'Gagal memuat gudang aktif.' }
  }

  let legacyQuery = supabase
    .from('warehouses')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (options?.limit && Number.isFinite(options.limit) && options.limit > 0) {
    legacyQuery = legacyQuery.limit(options.limit)
  }

  const { data: legacyData, error: legacyError } = await legacyQuery
  if (legacyError) {
    return { error: legacyError.message || 'Gagal memuat gudang aktif.' }
  }

  return { warehouses: normalizeActiveWarehouseRows(legacyData || [], null) }
}
