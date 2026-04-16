import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  getActiveOrg: vi.fn(),
  isInternalAuthProvider: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/actions/org.actions', () => ({
  getActiveOrg: mocks.getActiveOrg,
}))

vi.mock('@/lib/auth/provider', () => ({
  isInternalAuthProvider: mocks.isInternalAuthProvider,
}))

import { getRolesForOrganization, saveOrganizationRole } from '@/modules/organization/actions/roles.actions'

describe('Role Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isInternalAuthProvider.mockReturnValue(false)
    mocks.getActiveOrg.mockResolvedValue({
      org: { id: 'org-1' },
      role: 'admin',
      permissions: [],
    })
  })

  it('normalizes Postgres array literals when loading roles', async () => {
    const supabase = createSupabaseMock({
      tables: {
        roles: [
          {
            result: success([
              {
                id: 'role-1',
                org_id: 'org-1',
                name: 'Sales Lead',
                department_ids: '{MARKETING_SALES}',
                permissions: '{"crm:read","sales:write"}',
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getRolesForOrganization('org-1')

    expect(result.data[0]).toMatchObject({
      department_ids: ['MARKETING_SALES'],
      department_id: 'MARKETING_SALES',
      permissions: ['crm:read', 'sales:write'],
    })
  })

  it('hydrates department_ids from legacy department_id when loading roles', async () => {
    const supabase = createSupabaseMock({
      tables: {
        roles: [
          {
            result: success([
              {
                id: 'role-legacy',
                org_id: 'org-1',
                name: 'Finance Lead',
                department_id: 'FINANCE',
                department_ids: null,
                permissions: [],
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getRolesForOrganization('org-1')

    expect(result.data[0]).toMatchObject({
      department_ids: ['FINANCE'],
      department_id: 'FINANCE',
    })
  })

  it('cleans Postgres-style department input before inserting a role', async () => {
    const supabase = createSupabaseMock({
      tables: {
        roles: [
          { result: success([]) },
          { result: success([]) },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await saveOrganizationRole('org-1', {
      name: 'Sales Lead',
      departmentIds: ['{MARKETING_SALES}'],
      parentId: null,
    })

    const insertCall = supabase.calls.find((call) =>
      call.operations.some((operation) => operation.method === 'insert')
    )
    const insertPayload = insertCall?.operations.find((operation) => operation.method === 'insert')?.args[0] as {
      department_ids: string[]
    }

    expect(result).toEqual({ success: true })
    expect(insertPayload.department_ids).toEqual(['MARKETING_SALES'])
  })
})
