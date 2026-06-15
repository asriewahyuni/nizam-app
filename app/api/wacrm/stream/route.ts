// app/api/wacrm/stream/route.ts
// SSE endpoint — client subscribe ke sini untuk menerima pesan WA real-time.
// Menggunakan PostgreSQL LISTEN/NOTIFY: trigger di wacrm_messages mengirim
// pg_notify setiap ada INSERT, dan SSE meneruskannya ke browser tanpa polling.

import { NextRequest } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const orgData = await getActiveOrg()
  if (!orgData) return new Response('Unauthorized', { status: 401 })

  const orgId = orgData.org.id
  // Channel name: wacrm_<org_id tanpa hyphen> — max 63 char, UUID = 32 char + 6 prefix = 38 OK
  const channel = 'wacrm_' + orgId.replace(/-/g, '_')

  // Dedicated connection (bukan pool) — LISTEN butuh koneksi persisten
  const client = new Client({ connectionString: process.env.RAILWAY_DATABASE_URL })
  await client.connect()
  await client.query(`LISTEN "${channel}"`)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Kirim komentar keepalive awal agar browser tahu koneksi aktif
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Forward NOTIFY dari PostgreSQL ke SSE client
      client.on('notification', (notif) => {
        try {
          controller.enqueue(encoder.encode(`data: ${notif.payload}\n\n`))
        } catch {
          // Client sudah disconnect
        }
      })

      // Keepalive setiap 25 detik (proxy/load balancer biasanya timeout di 30 detik)
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(keepalive)
        }
      }, 25_000)

      // Cleanup saat client disconnect
      req.signal.addEventListener('abort', async () => {
        clearInterval(keepalive)
        try { await client.end() } catch {}
        try { controller.close() } catch {}
      })
    },
    cancel() {
      client.end().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // matikan buffering di Nginx/Railway proxy
    },
  })
}
