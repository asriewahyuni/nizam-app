import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  isInternalAuthProvider: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/auth/provider', () => ({
  isInternalAuthProvider: mocks.isInternalAuthProvider,
}))

import { deleteAccount } from '@/modules/accounting/actions/coa.actions'

describe('CoA Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isInternalAuthProvider.mockReturnValue(false)
  })

  it('rejects deleting an account used by payslip lines', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            singleResult: success({
              id: 'acc-1',
              code: '6001',
              is_system: false,
            }),
          },
          {
            result: { data: null, error: null, count: 0 } as any,
          },
        ],
        journal_lines: [
          {
            result: { data: null, error: null, count: 0 } as any,
          },
        ],
        payroll_components: [
          {
            result: { data: null, error: null, count: 0 } as any,
          },
        ],
        payslip_lines: [
          {
            result: { data: null, error: null, count: 2 } as any,
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await deleteAccount('acc-1', 'org-1')

    expect(result).toEqual({
      error: 'Akun ini sudah dipakai pada slip gaji/payroll. Nonaktifkan saja, jangan hapus.',
    })

    const deleteCall = supabase.calls.find((call) =>
      call.table === 'accounts' &&
      call.operations.some((operation) => operation.method === 'delete')
    )
    expect(deleteCall).toBeUndefined()
  })

  it('rejects deleting an account still mapped by payroll components', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            singleResult: success({
              id: 'acc-2',
              code: '2401',
              is_system: false,
            }),
          },
          {
            result: { data: null, error: null, count: 0 } as any,
          },
        ],
        journal_lines: [
          {
            result: { data: null, error: null, count: 0 } as any,
          },
        ],
        payroll_components: [
          {
            result: { data: null, error: null, count: 1 } as any,
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await deleteAccount('acc-2', 'org-1')

    expect(result).toEqual({
      error: 'Akun ini masih dipakai pada komponen payroll. Ganti mapping payroll atau nonaktifkan akun ini.',
    })

    const deleteCall = supabase.calls.find((call) =>
      call.table === 'accounts' &&
      call.operations.some((operation) => operation.method === 'delete')
    )
    expect(deleteCall).toBeUndefined()
  })
})
