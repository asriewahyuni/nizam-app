import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exportProfitLossXLSX,
  exportBalanceSheetXLSX,
  exportGeneralLedgerXLSX,
  exportZakatReportXLSX
} from '@/modules/accounting/actions/export.actions'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // pl | bs | gl | zakat
  const orgId = searchParams.get('orgId')
  const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
  const asOfDate = searchParams.get('asOfDate') || endDate
  const goldPerGram = parseFloat(searchParams.get('goldPerGram') || '1300000')
  const silverPerGram = parseFloat(searchParams.get('silverPerGram') || '15000')

  if (!orgId) return NextResponse.json({ error: 'orgId diperlukan' }, { status: 400 })

  // Verify user has access to this org
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get org name for header
  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  const orgName = org?.name || 'Organisasi'

  try {
    let buffer: Buffer
    let filename: string

    switch (type) {
      case 'pl':
        buffer = await exportProfitLossXLSX(orgId, startDate, endDate, orgName)
        filename = `Laba-Rugi_${orgName}_${startDate}_${endDate}.xlsx`
        break
      case 'bs':
        buffer = await exportBalanceSheetXLSX(orgId, asOfDate, orgName)
        filename = `Neraca_${orgName}_${asOfDate}.xlsx`
        break
      case 'gl':
        buffer = await exportGeneralLedgerXLSX(orgId, orgName)
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
    console.error('[Export] Error:', error.message)
    return NextResponse.json({ error: 'Gagal menghasilkan export: ' + error.message }, { status: 500 })
  }
}
