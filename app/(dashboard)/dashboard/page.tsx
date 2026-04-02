import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import { formatRupiah } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
} from 'lucide-react'
import { DashboardClient } from './DashboardClient'
import { getDashboardAnalytics } from '@/modules/accounting/actions/analytics.actions'

export const revalidate = 3600 // CACHE FOR 1 HOUR TO TEST LOOP

export default async function DashboardPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const activeBranch = await getActiveBranch(orgData.org.id)

  const [balances, analytics] = await Promise.all([
    getAccountBalances(orgData.org.id),
    getDashboardAnalytics(orgData.org.id, activeBranch?.id)
  ])

  // Aggregate key metrics
  const totalCash = balances
    .filter((b) => b.code >= '1101' && b.code <= '1105')
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  // 🔴 CEO Directive: Inclusive AR/AP (Trade + Tax + Accruals)
  const totalReceivables = balances
    .filter((b) => String(b.code).startsWith('12')) // Accounts Receivable (ALL)
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalPayables = balances
    .filter((b) => String(b.code).startsWith('21') || String(b.code).startsWith('22') || String(b.code).startsWith('23') || String(b.code).startsWith('24')) // Trade AP + Tax + Payroll + Other
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalRevenue = balances
    .filter((b) => b.type === 'REVENUE')
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalExpense = balances
    .filter((b) => b.type === 'EXPENSE')
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalInventory = balances
    .filter((b) => String(b.code).startsWith('13')) // Persediaan Barang: Kode 13XX (Verified)
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalOtherCurrentAssets = balances
    .filter((b) => String(b.code).startsWith('14')) // PPN Masukan & Biaya Dimuka
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const totalOtherCurrentLiabilities = balances
    .filter((b) => String(b.code).startsWith('25') || String(b.code).startsWith('26')) // Non-Current Liabilities (if any in short term, but let's keep it clean)
    .reduce((sum, b) => sum + (b.balance ?? 0), 0)

  const netProfit = totalRevenue - totalExpense

  // 🔴 CEO Directive: Real Operating Cash Flow (Indirect Method PSKAK)
  // OCF = Net Profit - ΔAR - ΔInventory - ΔOtherCurrentAssets + ΔAP + ΔOtherCurrentLiabilities
  // Logic: 344 - 331 - 401 - 88 + 888 + 82.5 = 494.5
  const operatingCashFlow = netProfit 
       - totalReceivables 
       - totalInventory 
       - totalOtherCurrentAssets 
       + totalPayables 
       + totalOtherCurrentLiabilities
  
  const runwayMonths = operatingCashFlow < 0 ? Math.abs(totalCash / operatingCashFlow) : 999
  const runwayText = operatingCashFlow >= 0 ? 'Aman (OCF Positif)' : `${runwayMonths.toFixed(1)} Bulan tewas`

  const data = {
    orgName: String(orgData.org.name),
    metrics: [
      {
        label: 'Total Kas & Bank',
        value: formatRupiah(totalCash),
        icon: 'wallet',
        hint: 'Total saldo di semua rekening',
        href: '/cash'
      },
      {
        label: 'Operating Cash Flow',
        value: formatRupiah(operatingCashFlow),
        icon: operatingCashFlow >= 0 ? 'profit' : 'loss',
        hint: 'Arus Kas Real dari Operasional',
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
        value: `${formatRupiah(totalPayables)} / ${formatRupiah(totalReceivables)}`,
        icon: 'receivables',
        hint: 'Rasio AP vs AR yang mengikat kas',
        href: '/accounting/aging?view=AP'
      },
      {
        label: 'Laba Bersih (Accrual)',
        value: formatRupiah(netProfit),
        icon: netProfit >= 0 ? 'profit' : 'loss',
        hint: 'Laba Kertas (AWAS ILUSI)',
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
