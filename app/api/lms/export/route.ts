/**
 * Export XLSX untuk data admin LMS: Course Catalog, Member Directory,
 * Transaksi, Produk, Kupon, Afiliasi, dan Pencairan Afiliasi.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { buildXLSXContentDisposition } from '@/lib/xlsx/table-workbook.server'
import {
  buildLmsAffiliatePayoutsXLSX,
  buildLmsAffiliatesXLSX,
  buildLmsCoursesXLSX,
  buildLmsCouponsXLSX,
  buildLmsMembersXLSX,
  buildLmsProductsXLSX,
  buildLmsSalesXLSX,
} from '@/modules/edu/lib/lms-export.server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 })
  }
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    return NextResponse.json({ error: 'Hanya admin yang dapat mengekspor data.' }, { status: 403 })
  }

  const orgId = orgData.org.id
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const today = new Date().toISOString().slice(0, 10)

  try {
    let buffer: Buffer
    let filename: string

    switch (type) {
      case 'courses':
        buffer = await buildLmsCoursesXLSX(orgId)
        filename = `Course-Catalog_${today}.xlsx`
        break
      case 'members':
        buffer = await buildLmsMembersXLSX({
          search: searchParams.get('search') || '',
          levelFilter: searchParams.get('levelFilter') || 'ALL',
          courseFilter: searchParams.get('courseFilter') || 'ALL',
          sortBy: searchParams.get('sortBy') || 'level_desc',
        })
        filename = `Member-Directory_${today}.xlsx`
        break
      case 'sales':
        buffer = await buildLmsSalesXLSX(orgId, {
          search: searchParams.get('search') || undefined,
          status: searchParams.get('status') || undefined,
          courseId: searchParams.get('courseId') || undefined,
          startDate: searchParams.get('startDate') || undefined,
          endDate: searchParams.get('endDate') || undefined,
        })
        filename = `Transaksi_${today}.xlsx`
        break
      case 'products':
        buffer = await buildLmsProductsXLSX()
        filename = `Produk_${today}.xlsx`
        break
      case 'coupons':
        buffer = await buildLmsCouponsXLSX()
        filename = `Kupon_${today}.xlsx`
        break
      case 'affiliates':
        buffer = await buildLmsAffiliatesXLSX(orgId)
        filename = `Afiliasi_${today}.xlsx`
        break
      case 'payouts':
        buffer = await buildLmsAffiliatePayoutsXLSX(orgId)
        filename = `Pencairan-Afiliasi_${today}.xlsx`
        break
      default:
        return NextResponse.json(
          { error: 'Tipe export tidak valid. Gunakan: courses | members | sales | products | coupons | affiliates | payouts' },
          { status: 400 },
        )
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildXLSXContentDisposition(filename),
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[LMS Export] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghasilkan export.' },
      { status: 500 },
    )
  }
}
