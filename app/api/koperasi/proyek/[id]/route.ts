import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createClient()

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get active org
    const { data: orgMember, error: orgError } = await db
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('is_primary', { ascending: false })
      .limit(1)
      .single()

    if (orgError || !orgMember) {
      return NextResponse.json({ error: 'No active organization' }, { status: 404 })
    }

    const orgId = orgMember.organization_id

    // Fetch proyek with related data
    const { data: proyek, error } = await db
      .from('koperasi_proyek')
      .select('*, mudharib:koperasi_mudharib!inner(nama)')
      .eq('id', id)
      .eq('mudharib.org_id', orgId)
      .single()

    if (error || !proyek) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(proyek, { status: 200 })
  } catch (err: any) {
    console.error('GET /api/koperasi/proyek/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
