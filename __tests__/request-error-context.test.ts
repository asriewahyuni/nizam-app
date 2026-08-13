import { describe, expect, it } from 'vitest'
import {
  buildRequestErrorContext,
  buildUserErrorContext,
} from '@/lib/monitoring/request-error-context'

describe('buildRequestErrorContext', () => {
  it('uses the Next.js request path and route context instead of an unavailable url property', () => {
    const error = Object.assign(new Error('invalid input syntax for type date: ""'), {
      code: '22007',
      severity: 'ERROR',
      routine: 'DateTimeParseError',
    })

    const context = buildRequestErrorContext(
      error,
      { path: '/accounting/journal', method: 'POST', headers: {} },
      { routerKind: 'App Router', routePath: '/accounting/journal', routeType: 'action' },
    )

    expect(context.RequestPath).toBe('/accounting/journal')
    expect(context.RoutePath).toBe('/accounting/journal')
    expect(context.Method).toBe('POST')
    expect(context.RouteType).toBe('action')
    expect(context.DatabaseCode).toBe('22007')
    expect(context.ErrorCategory).toBe('Invalid date input')
    expect(context.DiagnosticHint).toContain('empty string')
  })

  it('adds selected user and organization identity without exposing session internals', () => {
    const context = buildUserErrorContext({
      user: {
        id: 'legacy-user-id',
        email: 'yogi@example.com',
        user_metadata: {
          internal_user_id: 'internal-user-id',
          full_name: 'Yogi Anggriawan',
          login_nik: 'EMP-001',
          login_type: 'staff',
          auth_provider: 'internal',
        },
      },
      organization: {
        id: 'org-id',
        name: 'Nizam Indonesia',
        role: 'admin',
      },
    })

    expect(context).toEqual({
      UserId: 'legacy-user-id',
      InternalUserId: 'internal-user-id',
      UserName: 'Yogi Anggriawan',
      UserEmail: 'yogi@example.com',
      UserNik: 'EMP-001',
      LoginType: 'staff',
      OrganizationId: 'org-id',
      OrganizationName: 'Nizam Indonesia',
      OrganizationRole: 'admin',
    })
    expect(JSON.stringify(context)).not.toContain('auth_provider')
  })

  it('returns an anonymous marker when no authenticated session is available', () => {
    expect(buildUserErrorContext(null)).toEqual({ UserId: 'Anonymous/unknown' })
  })

  it('does not include request headers or database values in the diagnostic context', () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      detail: 'Key (email)=(private@example.com) already exists.',
    })

    const context = buildRequestErrorContext(
      error,
      { path: '/register', method: 'POST', headers: { cookie: 'secret-session' } },
      { routerKind: 'App Router', routePath: '/register', routeType: 'action' },
    )

    const serialized = JSON.stringify(context)
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('secret-session')
    expect(context.DatabaseCode).toBe('23505')
  })
})
