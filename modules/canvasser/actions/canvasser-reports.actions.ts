'use server'

// Laporan performa harian canvasser (penjualan, kas, AR tertagih, tingkat
// kunjungan) per van/periode, plus export ke PDF.

import { queryPostgres } from '@/lib/db/postgres'
import { formatDate } from '@/lib/utils'
import { renderCanvasserReportPdf } from '@/modules/canvasser/lib/canvasser-report-pdf'
import { extractManagedStorageKey, createSignedStorageGetUrl } from '@/lib/storage/object-storage.server'
import type {
  CanvasserPerformanceReport,
  CanvasserPerformanceReportRow,
} from '@/modules/canvasser/lib/canvasser-types'

export async function getCanvasserPerformanceReport(orgId: string, params: {
  from: string
  to: string
  vanId?: string | null
}): Promise<CanvasserPerformanceReport> {
  const res = await queryPostgres<Record<string, unknown>>(
    `SELECT
       v.id AS van_id, v.code AS van_code, v.name AS van_name,
       s.session_date,
       s.total_sales AS sales_total,
       s.total_cash_collected AS cash_collected,
       s.total_ar_collected AS ar_collected,
       COALESCE(vc.visits_done, 0) AS visits_done,
       COALESCE(vc.visits_total, 0) AS visits_total
     FROM canvasser_sessions s
     JOIN canvasser_vans v ON v.id = s.van_id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE status IN ('SELESAI', 'SKIP')) AS visits_done,
         COUNT(*) AS visits_total
       FROM canvasser_visits WHERE session_id = s.id
     ) vc ON true
     WHERE s.org_id = $1 AND s.session_date BETWEEN $2 AND $3
       AND ($4::uuid IS NULL OR s.van_id = $4)
     ORDER BY s.session_date DESC, v.code ASC`,
    [orgId, params.from, params.to, params.vanId || null]
  )

  const rows: CanvasserPerformanceReportRow[] = res.rows.map(row => ({
    vanId: String(row.van_id),
    vanCode: String(row.van_code || ''),
    vanName: String(row.van_name || ''),
    sessionDate: String(row.session_date),
    salesTotal: Number(row.sales_total || 0),
    cashCollected: Number(row.cash_collected || 0),
    arCollected: Number(row.ar_collected || 0),
    visitsDone: Number(row.visits_done || 0),
    visitsTotal: Number(row.visits_total || 0),
  }))

  const totals = rows.reduce((acc, r) => ({
    salesTotal: acc.salesTotal + r.salesTotal,
    cashCollected: acc.cashCollected + r.cashCollected,
    arCollected: acc.arCollected + r.arCollected,
    visitsDone: acc.visitsDone + r.visitsDone,
    visitsTotal: acc.visitsTotal + r.visitsTotal,
  }), { salesTotal: 0, cashCollected: 0, arCollected: 0, visitsDone: 0, visitsTotal: 0 })

  return { from: params.from, to: params.to, rows, totals }
}

// Ambil bytes logo org dari bucket Railway untuk di-embed ke PDF. logo_url
// tersimpan sebagai path proxy (/api/storage/public/...) — tukar ke signed
// URL S3 dulu supaya bisa di-fetch langsung dari server, tanpa round-trip
// lewat route proxy app sendiri. Gagal ambil logo tidak boleh menggagalkan
// pembuatan laporan, jadi semua error di sini ditelan (return null).
async function fetchOrgLogoBytes(logoUrl: string | null): Promise<Uint8Array | null> {
  if (!logoUrl) return null
  try {
    const key = extractManagedStorageKey(logoUrl)
    const fetchUrl = key ? await createSignedStorageGetUrl(key) : logoUrl
    if (!key && !/^(https?:|data:)/i.test(logoUrl)) return null
    const res = await fetch(fetchUrl)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function generateCanvasserReportPdfBase64(orgId: string, params: {
  from: string
  to: string
  vanId?: string | null
}): Promise<{ base64: string; filename: string } | { error: string }> {
  const [report, orgRes] = await Promise.all([
    getCanvasserPerformanceReport(orgId, params),
    queryPostgres<{ name: string; logo_url: string | null }>(`SELECT name, logo_url FROM organizations WHERE id = $1`, [orgId]),
  ])
  const orgName = orgRes.rows[0]?.name || 'Nizam ERP'
  const logoBytes = await fetchOrgLogoBytes(orgRes.rows[0]?.logo_url || null)

  const bytes = await renderCanvasserReportPdf({
    orgName,
    report,
    generatedAtLabel: formatDate(new Date().toISOString()),
    logoBytes,
  })

  return {
    base64: Buffer.from(bytes).toString('base64'),
    filename: `laporan-canvasser-${params.from}_${params.to}.pdf`,
  }
}
