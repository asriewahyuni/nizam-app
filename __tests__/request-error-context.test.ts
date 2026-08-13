import { describe, expect, it } from 'vitest'
import { buildRequestErrorContext } from '@/lib/monitoring/request-error-context'

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
