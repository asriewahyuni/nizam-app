import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mockState = vi.hoisted(() => {
  const state = {
    queryQueue: [] as Array<() => Promise<unknown>>,
    connectQueue: [] as Array<() => Promise<unknown>>,
    poolInstances: [] as any[],
  }

  class MockPool {
    query = vi.fn(async () => {
      const next = state.queryQueue.shift()
      if (!next) {
        return { rows: [] }
      }
      return await next()
    })

    connect = vi.fn(async () => {
      const next = state.connectQueue.shift()
      if (!next) {
        return { release: vi.fn() }
      }
      return next()
    })

    end = vi.fn(async () => undefined)

    constructor() {
      state.poolInstances.push(this)
    }
  }

  return { ...state, MockPool }
})

vi.mock('pg', () => ({
  Pool: mockState.MockPool,
  types: { setTypeParser: vi.fn() }
}))

import { closePostgresPool, connectPostgresClient, queryPostgres } from '@/lib/db/postgres'

describe('Postgres retry', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://postgres:secret@maglev.proxy.rlwy.net:25780/railway'
    process.env.PG_RETRY_ATTEMPTS = '2'
    process.env.PG_RETRY_DELAY_MS = '1'
    mockState.queryQueue.length = 0
    mockState.connectQueue.length = 0
    mockState.poolInstances.length = 0
  })

  afterEach(async () => {
    await closePostgresPool()
    vi.clearAllMocks()
  })

  it('retry query sekali saat DNS Railway gagal sementara', async () => {
    mockState.queryQueue.push(
      async () => {
        const error = new Error('getaddrinfo ENOTFOUND maglev.proxy.rlwy.net') as Error & { code?: string }
        error.code = 'ENOTFOUND'
        throw error
      },
      async () => ({ rows: [{ ok: 1 }] })
    )

    const result = await queryPostgres<{ ok: number }>('select 1 as ok')
    console.log('Test result in retry query:', result)

    expect(result.rows[0]?.ok).toBe(1)
    expect(mockState.poolInstances).toHaveLength(2)
    expect(mockState.poolInstances[0]?.end).toHaveBeenCalledTimes(1)
  })

  it('retry connect sekali saat resolver DNS sempat bermasalah', async () => {
    const release = vi.fn()
    mockState.connectQueue.push(
      async () => {
        const error = new Error('temporary resolver failure') as Error & { code?: string }
        error.code = 'EAI_AGAIN'
        throw error
      },
      async () => ({ release })
    )

    const client = await connectPostgresClient()
    client.release()

    expect(release).toHaveBeenCalledTimes(1)
    expect(mockState.poolInstances).toHaveLength(2)
    expect(mockState.poolInstances[0]?.end).toHaveBeenCalledTimes(1)
  })
})
