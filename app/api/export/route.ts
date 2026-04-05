import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getBranchAccessScope } from '@/modules/organization/lib/branch-access.server'
import { getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import {
  exportProfitLossXLSX,
  exportBalanceSheetXLSX,
  exportGeneralLedgerXLSX,
  exportZakatReportXLSX
} from '@/modules/accounting/actions/export.actions'

export async function GET(request: NextRequest) {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // pl | bs | gl | zakat
  const orgId = searchParams.get('orgId')
  const branchId = searchParams.get('branchId')
  const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
  const asOfDate = searchParams.get('asOfDate') || endDate
  const goldPerGram = parseFloat(searchParams.get('goldPerGram') || '1300000')
  const silverPerGram = parseFloat(searchParams.get('silverPerGram') || '15000')
  const isOrgScopedExport = type === 'zakat'

  if (!orgId) return NextResponse.json({ error: 'orgId diperlukan' }, { status: 400 })

  const membership = await getMembership(user.id, orgId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const branchAccessScope = await getBranchAccessScope(orgId)
  if (!branchAccessScope.role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isOrgScopedExport && branchId) {
    if (!branchAccessScope.accessibleBranchIds.includes(branchId)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke unit tersebut' }, { status: 403 })
    }
  } else if (!isOrgScopedExport && !branchAccessScope.canAccessAllBranches) {
    return NextResponse.json({ error: 'Pilih unit aktif terlebih dahulu untuk export laporan' }, { status: 400 })
  }

  // Get org name for header
  const org = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { name: true },
  })
  const orgName = org?.name || 'Organisasi'

  try {
    let buffer: Buffer
    let filename: string

    switch (type) {
      case 'pl':
        buffer = await exportProfitLossXLSX(orgId, startDate, endDate, orgName, branchId)
        filename = `Laba-Rugi_${orgName}_${startDate}_${endDate}.xlsx`
        break
      case 'bs':
        buffer = await exportBalanceSheetXLSX(orgId, asOfDate, orgName, branchId)
        filename = `Neraca_${orgName}_${asOfDate}.xlsx`
        break
      case 'gl':
        buffer = await exportGeneralLedgerXLSX(orgId, orgName, branchId)
        filename = `Buku-Besar_${orgName}_${new Date().toISOString().split('T')[0]}.xlsx`
        break
      case 'zakat':
        buffer = await exportZakatReportXLSX(orgId, goldPerGram, silverPerGram, orgName)
        filename = `Zakat-Tijarah_${orgName}_${new Date().toISOString().split('T')[0]}.xlsx`
        break
      default:
        return NextResponse.json({ error: 'Tipe export tidak valid. Gunakan: pl | bs | gl | zakat' }, { status: 400 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
  } catch (error: any) {
    (console as any).error('[Export] Error:', error.message)
    return NextResponse.json({ error: 'Gagal menghasilkan export: ' + error.message }, { status: 500 })
  }
}
