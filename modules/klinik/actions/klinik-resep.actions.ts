'use server'

// Klinik Pratama — resep obat & dispensing apotek.
// Alur wajib 2 langkah terpisah (lihat lib/erp-bridge/klinik-journals.ts):
// 1) process_klinik_dispensing() (RPC SQL) — potong stok per batch FEFO,
//    blok keras obat kadaluarsa, hard fail kalau stok kurang.
// 2) postJurnal() (layer TS, setelah RPC sukses) — posting HPP obat.
// Jangan digabung jadi satu transaksi SQL — lihat komentar di
// supabase/migrations/1428_klinik_pratama_apotek.sql soal kenapa.

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'
import { postJurnal } from '@/lib/erp-bridge/klinik-journals'

export type KlinikResepDetailInput = {
  productId: string
  jumlah: number
  dosis?: string | null
}

export type KlinikObatOption = {
  id: string
  sku: string
  name: string
  unit: string
  average_cost: number
}

export async function searchKlinikObat(orgId: string, query: string): Promise<KlinikObatOption[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const { rows } = await queryPostgres<KlinikObatOption>(
    `SELECT id::text, sku, name, unit, COALESCE(average_cost, 0) AS average_cost
     FROM public.products
     WHERE org_id = $1 AND type = 'INVENTORY' AND is_active = TRUE
       AND (name ILIKE $2 OR sku ILIKE $2)
     ORDER BY name ASC
     LIMIT 20`,
    [orgId, `%${trimmed}%`],
  )
  return rows
}

export type KlinikWarehouseOption = { id: string; name: string; code: string }

export async function getKlinikWarehousesByBranch(orgId: string, branchId: string): Promise<KlinikWarehouseOption[]> {
  const { rows } = await queryPostgres<KlinikWarehouseOption>(
    `SELECT id::text, name, code FROM public.warehouses
     WHERE org_id = $1 AND branch_id = $2 AND is_active = TRUE
     ORDER BY name ASC`,
    [orgId, branchId],
  )
  return rows
}

