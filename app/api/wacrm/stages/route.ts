// app/api/wacrm/stages/route.ts
// DELETE — hapus board/stage, re-assign kontak ke fallback stage, update settings

import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { name } = await req.json()
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama board wajib diisi' }, { status: 400 })
    }

    const instance = await getModuleInstanceStatus(orgId, 'WA_CRM')
    if (!instance) {
      return NextResponse.json({ error: 'Modul tidak ditemukan' }, { status: 404 })
    }

    const settings = (instance.settings ?? {}) as Record<string, string>
    const pipelineStages = (settings.pipeline_stages ?? 'Masuk, Follow Up, Negosiasi, Closing')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)

    if (pipelineStages.some(s => s.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Nama board/list sudah ada!' }, { status: 400 })
    }

    const updatedStages = [...pipelineStages, name.trim()]
    const newSettings = { ...settings, pipeline_stages: updatedStages.join(', ') }

    await queryPostgres(
      `UPDATE org_module_instances
       SET settings = $1::jsonb
       WHERE org_id = $2 AND module_key = 'WA_CRM'`,
      [JSON.stringify(newSettings), orgId]
    )

    return NextResponse.json({ data: { success: true, updatedStages } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = orgData.org.id

    const { stageLabel } = await req.json()
    if (!stageLabel) {
      return NextResponse.json({ error: 'stageLabel wajib diisi' }, { status: 400 })
    }

    const instance = await getModuleInstanceStatus(orgId, 'WA_CRM')
    if (!instance) {
      return NextResponse.json({ error: 'Modul tidak ditemukan' }, { status: 404 })
    }

    const settings = (instance.settings ?? {}) as Record<string, string>
    const pipelineStages = (settings.pipeline_stages ?? 'Masuk, Follow Up, Negosiasi, Closing')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)

    if (pipelineStages.length <= 1) {
      return NextResponse.json({ error: 'Minimal harus menyisakan 1 board/list' }, { status: 400 })
    }

    const stageIndex = pipelineStages.findIndex(s => s.toLowerCase() === stageLabel.toLowerCase())
    if (stageIndex === -1) {
      return NextResponse.json({ error: 'Board tidak ditemukan' }, { status: 404 })
    }

    const actualLabel = pipelineStages[stageIndex]
    const keyToDelete = actualLabel.trim().toLowerCase().replace(/\s+/g, '_')

    // Hapus stage
    const updatedStages = pipelineStages.filter((_, idx) => idx !== stageIndex)
    const fallbackLabel = updatedStages[0]
    const fallbackKey = fallbackLabel.trim().toLowerCase().replace(/\s+/g, '_')

    // 1. Update kontak di database ke fallback stage
    await queryPostgres(
      `UPDATE wacrm_contacts SET stage = $1 WHERE stage = $2 AND org_id = $3`,
      [fallbackKey, keyToDelete, orgId]
    )

    // 2. Simpan list stage ter-update ke module settings
    const newSettings = { ...settings, pipeline_stages: updatedStages.join(', ') }
    await queryPostgres(
      `UPDATE org_module_instances
       SET settings = $1::jsonb
       WHERE org_id = $2 AND module_key = 'WA_CRM'`,
      [JSON.stringify(newSettings), orgId]
    )

    return NextResponse.json({ data: { success: true, updatedStages } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
