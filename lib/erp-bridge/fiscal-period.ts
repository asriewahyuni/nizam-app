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

  if (!result.rows.length) return null
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
