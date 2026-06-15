// app/(dashboard)/wacrm/page.tsx
// Dashboard utama WA CRM — route guard: redirect ke onboarding jika modul belum READY.
// Menampilkan pipeline kanban, daftar kontak, dan panel inbox.

import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { isModuleAvailableForOrg, getModuleByKey } from '@/modules/marketplace/lib/module-registry'
import { queryPostgres } from '@/lib/db/postgres'
import { WaCrmDashboardClient } from './WaCrmDashboardClient'

export const revalidate = 0

export type WaCrmContact = {
  id: string
  name: string
  phone: string
  stage: 'masuk' | 'follow_up' | 'negosiasi' | 'closing'
  product_interest: string | null
  notes: string | null
  last_message_at: string | null
  created_at: string
}

export type WaCrmMessage = {
  id: string
  contact_id: string
  direction: 'in' | 'out'
  body: string
  media_url: string | null
  media_type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'unknown' | null
  sent_at: string
  delivered: boolean
  read_at: string | null
}

export type WaCrmConnectionStatus = 'connected' | 'disconnected' | 'qr_pending'

export default async function WaCrmPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  // Blok akses jika org belum dalam daftar beta
  const waCrmDef = getModuleByKey('WA_CRM')
  if (waCrmDef && !isModuleAvailableForOrg(waCrmDef, orgId)) redirect('/marketplace')

  const instance = await getModuleInstanceStatus(orgId, 'WA_CRM')
  if (!instance || instance.status !== 'READY') redirect('/wacrm/onboarding')

  const [contactsResult, messagesResult, connectionResult] = await Promise.all([
    queryPostgres<WaCrmContact>(
      `SELECT id, name, phone, stage, product_interest, notes,
              last_message_at, created_at
       FROM wacrm_contacts
       WHERE org_id = $1
       ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [orgId]
    ),
    // Ambil 100 pesan terbaru untuk semua kontak (inbox preview)
    queryPostgres<WaCrmMessage>(
      `SELECT id, contact_id, direction, body, media_url, media_type, sent_at, delivered, read_at
       FROM wacrm_messages
       WHERE org_id = $1
       ORDER BY sent_at DESC
       LIMIT 100`,
      [orgId]
    ),
    queryPostgres<{ status: WaCrmConnectionStatus; connected_phone: string | null }>(
      `SELECT status, connected_phone FROM wacrm_connections WHERE org_id = $1 LIMIT 1`,
      [orgId]
    ),
  ])

  const settings = (instance.settings ?? {}) as Record<string, string>
  const pipelineStages = (settings.pipeline_stages ?? 'Masuk, Follow Up, Negosiasi, Closing')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-col h-full min-h-screen">
      <WaCrmDashboardClient
        orgId={orgId}
        contacts={contactsResult.rows ?? []}
        messages={messagesResult.rows ?? []}
        connectionStatus={connectionResult.rows?.[0]?.status ?? 'disconnected'}
        connectedPhone={connectionResult.rows?.[0]?.connected_phone ?? null}
        pipelineStages={pipelineStages}
        settings={settings}
      />
    </div>
  )
}
