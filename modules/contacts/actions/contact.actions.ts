'use server'

import { isInternalAuthProvider } from '@/lib/auth/provider'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { nudgeEduModeValidation } from '@/modules/edu/lib/progress-hooks.server'

export async function getOrgSalesAssignees(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { queryPostgres } = await import('@/lib/db/postgres')
  const result = await queryPostgres<any>(`
    SELECT m.user_id, u.login_email as user_email
    FROM org_members m
    JOIN internal_auth_users u ON u.id = m.user_id
    WHERE m.org_id = $1 AND m.is_active = true
    ORDER BY u.login_email ASC
  `, [orgId])
  
  return result.rows
}

type ContactType = 'CUSTOMER' | 'SUPPLIER'
type ContactMutationPayload = {
  name: string
  type: ContactType
  email: string | null
  phone: string | null
  address: string | null
  phone_wa: string | null
  instagram: string | null
}
type ContactMutationResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }
type DeleteContactResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }
type ContactDbContext =
  | { user: any; db: any; error?: undefined }
  | { error: string; user?: undefined; db?: undefined }

function normalizeOptionalField(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseContactFormData(formData: FormData): ContactMutationPayload | { error: string } {
  const name = typeof formData.get('name') === 'string' ? (formData.get('name') as string).trim() : ''
  const typeValue = typeof formData.get('type') === 'string' ? (formData.get('type') as string).trim() : ''
  const type: ContactType | null = typeValue === 'CUSTOMER' || typeValue === 'SUPPLIER' ? typeValue : null

  if (!name || !type) {
    return { error: 'Nama dan Tipe wajib diisi.' as const }
  }

  return {
    name,
    type,
    email: normalizeOptionalField(formData.get('email')),
    phone: normalizeOptionalField(formData.get('phone')),
    address: normalizeOptionalField(formData.get('address')),
    phone_wa: normalizeOptionalField(formData.get('phone_wa')),
    instagram: normalizeOptionalField(formData.get('instagram')),
  }
}

function revalidateContactPages() {
  revalidatePath('/contacts')
  revalidatePath('/sales')
  revalidatePath('/purchasing')
  revalidatePath('/dashboard')
}

async function getContactDbContext(orgId: string): Promise<ContactDbContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  if (!isInternalAuthProvider()) {
    return {
      user,
      db: supabase as any,
    }
  }

  const admin = await createAdminClient()
  const { data: membership } = await (admin as any)
    .from('org_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.id) {
    return { error: 'Unauthorized' }
  }

  return {
    user,
    db: admin as any,
  }
}

export async function getContacts(orgId: string, type?: 'CUSTOMER' | 'SUPPLIER') {
  const context = await getContactDbContext(orgId)
  if ('error' in context) return []

  let query = context.db.from('contacts' as any).select('*').eq('org_id', orgId).eq('is_active', true)
  if (type) query = query.eq('type', type)

  const { data, error } = await (query.order('name', { ascending: true }) as any)
  if (error) return []
  return data
}

export async function createContact(orgId: string, formData: FormData): Promise<ContactMutationResult> {
  const context = await getContactDbContext(orgId)
  if ('error' in context) return { error: context.error || 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  const { data, error } = await context.db.from('contacts').insert({
    org_id: orgId,
    ...payload,
    is_active: true,
    created_by: context.user.id
  }).select().single()

  if (error) return { error: 'Gagal membuat kontak: ' + error.message }

  revalidateContactPages()
  await nudgeEduModeValidation('contacts.create.contact')
  return { success: true, data }
}

export async function updateContact(orgId: string, contactId: string, formData: FormData): Promise<ContactMutationResult> {
  const context = await getContactDbContext(orgId)
  if ('error' in context) return { error: context.error || 'Unauthorized' }

  const payload = parseContactFormData(formData)
  if ('error' in payload) return payload

  const updatePayload: any = {
    ...payload,
    updated_at: new Date().toISOString(),
  }

  const newCreatedBy = formData.get('created_by')
  if (typeof newCreatedBy === 'string' && newCreatedBy.trim() !== '') {
    updatePayload.created_by = newCreatedBy.trim()
  }

  const { data, error } = await context.db
    .from('contacts')
    .update(updatePayload)
    .eq('id', contactId)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: 'Gagal memperbarui kontak: ' + error.message }

  revalidateContactPages()
  return { success: true, data }
}

