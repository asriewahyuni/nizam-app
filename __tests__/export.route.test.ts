import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getBranchAccessScope: vi.fn(),
  exportProfitLossXLSX: vi.fn(),
  exportBalanceSheetXLSX: vi.fn(),
  exportGeneralLedgerXLSX: vi.fn(),
  exportZakatReportXLSX: vi.fn(),
  isObjectStorageFeatureEnabled: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  getBranchAccessScope: mocks.getBranchAccessScope,
}))

vi.mock('@/modules/accounting/actions/export.actions', () => ({
  exportProfitLossXLSX: mocks.exportProfitLossXLSX,
  exportBalanceSheetXLSX: mocks.exportBalanceSheetXLSX,
  exportGeneralLedgerXLSX: mocks.exportGeneralLedgerXLSX,
  exportZakatReportXLSX: mocks.exportZakatReportXLSX,
}))

vi.mock('@/lib/storage/object-storage.server', () => ({
  buildExportStorageKey: vi.fn(),
  buildPrivateStorageObjectPath: vi.fn(),
  isObjectStorageFeatureEnabled: mocks.isObjectStorageFeatureEnabled,
  uploadObjectToStorage: vi.fn(),
}))

import { GET } from '@/app/api/export/route'

function buildSupabaseClient() {
  const supabase = createSupabaseMock({
    tables: {
      org_members: [
        {
          singleResult: success({ org_id: 'org-1' }),
        },
      ],
      organizations: [
        {
          singleResult: success({ name: 'Org Demo' }),
        },
      ],
    },
  })

  return {
    ...supabase.client,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  }
}

describe('Export Route Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isObjectStorageFeatureEnabled.mockReturnValue(false)
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'staff',
      accessibleBranches: [],
      accessibleBranchIds: [],
      canAccessAllBranches: false,
    })
  })

  it('allows zakat export without a branch selection because it is org-scoped', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient())
    mocks.exportZakatReportXLSX.mockResolvedValue(Buffer.from('zakat-xlsx'))

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export?type=zakat&orgId=org-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.exportZakatReportXLSX).toHaveBeenCalledWith('org-1', 1300000, 15000, 'Org Demo')
  })

  it('still blocks branch-scoped exports when no branch is selected for limited staff', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient())

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export?type=pl&orgId=org-1')
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: 'Pilih unit aktif terlebih dahulu untuk export laporan',
      })
    )
    expect(mocks.exportProfitLossXLSX).not.toHaveBeenCalled()
  })

  it('returns buku besar export as xlsx when general ledger is requested', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient())
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'staff',
      accessibleBranches: [{ id: 'branch-1', name: 'Cabang A' }],
      accessibleBranchIds: ['branch-1'],
      canAccessAllBranches: false,
    })
    mocks.exportGeneralLedgerXLSX.mockResolvedValue(Buffer.from('gl-xlsx'))

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export?type=gl&orgId=org-1&branchId=branch-1')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(response.headers.get('Content-Disposition')).toContain('.xlsx')
    expect(mocks.exportGeneralLedgerXLSX).toHaveBeenCalledWith('org-1', 'Org Demo', 'branch-1', false)

    const body = Buffer.from(await response.arrayBuffer())
    expect(body.equals(Buffer.from('gl-xlsx'))).toBe(true)
  })
})
