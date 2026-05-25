import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import {
  buildExportStorageKey,
  buildPrivateStorageObjectPath,
  isObjectStorageFeatureEnabled,
  uploadObjectToStorage,
} from '@/lib/storage/object-storage.server'
import { getDateInTimeZone } from '@/lib/utils'
import { buildSentryActorContext } from '@/lib/monitoring/sentry'
import { getBranchAccessScope } from '@/modules/organization/lib/branch-access.server'
import {
  exportProfitLossXLSX,
  exportBalanceSheetXLSX,
  exportGeneralLedgerXLSX,
  exportZakatReportXLSX,
  exportFixedAssetsXLSX
} from '@/modules/accounting/actions/export.actions'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const db = supabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // pl | bs | gl | zakat | assets
  const orgId = searchParams.get('orgId')
  const branchId = searchParams.get('branchId')
  const consolidated = searchParams.get('consolidated') === 'true'
  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const currentMonthStart = `${todayInJakarta.slice(0, 7)}-01`
  const startDate = searchParams.get('startDate') || currentMonthStart
  const endDate = searchParams.get('endDate') || todayInJakarta
  const asOfDate = searchParams.get('asOfDate') || endDate
  const goldPerGram = parseFloat(searchParams.get('goldPerGram') || '1300000')
  const silverPerGram = parseFloat(searchParams.get('silverPerGram') || '15000')
  const isOrgScopedExport = type === 'zakat' || consolidated

  if (!orgId) return NextResponse.json({ error: 'orgId diperlukan' }, { status: 400 })

  // Verify user has access to this org
  const { data: member } = await db
    .from('org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  const orgName = org?.name || 'Organisasi'

  try {
    let buffer: Buffer
    let filename: string

    switch (type) {
      case 'pl':
        buffer = await exportProfitLossXLSX(orgId, startDate, endDate, orgName, branchId, consolidated)
        filename = `Laba-Rugi_${orgName}_${startDate}_${endDate}.xlsx`
        break
      case 'bs':
        buffer = await exportBalanceSheetXLSX(orgId, asOfDate, orgName, branchId, consolidated)
        filename = `Neraca_${orgName}_${asOfDate}.xlsx`
        break
      case 'gl':
        buffer = await exportGeneralLedgerXLSX(orgId, orgName, branchId, consolidated)
        filename = `Buku-Besar_${orgName}_${todayInJakarta}.xlsx`
        break
      case 'assets':
        buffer = await exportFixedAssetsXLSX(orgId, orgName, branchId)
        filename = `Aset-Tetap_${orgName}_${todayInJakarta}.xlsx`
        break
      case 'zakat':
        buffer = await exportZakatReportXLSX(orgId, goldPerGram, silverPerGram, orgName)
        filename = `Zakat-Tijarah_${orgName}_${todayInJakarta}.xlsx`
        break
      default:
        return NextResponse.json({ error: 'Tipe export tidak valid. Gunakan: pl | bs | gl | zakat | assets' }, { status: 400 })
    }

    const attachmentDisposition = buildAttachmentContentDisposition(filename)

    if (isObjectStorageFeatureEnabled('exports')) {
      try {
        const storageKey = buildExportStorageKey(orgId, filename, todayInJakarta)

        await uploadObjectToStorage({
          key: storageKey,
          body: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          cacheControl: 'private, no-store',
          contentDisposition: attachmentDisposition,
        })

        const downloadUrl = new URL(buildPrivateStorageObjectPath(storageKey), request.url)
        return NextResponse.redirect(downloadUrl, {
          status: 307,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        })
      } catch (storageError) {
        console.error('[Export] Gagal simpan file ke bucket, fallback ke download langsung:', storageError)
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': attachmentDisposition,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Export] Error:', errorMessage)

    const actor = buildSentryActorContext({
      userId: user.id,
      email: user.email || null,
      fullName: String(user.user_metadata?.full_name || user.email || ''),
      orgId,
      orgName,
      branchId,
      role: branchAccessScope.role,
      route: '/api/export',
      feature: 'report_export',
    })

    Sentry.withScope((scope) => {
      if (actor.user) scope.setUser(actor.user)
      Object.entries(actor.tags).forEach(([key, value]) => {
        if (value) scope.setTag(key, value)
      })
      scope.setContext('organization', actor.context.organization)
      scope.setContext('branch', actor.context.branch)
      scope.setContext('export_request', {
        type,
        consolidated,
        startDate,
        endDate,
        asOfDate,
      })
      Sentry.captureException(error)
    })

    return NextResponse.json({ error: 'Gagal menghasilkan export: ' + errorMessage }, { status: 500 })
  }
}

function buildAttachmentContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]+/g, '_').replace(/[";]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
