'use server'

/**
 * modules/organization/actions/api-key.actions.ts
 *
 * Server actions untuk manajemen Open API:
 * - Generate / revoke / list API key
 * - Baca & simpan konfigurasi cash-in / cash-out / webhook
 */

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { INVENTORY_WEBHOOK_DIRECTIONS, VALID_WEBHOOK_EVENTS } from '@/lib/api/webhook-events'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { generateRawApiKey, hashApiKeySecret, VALID_SCOPES, type ApiScope } from '@/lib/api/validate-key'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ApiKeyRecord = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  branch_id: string | null
  is_active: boolean
  rate_limit_rpm: number
  request_count: number
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export type ApiConfigurationRecord = {
  id: string | null
  org_id: string
  branch_id: string | null
  cash_in_account_id: string | null
  cash_out_account_id: string | null
  cash_in_params: Record<string, unknown>
  cash_out_params: Record<string, unknown>
  webhook_url: string | null
  webhook_secret: string | null
  webhook_events: string[]
  webhook_is_active: boolean
  webhook_inventory_directions: string[]
  webhook_inventory_reference_types: string[]
}

export type GenerateApiKeyInput = {
  name: string
  branchId?: string | null
  scopes: ApiScope[]
  rateLimitRpm?: number
  expiresAt?: string | null
}

export type SaveApiConfigurationInput = {
  branchId?: string | null
  cashInAccountId?: string | null
  cashOutAccountId?: string | null
  cashInParams?: Record<string, unknown>
  cashOutParams?: Record<string, unknown>
  webhookUrl?: string | null
  webhookSecret?: string | null
  webhookEvents?: string[]
  webhookIsActive?: boolean
  webhookInventoryDirections?: string[]
  webhookInventoryReferenceTypes?: string[]
}

type QueryError = { message?: string | null } | null
type MaybeSingleResult<T> = Promise<{ data: T | null; error: QueryError }>
type MutationResult = Promise<{ error: QueryError }>

type SupabaseQueryBuilder<T> = PromiseLike<{ data: T[] | null; error: QueryError }> & {
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>
  is(column: string, value: null): SupabaseQueryBuilder<T>
  order(column: string, options: { ascending: boolean }): SupabaseQueryBuilder<T>
  limit(value: number): SupabaseQueryBuilder<T>
  maybeSingle<S = T>(): MaybeSingleResult<S>
}

type SupabaseInsertBuilder<T> = {
  select(columns: string): {
    maybeSingle<S = T>(): MaybeSingleResult<S>
  }
}

type SupabaseTableBuilder<T> = {
  select(columns: string): SupabaseQueryBuilder<T>
  insert(values: Record<string, unknown>): SupabaseInsertBuilder<T>
  update(values: Record<string, unknown>): SupabaseQueryBuilder<T>
  upsert(values: Record<string, unknown>, options?: { onConflict: string }): MutationResult
}

type SupabaseActionClient = {
  from(table: 'api_keys'): SupabaseTableBuilder<ApiKeyRecord>
  from(table: 'api_configurations'): SupabaseTableBuilder<ApiConfigurationRecord>
  from(table: 'api_call_logs'): SupabaseTableBuilder<ApiCallLogRecord>
  from(table: 'api_webhook_deliveries'): SupabaseTableBuilder<{
    id: string
    event_type: string
    status: string
    http_status: number | null
    target_url: string
    attempt_count: number
    delivered_at: string | null
    created_at: string
  }>
}

function normalizeWebhookArray(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    )
  )
}

function normalizeWebhookReferenceTypes(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean)
    )
  )
}

// ─────────────────────────────────────────────────────────────
// Helper: get authenticated admin + verify org owner/admin role
// ─────────────────────────────────────────────────────────────

