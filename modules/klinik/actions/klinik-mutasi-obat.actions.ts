'use server'

// Klinik Pratama — ledger mutasi obat (riwayat stock_movements), dibaca-saja.
// Mirror getStockMovementsPage() (modules/inventory/actions/inventory.actions.ts)
// tapi dibatasi ke reference_type milik Apotek Klinik saja.

import { queryPostgres } from '@/lib/db/postgres'

export const KLINIK_STOCK_REFERENCE_TYPES = ['KLINIK_RECEIPT', 'KLINIK_RESEP', 'KLINIK_VOID_RETURN'] as const
export type KlinikStockReferenceType = (typeof KLINIK_STOCK_REFERENCE_TYPES)[number]

export type KlinikStockMovementRow = {
  id: string
  product_id: string
  product_name: string
  product_sku: string | null
  product_unit: string | null
  movement_date: string
  quantity: number
  unit_price: number
  reference_type: string
  notes: string | null
}

export type KlinikStockMovementsPageResult = {
  rows: KlinikStockMovementRow[]
  total: number
  page: number
  limit: number
  totalPages: number
  totalIn: number
  totalOut: number
}

export async function getKlinikStockMovementsPage(
  orgId: string,
  branchId: string,
  options: {
    page?: number
    limit?: number
    search?: string
    referenceType?: KlinikStockReferenceType | null
    direction?: 'in' | 'out' | null
    dateFrom?: string | null
    dateTo?: string | null
  } = {},
): Promise<KlinikStockMovementsPageResult> {
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(200, Math.max(10, options.limit ?? 20))
  const offset = (page - 1) * limit
  const search = options.search || ''

  const directionClause =
    options.direction === 'in' ? 'AND sm.quantity > 0' :
    options.direction === 'out' ? 'AND sm.quantity < 0' : ''

  const filterParams = [
    orgId,
    branchId,
    options.referenceType || null,
    options.dateFrom || null,
    options.dateTo || null,
    search,
  ]

  const whereClause = `
    WHERE sm.org_id = $1
      AND sm.branch_id = $2
      AND sm.reference_type = ANY(ARRAY['KLINIK_RECEIPT','KLINIK_RESEP','KLINIK_VOID_RETURN'])
      AND ($3::text IS NULL OR sm.reference_type = $3::text)
      AND ($4::date IS NULL OR sm.movement_date::date >= $4::date)
      AND ($5::date IS NULL OR sm.movement_date::date <= $5::date)
      AND ($6::text = '' OR COALESCE(p.name,'') ILIKE '%'||$6||'%' OR COALESCE(p.sku,'') ILIKE '%'||$6||'%' OR COALESCE(sm.notes,'') ILIKE '%'||$6||'%')
      ${directionClause}
  `

  const [result, totalsResult] = await Promise.all([
    queryPostgres<KlinikStockMovementRow & { total_count: string }>(
      `SELECT
        sm.id::text AS id,
        sm.product_id::text AS product_id,
        COALESCE(p.name, 'Produk Dihapus') AS product_name,
        p.sku AS product_sku,
        p.unit AS product_unit,
        sm.movement_date::text AS movement_date,
        sm.quantity::float AS quantity,
        COALESCE(sm.unit_price, 0)::float AS unit_price,
        sm.reference_type,
        sm.notes,
        COUNT(*) OVER() AS total_count
      FROM public.stock_movements sm
      LEFT JOIN public.products p ON p.id = sm.product_id AND p.org_id = sm.org_id
      ${whereClause}
      ORDER BY sm.movement_date DESC, sm.created_at DESC
      LIMIT $7 OFFSET $8`,
      [...filterParams, limit, offset],
    ),
    queryPostgres<{ total_in: string; total_out: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN sm.quantity > 0 THEN sm.quantity ELSE 0 END), 0)::float AS total_in,
        COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END), 0)::float AS total_out
      FROM public.stock_movements sm
      LEFT JOIN public.products p ON p.id = sm.product_id AND p.org_id = sm.org_id
      ${whereClause}`,
      filterParams,
    ),
  ])

  const rows = result.rows.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    product_name: r.product_name,
    product_sku: r.product_sku,
    product_unit: r.product_unit,
    movement_date: r.movement_date,
    quantity: r.quantity,
    unit_price: r.unit_price,
    reference_type: r.reference_type,
    notes: r.notes,
  }))
  const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0
  const totals = totalsResult.rows[0]

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    totalIn: totals ? Number(totals.total_in) : 0,
    totalOut: totals ? Number(totals.total_out) : 0,
  }
}
