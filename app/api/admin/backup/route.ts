/**
 * Endpoint manual trigger backup database.
 * POST /api/admin/backup          → jalankan backup sekarang
 * GET  /api/admin/backup          → cek status config backup
 * POST /api/admin/backup?dryRun=1 → dry run (validasi config saja)
 *
 * Auth: Bearer token via SCHEDULER_SECRET env.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDatabaseBackup } from '@/lib/backup/backup-db.server'

function getSecret() {
  return (
    String(process.env.SCHEDULER_SECRET || '').trim() ||
    String(process.env.WEEKLY_SYSTEM_USAGE_REPORT_SECRET || '').trim()
  )
}

function isAuthorized(request: NextRequest) {
  const secret = getSecret()
  if (!secret) return false
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  const header = request.headers.get('x-cron-secret')?.trim() || ''
  return bearer === secret || header === secret
}

function readBooleanQuery(value: string | null) {
  return ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase())
}

// GET — cek status config
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const enabled = String(process.env.BACKUP_SCHEDULER_ENABLED || 'false').toLowerCase() === 'true'
  const hasDbUrl = Boolean(process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL)
  const hasBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const hasChatId = Boolean(process.env.TELEGRAM_USER_ID)
  const cron = String(process.env.BACKUP_SCHEDULER_CRON || '0 3 * * *')
  const timezone = String(process.env.BACKUP_SCHEDULER_TIMEZONE || 'Asia/Jakarta')

  return NextResponse.json(
    {
      ok: true,
      config: {
        enabled,
        hasDbUrl,
        hasBotToken,
        hasChatId,
        cron,
        timezone,
        ready: hasDbUrl && hasBotToken && hasChatId,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST — jalankan backup
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = readBooleanQuery(request.nextUrl.searchParams.get('dryRun'))

  try {
    const result = await runDatabaseBackup(dryRun)

    return NextResponse.json(
      { ok: result.ok, result },
      {
        status: result.ok ? 200 : 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Backup gagal.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
