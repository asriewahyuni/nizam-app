import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBalanceSheet,
  getCashFlow,
  getProfitLoss,
} from '@/modules/accounting/actions/reports.actions'
import { getAgingSummary } from '@/modules/accounting/actions/aging.actions'
import { getBankLiquidityTotal } from '@/modules/cash/actions/bank.actions'
import { unstable_noStore as noStore } from 'next/cache'
import { formatRupiah } from '@/lib/utils'
import { hasRolePermission, resolveDefaultAuthorizedRoute } from '@/modules/organization/lib/navigation-access'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'
import { getTodayAttendanceSummary } from '@/modules/hris/actions/attendance.actions'

type DashboardBalanceRow = {
  code?: string | null
  balance?: number | null
}

export default async function DashboardPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  if (!hasRolePermission(orgData.role, orgData.permissions, 'dashboard')) {
    return redirect(resolveDefaultAuthorizedRoute({
      userRole: orgData.role,
      permissions: orgData.permissions,
      enabledModules: orgData.enabledModules,
    }))
  }
  const activeBranch = await getActiveBranch(orgData.org.id)
  // Allow admins to filter dashboard by their selected branch
  const reportBranchId = activeBranch?.id ?? null

  const isOwnerOrAdmin = orgData.role === 'owner' || orgData.role === 'admin'
  const canSeeAttendance = isOwnerOrAdmin || hasRolePermission(orgData.role, orgData.permissions, 'attendance')

  const [cashBalance, balanceSheet, profitLoss, cashFlow, analytics, agingSummary, attendanceSummary] = await Promise.all([
    getBankLiquidityTotal(orgData.org.id, reportBranchId),
    getBalanceSheet(orgData.org.id, undefined, reportBranchId, false),
    getProfitLoss(orgData.org.id, undefined, undefined, reportBranchId, false),
    getCashFlow(orgData.org.id, reportBranchId, false),
    getDashboardAnalytics(orgData.org.id, reportBranchId ?? undefined),
    getAgingSummary(orgData.org.id, reportBranchId),
    canSeeAttendance ? getTodayAttendanceSummary(orgData.org.id, reportBranchId) : Promise.resolve(null),
  ])

  const assetRows: DashboardBalanceRow[] = Array.isArray(balanceSheet?.assets) ? balanceSheet.assets : []
  const liabilityRows: DashboardBalanceRow[] = Array.isArray(balanceSheet?.liabilities) ? balanceSheet.liabilities : []

  const totalCash = Number(cashBalance || 0)

  const totalReceivables = Number(agingSummary?.totalAR || 0)
  const totalPayables = Number(agingSummary?.totalAP || 0)

  const totalNonCurrentLiabilities = liabilityRows
    .filter((account) => {
      const code = String(account?.code || '').trim()
      return code.startsWith('25') || code.startsWith('26')
    })
    .reduce((sum, account) => sum + Number(account?.balance || 0), 0)

  const totalInventory = assetRows
    .filter((account) => String(account?.code || '').startsWith('13'))
    .reduce((sum, account) => sum + Number(account?.balance || 0), 0)

  const totalOtherCurrentAssets = assetRows
    .filter((account) => String(account?.code || '').startsWith('14'))
    .reduce((sum, account) => sum + Number(account?.balance || 0), 0)

  const netProfit = Number(profitLoss?.netProfit || 0)
  const operatingCashFlow = Number(cashFlow?.ocf || 0)

  const workingCapitalSummary = `${formatRupiah(totalPayables)} / ${formatRupiah(totalReceivables)}`
  const currentAssetPressureSummary = `${formatRupiah(totalInventory + totalOtherCurrentAssets)} / ${formatRupiah(totalNonCurrentLiabilities)}`

  const data = {
    orgName: String(orgData.org.name),
    metrics: [
      {
        label: 'Total Kas & Bank',
        value: formatRupiah(totalCash),
        icon: 'wallet',
        hint: 'Mengikuti saldo rekening aktif di menu Kas & Bank',
        href: '/cash'
      },
      {
        label: 'Operating Cash Flow',
        value: formatRupiah(operatingCashFlow),
        icon: operatingCashFlow >= 0 ? 'profit' : 'loss',
        hint: 'Sama dengan angka OCF pada menu laporan',
        danger: operatingCashFlow < 0,
        href: '/reports'
      },
      {
        label: 'Hutang & Piutang',
        value: workingCapitalSummary,
        icon: 'receivables',
        hint: 'Outstanding aging AP / AR dari modul operasional',
        href: '/accounting/aging?view=AP'
      },
      {
        label: 'Stok & Aset Lancar',
        value: currentAssetPressureSummary,
        icon: 'receivables',
        hint: 'Persediaan + aset lancar lain vs liabilitas non-lancar',
        href: '/reports'
      },
      {
        label: 'Laba Bersih (Accrual)',
        value: formatRupiah(netProfit),
        icon: netProfit >= 0 ? 'profit' : 'loss',
        hint: 'Diambil dari laporan laba rugi periode berjalan',
        href: '/reports'
      },
    ],
    analytics: analytics.chartData,
    topExpenses: analytics.topExpenses,
    topProducts: analytics.topProducts,
    paretoAnalysis: analytics.paretoAnalysis,
    customerPareto: analytics.customerPareto,
    attendanceSummary: attendanceSummary ?? null,
  }

  const serializableData = JSON.parse(JSON.stringify(data))

  return <DashboardClient data={serializableData} />
}
