'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { LooseDb } from '@/lib/supabase/loose'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_SCREENSHOT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

export type SupportTicketRecord = {
  id: string
  ticket_no: string
  title: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  found_in_menu: string
  found_during: string | null
  found_at: string | null
  screenshot_url: string | null
  created_at: string
}

export type SupportTicketDocUpdateRecord = {
  id: string
  ticket_id: string
  update_title: string
  update_body: string | null
  status_after: SupportTicketRecord['status']
  created_at: string
  ticket: {
    ticket_no: string
    title: string
    severity: SupportTicketRecord['severity']
    found_in_menu: string
  } | null
}

export type OperatorSupportTicketRecord = SupportTicketRecord & {
  org_id: string
  organization?: { name: string } | null
}

export type OperatorSupportTicketUpdateRecord = {
  id: string
  ticket_id: string
  org_id: string
  update_title: string
  update_body: string | null
  status_after: SupportTicketRecord['status']
  is_public: boolean
  created_at: string
  updated_by_user_id: string
}

export type OperatorTicketingSnapshot = {
  tickets: OperatorSupportTicketRecord[]
  updates: OperatorSupportTicketUpdateRecord[]
}

type TicketMutationResult = {
  success?: boolean
  error?: string
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function parseFoundAtIso(foundAtRaw: string) {
  if (!foundAtRaw) return null
  const parsed = new Date(foundAtRaw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function validateScreenshot(file: File) {
  if (!ALLOWED_SCREENSHOT_MIME_TYPES.includes(file.type)) {
    return 'Format screenshot tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau HEIC.'
  }
  if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
    return 'Ukuran screenshot maksimal 5MB.'
  }
  return null
}

async function requirePlatformAdminActor() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return { error: 'Sesi login tidak ditemukan.' }
  if (!isPlatformAdminEmail(user.email)) return { error: 'Akses ditolak. Khusus platform admin.' }
  return { user }
}

export async function getSupportTicketsForCurrentOrg(limit = 20): Promise<SupportTicketRecord[]> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('support_tickets')
    .select('id, ticket_no, title, description, severity, status, found_in_menu, found_during, found_at, screenshot_url, created_at')
    .eq('org_id', orgData.org.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ticketing] Failed to fetch support tickets:', error.message)
    return []
  }

  return (data || []) as SupportTicketRecord[]
}

export async function getSupportDocUpdatesForCurrentOrg(limit = 100): Promise<SupportTicketDocUpdateRecord[]> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('support_ticket_updates')
    .select('id, ticket_id, update_title, update_body, status_after, created_at, ticket:support_tickets(ticket_no, title, severity, found_in_menu)')
    .eq('org_id', orgData.org.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ticketing] Failed to fetch doc updates:', error.message)
    return []
  }

  return (data || []) as SupportTicketDocUpdateRecord[]
}

export async function getOperatorTicketingSnapshot(limit = 120): Promise<OperatorTicketingSnapshot> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { tickets: [], updates: [] }

  const admin = await createAdminClient()
  const db = admin as unknown as LooseDb

  const [ticketResult, updatesResult] = await Promise.all([
    db
      .from('support_tickets')
      .select('id, org_id, ticket_no, title, description, severity, status, found_in_menu, found_during, found_at, screenshot_url, created_at, organization:organizations(name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('support_ticket_updates')
      .select('id, ticket_id, org_id, update_title, update_body, status_after, is_public, created_at, updated_by_user_id')
      .order('created_at', { ascending: false })
      .limit(limit * 2),
  ])

  const tickets = ticketResult.error ? [] : ((ticketResult.data || []) as OperatorSupportTicketRecord[])
  const updates = updatesResult.error ? [] : ((updatesResult.data || []) as OperatorSupportTicketUpdateRecord[])

  return { tickets, updates }
}

