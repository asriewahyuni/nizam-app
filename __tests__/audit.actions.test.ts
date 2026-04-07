import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { resetOrganizationData } from '@/modules/settings/actions/audit.actions'

describe('resetOrganizationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps one default branch and rebinds accounts during full reset', async () => {
    const admin = createSupabaseMock({
      tables: {
        org_members: [{ maybeSingleResult: success({ role: 'owner' }) }],
        organizations: [{ maybeSingleResult: success({ name: 'PT Nizam Jaya' }) }],
        branches: [
          { maybeSingleResult: success({ id: 'branch-main' }) },
          {},
          {},
        ],
      },
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    })
    mocks.createAdminClient.mockResolvedValue(admin.client)

    const result = await resetOrganizationData('org-1', {
      mode: 'all_data',
      confirmationText: 'PT Nizam Jaya',
    })

    expect(result).toMatchObject({ success: true, mode: 'all_data' })

    const accountsUpdateCall = admin.calls.find((call) => (
      call.table === 'accounts' &&
      call.operations.some((operation) => operation.method === 'update')
    ))
    expect(accountsUpdateCall?.operations).toEqual(expect.arrayContaining([
      { method: 'update', args: [{ managed_branch_id: 'branch-main' }] },
      { method: 'eq', args: ['org_id', 'org-1'] },
    ]))

    const branchDeleteCall = admin.calls.find((call) => (
      call.table === 'branches' &&
      call.operations.some((operation) => operation.method === 'delete')
    ))
    expect(branchDeleteCall?.operations).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['org_id', 'org-1'] },
      { method: 'neq', args: ['id', 'branch-main'] },
    ]))

    const branchNormalizeCall = admin.calls.find((call) => (
      call.table === 'branches' &&
      call.operations.some((operation) => operation.method === 'update')
    ))
    expect(branchNormalizeCall?.operations).toEqual(expect.arrayContaining([
      {
        method: 'update',
        args: [{
          name: 'Unit Utama',
          code: 'MAIN',
          address: null,
          is_active: true,
        }],
      },
      { method: 'eq', args: ['id', 'branch-main'] },
      { method: 'eq', args: ['org_id', 'org-1'] },
    ]))
  })

  it('creates a default branch first when full reset finds no branch', async () => {
    const admin = createSupabaseMock({
      tables: {
        org_members: [{ maybeSingleResult: success({ role: 'owner' }) }],
        organizations: [{ maybeSingleResult: success({ name: 'PT Nizam Jaya' }) }],
        branches: [
          { maybeSingleResult: success(null) },
          {},
          {},
          {},
        ],
      },
    })

    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID')
    randomUuidMock.mockReturnValue('branch-reset')

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    })
    mocks.createAdminClient.mockResolvedValue(admin.client)

    const result = await resetOrganizationData('org-2', {
      mode: 'all_data',
      confirmationText: 'PT Nizam Jaya',
    })

    expect(result).toMatchObject({ success: true, mode: 'all_data' })

    const branchInsertCall = admin.calls.find((call) => (
      call.table === 'branches' &&
      call.operations.some((operation) => operation.method === 'insert')
    ))
    expect(branchInsertCall?.operations).toEqual(expect.arrayContaining([
      {
        method: 'insert',
        args: [{
          id: 'branch-reset',
          org_id: 'org-2',
          name: 'Unit Utama',
          code: 'MAIN',
          address: null,
          is_active: true,
        }],
      },
    ]))

    const accountsUpdateCall = admin.calls.find((call) => (
      call.table === 'accounts' &&
      call.operations.some((operation) => operation.method === 'update')
    ))
    expect(accountsUpdateCall?.operations).toEqual(expect.arrayContaining([
      { method: 'update', args: [{ managed_branch_id: 'branch-reset' }] },
    ]))

    randomUuidMock.mockRestore()
  })
})
