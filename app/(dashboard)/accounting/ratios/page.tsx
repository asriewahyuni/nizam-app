import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getFinancialRatios } from '@/modules/accounting/actions/ratios.actions'
import RatioClient from '@/app/(dashboard)/accounting/ratios/RatioClient'

export const dynamic = 'force-dynamic'

export default async function RatiosPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const ratios = await getFinancialRatios(orgData.org.id)

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <RatioClient initialData={ratios} />
    </div>
  )
}
