import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getActiveOrg: vi.fn(),
  revalidatePath: vi.fn(),
  generateRawApiKey: vi.fn(),
  hashApiKeySecret: vi.fn(),
  normalizeIpAllowlistEntries: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
  createClient: mocks.createClient,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveOrg: mocks.getActiveOrg,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/api/validate-key', () => ({
  VALID_SCOPES: ['cash:read', 'cash:write', 'sales:read', 'inventory:read', 'ledger:read', 'contacts:read', 'contacts:write', 'purchases:read', 'bank_transactions:read'],
  generateRawApiKey: mocks.generateRawApiKey,
  hashApiKeySecret: mocks.hashApiKeySecret,
  normalizeIpAllowlistEntries: mocks.normalizeIpAllowlistEntries,
}))

import {
  generateApiKey,
  getApiConfiguration,
  listApiCallLogs,
  listApiKeys,
  listWebhookDeliveries,
  revokeApiKey,
  saveApiConfiguration,
  updateApiKeySettings,
} from '@/modules/organization/actions/api-key.actions'

describe('Open API settings server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActiveOrg.mockResolvedValue({
      org: { id: 'org-1' },
      role: 'owner',
      user: { id: 'user-1' },
    })
    mocks.generateRawApiKey.mockReturnValue({
      fullKey: 'nzm_live_DETERMINISTICKEY123456',
      prefix: 'nzm_live_',
      secret: 'DETERMINISTICKEY123456',
    })
    mocks.hashApiKeySecret.mockResolvedValue('hashed-secret')
    mocks.normalizeIpAllowlistEntries.mockImplementation((values: string[] | undefined) => ({
      normalized: Array.from(new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))),
      invalid: [],
    }))
  })

  it('lists API keys for the active organization', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          result: success([
            {
              id: 'key-1',
              name: 'Main key',
              key_prefix: 'nzm_live_',
              scopes: ['cash:read'],
              branch_id: null,
              is_active: true,
              rate_limit_rpm: 60,
              ip_allowlist: ['203.0.113.0/24'],
              request_count: 4,
              last_used_at: null,
              expires_at: null,
              created_at: '2026-04-18T00:00:00.000Z',
            },
          ]),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const rows = await listApiKeys('org-1')

    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Main key')
  })

  it('generates and stores a scoped API key', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({ id: 'key-1' }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await generateApiKey('org-1', {
      name: 'Tokopedia',
      branchId: 'branch-1',
      scopes: ['cash:read', 'inventory:read'],
      rateLimitRpm: 120,
      expiresAt: '2026-05-01T00:00:00.000Z',
      ipAllowlist: ['203.0.113.10', '203.0.113.0/24'],
    })

    expect(result).toEqual({
      success: true,
      fullKey: 'nzm_live_DETERMINISTICKEY123456',
      keyId: 'key-1',
    })
    const insertCall = supabase.calls.find((call) => call.table === 'api_keys')
    expect(insertCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'insert',
          args: [
            expect.objectContaining({
              org_id: 'org-1',
              name: 'Tokopedia',
              key_prefix: 'nzm_live_',
              key_hash: 'hashed-secret',
              scopes: ['cash:read', 'inventory:read'],
              branch_id: 'branch-1',
              rate_limit_rpm: 120,
              ip_allowlist: ['203.0.113.10', '203.0.113.0/24'],
              expires_at: '2026-05-01T00:00:00.000Z',
              created_by: 'user-1',
            }),
          ],
        }),
      ])
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/developers/api')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/api')
  })

  it('rejects invalid IP allowlist entries before inserting a key', async () => {
    mocks.createAdminClient.mockResolvedValue(createSupabaseMock().client)
    mocks.normalizeIpAllowlistEntries.mockReturnValueOnce({
      normalized: ['203.0.113.0/24'],
      invalid: ['invalid-ip'],
    })

    const result = await generateApiKey('org-1', {
      name: 'Restricted',
      scopes: ['cash:read'],
      ipAllowlist: ['203.0.113.0/24', 'invalid-ip'],
    })

    expect(result).toEqual({
      error: 'Whitelist IP tidak valid: invalid-ip',
    })
  })

  it('rejects invalid scopes before inserting a key', async () => {
    mocks.createAdminClient.mockResolvedValue(createSupabaseMock().client)

    const result = await generateApiKey('org-1', {
      name: 'Invalid',
      scopes: ['unsupported:scope'] as unknown as Parameters<typeof generateApiKey>[1]['scopes'],
    })

    expect(result).toEqual({
      error: 'Scope tidak valid: unsupported:scope',
    })
  })

  it('revokes API keys by marking them inactive', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{ result: success([]) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await revokeApiKey('org-1', 'key-1')

    expect(result).toEqual({ success: true })
    const updateCall = supabase.calls.find((call) => call.table === 'api_keys')
    expect(updateCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [expect.objectContaining({ is_active: false })],
        }),
        expect.objectContaining({ method: 'eq', args: ['id', 'key-1'] }),
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
      ])
    )
  })

  it('updates API key settings including whitelist IP', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({
            id: 'key-1',
            name: 'Partner',
            key_prefix: 'nzm_live_',
            scopes: ['cash:read'],
            branch_id: 'branch-1',
            is_active: true,
            rate_limit_rpm: 90,
            ip_allowlist: ['203.0.113.0/24'],
            request_count: 3,
            last_used_at: '2026-04-18T01:00:00.000Z',
            expires_at: '2026-05-02T00:00:00.000Z',
            created_at: '2026-04-18T00:00:00.000Z',
          }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await updateApiKeySettings('org-1', 'key-1', {
      name: 'Partner Updated',
      branchId: 'branch-1',
      scopes: ['cash:read', 'inventory:read'],
      rateLimitRpm: 90,
      expiresAt: '2026-05-02T00:00:00.000Z',
      ipAllowlist: ['203.0.113.0/24'],
    })

    expect(result).toEqual({
      success: true,
      key: expect.objectContaining({
        id: 'key-1',
        name: 'Partner',
      }),
    })

    const updateCall = supabase.calls.find((call) => call.table === 'api_keys')
    expect(updateCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [
            expect.objectContaining({
              name: 'Partner Updated',
              branch_id: 'branch-1',
              scopes: ['cash:read', 'inventory:read'],
              rate_limit_rpm: 90,
              ip_allowlist: ['203.0.113.0/24'],
              expires_at: '2026-05-02T00:00:00.000Z',
            }),
          ],
        }),
      ])
    )
  })

  it('returns default empty configuration when nothing is stored yet', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{ maybeSingleResult: success(null) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await getApiConfiguration('org-1', 'branch-1')

    expect(result).toEqual({
      id: null,
      org_id: 'org-1',
      branch_id: 'branch-1',
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
    })
  })

  it('upserts API configuration without clearing webhook secret when omitted', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{ result: success([]) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await saveApiConfiguration('org-1', {
      branchId: 'branch-1',
      cashInAccountId: 'cash-in-1',
      cashOutAccountId: 'cash-out-1',
      cashInParams: { counter_account_id: 'counter-1' },
      cashOutParams: { expense_account_id: 'expense-1' },
      webhookUrl: 'https://example.com/webhook',
      webhookEvents: ['cash_in'],
      webhookIsActive: true,
      webhookInventoryDirections: ['in'],
      webhookInventoryReferenceTypes: ['purchase', 'sale_void'],
    })

    expect(result).toEqual({ success: true })
    const upsertCall = supabase.calls.find((call) => call.table === 'api_configurations')
    const payload = upsertCall?.operations.find((op) => op.method === 'upsert')?.args[0] as Record<string, unknown>
    expect(payload).toEqual(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        cash_in_account_id: 'cash-in-1',
        cash_out_account_id: 'cash-out-1',
        webhook_url: 'https://example.com/webhook',
        webhook_events: ['cash_in'],
        webhook_is_active: true,
        webhook_inventory_directions: ['in'],
        webhook_inventory_reference_types: ['PURCHASE', 'SALE_VOID'],
      })
    )
    expect(payload).not.toHaveProperty('webhook_secret')
  })

  it('rejects invalid webhook events before saving configuration', async () => {
    mocks.createAdminClient.mockResolvedValue(createSupabaseMock().client)

    const result = await saveApiConfiguration('org-1', {
      branchId: 'branch-1',
      webhookEvents: ['unsupported_event'],
      webhookIsActive: true,
    })

    expect(result).toEqual({
      error: 'Webhook event tidak valid: unsupported_event',
    })
  })

  it('rejects invalid inventory webhook directions before saving configuration', async () => {
    mocks.createAdminClient.mockResolvedValue(createSupabaseMock().client)

    const result = await saveApiConfiguration('org-1', {
      branchId: 'branch-1',
      webhookEvents: ['inventory_movement'],
      webhookInventoryDirections: ['sideways'],
      webhookIsActive: true,
    })

    expect(result).toEqual({
      error: 'Arah inventory webhook tidak valid: sideways',
    })
  })

  it('lists call logs and webhook deliveries for the organization', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_call_logs: [{
          result: success([
            {
              id: 'log-1',
              api_key_id: 'key-1',
              method: 'GET',
              endpoint: '/api/v1/cash',
              status_code: 200,
              duration_ms: 12,
              ip_address: '198.51.100.5',
              user_agent: 'Vitest',
              error_message: null,
              created_at: '2026-04-18T00:00:00.000Z',
            },
          ]),
        }],
        api_webhook_deliveries: [{
          result: success([
            {
              id: 'wh-1',
              event_type: 'cash_in',
              status: 'delivered',
              http_status: 200,
              target_url: 'https://example.com/webhook',
              attempt_count: 1,
              delivered_at: '2026-04-18T00:00:01.000Z',
              created_at: '2026-04-18T00:00:00.000Z',
            },
          ]),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const [logs, deliveries] = await Promise.all([
      listApiCallLogs('org-1', 10),
      listWebhookDeliveries('org-1', 5),
    ])

    expect(logs[0]?.endpoint).toBe('/api/v1/cash')
    expect(deliveries[0]?.event_type).toBe('cash_in')
  })
})
