import { queryPostgres } from '@/lib/db/postgres'

/**
 * Cek apakah tanggal tertentu jatuh pada periode fiskal yang sudah ditutup.
 * Mengembalikan nama periode jika terkunci, null jika tidak.
 */
export async function checkClosedFiscalPeriod(
  orgId: string,
  date: string
): Promise<string | null> {
  const normalizedDate = String(date || '').trim()
  if (!normalizedDate) return null

  const result = await queryPostgres<{ name: string }>(
    `SELECT name FROM fiscal_periods
     WHERE org_id = $1
       AND is_closed = true
       AND start_date <= $2
       AND end_date >= $2
     ORDER BY start_date DESC
     LIMIT 1`,
    [orgId, normalizedDate]
  )

  if (!result?.rows?.length) return null
  return String(result.rows[0].name || '').trim() || null
}

/**
 * Kembalikan pesan error standar jika transaksi ditolak karena periode terkunci.
 */
export function buildClosedPeriodError(
  action: string,
  date: string,
  periodName: string
): string {
  return `${action} tanggal ${date} berada pada periode fiskal "${periodName}" yang sudah ditutup dan tidak dapat diproses.`
}

type ResolveFiscalPeriodResult =
  | { periodId: string | null }
  | { error: string }

/**
 * Tentukan period_id yang akan disimpan untuk sebuah transaksi.
 * - Jika explicitPeriodId diisi (user override manual): validasi periode itu
 *   ada, org_id cocok, dan belum closed, lalu pakai apa adanya.
 * - Jika kosong: auto-derive dari tanggal transaksi (date-range match).
 *   Tidak ada periode yang match sama sekali -> periodId: null (no-op, untuk
 *   org yang belum setup fiscal_periods).
 */
export async function resolveFiscalPeriodId(
  orgId: string,
  date: string,
  explicitPeriodId?: string | null
): Promise<ResolveFiscalPeriodResult> {
  const normalizedDate = String(date || '').trim()

  if (explicitPeriodId) {
    const result = await queryPostgres<{ id: string; org_id: string; is_closed: boolean; name: string }>(
      `SELECT id, org_id, is_closed, name FROM fiscal_periods WHERE id = $1`,
      [explicitPeriodId]
    )
    const period = result?.rows?.[0]
    if (!period) return { error: 'Periode fiskal yang dipilih tidak ditemukan.' }
    if (period.org_id !== orgId) return { error: 'Periode fiskal tidak sesuai dengan organisasi transaksi.' }
    if (period.is_closed) return { error: buildClosedPeriodError('Transaksi', normalizedDate, period.name) }
    return { periodId: period.id }
  }

  if (!normalizedDate) return { periodId: null }

  const result = await queryPostgres<{ id: string; is_closed: boolean; name: string }>(
    `SELECT id, is_closed, name FROM fiscal_periods
     WHERE org_id = $1 AND start_date <= $2 AND end_date >= $2
     ORDER BY start_date DESC
     LIMIT 1`,
    [orgId, normalizedDate]
  )
  const matched = result?.rows?.[0]
  if (!matched) return { periodId: null }
  if (matched.is_closed) return { error: buildClosedPeriodError('Transaksi', normalizedDate, matched.name) }
  return { periodId: matched.id }
}