export async function createResep(input: {
  orgId: string
  branchId: string
  kunjunganId: string
  warehouseId: string
  stafMedisId?: string | null
  catatan?: string | null
  items: KlinikResepDetailInput[]
}): Promise<{ data: { id: string } } | { error: string }> {
  if (input.items.length === 0) return { error: 'Resep wajib berisi minimal 1 obat.' }

  try {
    const { rows } = await queryPostgres<{ id: string }>(
      `INSERT INTO public.klinik_resep (org_id, branch_id, kunjungan_id, warehouse_id, staf_medis_id, catatan)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text`,
      [input.orgId, input.branchId, input.kunjunganId, input.warehouseId, input.stafMedisId || null, input.catatan || null],
    )
    const resepId = rows[0].id

    for (const item of input.items) {
      await queryPostgres(
        `INSERT INTO public.klinik_resep_detail (resep_id, product_id, jumlah, dosis) VALUES ($1, $2, $3, $4)`,
        [resepId, item.productId, item.jumlah, item.dosis || null],
      )
    }

    revalidatePath('/klinik')
    return { data: { id: resepId } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat resep.' }
  }
}

export type KlinikResepRow = {
  id: string
  kunjungan_id: string
  warehouse_id: string
  status: 'PENDING' | 'DISPENSED' | 'BATAL'
  catatan: string | null
  dispensed_at: string | null
}

export type KlinikResepDetailRow = {
  id: string
  product_id: string
  product_name: string
  jumlah: number
  dosis: string | null
  batch_number: string | null
  expiry_date: string | null
}

export async function getResepByKunjungan(kunjunganId: string): Promise<Array<KlinikResepRow & { items: KlinikResepDetailRow[] }>> {
  const { rows: resepRows } = await queryPostgres<KlinikResepRow>(
    `SELECT id::text, kunjungan_id::text, warehouse_id::text, status, catatan, dispensed_at::text
     FROM public.klinik_resep WHERE kunjungan_id = $1 ORDER BY created_at DESC`,
    [kunjunganId],
  )
  if (resepRows.length === 0) return []

  const { rows: detailRows } = await queryPostgres<KlinikResepDetailRow & { resep_id: string }>(
    `SELECT d.id::text, d.resep_id::text, d.product_id::text, p.name AS product_name,
            d.jumlah, d.dosis, d.batch_number, d.expiry_date::text
     FROM public.klinik_resep_detail d
     JOIN public.products p ON p.id = d.product_id
     WHERE d.resep_id = ANY($1::uuid[])
     ORDER BY d.created_at ASC`,
    [resepRows.map((r) => r.id)],
  )

  return resepRows.map((resep) => ({
    ...resep,
    items: detailRows.filter((d) => d.resep_id === resep.id),
  }))
}

export async function dispenseResep(
  orgId: string,
  branchId: string,
  resepId: string,
): Promise<{ success: true; totalHpp: number } | { error: string }> {
  let dispensingResult: { success: boolean; error?: string; already_dispensed?: boolean; total_hpp?: number }

  try {
    const { rows } = await queryPostgres<{ result: typeof dispensingResult }>(
      `SELECT process_klinik_dispensing($1, $2) AS result`,
      [orgId, resepId],
    )
    dispensingResult = rows[0].result
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal memproses dispensing obat.' }
  }

  if (!dispensingResult.success) {
    return { error: dispensingResult.error || 'Gagal memproses dispensing obat.' }
  }

  const totalHpp = Number(dispensingResult.total_hpp || 0)

  if (totalHpp > 0) {
    await postJurnal(
      orgId,
      branchId,
      [
        { role: 'hpp_obat', debit: totalHpp, credit: 0, memo: `HPP obat resep ${resepId}` },
        { role: 'persediaan_obat', debit: 0, credit: totalHpp, memo: `HPP obat resep ${resepId}` },
      ],
      `HPP dispensing resep ${resepId}`,
      'KLINIK_DISPENSING',
      resepId,
    )
  }

  revalidatePath('/klinik')
  return { success: true, totalHpp }
}

export type KlinikPendingResep = {
  id: string
  warehouse_id: string
  catatan: string | null
  created_at: string
  no_antrian: number
  pasien_nama: string
  pasien_no_rm: string
  items: KlinikResepDetailRow[]
}

/** Antrian resep yang perlu diserahkan apoteker — lintas semua kunjungan di cabang, bukan per-pasien. */
export async function getPendingResepByBranch(orgId: string, branchId: string): Promise<KlinikPendingResep[]> {
  const { rows: resepRows } = await queryPostgres<Omit<KlinikPendingResep, 'items'>>(
    `SELECT r.id::text, r.warehouse_id::text, r.catatan, r.created_at::text,
            k.no_antrian, p.nama AS pasien_nama, p.no_rm AS pasien_no_rm
     FROM public.klinik_resep r
     JOIN public.klinik_kunjungan k ON k.id = r.kunjungan_id
     JOIN public.klinik_pasien p ON p.id = k.pasien_id
     WHERE r.org_id = $1 AND r.branch_id = $2 AND r.status = 'PENDING'
     ORDER BY r.created_at ASC`,
    [orgId, branchId],
  )
  if (resepRows.length === 0) return []

  const { rows: detailRows } = await queryPostgres<KlinikResepDetailRow & { resep_id: string }>(
    `SELECT d.id::text, d.resep_id::text, d.product_id::text, p.name AS product_name,
            d.jumlah, d.dosis, d.batch_number, d.expiry_date::text
     FROM public.klinik_resep_detail d
     JOIN public.products p ON p.id = d.product_id
     WHERE d.resep_id = ANY($1::uuid[])
     ORDER BY d.created_at ASC`,
    [resepRows.map((r) => r.id)],
  )

  return resepRows.map((resep) => ({
    ...resep,
    items: detailRows.filter((d) => d.resep_id === resep.id),
  }))
}

export type KlinikObatStockRow = {
  product_id: string
  product_name: string
  unit: string
  batch_number: string | null
  expiry_date: string | null
  quantity: number
}

export async function getObatStockByBranch(orgId: string, branchId: string): Promise<KlinikObatStockRow[]> {
  const { rows } = await queryPostgres<KlinikObatStockRow>(
    `SELECT s.product_id::text, p.name AS product_name, p.unit, s.batch_number, s.expiry_date::text,
            s.quantity
     FROM public.inventory_stocks s
     JOIN public.products p ON p.id = s.product_id
     JOIN public.warehouses w ON w.id = s.warehouse_id
     WHERE s.org_id = $1 AND w.branch_id = $2 AND p.type = 'INVENTORY' AND s.quantity > 0
     ORDER BY p.name ASC, s.expiry_date ASC NULLS LAST`,
    [orgId, branchId],
  )
  return rows
}

export async function receiveObat(input: {
  orgId: string
  productId: string
  warehouseId: string
  jumlah: number
  batchNumber: string
  expiryDate: string
  branchId: string
}): Promise<{ success: true } | { error: string }> {
  if (input.jumlah <= 0) return { error: 'Jumlah wajib lebih dari 0.' }
  if (!input.batchNumber.trim()) return { error: 'Nomor batch wajib diisi.' }
  if (!input.expiryDate) return { error: 'Tanggal kadaluarsa wajib diisi.' }

  try {
    await queryPostgres(
      `SELECT adjust_inventory_stock($1, $2, $3, $4, $5, NULL)`,
      [input.orgId, input.productId, input.warehouseId, input.jumlah, input.batchNumber.trim()],
    )
    await queryPostgres(
      `UPDATE public.inventory_stocks SET expiry_date = $4, updated_at = NOW()
       WHERE org_id = $1 AND product_id = $2 AND warehouse_id = $3 AND batch_number = $5 AND bin_id IS NULL`,
      [input.orgId, input.productId, input.warehouseId, input.expiryDate, input.batchNumber.trim()],
    )
    await queryPostgres(
      `INSERT INTO public.stock_movements (org_id, branch_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
       VALUES ($1, $2, $3, $4, 0, 'KLINIK_RECEIPT', gen_random_uuid(), $5)`,
      [input.orgId, input.branchId, input.productId, input.jumlah, `Penerimaan obat batch ${input.batchNumber}`],
    )
    revalidatePath('/klinik')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mencatat penerimaan obat.' }
  }
}
