import { NextResponse } from 'next/server'
import { resolveRuntimeDatabaseTarget } from '@/lib/db/runtime-target'

export const dynamic = 'force-dynamic'

export async function GET() {
  const runtimeDb = resolveRuntimeDatabaseTarget()

  return NextResponse.json(
    {
      ok: true,
      service: 'nizam-app',
      timestamp: new Date().toISOString(),
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      supabaseTarget: process.env.NEXT_PUBLIC_SUPABASE_TARGET || 'remote',
      runtimeDatabaseMode: runtimeDb.mode,
      runtimeDatabaseSource: runtimeDb.sourceKey,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
