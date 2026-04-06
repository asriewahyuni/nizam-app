'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { uploadSupportTicketScreenshot } from '@/modules/saas/lib/support-ticket-storage.server'
import { revalidatePath } from 'next/cache'

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

type SupportTicketRow = {
  id: string
  org_id: string
  ticket_no: string
  title: string
  description: string
  severity: string
  status: string
  found_in_menu: string
  found_during: string | null
  found_at: Date | string | null
  screenshot_url: string | null
  created_at: Date | string
  organization_name?: string | null
}

type SupportTicketUpdateRow = {
  id: string
  ticket_id: string
  org_id: string
  update_title: string
  update_body: string | null
  status_after: string
  is_public?: boolean | null
  created_at: Date | string
  updated_by_user_id?: string | null
  ticket_no?: string | null
  ticket_title?: string | null
  ticket_severity?: string | null
  ticket_found_in_menu?: string | null
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function parseFoundAtIso(foundAtRaw: string) {
  if (!foundAtRaw) return null
  const parsed = new Date(foundAtRaw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeTicketStatus(value: string | null | undefined): SupportTicketRecord['status'] {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH' || normalized === 'CRITICAL') {
    return 'OPEN'
  }

  return (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(normalized)
    ? normalized
    : 'OPEN') as SupportTicketRecord['status']
}

function normalizeTicketSeverity(value: string | null | undefined): SupportTicketRecord['severity'] {
  const normalized = String(value || '').toUpperCase()
  return (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(normalized)
    ? normalized
    : 'MEDIUM') as SupportTicketRecord['severity']
}

function normalizeSupportTicket(row: SupportTicketRow): SupportTicketRecord {
  return {
    id: row.id,
    ticket_no: row.ticket_no,
    title: row.title,
    description: row.description,
    severity: normalizeTicketSeverity(row.severity),
    status: normalizeTicketStatus(row.status),
    found_in_menu: row.found_in_menu,
    found_during: row.found_during ?? null,
    found_at: toIsoString(row.found_at),
    screenshot_url: row.screenshot_url ?? null,
    created_at: toIsoString(row.created_at) || new Date(0).toISOString(),
  }
}

function normalizeSupportTicketDocUpdate(row: SupportTicketUpdateRow): SupportTicketDocUpdateRecord {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    update_title: row.update_title,
    update_body: row.update_body ?? null,
    status_after: normalizeTicketStatus(row.status_after),
    created_at: toIsoString(row.created_at) || new Date(0).toISOString(),
    ticket: row.ticket_no
      ? {
          ticket_no: row.ticket_no,
          title: row.ticket_title || '',
          severity: normalizeTicketSeverity(row.ticket_severity),
          found_in_menu: row.ticket_found_in_menu || '',
        }
      : null,
  }
}

function normalizeOperatorSupportTicket(row: SupportTicketRow): OperatorSupportTicketRecord {
  return {
    ...normalizeSupportTicket(row),
    org_id: row.org_id,
    organization: row.organization_name
      ? { name: row.organization_name }
      : null,
  }
}

function normalizeOperatorSupportTicketUpdate(row: SupportTicketUpdateRow): OperatorSupportTicketUpdateRecord {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    org_id: row.org_id,
    update_title: row.update_title,
    update_body: row.update_body ?? null,
    status_after: normalizeTicketStatus(row.status_after),
    is_public: Boolean(row.is_public),
    created_at: toIsoString(row.created_at) || new Date(0).toISOString(),
    updated_by_user_id: String(row.updated_by_user_id || ''),
  }
}

async function requirePlatformAdminActor() {
  const session = await auth()
  const user = session?.user
  const email = String(user?.email || '').trim()

  if (!user?.id) return { error: 'Sesi login tidak ditemukan.' }
  if (!email || !isPlatformAdminEmail(email)) return { error: 'Akses ditolak. Khusus platform admin.' }

  return {
    userId: user.id,
    email,
  }
}

async function getCurrentAuthenticatedUser() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' as const }
  }

  return { userId }
}

