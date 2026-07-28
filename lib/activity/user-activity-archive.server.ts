/**
 * Arsip otomatis log aktivitas user (user_activity_logs) yang sudah lewat
 * masa retensi ke S3 (Railway bucket) sebelum dihapus dari Postgres — bukan
 * dihapus begitu saja, supaya histori tetap ada kalau sewaktu-waktu diperlukan.
 * Dipanggil dari scheduler harian (lib/scheduler/scheduler.server.ts).
 */
import 'server-only'

import { gzipSync } from 'node:zlib'
import { queryPostgres } from '@/lib/db/postgres'
import {
  buildActivityArchiveStorageKey,
  isObjectStorageConfigured,
  uploadObjectToStorage,
} from '@/lib/storage/object-storage.server'

const DEFAULT_RETENTION_DAYS = 30
const MAX_DAYS_PER_RUN = 60

export type ArchiveUserActivityLogsResult = {
  ok: boolean
  skipped: boolean
  reason?: string
  dryRun: boolean
  retentionDays: number
  archivedDays: number
  archivedRows: number
  days: string[]
}

export async function archiveOldUserActivityLogs(options: {
  dryRun?: boolean
  retentionDays?: number
} = {}): Promise<ArchiveUserActivityLogsResult> {
  const retentionDays = Math.max(1, Math.trunc(options.retentionDays ?? DEFAULT_RETENTION_DAYS))
  const dryRun = Boolean(options.dryRun)

  if (!isObjectStorageConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'Object storage (S3) belum dikonfigurasi — arsip dibatalkan, tidak ada data yang dihapus demi keamanan.',
      dryRun,
      retentionDays,
      archivedDays: 0,
      archivedRows: 0,
      days: [],
    }
  }

  const dayRows = await queryPostgres<{ day: string }>(
    `SELECT DISTINCT date_trunc('day', occurred_at)::date::text AS day
     FROM public.user_activity_logs
     WHERE occurred_at < NOW() - make_interval(days => $1::int)
     ORDER BY day ASC
     LIMIT $2::int`,
    [retentionDays, MAX_DAYS_PER_RUN],
  )

  let archivedRows = 0
  const archivedDays: string[] = []

  for (const { day } of dayRows.rows) {
    const rowsResult = await queryPostgres<Record<string, unknown>>(
      `SELECT * FROM public.user_activity_logs
       WHERE date_trunc('day', occurred_at) = $1::date
       ORDER BY occurred_at ASC`,
      [day],
    )
    if (rowsResult.rows.length === 0) continue

    if (!dryRun) {
      const payload = JSON.stringify(rowsResult.rows)
      const compressed = gzipSync(Buffer.from(payload, 'utf8'))
      const key = buildActivityArchiveStorageKey(day)

      await uploadObjectToStorage({
        key,
        body: compressed,
        contentType: 'application/gzip',
        cacheControl: 'private, no-store',
      })

      const ids = rowsResult.rows.map((row) => row.id)
      await queryPostgres(
        `DELETE FROM public.user_activity_logs WHERE id = ANY($1::uuid[])`,
        [ids],
      )
    }

    archivedRows += rowsResult.rows.length
    archivedDays.push(day)
  }

  return {
    ok: true,
    skipped: false,
    dryRun,
    retentionDays,
    archivedDays: archivedDays.length,
    archivedRows,
    days: archivedDays,
  }
}
