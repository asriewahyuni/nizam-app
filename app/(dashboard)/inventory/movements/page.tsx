import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getStockMovementsPage } from '@/modules/inventory/actions/inventory.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import StockMovementsClient from './StockMovementsClient'

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const referenceType = searchParams.type ?? null
  const direction = (searchParams.direction as 'in' | 'out' | null) ?? null
  const dateFrom = searchParams.date_from ?? null
  const dateTo = searchParams.date_to ?? null
  const search = searchParams.search ?? ''

  const [result, products] = await Promise.all([
    getStockMovementsPage(orgData.org.id, {
      branchId: activeBranch?.id,
      page,
      limit: 50,
      search,
      referenceType,
      direction,
      dateFrom,
      dateTo,
    }),
    getProducts(orgData.org.id, activeBranch?.id),
  ])

  return (
    <Suspense fallback={<div className="p-5 text-center font-semibold animate-pulse">Memuat data mutasi stok...</div>}>
      <StockMovementsClient
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialResult={result}
        products={products}
      />
    </Suspense>
  )
}
