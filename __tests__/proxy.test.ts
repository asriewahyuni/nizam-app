import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}))

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}))

import { proxy } from '@/proxy'

describe('Proxy Entry Point', () => {
  it('delegates request handling to updateSession', async () => {
    const request = { url: 'http://localhost:3000/fleet' }
    const response = { ok: true }
    mocks.updateSession.mockResolvedValue(response)

    const result = await proxy(request as never)

    expect(mocks.updateSession).toHaveBeenCalledWith(request)
    expect(result).toBe(response)
  })
})
