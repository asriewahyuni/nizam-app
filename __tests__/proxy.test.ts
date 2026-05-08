import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}))

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}))

import { proxy } from '@/proxy'

describe('Next proxy', () => {
  it('returns a server-action redirect for legacy domain action requests', async () => {
    const request = new NextRequest('http://nizam.xales.id/demo', {
      method: 'POST',
      headers: {
        host: 'nizam.xales.id',
        'next-action': 'demo-action',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('x-action-redirect')).toBe('https://kliknizam.app;replace')
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('delegates normal requests to updateSession', async () => {
    mocks.updateSession.mockResolvedValue(
      new NextResponse(null, {
        status: 200,
      })
    )

    const request = new NextRequest('http://localhost:3000/demo', {
      headers: {
        host: 'localhost:3000',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.updateSession).toHaveBeenCalledTimes(1)
  })
})
