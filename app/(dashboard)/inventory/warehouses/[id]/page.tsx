import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getWarehouses, getWarehouseBins } from '@/modules/inventory/actions/warehouse.actions'
import { WarehouseDetailClient } from './WarehouseDetailClient'

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const warehouses = await getWarehouses(orgData.org.id, activeBranch?.id)
  const warehouse = warehouses.find((w: any) => w.id === id)
  
  if (!warehouse) {
    redirect('/inventory/warehouses')
  }

  const bins = await getWarehouseBins(orgData.org.id, id, activeBranch?.id)

  return (
    <WarehouseDetailClient 
      orgId={orgData.org.id} 
      activeBranchId={activeBranch?.id ?? null}
      activeBranchName={activeBranch?.name ?? null}
      warehouse={warehouse} 
      initialBins={bins || []} 
      userRole={orgData.role}
    />
  )
}
