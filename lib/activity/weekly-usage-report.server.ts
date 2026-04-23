/**
 * Service laporan pekanan penggunaan sistem untuk admin platform.
 * Mengambil data analytics + heatmap dari modul activity lalu mengirimkannya via email.
 */

import { getWeeklyUserActivityReport } from '@/lib/activity/user-activity.server'
import type { UserActivityHeatmapCell, UserActivityWeeklyReport } from '@/lib/activity/user-activity.types'
import { sendSystemEmail } from '@/lib/email/sender'

type WeeklyUsageReportOptions = {
  dryRun?: boolean
}

type WeeklyUsageDeliveryResult = {
  recipient: string
  success: boolean
  error?: string
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function escapeHtml(value: unknown) {
  const text = String(value ?? '')

  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('id-ID')
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getReportRecipients() {
  const rawRecipients = String(process.env.WEEKLY_SYSTEM_USAGE_REPORT_RECIPIENTS || '').trim()
  const recipients = rawRecipients
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(recipients)]
}

function resolveDashboardUrl() {
  const baseUrl =
    normalizeText(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeText(process.env.NEXT_PUBLIC_SITE_URL)

  if (!baseUrl) return null

  return `${baseUrl.replace(/\/+$/, '')}/admin`
}

function groupHeatmapRows(heatmap: UserActivityHeatmapCell[]) {
  const grouped = new Map<string, UserActivityHeatmapCell[]>()

  for (const cell of heatmap) {
    const current = grouped.get(cell.dateKey) || []
    current.push(cell)
    grouped.set(cell.dateKey, current)
  }

  return Array.from(grouped.values()).map((cells) => {
    const sortedCells = [...cells].sort((left, right) => left.hour - right.hour)

    return {
      dateKey: sortedCells[0]?.dateKey || '',
      dayLabel: sortedCells[0]?.dayLabel || '-',
      dateLabel: sortedCells[0]?.dateLabel || '-',
      dailyTotal: sortedCells.reduce((total, cell) => total + cell.activityCount, 0),
      cells: sortedCells,
    }
  })
}

function getHeatmapColor(activityCount: number, maxActivity: number) {
  if (activityCount <= 0 || maxActivity <= 0) {
    return '#E2E8F0'
  }

  const ratio = activityCount / maxActivity

  if (ratio < 0.2) return '#E0F2FE'
  if (ratio < 0.4) return '#BAE6FD'
  if (ratio < 0.6) return '#7DD3FC'
  if (ratio < 0.8) return '#2563EB'
  return '#0F172A'
}

function buildInsightItems(report: UserActivityWeeklyReport) {
  const items: string[] = []

  if (report.peakDay) {
    items.push(
      `Hari paling ramai: ${report.peakDay.dayLabel}, ${report.peakDay.dateLabel} dengan ${formatNumber(report.peakDay.activityCount)} aktivitas dan ${formatNumber(report.peakDay.uniqueUsers)} user unik.`
    )
  }

  if (report.peakHour) {
    items.push(
      `Jam paling ramai: ${report.peakHour.dayLabel}, ${report.peakHour.dateLabel} pukul ${formatHourLabel(report.peakHour.hour)} dengan ${formatNumber(report.peakHour.activityCount)} aktivitas.`
    )
  }

  if (report.topRoutes[0]) {
    items.push(
      `Route paling sering dibuka: ${report.topRoutes[0].routePath} (${formatNumber(report.topRoutes[0].visits)} kunjungan).`
    )
  }

  if (report.topTenants[0]) {
    items.push(
      `Tenant paling aktif: ${report.topTenants[0].orgName} (${formatNumber(report.topTenants[0].visits)} kunjungan dari ${formatNumber(report.topTenants[0].uniqueUsers)} user).`
    )
  }

  return items
}

function buildWeeklyUsageReportHtml(report: UserActivityWeeklyReport) {
  const maxHeatmapActivity = Math.max(0, ...report.heatmap.map((cell) => cell.activityCount))
  const heatmapRows = groupHeatmapRows(report.heatmap)
  const dashboardUrl = resolveDashboardUrl()
  const insightItems = buildInsightItems(report)

  const summaryCards = [
    { label: 'User Aktif Sekarang', value: formatNumber(report.summary.activeUsers10m) },
    { label: 'Kunjungan 7 Hari', value: formatNumber(report.summary.routeVisits7d) },
    { label: 'User Login 7 Hari', value: formatNumber(report.summary.usersLoggedIn7d) },
    { label: 'User Unik 7 Hari', value: formatNumber(report.summary.uniqueUsers7d) },
    { label: 'Tenant Aktif', value: formatNumber(report.summary.activeOrgs7d) },
    { label: 'Unit Aktif', value: formatNumber(report.summary.activeBranches7d) },
  ]

  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; color:#0f172a; padding:24px;">
      <div style="max-width:1100px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; overflow:hidden;">
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color:#ffffff; padding:28px 32px;">
          <div style="font-size:12px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; opacity:0.9;">NIZAM System Usage Report</div>
          <h1 style="margin:10px 0 8px; font-size:28px; line-height:1.2;">Laporan Pekanan Penggunaan Sistem</h1>
          <p style="margin:0; font-size:15px; opacity:0.9;">Periode ${escapeHtml(report.periodLabel)}</p>
        </div>

        <div style="padding:28px 32px;">
          <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:24px;">
            ${summaryCards.map((card) => `
              <div style="border:1px solid #e2e8f0; border-radius:16px; padding:16px 18px; background:#f8fafc;">
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.14em; color:#64748b;">${escapeHtml(card.label)}</div>
                <div style="margin-top:8px; font-size:26px; font-weight:800; color:#0f172a;">${escapeHtml(card.value)}</div>
              </div>
            `).join('')}
          </div>

          <div style="border:1px solid #dbeafe; background:#eff6ff; border-radius:16px; padding:18px 20px; margin-bottom:24px;">
            <div style="font-size:13px; font-weight:800; color:#1d4ed8; text-transform:uppercase; letter-spacing:0.14em;">Insight Analytics + Heatmap</div>
            <ul style="margin:12px 0 0; padding-left:18px; color:#1e293b;">
              ${insightItems.length > 0
                ? insightItems.map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join('')
                : '<li style="margin:0;">Belum ada data aktivitas yang cukup untuk disimpulkan.</li>'}
            </ul>
          </div>

          <div style="margin-bottom:24px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
              <div>
                <h2 style="margin:0; font-size:20px; color:#0f172a;">Heatmap Aktivitas 7 Hari</h2>
                <p style="margin:6px 0 0; font-size:13px; color:#64748b;">Semakin gelap kotaknya, semakin ramai aktivitas pada jam tersebut. Waktu Jakarta.</p>
              </div>
              <div style="font-size:12px; font-weight:700; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:999px; padding:8px 12px;">
                Puncak: ${escapeHtml(formatNumber(maxHeatmapActivity))} event/jam
              </div>
            </div>

            <div style="overflow-x:auto;">
              <table style="border-collapse:separate; border-spacing:4px; width:100%; min-width:960px;">
                <thead>
                  <tr>
                    <th style="text-align:left; font-size:11px; color:#64748b;">Hari</th>
                    ${Array.from({ length: 24 }, (_, hour) => `
                      <th style="font-size:10px; color:#64748b; font-weight:700; min-width:22px;">${String(hour).padStart(2, '0')}</th>
                    `).join('')}
                    <th style="text-align:right; font-size:11px; color:#64748b;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${heatmapRows.map((row) => `
                    <tr>
                      <td style="white-space:nowrap; font-size:12px; font-weight:700; color:#0f172a; padding-right:8px;">
                        ${escapeHtml(row.dayLabel)}<br/>
                        <span style="font-size:11px; font-weight:600; color:#64748b;">${escapeHtml(row.dateLabel)}</span>
                      </td>
                      ${row.cells.map((cell) => `
                        <td title="${escapeHtml(`${row.dayLabel}, ${row.dateLabel} ${formatHourLabel(cell.hour)} • ${cell.activityCount} event • ${cell.uniqueUsers} user`)}" style="background:${getHeatmapColor(cell.activityCount, maxHeatmapActivity)}; border-radius:6px; height:20px; min-width:22px; text-align:center; font-size:0;"></td>
                      `).join('')}
                      <td style="text-align:right; font-size:12px; font-weight:800; color:#0f172a; padding-left:8px;">
                        ${escapeHtml(formatNumber(row.dailyTotal))}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:24px;">
            <div style="border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
              <div style="padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <h3 style="margin:0; font-size:17px; color:#0f172a;">Route Teratas 7 Hari</h3>
              </div>
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:12px 18px; text-align:left; font-size:11px; color:#64748b;">Route</th>
                    <th style="padding:12px 18px; text-align:right; font-size:11px; color:#64748b;">Kunjungan</th>
                    <th style="padding:12px 18px; text-align:right; font-size:11px; color:#64748b;">User</th>
                  </tr>
                </thead>
                <tbody>
                  ${(report.topRoutes.length > 0 ? report.topRoutes : [{ routePath: '-', visits: 0, uniqueUsers: 0 }]).slice(0, 7).map((route) => `
                    <tr>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:700; color:#0f172a;">${escapeHtml(route.routePath)}</td>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:800; color:#0f172a; text-align:right;">${escapeHtml(formatNumber(route.visits))}</td>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:700; color:#334155; text-align:right;">${escapeHtml(formatNumber(route.uniqueUsers))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
              <div style="padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                <h3 style="margin:0; font-size:17px; color:#0f172a;">Tenant Teraktif 7 Hari</h3>
              </div>
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:12px 18px; text-align:left; font-size:11px; color:#64748b;">Tenant</th>
                    <th style="padding:12px 18px; text-align:right; font-size:11px; color:#64748b;">Kunjungan</th>
                    <th style="padding:12px 18px; text-align:right; font-size:11px; color:#64748b;">User</th>
                  </tr>
                </thead>
                <tbody>
                  ${(report.topTenants.length > 0 ? report.topTenants : [{ orgName: '-', orgId: null, visits: 0, uniqueUsers: 0 }]).slice(0, 7).map((tenant) => `
                    <tr>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:700; color:#0f172a;">${escapeHtml(tenant.orgName)}</td>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:800; color:#0f172a; text-align:right;">${escapeHtml(formatNumber(tenant.visits))}</td>
                      <td style="padding:12px 18px; border-top:1px solid #f1f5f9; font-size:13px; font-weight:700; color:#334155; text-align:right;">${escapeHtml(formatNumber(tenant.uniqueUsers))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="border-top:1px solid #e2e8f0; padding-top:18px; font-size:12px; color:#64748b;">
            ${dashboardUrl
              ? `Lihat detail lengkap di panel admin: <a href="${escapeHtml(dashboardUrl)}" style="color:#1d4ed8; font-weight:700; text-decoration:none;">${escapeHtml(dashboardUrl)}</a><br/>`
              : ''}
            Email ini dibuat otomatis dari fitur analytics dan heatmap aktivitas user di NIZAM.
          </div>
        </div>
      </div>
    </div>
  `
}

export async function sendWeeklySystemUsageReport(options: WeeklyUsageReportOptions = {}) {
  const recipients = getReportRecipients()

  if (recipients.length === 0) {
    throw new Error('Missing WEEKLY_SYSTEM_USAGE_REPORT_RECIPIENTS')
  }

  const report = await getWeeklyUserActivityReport()
  const subject = `[NIZAM] Laporan Pekanan Penggunaan Sistem (${report.periodLabel})`
  const html = buildWeeklyUsageReportHtml(report)

  if (options.dryRun) {
    return {
      report,
      recipients,
      subject,
      results: [] as WeeklyUsageDeliveryResult[],
      dryRun: true as const,
    }
  }

  const results = await Promise.all(
    recipients.map(async (recipient) => {
      const sendResult = await sendSystemEmail({
        fromName: 'Nizam System Report',
        toEmail: recipient,
        subject,
        html,
      })

      if ('error' in sendResult) {
        return {
          recipient,
          success: false,
          error: sendResult.error,
        }
      }

      return {
        recipient,
        success: true,
      }
    })
  )

  return {
    report,
    recipients,
    subject,
    results,
    dryRun: false as const,
  }
}
