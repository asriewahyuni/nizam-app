/**
 * Resolver domain portal member untuk proxy Next.js.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '').split(':')[0]
}

export async function GET(request: NextRequest) {
  const hostname = normalizeHostname(request.nextUrl.searchParams.get('host') || '')
  if (!hostname || !/^[a-z0-9.-]+$/.test(hostname)) {
    return NextResponse.json({ error: 'Hostname tidak valid.' }, { status: 400 })
  }

  try {
    const result = await queryPostgres<{
      org_id: string
      org_slug: string
      org_name: string
      purpose: string
    }>(
      `SELECT
         org_id::text,
         org_slug,
         org_name,
         purpose
       FROM public.resolve_organization_member_domain($1)
       LIMIT 1`,
      [hostname],
    )
    const domain = result.rows[0]
    if (!domain) {
      return NextResponse.json({ data: null }, { status: 404 })
    }
    return NextResponse.json({
      data: {
        orgId: domain.org_id,
        orgSlug: domain.org_slug,
        orgName: domain.org_name,
        purpose: domain.purpose,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Domain tidak dapat diperiksa.' },
      { status: 500 },
    )
  }
}
