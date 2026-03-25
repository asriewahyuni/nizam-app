import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCashFlowForecast } from '@/modules/accounting/actions/forecast.actions'
import { redirect } from 'next/navigation'
import ForecastClient from './ForecastClient'

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) redirect('/onboarding')

  const orgId = activeOrg.org.id
  const sParams = await searchParams
  const days = parseInt(sParams.days as string) || 30

  const forecast = await getCashFlowForecast(orgId, days)

  return (
    <main className="p-8 text-slate-900">
      <ForecastClient forecast={forecast} orgId={orgId} />
    </main>
  )
}
