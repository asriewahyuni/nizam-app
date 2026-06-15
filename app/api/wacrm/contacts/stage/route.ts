// app/api/wacrm/contacts/stage/route.ts
// PATCH — update stage kontak + catat ke pipeline_history

import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { contactId, stage } = await req.json()
    if (!contactId || !stage) {
      return NextResponse.json({ error: 'contactId dan stage wajib diisi' }, { status: 400 })
    }

    const VALID_STAGES = ['masuk', 'follow_up', 'negosiasi', 'closing']
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Stage tidak valid' }, { status: 400 })
    }

    // Ambil stage lama untuk history
    const current = await queryPostgres(
      `SELECT stage FROM wacrm_contacts WHERE id = $1 AND org_id = $2`,
      [contactId, orgId]
    )
    if (!current.rows[0]) {
      return NextResponse.json({ error: 'Kontak tidak ditemukan' }, { status: 404 })
    }
    const fromStage = current.rows[0].stage

    if (fromStage === stage) return NextResponse.json({ data: { stage } })

    // Update stage + catat history
    await queryPostgres(
      `UPDATE wacrm_contacts SET stage = $1 WHERE id = $2 AND org_id = $3`,
      [stage, contactId, orgId]
    )
    await queryPostgres(
      `INSERT INTO wacrm_pipeline_history (org_id, contact_id, from_stage, to_stage)
       VALUES ($1, $2, $3, $4)`,
      [orgId, contactId, fromStage, stage]
    )

    return NextResponse.json({ data: { stage, from: fromStage } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
