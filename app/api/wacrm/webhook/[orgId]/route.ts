// app/api/wacrm/webhook/[orgId]/route.ts
// Terima pesan masuk dari Fonnte dan simpan ke wacrm_messages.
// URL ini di-paste ke field "URL Webhook" di dashboard Fonnte.
// Payload Fonnte: { device, sender, message, name, url?, type?, filename? }

import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

// Mapping tipe Fonnte → media_type kita
const MEDIA_TYPES: Record<string, string> = {
  image:    'image',
  video:    'video',
  audio:    'audio',
  document: 'document',
  sticker:  'sticker',
  ptt:      'audio', // push-to-talk voice note
}

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

  const { device, sender, message, name, url, type } = payload

  // Abaikan jika tidak ada pengirim/device (event status/system)
  if (!device || !sender) return NextResponse.json({ ok: true })

  // Harus ada konten: teks atau media URL
  const hasText  = !!message?.trim()
  const hasMedia = !!url?.trim()
  if (!hasText && !hasMedia) return NextResponse.json({ ok: true })

  try {
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

    // Log webhook
    await queryPostgres(
      `INSERT INTO wacrm_webhook_logs (org_id, event_type, payload, processed)
       VALUES ($1, 'message_in', $2::jsonb, false)`,
      [orgId, rawBody]
    )

    if (!conn) return NextResponse.json({ ok: true })

    // Normalisasi nomor pengirim
    const senderPhone = sender.replace(/@.*/, '').replace(/\D/g, '')
    const ownPhone    = (conn.connected_phone ?? '').replace(/\D/g, '')
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

    // Tentukan media_type
    const mediaType = type ? (MEDIA_TYPES[type.toLowerCase()] ?? null) : null

    // Simpan pesan (body boleh kosong untuk pesan gambar tanpa caption)
    await queryPostgres(
      `INSERT INTO wacrm_messages
         (org_id, contact_id, direction, body, media_url, media_type, sent_at, delivered)
       VALUES ($1, $2, 'in', $3, $4, $5, NOW(), true)`,
      [orgId, contactId, message?.trim() || '', url?.trim() || null, mediaType]
    )

    // Update last_message_at kontak
    await queryPostgres(
      `UPDATE wacrm_contacts SET last_message_at = NOW() WHERE id = $1`,
      [contactId]
    )

    // Tandai webhook sebagai processed
    await queryPostgres(
      `UPDATE wacrm_webhook_logs SET processed = true
       WHERE id = (
         SELECT id FROM wacrm_webhook_logs
         WHERE org_id = $1 AND processed = false
         ORDER BY received_at DESC LIMIT 1
       )`,
      [orgId]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[wacrm/webhook]', err.message)
    return NextResponse.json({ ok: true })
  }
}