export async function createSupportTicket(formData: FormData): Promise<TicketMutationResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Organisasi aktif tidak ditemukan.' }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' }

  const title = normalizeText(formData.get('title'))
  const description = normalizeText(formData.get('description'))
  const foundInMenu = normalizeText(formData.get('found_in_menu'))
  const foundDuring = normalizeText(formData.get('found_during'))
  const foundAtRaw = normalizeText(formData.get('found_at'))
  const foundAtIso = parseFoundAtIso(foundAtRaw)
  const severityRaw = normalizeText(formData.get('severity')).toUpperCase()
  const severity = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severityRaw) ? severityRaw : 'MEDIUM') as SupportTicketRecord['severity']

  if (!title) return { error: 'Judul bug wajib diisi.' }
  if (!description) return { error: 'Deskripsi bug wajib diisi.' }
  if (!foundInMenu) return { error: 'Menu/lokasi bug ditemukan wajib diisi.' }

  let screenshotUrl: string | null = null
  const screenshot = formData.get('screenshot')
  if (screenshot instanceof File && screenshot.size > 0) {
    const screenshotError = validateScreenshot(screenshot)
    if (screenshotError) return { error: screenshotError }

    const extension = String(screenshot.name.split('.').pop() || 'png')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'png'
    const filePath = `${user.id}/support-tickets/${orgData.org.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, screenshot, { contentType: screenshot.type, upsert: false })

    if (uploadError) {
      return { error: `Gagal upload screenshot: ${uploadError.message}` }
    }

    const { data: publicData } = supabase.storage.from('receipts').getPublicUrl(filePath)
    screenshotUrl = publicData.publicUrl
  }

  const payload = {
    org_id: orgData.org.id,
    reporter_user_id: user.id,
    title,
    description,
    severity,
    status: 'OPEN',
    found_in_menu: foundInMenu,
    found_during: foundDuring || null,
    found_at: foundAtIso,
    screenshot_url: screenshotUrl,
  }

  const { error } = await db.from('support_tickets').insert(payload)
  if (error) return { error: `Gagal menyimpan tiket: ${error.message}` }

  revalidatePath('/settings/ticketing')
  revalidatePath('/settings/ticketing/doc-update')
  return { success: true }
}

export async function postSupportTicketProgress(formData: FormData): Promise<TicketMutationResult> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { error: actor.error }

  const ticketId = normalizeText(formData.get('ticket_id'))
  const updateTitle = normalizeText(formData.get('update_title'))
  const updateBody = normalizeText(formData.get('update_body'))
  const statusAfterRaw = normalizeText(formData.get('status_after')).toUpperCase()
  const isPublicRaw = normalizeText(formData.get('is_public'))
  const isPublic = isPublicRaw === 'on' || isPublicRaw === 'true' || isPublicRaw === '1'

  if (!ticketId) return { error: 'Ticket tidak valid.' }
  if (!updateTitle) return { error: 'Judul progress wajib diisi.' }

  const statusAfter = (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(statusAfterRaw)
    ? statusAfterRaw
    : 'IN_PROGRESS') as SupportTicketRecord['status']

  const admin = await createAdminClient()
  const db = admin as unknown as LooseDb

  const { data: ticketRow, error: ticketError } = await db
    .from('support_tickets')
    .select('id, org_id, status')
    .eq('id', ticketId)
    .maybeSingle()

  if (ticketError) return { error: `Tiket tidak dapat dibaca: ${ticketError.message}` }
  if (!ticketRow) return { error: 'Tiket tidak ditemukan.' }

  const currentStatus = String((ticketRow as { status?: string }).status || 'OPEN').toUpperCase()
  const orgId = String((ticketRow as { org_id?: string }).org_id || '')
  if (!orgId) return { error: 'Org tiket tidak valid.' }

  const normalizedCurrentStatus = (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(currentStatus)
    ? currentStatus
    : 'OPEN') as SupportTicketRecord['status']

  const { error: updateTicketError } = await db
    .from('support_tickets')
    .update({ status: statusAfter })
    .eq('id', ticketId)

  if (updateTicketError) {
    return { error: `Gagal update status tiket: ${updateTicketError.message}` }
  }

  const updatePayload = {
    ticket_id: ticketId,
    org_id: orgId,
    updated_by_user_id: actor.user.id,
    update_title: updateTitle,
    update_body: updateBody || null,
    status_before: normalizedCurrentStatus,
    status_after: statusAfter,
    is_public: isPublic,
  }

  const { error: progressError } = await db.from('support_ticket_updates').insert(updatePayload)
  if (progressError) return { error: `Gagal simpan progress: ${progressError.message}` }

  revalidatePath('/saas/ticketing')
  revalidatePath('/settings/ticketing')
  revalidatePath('/settings/ticketing/doc-update')
  return { success: true }
}
