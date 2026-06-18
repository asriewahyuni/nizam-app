// app/api/wacrm/messages/route.ts
// GET  — 100 pesan terbaru untuk org aktif
// DELETE — hapus satu pesan dari DB (tidak menarik kembali dari WhatsApp penerima)

import { NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const result = await queryPostgres(
      `SELECT id, contact_id, direction, body, media_url, media_type, sent_at, delivered, read_at
       FROM wacrm_messages
       WHERE org_id = $1
       ORDER BY sent_at DESC
       LIMIT 100`,
      [orgId]
    )

    return NextResponse.json({ data: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { messageId } = await req.json()
    if (!messageId) return NextResponse.json({ error: 'messageId wajib diisi' }, { status: 400 })

    await queryPostgres(
      'DELETE FROM wacrm_messages WHERE id = $1 AND org_id = $2',
      [messageId, orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
