/**
 * Endpoint internal untuk menjalankan scheduler pusat.
 * Bisa dipakai oleh cron berbasis HTTP dari hosting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runScheduledTasks } from '@/lib/scheduler/scheduler.server'

function getSchedulerSecret() {
  return (
    String(process.env.SCHEDULER_SECRET || '').trim() ||
    String(process.env.WEEKLY_SYSTEM_USAGE_REPORT_SECRET || '').trim()
  )
}

function isAuthorized(request: NextRequest) {
  const configuredSecret = getSchedulerSecret()
  if (!configuredSecret) return false

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  const headerSecret = request.headers.get('x-cron-secret')?.trim() || ''

  return bearerToken === configuredSecret || headerSecret === configuredSecret
}

function readBooleanQuery(value: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes'].includes(normalized)
}

async function handleRequest(request: NextRequest) {
  if (!getSchedulerSecret()) {
    return NextResponse.json(
      { ok: false, error: 'Missing SCHEDULER_SECRET' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const results = await runScheduledTasks({
      dryRun: readBooleanQuery(request.nextUrl.searchParams.get('dryRun')),
      force: readBooleanQuery(request.nextUrl.searchParams.get('force')),
      taskName: request.nextUrl.searchParams.get('task'),
    })

    const failedTasks = results.filter((item) => item.success === false)

    return NextResponse.json(
      {
        ok: failedTasks.length === 0,
        results,
      },
      {
        status: failedTasks.length === 0 ? 200 : 502,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Gagal menjalankan scheduler.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}
