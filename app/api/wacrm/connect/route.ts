// app/api/wacrm/connect/route.ts
// POST — simpan/update koneksi Fonnte (token + nomor WA) ke wacrm_connections.
// Dipanggil dari onboarding Step 1 setelah user isi Fonnte token & nomor.

import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { bridge_token, connected_phone } = await req.json()
    if (!bridge_token?.trim()) {
      return NextResponse.json({ error: 'Token Fonnte wajib diisi' }, { status: 400 })
    }
    if (!connected_phone?.trim()) {
      return NextResponse.json({ error: 'Nomor WA wajib diisi' }, { status: 400 })
    }

    // Normalisasi nomor: hapus non-digit, ganti awalan 0 → 62
    const phone = connected_phone.trim().replace(/\D/g, '').replace(/^0/, '62')

    // Upsert: satu org hanya punya satu koneksi WA (untuk MVP)
    const result = await queryPostgres(
      `INSERT INTO wacrm_connections
         (org_id, bridge_type, bridge_url, bridge_token, connected_phone, status)
       VALUES ($1, 'fonnte', 'https://api.fonnte.com', $2, $3, 'connected')
       ON CONFLICT (org_id) DO UPDATE
         SET bridge_type     = 'fonnte',
             bridge_url      = 'https://api.fonnte.com',
             bridge_token    = EXCLUDED.bridge_token,
             connected_phone = EXCLUDED.connected_phone,
             status          = 'connected',
             connected_at    = NOW()
       RETURNING id, status, connected_phone`,
      [orgId, bridge_token.trim(), phone]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 200 })
  } catch (err: any) {
    console.error('[wacrm/connect]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
