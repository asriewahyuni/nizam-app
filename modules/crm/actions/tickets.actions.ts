'use server'

/**
 * tickets.actions.ts
 * Server actions untuk CRM Tiket Layanan (Keluhan & Permintaan Pelanggan/Vendor)
 * Hanya export async functions — konstanta & tipe ada di ../lib/ticket-constants.ts
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import type {
  CrmTicket,
  CrmTicketNote,
  CrmTicketFilters,
  CreateCrmTicketInput,
  UpdateCrmTicketInput,
} from '@/modules/crm/lib/ticket-constants'

// Re-export types so consumers can import from one place
export type {
  CrmTicket,
  CrmTicketNote,
  CrmTicketFilters,
  CreateCrmTicketInput,
  UpdateCrmTicketInput,
  CrmTicketType,
  CrmTicketPriority,
  CrmTicketStatus,
  CrmTicketSource,
} from '@/modules/crm/lib/ticket-constants'

// ─── Helper: Generate Ticket Number ──────────────────────────────────────────

async function generateTicketNumber(db: any, orgId: string): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const startOfMonth = `${year}-${month}-01`
  const startOfNextMonth = month === '12'
    ? `${year + 1}-01-01`
    : `${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

  const { count } = await db
    .from('crm_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startOfMonth)
    .lt('created_at', startOfNextMonth)

  const seq = String((count || 0) + 1).padStart(3, '0')
  return `TKT-${year}-${month}-${seq}`
}

// ─── Lookup org by slug (untuk public form) ───────────────────────────────────

export async function getOrgBySlug(
  slug: string
): Promise<{ id: string; name: string; logo_url: string | null } | null> {
  const supabase = await createClient()
  const db = supabase as any
  const { data } = await db
    .from('organizations')
    .select('id, name, logo_url')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle()
  return data || null
}

// ─── Public: Buat tiket dari form publik (tanpa auth) ────────────────────────

export async function createCrmTicketPublic(
  input: CreateCrmTicketInput
): Promise<{ ticketNumber: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const db = supabase as any

    const { data: orgRow } = await db
      .from('organizations')
      .select('id')
      .eq('id', input.org_id)
      .maybeSingle()

    if (!orgRow) return { error: 'Organisasi tidak ditemukan.' }

    const ticketNumber = await generateTicketNumber(db, input.org_id)

    const { error: insertError } = await db.from('crm_tickets').insert({
      org_id:             input.org_id,
      branch_id:          input.branch_id || null,
      ticket_number:      ticketNumber,
      source:             input.source || 'CUSTOMER_FORM',
      type:               input.type,
      priority:           input.priority || 'MEDIUM',
      status:             'NEW',
      subject:            input.subject.trim(),
      description:        input.description?.trim() || null,
      submitter_name:     input.submitter_name.trim(),
      submitter_email:    input.submitter_email?.trim() || null,
      submitter_phone:    input.submitter_phone?.trim() || null,
      notification_email: input.notification_email?.trim() || input.submitter_email?.trim() || null,
      notification_phone: input.notification_phone?.trim() || input.submitter_phone?.trim() || null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })

    if (insertError) {
      console.error('[CRM] createCrmTicketPublic error:', insertError)
      return { error: 'Gagal menyimpan tiket. Coba lagi.' }
    }

    // System note otomatis
    const { data: ticket } = await db
      .from('crm_tickets')
      .select('id')
      .eq('org_id', input.org_id)
      .eq('ticket_number', ticketNumber)
      .maybeSingle()

    if (ticket?.id) {
      await db.from('crm_ticket_notes').insert({
        ticket_id:   ticket.id,
        org_id:      input.org_id,
        author_name: 'System',
        author_type: 'SYSTEM',
        content:     `Tiket ${ticketNumber} dibuat oleh ${input.submitter_name} via form publik.`,
        is_internal: true,
      })
    }

    revalidatePath('/crm/tickets')
    return { ticketNumber }
  } catch (err) {
    console.error('[CRM] createCrmTicketPublic exception:', err)
    return { error: 'Terjadi kesalahan. Coba lagi.' }
  }
}

// ─── Dashboard: Daftar tiket ──────────────────────────────────────────────────

export async function getCrmTickets(
  orgId: string,
  branchId?: string | null,
  filters: CrmTicketFilters = {}
): Promise<CrmTicket[]> {
  const supabase = await createClient()
  const db = supabase as any

  let query = db
    .from('crm_tickets')
    .select(`
      id, org_id, branch_id, ticket_number, source, type, priority, status,
      subject, description, resolution,
      submitter_name, submitter_email, submitter_phone,
      contact_id, reference_type, reference_id,
      assigned_to_user_id, due_date,
      notification_email, notification_phone,
      resolved_at, closed_at, created_at, updated_at
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)
  if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status)
  if (filters.type && filters.type !== 'ALL') query = query.eq('type', filters.type)
  if (filters.priority && filters.priority !== 'ALL') query = query.eq('priority', filters.priority)
  if (filters.search) {
    const q = `%${filters.search.trim()}%`
    query = query.or(`subject.ilike.${q},submitter_name.ilike.${q},ticket_number.ilike.${q}`)
  }

  const { data, error } = await query.limit(200)
  if (error || !Array.isArray(data)) return []

  const contactIds  = [...new Set(data.filter((r: any) => r.contact_id).map((r: any) => r.contact_id))]
  const saleIds     = [...new Set(data.filter((r: any) => r.reference_type === 'SALE' && r.reference_id).map((r: any) => r.reference_id))]
  const purchaseIds = [...new Set(data.filter((r: any) => r.reference_type === 'PURCHASE' && r.reference_id).map((r: any) => r.reference_id))]
  const assigneeIds = [...new Set(data.filter((r: any) => r.assigned_to_user_id).map((r: any) => r.assigned_to_user_id))]

  const [contacts, sales, purchases, assignees] = await Promise.all([
    contactIds.length  > 0 ? db.from('contacts').select('id, name').in('id', contactIds).then((r: any) => r.data || []) : [],
    saleIds.length     > 0 ? db.from('sales').select('id, invoice_number').in('id', saleIds).then((r: any) => r.data || []) : [],
    purchaseIds.length > 0 ? db.from('purchases').select('id, purchase_number').in('id', purchaseIds).then((r: any) => r.data || []) : [],
    assigneeIds.length > 0 ? db.from('internal_auth_users').select('id, full_name, email').in('id', assigneeIds).then((r: any) => r.data || []) : [],
  ])

  const contactMap  = new Map(contacts.map((c: any) => [c.id, c.name]))
  const saleMap     = new Map(sales.map((s: any) => [s.id, s.invoice_number]))
  const purchaseMap = new Map(purchases.map((p: any) => [p.id, p.purchase_number]))
  const assigneeMap = new Map(assignees.map((u: any) => [u.id, u.full_name || u.email]))

  return data.map((row: any) => ({
    ...row,
    contact_name:     row.contact_id ? (contactMap.get(row.contact_id) ?? null) : null,
    reference_number: row.reference_id
      ? (row.reference_type === 'SALE' ? saleMap.get(row.reference_id) ?? null : purchaseMap.get(row.reference_id) ?? null)
      : null,
    assigned_to_name: row.assigned_to_user_id ? (assigneeMap.get(row.assigned_to_user_id) ?? null) : null,
  })) as CrmTicket[]
}

// ─── Dashboard: Detail tiket + notes ─────────────────────────────────────────

export async function getCrmTicket(
  ticketId: string,
  orgId: string
): Promise<{ ticket: CrmTicket; notes: CrmTicketNote[] } | null> {
  const supabase = await createClient()
  const db = supabase as any

  const [{ data: ticketRow }, { data: notesRows }] = await Promise.all([
    db.from('crm_tickets').select('*').eq('id', ticketId).eq('org_id', orgId).maybeSingle(),
    db.from('crm_ticket_notes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
  ])

  if (!ticketRow) return null

  const [contactRow, assigneeRow, referenceRow] = await Promise.all([
    ticketRow.contact_id
      ? db.from('contacts').select('name').eq('id', ticketRow.contact_id).maybeSingle().then((r: any) => r.data)
      : null,
    ticketRow.assigned_to_user_id
      ? db.from('internal_auth_users').select('full_name, email').eq('id', ticketRow.assigned_to_user_id).maybeSingle().then((r: any) => r.data)
      : null,
    ticketRow.reference_id && ticketRow.reference_type
      ? (ticketRow.reference_type === 'SALE'
          ? db.from('sales').select('invoice_number').eq('id', ticketRow.reference_id).maybeSingle().then((r: any) => r.data)
          : db.from('purchases').select('purchase_number').eq('id', ticketRow.reference_id).maybeSingle().then((r: any) => r.data))
      : null,
  ])

  const ticket: CrmTicket = {
    ...ticketRow,
    contact_name:     contactRow?.name ?? null,
    assigned_to_name: assigneeRow ? (assigneeRow.full_name || assigneeRow.email) : null,
    reference_number: referenceRow
      ? (ticketRow.reference_type === 'SALE' ? referenceRow.invoice_number : referenceRow.purchase_number)
      : null,
  }

  return { ticket, notes: notesRows || [] }
}

// ─── Dashboard: Update status/detail tiket ───────────────────────────────────

export async function updateCrmTicket(
  ticketId: string,
  input: UpdateCrmTicketInput
): Promise<{ success: true } | { error: string }> {
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Tidak terautentikasi.' }

  const supabase = await createClient()
  const db = supabase as any

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }

  if (input.status !== undefined) {
    patch.status = input.status
    if (input.status === 'RESOLVED') patch.resolved_at = new Date().toISOString()
    if (input.status === 'CLOSED')   patch.closed_at   = new Date().toISOString()
  }
  if (input.priority             !== undefined) patch.priority             = input.priority
  if (input.resolution           !== undefined) patch.resolution           = input.resolution
  if (input.assigned_to_user_id  !== undefined) patch.assigned_to_user_id  = input.assigned_to_user_id
  if (input.due_date             !== undefined) patch.due_date             = input.due_date
  if (input.contact_id           !== undefined) patch.contact_id           = input.contact_id
  if (input.reference_type       !== undefined) patch.reference_type       = input.reference_type
  if (input.reference_id         !== undefined) patch.reference_id         = input.reference_id

  const { error } = await db
    .from('crm_tickets')
    .update(patch)
    .eq('id', ticketId)
    .eq('org_id', orgData.org.id)

  if (error) return { error: error.message || 'Gagal memperbarui tiket.' }

  revalidatePath('/crm/tickets')
  revalidatePath(`/crm/tickets/${ticketId}`)
  return { success: true }
}

// ─── Dashboard: Tambah catatan ────────────────────────────────────────────────

export async function addCrmTicketNote(
  ticketId: string,
  content: string,
  isInternal: boolean = true
): Promise<{ success: true } | { error: string }> {
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Tidak terautentikasi.' }

  const supabase = await createClient()
  const db = supabase as any

  const authorName = (orgData.user?.user_metadata?.full_name as string | undefined)
    || orgData.user?.email?.split('@')[0]
    || 'Staff'

  const { error } = await db.from('crm_ticket_notes').insert({
    ticket_id:   ticketId,
    org_id:      orgData.org.id,
    author_name: authorName,
    author_type: 'STAFF',
    content:     content.trim(),
    is_internal: isInternal,
    created_at:  new Date().toISOString(),
  })

  if (error) return { error: error.message || 'Gagal menyimpan catatan.' }

  await db.from('crm_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

  revalidatePath(`/crm/tickets/${ticketId}`)
  return { success: true }
}

// ─── Badge: Hitung tiket status NEW ──────────────────────────────────────────

export async function getNewCrmTicketsCount(
  orgId: string,
  branchId?: string | null
): Promise<number> {
  const supabase = await createClient()
  const db = supabase as any

  let query = db
    .from('crm_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'NEW')

  if (branchId) query = query.eq('branch_id', branchId)

  const { count } = await query
  return count || 0
}

// ─── Staff: Buat tiket manual dari dalam dashboard ────────────────────────────

export async function createCrmTicketInternal(
  input: Omit<CreateCrmTicketInput, 'org_id'>
): Promise<{ ticketNumber: string } | { error: string }> {
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Tidak terautentikasi.' }

  return createCrmTicketPublic({
    ...input,
    org_id: orgData.org.id,
    source: 'STAFF',
  })
}