export async function getSupportTicketsForCurrentOrg(limit = 20): Promise<SupportTicketRecord[]> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return []

  try {
    const rows = await prisma.$queryRaw<SupportTicketRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        org_id::text AS org_id,
        ticket_no,
        title,
        description,
        severity,
        status,
        found_in_menu,
        found_during,
        found_at,
        screenshot_url,
        created_at
      FROM public.support_tickets
      WHERE org_id = ${orgData.org.id}::uuid
      ORDER BY created_at DESC
      LIMIT ${Math.max(1, limit)}
    `)

    return rows.map(normalizeSupportTicket)
  } catch (error) {
    console.error('[ticketing] Failed to fetch support tickets:', error)
    return []
  }
}

export async function getSupportDocUpdatesForCurrentOrg(limit = 100): Promise<SupportTicketDocUpdateRecord[]> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return []

  try {
    const rows = await prisma.$queryRaw<SupportTicketUpdateRow[]>(Prisma.sql`
      SELECT
        u.id::text AS id,
        u.ticket_id::text AS ticket_id,
        u.org_id::text AS org_id,
        u.update_title,
        u.update_body,
        u.status_after,
        u.created_at,
        t.ticket_no,
        t.title AS ticket_title,
        t.severity AS ticket_severity,
        t.found_in_menu AS ticket_found_in_menu
      FROM public.support_ticket_updates u
      JOIN public.support_tickets t ON t.id = u.ticket_id
      WHERE u.org_id = ${orgData.org.id}::uuid
        AND u.is_public = TRUE
      ORDER BY u.created_at DESC
      LIMIT ${Math.max(1, limit)}
    `)

    return rows.map(normalizeSupportTicketDocUpdate)
  } catch (error) {
    console.error('[ticketing] Failed to fetch doc updates:', error)
    return []
  }
}

export async function getOperatorTicketingSnapshot(limit = 120): Promise<OperatorTicketingSnapshot> {
  const actor = await requirePlatformAdminActor()
  if ('error' in actor) return { tickets: [], updates: [] }

  try {
    const [ticketRows, updateRows] = await Promise.all([
      prisma.$queryRaw<SupportTicketRow[]>(Prisma.sql`
        SELECT
          t.id::text AS id,
          t.org_id::text AS org_id,
          t.ticket_no,
          t.title,
          t.description,
          t.severity,
          t.status,
          t.found_in_menu,
          t.found_during,
          t.found_at,
          t.screenshot_url,
          t.created_at,
          o.name AS organization_name
        FROM public.support_tickets t
        LEFT JOIN public.organizations o ON o.id = t.org_id
        ORDER BY t.created_at DESC
        LIMIT ${Math.max(1, limit)}
      `),
      prisma.$queryRaw<SupportTicketUpdateRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          ticket_id::text AS ticket_id,
          org_id::text AS org_id,
          update_title,
          update_body,
          status_after,
          is_public,
          created_at,
          updated_by_user_id::text AS updated_by_user_id
        FROM public.support_ticket_updates
        ORDER BY created_at DESC
        LIMIT ${Math.max(1, limit * 2)}
      `),
    ])

    return {
      tickets: ticketRows.map(normalizeOperatorSupportTicket),
      updates: updateRows.map(normalizeOperatorSupportTicketUpdate),
    }
  } catch (error) {
    console.error('[ticketing] Failed to fetch operator snapshot:', error)
    return { tickets: [], updates: [] }
  }
}

export async function createSupportTicket(formData: FormData): Promise<TicketMutationResult> {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { error: 'Organisasi aktif tidak ditemukan.' }

  const actor = await getCurrentAuthenticatedUser()
  if ('error' in actor) return { error: actor.error }

  const title = normalizeText(formData.get('title'))
  const description = normalizeText(formData.get('description'))
  const foundInMenu = normalizeText(formData.get('found_in_menu'))
  const foundDuring = normalizeText(formData.get('found_during'))
  const foundAtRaw = normalizeText(formData.get('found_at'))
  const foundAtIso = parseFoundAtIso(foundAtRaw)
  const severityRaw = normalizeText(formData.get('severity')).toUpperCase()
  const severity = normalizeTicketSeverity(severityRaw)

  if (!title) return { error: 'Judul bug wajib diisi.' }
  if (!description) return { error: 'Deskripsi bug wajib diisi.' }
  if (!foundInMenu) return { error: 'Menu/lokasi bug ditemukan wajib diisi.' }

  let screenshotUrl: string | null = null
  const screenshot = formData.get('screenshot')
  if (screenshot instanceof File && screenshot.size > 0) {
    const uploadResult = await uploadSupportTicketScreenshot(actor.userId, orgData.org.id, screenshot)
    if (!uploadResult.url) {
      return { error: `Gagal upload screenshot: ${uploadResult.error}` }
    }

    screenshotUrl = uploadResult.url
  }

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.support_tickets (
        org_id,
        reporter_user_id,
        title,
        description,
        severity,
        status,
        found_in_menu,
        found_during,
        found_at,
        screenshot_url
      ) VALUES (
        ${orgData.org.id}::uuid,
        ${actor.userId}::uuid,
        ${title},
        ${description},
        ${severity},
        ${'OPEN'},
        ${foundInMenu},
        ${foundDuring || null},
        ${foundAtIso ? new Date(foundAtIso) : null},
        ${screenshotUrl}
      )
    `)
  } catch (error) {
    return { error: `Gagal menyimpan tiket: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }

  revalidatePath('/settings/ticketing')
  revalidatePath('/settings/ticketing/doc-update')
  revalidatePath('/saas/ticketing')
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

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SupportTicketRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          org_id::text AS org_id,
          status
        FROM public.support_tickets
        WHERE id = ${ticketId}::uuid
        LIMIT 1
      `)

      const ticketRow = rows[0]
      if (!ticketRow) {
        throw new Error('Tiket tidak ditemukan.')
      }

      const orgId = String(ticketRow.org_id || '')
      if (!orgId) {
        throw new Error('Org tiket tidak valid.')
      }

      const normalizedCurrentStatus = normalizeTicketStatus(ticketRow.status)

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.support_tickets
        SET status = ${statusAfter}
        WHERE id = ${ticketId}::uuid
      `)

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.support_ticket_updates (
          ticket_id,
          org_id,
          updated_by_user_id,
          update_title,
          update_body,
          status_before,
          status_after,
          is_public
        ) VALUES (
          ${ticketId}::uuid,
          ${orgId}::uuid,
          ${actor.userId}::uuid,
          ${updateTitle},
          ${updateBody || null},
          ${normalizedCurrentStatus},
          ${statusAfter},
          ${isPublic}
        )
      `)
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal simpan progress.' }
  }

  revalidatePath('/saas/ticketing')
  revalidatePath('/settings/ticketing')
  revalidatePath('/settings/ticketing/doc-update')
  return { success: true }
}
