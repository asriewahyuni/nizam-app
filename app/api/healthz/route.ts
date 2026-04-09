import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'nizam-app',
      timestamp: new Date().toISOString(),
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      supabaseTarget: process.env.NEXT_PUBLIC_SUPABASE_TARGET || 'remote',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
