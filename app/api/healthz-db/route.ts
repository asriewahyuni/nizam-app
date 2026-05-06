import { NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { resolveRuntimeDatabaseTarget } from '@/lib/db/runtime-target'

export const dynamic = 'force-dynamic'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function GET() {
  const startedAt = Date.now()
  const runtimeDb = resolveRuntimeDatabaseTarget()

  try {
    const { rows } = await queryPostgres<{
      server_time: string
      database_name: string
      database_user: string
    }>(
      `
      select
        now()::text as server_time,
        current_database() as database_name,
        current_user as database_user
      `
    )

    return NextResponse.json(
      {
        ok: true,
        service: 'nizam-app',
        target: runtimeDb.mode,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        runtimeDatabaseSource: runtimeDb.sourceKey,
        details: rows[0] || null,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'nizam-app',
        target: runtimeDb.mode,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        runtimeDatabaseSource: runtimeDb.sourceKey,
        error: getErrorMessage(error),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  }
}
