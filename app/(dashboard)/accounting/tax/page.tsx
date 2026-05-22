import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getTaxSummary } from '@/modules/accounting/actions/tax.actions'
import { redirect } from 'next/navigation'
import TaxClient from './TaxClient'

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) redirect('/onboarding')

  const orgId = activeOrg.org.id
  const activeBranch = await getActiveBranch(orgId)
  const sParams = await searchParams
  const startDate = sParams.startDate as string | undefined
  const endDate = sParams.endDate as string | undefined

  const summary = await getTaxSummary(orgId, startDate, endDate, activeBranch?.id)

  return (
    <main className="p-8">
      <TaxClient summary={summary} orgId={orgId} />
    </main>
  )
}
