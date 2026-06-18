// app/api/wacrm/contacts/route.ts
// GET  — daftar wacrm_contacts + daftar pelanggan dari tabel contacts (untuk import)
// POST — buat wacrm_contact baru (manual atau dari contacts yang ada)

import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

// GET /api/wacrm/contacts?source=customers&q=...
// source=customers → cari dari tabel contacts (pelanggan/vendor), bukan wacrm_contacts
export async function GET(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const source = req.nextUrl.searchParams.get('source')
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()

    if (source === 'customers') {
      // Cari dari tabel contacts yang sudah ada, exclude yang sudah ada di wacrm_contacts
      const result = await queryPostgres(
        `SELECT c.id, c.name, c.phone, c.email, c.type
         FROM contacts c
         WHERE c.org_id = $1
           AND c.is_active = TRUE
           AND c.phone IS NOT NULL
           AND c.phone <> ''
           AND ($2 = '' OR c.name ILIKE $3 OR c.phone ILIKE $3)
           AND NOT EXISTS (
             SELECT 1 FROM wacrm_contacts wc
             WHERE wc.org_id = $1 AND wc.phone = c.phone
           )
         ORDER BY c.name
         LIMIT 50`,
        [orgId, q, `%${q}%`]
      )
      return NextResponse.json({ data: result.rows })
    }

    // Default: kembalikan wacrm_contacts
    const result = await queryPostgres(
      `SELECT id, name, phone, stage, product_interest, notes, last_message_at, created_at
       FROM wacrm_contacts
       WHERE org_id = $1
       ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [orgId]
    )
    return NextResponse.json({ data: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/wacrm/contacts
// Body: { name, phone, stage?, product_interest?, notes?, contact_id? }
// contact_id = UUID dari tabel contacts (jika import dari pelanggan)
export async function POST(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const body = await req.json()
    const { name, phone, stage = 'masuk', product_interest, notes } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!phone?.trim()) return NextResponse.json({ error: 'Nomor WhatsApp wajib diisi' }, { status: 400 })

    // Normalisasi nomor: hapus karakter non-digit, ganti awalan 0 → 62
    const normalizedPhone = phone.trim()
      .replace(/\D/g, '')
      .replace(/^0/, '62')

    const result = await queryPostgres(
      `INSERT INTO wacrm_contacts (org_id, name, phone, stage, product_interest, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, phone) DO NOTHING
       RETURNING *`,
      [orgId, name.trim(), normalizedPhone, stage, product_interest?.trim() || null, notes?.trim() || null]
    )

    if (!result.rows[0]) {
      return NextResponse.json(
        { error: `Nomor ${normalizedPhone} sudah ada di Whatslab CRM` },
        { status: 409 }
      )
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
