import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getStockLedger } from '@/modules/inventory/actions/inventory.actions'
import { redirect } from 'next/navigation'
import StockLedgerClient from './StockLedgerClient'

export default async function StockLedgerPage({ params }: { params: { id: string } }) {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const productId = params.id
  const data = await getStockLedger(orgData.org.id, productId)

  if (!data || (data as any).error) {
    return <div>Error loading ledger data.</div>
  }

  return (
    <StockLedgerClient
      productId={productId}
      data={data as any}
    />
  )
}
