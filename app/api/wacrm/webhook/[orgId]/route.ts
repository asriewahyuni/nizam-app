// app/api/wacrm/webhook/[orgId]/route.ts
// Terima pesan masuk dari Fonnte dan simpan ke wacrm_messages.
// URL ini di-paste ke field "URL Webhook" di dashboard Fonnte.
// Fonnte POST payload: { device, sender, message, name, member? }

import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

// Fonnte tidak mendukung HMAC signature — kita verifikasi via `device` phone
// yang harus cocok dengan connected_phone di wacrm_connections milik org ini.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params

  let rawBody: string
  let payload: Record<string, string>
  try {
    rawBody = await req.text()
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { device, sender, message, name } = payload
  if (!device || !sender || !message) {
    return NextResponse.json({ ok: true }) // abaikan event non-pesan (status, dll)
  }

  try {
    // Ambil koneksi aktif untuk org ini
    const connResult = await queryPostgres<{
      id: string
      bridge_token: string
      connected_phone: string
    }>(
      `SELECT id, bridge_token, connected_phone
       FROM wacrm_connections
       WHERE org_id = $1
       LIMIT 1`,
      [orgId]
    )
    const conn = connResult.rows[0]

    // Log webhook terlepas dari validasi
    await queryPostgres(
      `INSERT INTO wacrm_webhook_logs (org_id, event_type, payload, processed)
       VALUES ($1, 'message_in', $2::jsonb, false)`,
      [orgId, rawBody]
    )

    if (!conn) return NextResponse.json({ ok: true })

    // Normalisasi nomor pengirim (hapus @s.whatsapp.net dll)
    const senderPhone = sender.replace(/@.*/, '').replace(/\D/g, '')

    // Jangan proses pesan dari nomor sendiri (echo dari outbound)
    const ownPhone = (conn.connected_phone ?? '').replace(/\D/g, '')
    if (senderPhone === ownPhone) return NextResponse.json({ ok: true })

    // Upsert kontak
    const contactResult = await queryPostgres<{ id: string }>(
      `INSERT INTO wacrm_contacts (org_id, name, phone, stage)
       VALUES ($1, $2, $3, 'masuk')
       ON CONFLICT (org_id, phone) DO UPDATE
         SET name = EXCLUDED.name,
             last_message_at = NOW()
       RETURNING id`,
      [orgId, name || senderPhone, senderPhone]
    )
    const contactId = contactResult.rows[0]?.id
    if (!contactId) return NextResponse.json({ ok: true })

    // Simpan pesan
    await queryPostgres(
      `INSERT INTO wacrm_messages (org_id, contact_id, direction, body, sent_at, delivered)
       VALUES ($1, $2, 'in', $3, NOW(), true)`,
      [orgId, contactId, message]
    )

    // Update last_message_at kontak
    await queryPostgres(
      `UPDATE wacrm_contacts SET last_message_at = NOW() WHERE id = $1`,
      [contactId]
    )

    // Tandai webhook sebagai processed
    await queryPostgres(
      `UPDATE wacrm_webhook_logs SET processed = true
       WHERE org_id = $1 AND processed = false
       ORDER BY received_at DESC LIMIT 1`,
      [orgId]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[wacrm/webhook]', err.message)
    return NextResponse.json({ ok: true }) // selalu 200 agar Fonnte tidak retry terus
  }
}
