import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  prisma: {
    organizations: {
      findUnique: vi.fn(),
    },
  },
  getBranchAccessScope: vi.fn(),
  exportProfitLossXLSX: vi.fn(),
  exportBalanceSheetXLSX: vi.fn(),
  exportGeneralLedgerXLSX: vi.fn(),
  exportZakatReportXLSX: vi.fn(),
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getMembership: mocks.getMembership,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
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

import { GET } from '@/app/api/export/route'

describe('Export Route Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getMembership.mockResolvedValue({
      memberId: 'member-1',
      userId: 'user-1',
      orgId: 'org-1',
      role: 'staff',
      roleId: null,
      permissions: [],
      isOwner: false,
      isAdmin: false,
      isOwnerOrAdmin: false,
    })
    mocks.prisma.organizations.findUnique.mockResolvedValue({ name: 'Org Demo' })
    mocks.getBranchAccessScope.mockResolvedValue({
      membershipId: 'member-1',
      role: 'staff',
      accessibleBranches: [],
      accessibleBranchIds: [],
      canAccessAllBranches: false,
    })
  })

  it('allows zakat export without a branch selection because it is org-scoped', async () => {
    mocks.exportZakatReportXLSX.mockResolvedValue(Buffer.from('zakat-xlsx'))

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export?type=zakat&orgId=org-1')
    )

    expect(response.status).toBe(200)
    expect(mocks.exportZakatReportXLSX).toHaveBeenCalledWith('org-1', 1300000, 15000, 'Org Demo')
  })

  it('still blocks branch-scoped exports when no branch is selected for limited staff', async () => {
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
})
