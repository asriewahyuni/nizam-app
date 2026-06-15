// app/api/wacrm/webhook/[orgId]/route.ts
// Terima pesan masuk dari Fonnte dan simpan ke wacrm_messages.
// URL ini di-paste ke field "URL Webhook" di dashboard Fonnte.
// Payload Fonnte: { device, sender, message, name, url, type, filename, extension }
// Untuk pesan non-text: message = "non-text message", url = "" → ambil via API Fonnte

import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

const FONNTE_MEDIA_URL = 'https://api.fonnte.com/download-file'

// Pesan Fonnte ini adalah placeholder untuk pesan non-teks
const FONNTE_NONTEXTPLACEHOLDER = 'non-text message'

async function downloadFonnteMedia(
  token: string,
  sender: string,
  message: string
): Promise<{ url: string; type: string } | null> {
  try {
    const res = await fetch(FONNTE_MEDIA_URL, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target: sender, message }),
    })
    if (!res.ok) return null
    const json = await res.json()
    // Fonnte mengembalikan { url, type } atau { file, type }
    const fileUrl = json.url || json.file || null
    const fileType = (json.type || '').toLowerCase()
    if (!fileUrl) return null
    return { url: fileUrl, type: fileType }
  } catch {
    return null
  }
}

function guessMediaType(type: string, extension: string): string | null {
  const t = type.toLowerCase()
  const ext = extension.toLowerCase()
  if (t === 'image' || ['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return 'image'
  if (t === 'video' || ['mp4','mov','avi','mkv'].includes(ext)) return 'video'
  if (t === 'audio' || t === 'ptt' || ['mp3','ogg','m4a','aac','opus'].includes(ext)) return 'audio'
  if (t === 'sticker') return 'sticker'
  if (t === 'document' || ext) return 'document'
  return null
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

  const { device, sender, message, name, url, type, extension } = payload

  if (!device || !sender) return NextResponse.json({ ok: true })

  const isNonText = message === FONNTE_NONTEXTPLACEHOLDER
  const hasText   = !!message?.trim() && !isNonText
  const hasMedia  = !!url?.trim()

  // Abaikan jika benar-benar kosong (bukan pesan)
  if (!hasText && !hasMedia && !isNonText) return NextResponse.json({ ok: true })

  try {
    const connResult = await queryPostgres<{
      bridge_token: string
      connected_phone: string
    }>(
      `SELECT bridge_token, connected_phone FROM wacrm_connections WHERE org_id = $1 LIMIT 1`,
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

    const senderPhone = sender.replace(/@.*/, '').replace(/\D/g, '')
    const ownPhone    = (conn.connected_phone ?? '').replace(/\D/g, '')
    if (senderPhone === ownPhone) return NextResponse.json({ ok: true })

    // Upsert kontak
    const contactResult = await queryPostgres<{ id: string }>(
      `INSERT INTO wacrm_contacts (org_id, name, phone, stage)
       VALUES ($1, $2, $3, 'masuk')
       ON CONFLICT (org_id, phone) DO UPDATE
         SET name = EXCLUDED.name, last_message_at = NOW()
       RETURNING id`,
      [orgId, name || senderPhone, senderPhone]
    )
    const contactId = contactResult.rows[0]?.id
    if (!contactId) return NextResponse.json({ ok: true })

    let mediaUrl:  string | null = url?.trim() || null
    let mediaType: string | null = guessMediaType(type || '', extension || '')

    // Jika non-text dan belum ada URL → minta download ke Fonnte
    if (isNonText && !mediaUrl && conn.bridge_token) {
      const downloaded = await downloadFonnteMedia(conn.bridge_token, sender, message)
      if (downloaded) {
        mediaUrl  = downloaded.url
        mediaType = downloaded.type || mediaType
      }
    }

    const bodyText = hasText ? message.trim() : ''
    // Jika masih tidak tahu tipe media, tandai sebagai 'unknown' agar UI bisa tampilkan placeholder
    const finalMediaType = mediaType || (isNonText ? 'unknown' : null)

    await queryPostgres(
      `INSERT INTO wacrm_messages
         (org_id, contact_id, direction, body, media_url, media_type, sent_at, delivered)
       VALUES ($1, $2, 'in', $3, $4, $5, NOW(), true)`,
      [orgId, contactId, bodyText, mediaUrl, finalMediaType]
    )

    await queryPostgres(
      `UPDATE wacrm_contacts SET last_message_at = NOW() WHERE id = $1`,
      [contactId]
    )

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
