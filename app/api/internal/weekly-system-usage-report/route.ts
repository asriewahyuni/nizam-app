/**
 * Endpoint internal untuk trigger laporan pekanan penggunaan sistem.
 * Cocok dipanggil oleh scheduler eksternal atau cron dari hosting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklySystemUsageReport } from '@/lib/activity/weekly-usage-report.server'

function getCronSecret() {
  return (
    String(process.env.WEEKLY_SYSTEM_USAGE_REPORT_SECRET || '').trim() ||
    String(process.env.SCHEDULER_SECRET || '').trim()
  )
}

function isAuthorized(request: NextRequest) {
  const configuredSecret = getCronSecret()
  if (!configuredSecret) return false

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  const headerSecret = request.headers.get('x-cron-secret')?.trim() || ''

  return bearerToken === configuredSecret || headerSecret === configuredSecret
}

async function handleRequest(request: NextRequest) {
  if (!getCronSecret()) {
    return NextResponse.json(
      { ok: false, error: 'Missing WEEKLY_SYSTEM_USAGE_REPORT_SECRET' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const dryRun = ['1', 'true', 'yes'].includes(
    String(request.nextUrl.searchParams.get('dryRun') || '').trim().toLowerCase()
  )

  try {
    const result = await sendWeeklySystemUsageReport({ dryRun })
    const failedRecipients = result.results.filter((item) => !item.success)

    return NextResponse.json(
      {
        ok: failedRecipients.length === 0,
        dryRun: result.dryRun,
        recipients: result.recipients,
        subject: result.subject,
        periodLabel: result.report.periodLabel,
        summary: result.report.summary,
        failedRecipients,
      },
      {
        status: failedRecipients.length === 0 ? 200 : 502,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Gagal mengirim laporan pekanan.',
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
