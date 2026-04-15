import { scryptSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryPostgres: vi.fn(),
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}))

import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'
import { signInWithInternalAuth, verifyInternalAuthNikForOrg } from '@/lib/auth/internal-auth.server'

function createPasswordHash(password: string) {
  const salt = Buffer.from('nizam-internal-auth-test-salt')
  const derivedKey = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`
}

function createCookieStore() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }
}

describe('internal auth server', () => {
  const internalUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const legacyUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const preferredOrgId = '11111111-1111-4111-8111-111111111111'
  const storedActiveOrgId = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INTERNAL_AUTH_SUPABASE_PASSWORD_FALLBACK = 'false'
    process.env.INTERNAL_AUTH_SESSION_SECRET = 'test-session-secret'
    mocks.cookies.mockResolvedValue(createCookieStore())
    mocks.headers.mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === 'user-agent') return 'Vitest'
        if (name === 'x-forwarded-for') return '127.0.0.1'
        return null
      }),
    })
  })

  it('restores stored active org when user belongs to multiple organizations', async () => {
    const cookieStore = createCookieStore()
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: internalUserId,
          legacy_user_id: legacyUserId,
          preferred_org_match: false,
          active_org_ids: [preferredOrgId, storedActiveOrgId],
          stored_active_org_id: storedActiveOrgId,
          login_email: 'owner@example.com',
          login_nik: null,
          password_hash: createPasswordHash('secret123'),
          display_name: 'Owner Example',
          user_type: 'owner',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1' }],
      })
      .mockResolvedValueOnce({
        rows: [],
      })

    const result = await signInWithInternalAuth({
      email: 'owner@example.com',
      password: 'secret123',
    })

    expect(result).toMatchObject({
      success: true,
      userId: internalUserId,
      email: 'owner@example.com',
      resolvedOrgId: storedActiveOrgId,
    })
    expect(cookieStore.set).toHaveBeenCalledWith(
      INTERNAL_AUTH_SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: INTERNAL_AUTH_SESSION_MAX_AGE,
      })
    )
  })

  it('keeps preferred org when the login request explicitly matches that membership', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: internalUserId,
          legacy_user_id: legacyUserId,
          preferred_org_match: true,
          active_org_ids: [preferredOrgId, storedActiveOrgId],
          stored_active_org_id: storedActiveOrgId,
          login_email: 'owner@example.com',
          login_nik: null,
          password_hash: createPasswordHash('secret123'),
          display_name: 'Owner Example',
          user_type: 'owner',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'session-2' }],
      })
      .mockResolvedValueOnce({
        rows: [],
      })

    const result = await signInWithInternalAuth({
      email: 'owner@example.com',
      password: 'secret123',
      preferredOrgId,
    })

    expect(result).toMatchObject({
      success: true,
      resolvedOrgId: preferredOrgId,
    })
  })

  it('verifies cashier nik within the requested organization without creating a session', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [{
        id: internalUserId,
        legacy_user_id: legacyUserId,
        login_email: 'kasir@example.com',
        login_nik: null,
        password_hash: createPasswordHash('kasir123'),
        display_name: 'Kasir Pagi',
        is_active: true,
        employee_nik: 'K-0001',
        employee_first_name: 'Kasir',
        employee_last_name: 'Depan',
      }],
    })

    const result = await verifyInternalAuthNikForOrg({
      orgId: preferredOrgId,
      nik: 'K-0001',
      password: 'kasir123',
    })

    expect(result).toMatchObject({
      success: true,
      internalUserId,
      sessionUserId: legacyUserId,
      nik: 'K-0001',
      displayName: 'Kasir Depan',
      email: 'kasir@example.com',
    })
  })
})
