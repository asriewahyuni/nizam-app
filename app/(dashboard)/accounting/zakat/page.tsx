import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getZakatSummary, evaluateZakatDaily } from '@/modules/accounting/actions/zakat.actions'
import { redirect } from 'next/navigation'
import ZakatClient from './ZakatClient'

export default async function ZakatPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) redirect('/onboarding')

  const orgId = activeOrg.org.id
  const activeBranch = await getActiveBranch(orgId)
  const sParams = await searchParams
  
  // Default gold price Rp 1,500,000 / gram, silver Rp 15,000 / gram
  const goldPrice = parseInt(sParams.goldPrice as string) || 1500000
  const silverPrice = parseInt(sParams.silverPrice as string) || 15000

  // Trigger auto evaluation and daily chart logging
  await evaluateZakatDaily(orgId, { gold: goldPrice, silver: silverPrice })

  const summary = await getZakatSummary(orgId, { goldPerGram: goldPrice, silverPerGram: silverPrice })

  return (
    <main className="p-8">
      <ZakatClient
        summary={summary}
        orgId={orgId}
        activeBranchName={activeBranch?.name ?? null}
      />
    </main>
  )
}
