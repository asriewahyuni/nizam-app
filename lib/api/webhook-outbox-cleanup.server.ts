/**
 * Pembersihan rutin api_webhook_outbox — entri yang sudah final (completed/failed)
 * tidak pernah dibaca lagi oleh worker manapun (lihat processInventoryWebhookOutboxBatch
 * di inventory-webhook-outbox.ts, yang hanya mengklaim baris 'pending'/'processing'),
 * jadi aman dihapus langsung tanpa arsip. Dipanggil dari scheduler harian.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'

const DEFAULT_RETENTION_DAYS = 14

export type PruneWebhookOutboxResult = {
  ok: boolean
  dryRun: boolean
  retentionDays: number
  prunedCount: number
}

export async function pruneWebhookOutbox(options: {
  dryRun?: boolean
  retentionDays?: number
} = {}): Promise<PruneWebhookOutboxResult> {
  const retentionDays = Math.max(1, Math.trunc(options.retentionDays ?? DEFAULT_RETENTION_DAYS))
  const dryRun = Boolean(options.dryRun)

  const countResult = await queryPostgres<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM public.api_webhook_outbox
     WHERE status IN ('completed', 'failed')
       AND processed_at < NOW() - make_interval(days => $1::int)`,
    [retentionDays],
  )
  const eligibleCount = Number(countResult.rows[0]?.count || 0)

  if (dryRun || eligibleCount === 0) {
    return { ok: true, dryRun, retentionDays, prunedCount: eligibleCount }
  }

  await queryPostgres(
    `DELETE FROM public.api_webhook_outbox
     WHERE status IN ('completed', 'failed')
       AND processed_at < NOW() - make_interval(days => $1::int)`,
    [retentionDays],
  )

  return { ok: true, dryRun: false, retentionDays, prunedCount: eligibleCount }
}