export async function deleteContact(orgId: string, contactId: string): Promise<DeleteContactResult> {
  const context = await getContactDbContext(orgId)
  if ('error' in context) return { error: context.error || 'Unauthorized' }

  const { error } = await context.db
    .from('contacts')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: 'Gagal menghapus kontak: ' + error.message }

  revalidateContactPages()
  return { success: true }
}

export type ContactCrmAnalytics = {
  monthlyPurchases: { month: string; month_label: string; transaction_count: number; total: number }[]
  topProducts: { description: string; order_count: number; total_qty: number; total_amount: number }[]
  shoppingDays: { day_of_week: number; count: number }[]
  paymentChannels: { channel: string; count: number }[]
  summary: { total_orders: number; total_spent: number; avg_order: number; last_purchase: string | null }
}

export async function getContactCrmAnalytics(orgId: string, contactId: string): Promise<{ data: ContactCrmAnalytics } | { error: string }> {
  const context = await getContactDbContext(orgId)
  if ('error' in context) return { error: context.error || 'Unauthorized' }

  const { queryPostgres } = await import('@/lib/db/postgres')

  const [monthly, products, days, channels, summary] = await Promise.all([
    queryPostgres<any>(`
      SELECT
        TO_CHAR(s.sale_date, 'YYYY-MM') AS month,
        TO_CHAR(s.sale_date, 'Mon YYYY') AS month_label,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(s.grand_total), 0)::float AS total
      FROM sales s
      WHERE s.customer_id = $1
        AND s.org_id = $2
        AND s.status != 'VOIDED'
        AND s.sale_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `, [contactId, orgId]),

    queryPostgres<any>(`
      SELECT
        si.description,
        COUNT(*)::int AS order_count,
        SUM(si.quantity)::float AS total_qty,
        COALESCE(SUM(si.total_amount), 0)::float AS total_amount
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.customer_id = $1
        AND s.org_id = $2
        AND s.status != 'VOIDED'
      GROUP BY si.description
      ORDER BY order_count DESC, total_amount DESC
      LIMIT 6
    `, [contactId, orgId]),

    queryPostgres<any>(`
      SELECT
        EXTRACT(DOW FROM s.sale_date)::int AS day_of_week,
        COUNT(*)::int AS count
      FROM sales s
      WHERE s.customer_id = $1
        AND s.org_id = $2
        AND s.status != 'VOIDED'
      GROUP BY 1
      ORDER BY 2 DESC
    `, [contactId, orgId]),

    queryPostgres<any>(`
      SELECT
        ba.bank_name AS channel,
        COUNT(bt.id)::int AS count
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      JOIN journal_entries je ON bt.journal_entry_id = je.id
      WHERE je.contact_id = $1
        AND je.org_id = $2
      GROUP BY ba.bank_name
      ORDER BY count DESC
      LIMIT 5
    `, [contactId, orgId]),

    queryPostgres<any>(`
      SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(grand_total), 0)::float AS total_spent,
        COALESCE(AVG(grand_total), 0)::float AS avg_order,
        MAX(sale_date)::text AS last_purchase
      FROM sales
      WHERE customer_id = $1
        AND org_id = $2
        AND status != 'VOIDED'
    `, [contactId, orgId]),
  ])

  return {
    data: {
      monthlyPurchases: monthly.rows,
      topProducts: products.rows,
      shoppingDays: days.rows,
      paymentChannels: channels.rows,
      summary: summary.rows[0] ?? { total_orders: 0, total_spent: 0, avg_order: 0, last_purchase: null },
    },
  }
}
