import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  next: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  getToken: mocks.getToken,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    next: (...args: any[]) => mocks.next(...args),
    redirect: (...args: any[]) => mocks.redirect(...args),
  },
}))

import { proxy } from '@/proxy'

describe('Proxy Entry Point', () => {
  it('redirects protected pages to login when unauthenticated', async () => {
    mocks.getToken.mockResolvedValue(null)
    mocks.next.mockReturnValue({ type: 'next' })
    mocks.redirect.mockImplementation((url: URL) => ({ type: 'redirect', url: url.toString() }))

    const request = {
      url: 'http://localhost:3000/fleet?x=1',
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/fleet?x=1'),
    }

    const result = await proxy(request as never)

    expect(mocks.redirect).toHaveBeenCalled()
    expect((result as any).url).toBe('http://localhost:3000/login?redirectTo=%2Ffleet%3Fx%3D1')
  })
})
