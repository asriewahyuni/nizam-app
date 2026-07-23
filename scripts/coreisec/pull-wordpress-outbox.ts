/**
 * Menarik delta WordPress melalui HMAC, memverifikasi tiap payload, menyimpan
 * secara idempoten, lalu ACK hanya setelah commit database berhasil.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { connectPostgresClient, closePostgresPool } from '../../lib/db/postgres'
import { canonicalJson, isRecord } from './migration-types'

type BridgeEvent = {
  id: number
  entity_type: string
  external_id: string
  operation: 'UPSERT' | 'DELETE'
  payload: Record<string, unknown>
  payload_sha256: string
  event_signature: string
  source_updated_at: string | null
  occurred_at: string
}

type OutboxResponse = {
  bridgeVersion: string
  events: BridgeEvent[]
  nextCursor: number
  hasMore: boolean
}

function argValue(name: string) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function signedHeaders(method: string, route: string, body: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(24).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update([method, route, timestamp, nonce, sha256(body)].join('\n'))
    .digest('hex')
  return {
    'content-type': 'application/json',
    'x-nizam-timestamp': timestamp,
    'x-nizam-nonce': nonce,
    'x-nizam-signature': signature,
  }
}

function parseResponse(value: unknown): OutboxResponse {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('Respons bridge WordPress tidak valid.')
  }
  return value as unknown as OutboxResponse
}

function verifyEvent(event: BridgeEvent, secret: string) {
  if (
    !Number.isInteger(event.id)
    || !event.entity_type
    || !event.external_id
    || !['UPSERT', 'DELETE'].includes(event.operation)
    || !isRecord(event.payload)
  ) {
    throw new Error(`Struktur event bridge ${String(event.id)} tidak valid.`)
  }
  const payloadChecksum = sha256(canonicalJson(event.payload))
  if (payloadChecksum !== event.payload_sha256) {
    throw new Error(`Checksum event bridge ${event.id} tidak cocok.`)
  }
  const expectedSignature = createHmac('sha256', secret)
    .update([
      event.entity_type,
      event.external_id,
      event.operation,
      event.payload_sha256,
      event.occurred_at,
    ].join('\n'))
    .digest('hex')
  if (expectedSignature !== event.event_signature) {
    throw new Error(`Tanda tangan event bridge ${event.id} tidak valid.`)
  }
}

async function fetchPage(baseUrl: string, secret: string, cursor: number) {
  const route = '/nizam-bridge/v1/outbox'
  const url = new URL(`/wp-json${route}`, baseUrl)
  url.searchParams.set('after', String(cursor))
  url.searchParams.set('limit', '250')
  const response = await fetch(url, {
    method: 'GET',
    headers: signedHeaders('GET', route, '', secret),
  })
  if (!response.ok) {
    throw new Error(`Bridge WordPress menolak pull (${response.status}): ${await response.text()}`)
  }
  return parseResponse(await response.json())
}

async function acknowledge(baseUrl: string, secret: string, ids: number[]) {
  const route = '/nizam-bridge/v1/ack'
  const body = JSON.stringify({ ids })
  const response = await fetch(new URL(`/wp-json${route}`, baseUrl), {
    method: 'POST',
    headers: signedHeaders('POST', route, body, secret),
    body,
  })
  if (!response.ok) {
    throw new Error(`Bridge WordPress menolak ACK (${response.status}): ${await response.text()}`)
  }
}

async function main() {
  const baseUrl = argValue('url') || String(process.env.COREISEC_BRIDGE_URL || '').trim()
  const secret = String(process.env.COREISEC_BRIDGE_SECRET || '').trim()
  const orgId = argValue('org-id')
  if (!baseUrl || !orgId || secret.length < 32) {
    throw new Error(
      'Wajib isi --url, --org-id, dan COREISEC_BRIDGE_SECRET minimal 32 karakter.',
    )
  }
  const client = await connectPostgresClient()
  let cursor = Math.max(0, Number(argValue('after') || 0))
  let received = 0
  try {
    do {
      const page = await fetchPage(baseUrl, secret, cursor)
      if (page.events.length === 0) break
      page.events.forEach((event) => verifyEvent(event, secret))

      await client.query('BEGIN')
      try {
        for (const event of page.events) {
          await client.query(
            `INSERT INTO public.migration_bridge_events (
               org_id, source_system, source_event_id, entity_type, external_id,
               operation, payload, payload_sha256, event_signature,
               source_updated_at, occurred_at
             ) VALUES (
               $1::uuid, 'WORDPRESS_COREISEC', $2, $3, $4, $5, $6::jsonb,
               $7, $8, $9::timestamptz, $10::timestamptz
             )
             ON CONFLICT (org_id, source_system, source_event_id) DO UPDATE
             SET
               payload = EXCLUDED.payload,
               payload_sha256 = EXCLUDED.payload_sha256,
               event_signature = EXCLUDED.event_signature,
               source_updated_at = EXCLUDED.source_updated_at,
               occurred_at = EXCLUDED.occurred_at
             WHERE public.migration_bridge_events.payload_sha256 = EXCLUDED.payload_sha256`,
            [
              orgId,
              event.id,
              event.entity_type,
              event.external_id,
              event.operation,
              JSON.stringify(event.payload),
              event.payload_sha256,
              event.event_signature,
              event.source_updated_at,
              event.occurred_at,
            ],
          )
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }

      await acknowledge(baseUrl, secret, page.events.map((event) => event.id))
      received += page.events.length
      cursor = page.nextCursor
      if (!page.hasMore || process.argv.includes('--once')) break
    } while (true)
  } finally {
    client.release()
    await closePostgresPool()
  }
  console.log(JSON.stringify({ received, nextCursor: cursor, status: 'TERSIMPAN' }, null, 2))
}

main().catch((error: unknown) => {
  console.error(`[coreisec:bridge:pull] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