async function getAdminOrgContext(orgId: string, requireOwner = false) {
  const orgData = await getActiveOrg()
  if (!orgData) return { error: 'Tidak terautentikasi.' }
  if (orgData.org.id !== orgId) return { error: 'Organisasi tidak cocok dengan sesi aktif.' }

  const role = String(orgData.role || '').toLowerCase()
  if (requireOwner && role !== 'owner') {
    return { error: 'Hanya owner yang dapat melakukan aksi ini.' }
  }
  if (!requireOwner && role !== 'owner' && role !== 'admin') {
    return { error: 'Hanya owner/admin yang dapat mengelola API key.' }
  }

  let admin: SupabaseActionClient
  try {
    admin = await createAdminClient() as unknown as SupabaseActionClient
  } catch {
    const db = await createClient()
    admin = db as unknown as SupabaseActionClient
  }

  return { admin, orgData }
}

// ─────────────────────────────────────────────────────────────
// Action: listApiKeys
// ─────────────────────────────────────────────────────────────

export async function listApiKeys(orgId: string): Promise<ApiKeyRecord[]> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return []

  const { data, error } = await ctx.admin
    .from('api_keys')
    .select('id, name, key_prefix, scopes, branch_id, is_active, rate_limit_rpm, request_count, last_used_at, expires_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error || !Array.isArray(data)) return []
  return data as ApiKeyRecord[]
}

// ─────────────────────────────────────────────────────────────
// Action: generateApiKey
// Returns the full key string ONCE — never stored in plaintext.
// ─────────────────────────────────────────────────────────────

export async function generateApiKey(
  orgId: string,
  input: GenerateApiKeyInput
): Promise<{ success: true; fullKey: string; keyId: string } | { error: string }> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return { error: String(ctx.error ?? 'Tidak terautentikasi.') }

  if (!input.name?.trim()) return { error: 'Nama API key wajib diisi.' }
  if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
    return { error: 'Minimal satu scope harus dipilih.' }
  }

  const invalidScopes = input.scopes.filter((s) => !(VALID_SCOPES as readonly string[]).includes(s))
  if (invalidScopes.length > 0) {
    return { error: `Scope tidak valid: ${invalidScopes.join(', ')}` }
  }

  const { fullKey, prefix, secret } = generateRawApiKey()
  const keyHash = await hashApiKeySecret(secret)

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    name: input.name.trim(),
    key_prefix: prefix,
    key_hash: keyHash,
    scopes: input.scopes,
    is_active: true,
    rate_limit_rpm: input.rateLimitRpm ?? 60,
    created_by: ctx.orgData.user?.id ?? null,
  }

  if (input.branchId) insertPayload.branch_id = input.branchId
  if (input.expiresAt) insertPayload.expires_at = input.expiresAt

  const { data, error } = await ctx.admin
    .from('api_keys')
    .insert(insertPayload)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { error: error?.message || 'Gagal membuat API key.' }
  }

  revalidatePath('/developers/api')
  revalidatePath('/settings/api')
  return { success: true, fullKey, keyId: data.id }
}

// ─────────────────────────────────────────────────────────────
// Action: revokeApiKey
// ─────────────────────────────────────────────────────────────

export async function revokeApiKey(
  orgId: string,
  keyId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return { error: String(ctx.error ?? 'Tidak terautentikasi.') }

  const { error } = await ctx.admin
    .from('api_keys')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('org_id', orgId)

  if (error) return { error: error.message || 'Gagal menonaktifkan API key.' }

  revalidatePath('/developers/api')
  revalidatePath('/settings/api')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Action: getApiConfiguration
// ─────────────────────────────────────────────────────────────

export async function getApiConfiguration(
  orgId: string,
  branchId?: string | null
): Promise<ApiConfigurationRecord | null> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return null

  let query = ctx.admin
    .from('api_configurations')
    .select('*')
    .eq('org_id', orgId)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  } else {
    query = query.is('branch_id', null)
  }

  const { data } = await query.maybeSingle()
  if (!data) {
    // Return empty default config
    return {
      id: null,
      org_id: orgId,
      branch_id: branchId ?? null,
      cash_in_account_id: null,
      cash_out_account_id: null,
      cash_in_params: {},
      cash_out_params: {},
      webhook_url: null,
      webhook_secret: null,
      webhook_events: [],
      webhook_is_active: false,
      webhook_inventory_directions: [],
      webhook_inventory_reference_types: [],
    }
  }

  return data as ApiConfigurationRecord
}

