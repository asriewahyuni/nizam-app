import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getBalanceSheet, getProfitLoss, getCashFlow } from '@/modules/accounting/actions/reports.actions'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ startDate?: string, endDate?: string }> }) {
  const params = await searchParams
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const startDate = params.startDate
  const endDate = params.endDate

  const [balanceSheet, profitLoss, cashFlow] = await Promise.all([
    getBalanceSheet(orgData.org.id, endDate),
    getProfitLoss(orgData.org.id, startDate, endDate),
    getCashFlow(orgData.org.id) // Cash flow still current, can be improved later
  ])

  return (
    <ReportsClient 
      orgId={orgData.org.id}
      orgName={orgData.org.name}
      balanceSheet={balanceSheet} 
      profitLoss={profitLoss} 
      cashFlow={cashFlow}
    />
  )
}
