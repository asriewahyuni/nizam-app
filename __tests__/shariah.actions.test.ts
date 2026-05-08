import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { injectShariahPack, setShariahAccountsActive } from '@/modules/accounting/actions/shariah.actions'
import { SHARIAH_COA_ACTIVATION_CODES } from '@/modules/accounting/lib/shariah-coa'

describe('Shariah CoA Activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reactivates existing CoAS accounts and seeds SALAM/ISTISHNA accounts on inject', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([
              { id: 'asset-root', code: '1000' },
              { id: 'liability-root', code: '2000' },
              { id: 'equity-root', code: '3000' },
              { id: 'expense-root', code: '6000' },
            ]),
          },
          {
            result: success([]),
          },
          ...SHARIAH_COA_ACTIVATION_CODES.map((code) => ({
            singleResult: success({ id: `acc-${code}` }),
          })),
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await injectShariahPack('org-1')

    expect(result).toEqual({ success: true })

    const upsertCalls = supabase.calls.filter((call) =>
      call.operations.some((operation) => operation.method === 'upsert')
    )

    const getUpsertPayload = (code: string) => {
      const call = upsertCalls.find((entry) =>
        entry.operations.some(
          (operation) =>
            operation.method === 'upsert' &&
            (operation.args[0] as { code?: string } | undefined)?.code === code
        )
      )

      const payload = call?.operations.find((operation) => operation.method === 'upsert')?.args[0] as
        | Record<string, unknown>
        | undefined

      return payload
    }

    expect(getUpsertPayload('2603')).toMatchObject({
      code: '2603',
      parent_id: 'acc-2600',
      is_active: true,
    })
    expect(getUpsertPayload('1205')).toMatchObject({
      code: '1205',
      parent_id: 'asset-root',
      is_active: true,
    })
    expect(getUpsertPayload('1404')).toMatchObject({
      code: '1404',
      parent_id: 'asset-root',
      is_active: true,
    })
    expect(getUpsertPayload('3130')).toMatchObject({
      code: '3130',
      parent_id: 'equity-root',
      normal_balance: 'DEBIT',
      is_active: true,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings/accounts')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/zakat')
  })

  it('deactivates legacy 3100 instead of deleting referenced account rows', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([
              { id: 'asset-root', code: '1000' },
              { id: 'liability-root', code: '2000' },
              { id: 'equity-root', code: '3000' },
              { id: 'expense-root', code: '6000' },
            ]),
          },
          {
            result: success([{ id: 'legacy-3100', code: '3100' }]),
          },
          {},
          ...SHARIAH_COA_ACTIVATION_CODES.map((code) => ({
            singleResult: success({ id: `acc-${code}` }),
          })),
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await injectShariahPack('org-1')

    expect(result).toEqual({ success: true })

    const legacyCleanupCall = supabase.calls.find((call) =>
      call.operations.some(
        (operation) =>
          operation.method === 'eq' &&
          operation.args[0] === 'id' &&
          operation.args[1] === 'legacy-3100'
      )
    )

    expect(legacyCleanupCall?.operations.some((operation) => operation.method === 'delete')).toBe(false)
    expect(legacyCleanupCall?.operations.find((operation) => operation.method === 'update')?.args[0]).toEqual({
      is_active: false,
    })
  })

  it('toggles SALAM/ISTISHNA accounts together with the rest of CoAS codes', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await setShariahAccountsActive('org-1', false)

    expect(result).toEqual({ success: true })

    const inOperation = supabase.calls[0]?.operations.find((operation) => operation.method === 'in')
    expect(inOperation?.args[0]).toBe('code')
    expect(inOperation?.args[1]).toEqual(expect.arrayContaining(['1205', '2603', '3100']))
  })
})
