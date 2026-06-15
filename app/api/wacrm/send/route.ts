// app/api/wacrm/send/route.ts
// Kirim pesan WA via Fonnte API dan simpan ke wacrm_messages.

import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

const FONNTE_SEND_URL = 'https://api.fonnte.com/send'

export async function POST(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { contactId, body } = await req.json()
    if (!contactId || !body?.trim()) {
      return NextResponse.json({ error: 'contactId dan body wajib diisi' }, { status: 400 })
    }

    // Ambil koneksi aktif
    const connResult = await queryPostgres<{
      bridge_token: string
      connected_phone: string
    }>(
      `SELECT bridge_token, connected_phone
       FROM wacrm_connections
       WHERE org_id = $1 AND status = 'connected'
       LIMIT 1`,
      [orgId]
    )
    const conn = connResult.rows[0]
    if (!conn?.bridge_token) {
      return NextResponse.json({ error: 'WA belum terhubung. Cek pengaturan koneksi.' }, { status: 400 })
    }

    // Ambil nomor kontak
    const contactResult = await queryPostgres<{ phone: string }>(
      `SELECT phone FROM wacrm_contacts WHERE id = $1 AND org_id = $2`,
      [contactId, orgId]
    )
    const contact = contactResult.rows[0]
    if (!contact) {
      return NextResponse.json({ error: 'Kontak tidak ditemukan' }, { status: 404 })
    }

    // Kirim via Fonnte
    const fonnteRes = await fetch(FONNTE_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': conn.bridge_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: contact.phone,
        message: body.trim(),
        countryCode: '62',
      }),
    })

    if (!fonnteRes.ok) {
      const errText = await fonnteRes.text()
      console.error('[wacrm/send] Fonnte error:', errText)
      return NextResponse.json({ error: 'Gagal mengirim pesan via Fonnte' }, { status: 502 })
    }

    // Simpan pesan ke DB
    const msgResult = await queryPostgres<{
      id: string; body: string; sent_at: string; delivered: boolean
    }>(
      `INSERT INTO wacrm_messages (org_id, contact_id, direction, body, sent_at, delivered)
       VALUES ($1, $2, 'out', $3, NOW(), false)
       RETURNING id, body, sent_at, delivered`,
      [orgId, contactId, body.trim()]
    )

    // Update last_message_at kontak
    await queryPostgres(
      `UPDATE wacrm_contacts SET last_message_at = NOW() WHERE id = $1`,
      [contactId]
    )

    return NextResponse.json({ data: msgResult.rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error('[wacrm/send]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
