import { canSelectAllBranches, getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getBalanceSheet,
  getCashFlow,
  getProfitLoss,
} from '@/modules/accounting/actions/reports.actions'
import { getBankLiquidityTotal } from '@/modules/cash/actions/bank.actions'
import { unstable_noStore as noStore } from 'next/cache'
import { formatRupiah } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'

export default async function DashboardPage() {
  noStore()
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const [activeBranch, canAccessAllBranches] = await Promise.all([
    getActiveBranch(orgData.org.id),
    canSelectAllBranches(orgData.org.id),
  ])
  const reportBranchId = canAccessAllBranches ? null : (activeBranch?.id ?? null)

  const [cashBalance, balanceSheet, profitLoss, cashFlow, analytics] = await Promise.all([
    getBankLiquidityTotal(orgData.org.id, reportBranchId),
    getBalanceSheet(orgData.org.id, undefined, reportBranchId, false),
    getProfitLoss(orgData.org.id, undefined, undefined, reportBranchId, false),
    getCashFlow(orgData.org.id, reportBranchId, false),
    getDashboardAnalytics(orgData.org.id, reportBranchId ?? undefined),
  ])

  const assetRows = Array.isArray(balanceSheet?.assets) ? balanceSheet.assets : []
  const liabilityRows = Array.isArray(balanceSheet?.liabilities) ? balanceSheet.liabilities : []

  const totalCash = Number(cashBalance || 0)

  const totalReceivables = assetRows
    .filter((account: any) => String(account?.code || '').startsWith('12') && String(account?.code || '') !== '1203')
    .reduce((sum: number, account: any) => sum + Number(account?.balance || 0), 0)

  const totalPayables = liabilityRows
    .filter((account: any) => {
      const code = String(account?.code || '').trim()
      return code === '2101' || code.startsWith('22') || code.startsWith('23') || code.startsWith('24')
    })
    .reduce((sum: number, account: any) => sum + Number(account?.balance || 0), 0)

  const totalNonCurrentLiabilities = liabilityRows
    .filter((account: any) => {
      const code = String(account?.code || '').trim()
      return code.startsWith('25') || code.startsWith('26')
    })
    .reduce((sum: number, account: any) => sum + Number(account?.balance || 0), 0)

  const totalInventory = assetRows
    .filter((account: any) => String(account?.code || '').startsWith('13'))
    .reduce((sum: number, account: any) => sum + Number(account?.balance || 0), 0)

  const totalOtherCurrentAssets = assetRows
    .filter((account: any) => String(account?.code || '').startsWith('14'))
    .reduce((sum: number, account: any) => sum + Number(account?.balance || 0), 0)

  const netProfit = Number(profitLoss?.netProfit || 0)
  const operatingCashFlow = Number(cashFlow?.ocf || 0)

  const runwayMonths = operatingCashFlow < 0 && totalCash > 0 ? Math.abs(totalCash / operatingCashFlow) : 999
  const runwayText = operatingCashFlow >= 0 ? 'Aman (OCF Positif)' : `${runwayMonths.toFixed(1)} Bulan tewas`

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
        label: 'Runway / Burn Rate',
        value: runwayText,
        icon: 'wallet',
        hint: operatingCashFlow < 0 ? 'Waktu tersisa sebelum bangkrut' : 'Perusahaan mencetak Net Cash.',
        danger: operatingCashFlow < 0 && runwayMonths < 6,
        href: '/accounting/budgets'
      },
      {
        label: 'Hutang & Piutang',
        value: workingCapitalSummary,
        icon: 'receivables',
        hint: 'Utang operasional vs piutang usaha',
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
    customerPareto: analytics.customerPareto
  }

  const serializableData = JSON.parse(JSON.stringify(data))

  return <DashboardClient data={serializableData} />
}