// ─────────────────────────────────────────────────────────────
// Action: saveApiConfiguration
// ─────────────────────────────────────────────────────────────

export async function saveApiConfiguration(
  orgId: string,
  input: SaveApiConfigurationInput
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return { error: String(ctx.error ?? 'Tidak terautentikasi.') }

  const normalizedWebhookEvents = normalizeWebhookArray(input.webhookEvents)
  const invalidWebhookEvents = normalizedWebhookEvents.filter(
    (event) => !(VALID_WEBHOOK_EVENTS as readonly string[]).includes(event)
  )
  if (invalidWebhookEvents.length > 0) {
    return { error: `Webhook event tidak valid: ${invalidWebhookEvents.join(', ')}` }
  }

  const normalizedWebhookInventoryDirections = Array.from(
    new Set(normalizeWebhookArray(input.webhookInventoryDirections).map((direction) => direction.toLowerCase()))
  )
  const invalidInventoryDirections = normalizedWebhookInventoryDirections.filter(
    (direction) => !(INVENTORY_WEBHOOK_DIRECTIONS as readonly string[]).includes(direction)
  )
  if (invalidInventoryDirections.length > 0) {
    return { error: `Arah inventory webhook tidak valid: ${invalidInventoryDirections.join(', ')}` }
  }

  const upsertPayload: Record<string, unknown> = {
    org_id: orgId,
    branch_id: input.branchId ?? null,
    cash_in_account_id: input.cashInAccountId ?? null,
    cash_out_account_id: input.cashOutAccountId ?? null,
    cash_in_params: input.cashInParams ?? {},
    cash_out_params: input.cashOutParams ?? {},
    webhook_url: input.webhookUrl ?? null,
    webhook_events: normalizedWebhookEvents,
    webhook_is_active: input.webhookIsActive ?? false,
    webhook_inventory_directions: normalizedWebhookInventoryDirections,
    webhook_inventory_reference_types: normalizeWebhookReferenceTypes(input.webhookInventoryReferenceTypes),
    updated_at: new Date().toISOString(),
  }

  // Only update secret if explicitly provided (avoid clearing existing secret)
  if (input.webhookSecret !== undefined) {
    upsertPayload.webhook_secret = input.webhookSecret || null
  }

  const { error } = await ctx.admin
    .from('api_configurations')
    .upsert(upsertPayload, { onConflict: 'org_id,branch_id' })

  if (error) return { error: error.message || 'Gagal menyimpan konfigurasi API.' }

  revalidatePath('/developers/api')
  revalidatePath('/settings/api')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Action: listApiCallLogs
// ─────────────────────────────────────────────────────────────

export type ApiCallLogRecord = {
  id: string
  api_key_id: string | null
  method: string
  endpoint: string
  status_code: number
  duration_ms: number | null
  ip_address: string | null
  user_agent: string | null
  error_message: string | null
  created_at: string
}

export async function listApiCallLogs(orgId: string, limit = 50): Promise<ApiCallLogRecord[]> {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return []

  const { data } = await ctx.admin
    .from('api_call_logs')
    .select('id, api_key_id, method, endpoint, status_code, duration_ms, ip_address, user_agent, error_message, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return Array.isArray(data) ? data : []
}

// ─────────────────────────────────────────────────────────────
// Action: listWebhookDeliveries
// ─────────────────────────────────────────────────────────────

export async function listWebhookDeliveries(orgId: string, limit = 20) {
  const ctx = await getAdminOrgContext(orgId)
  if ('error' in ctx) return []

  const { data } = await ctx.admin
    .from('api_webhook_deliveries')
    .select('id, event_type, status, http_status, target_url, attempt_count, delivered_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return Array.isArray(data) ? data : []
}
