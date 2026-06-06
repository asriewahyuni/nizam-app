import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCargoShipments } from '@/modules/po-bus/actions/cargo.actions'
import { getCargoTariffs } from '@/modules/po-bus/actions/cargo-tariff.actions'
import { getBusPools } from '@/modules/po-bus/actions/po-bus.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { CargoPosFullClient } from './CargoPosFullClient'

export const revalidate = 0

export default async function PosCargoPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const orgId = orgData.org.id

  const branchSelection = await resolveAccessibleBranchSelection(orgId, null)
  
  const [pools, cargoShipments, cargoTariffs] = await Promise.all([
    getBusPools(orgId),
    getCargoShipments(orgId, branchSelection && !('error' in branchSelection) ? branchSelection.branchId : null),
    getCargoTariffs(orgId)
  ])

  let defaultOriginPoolId: string | null = null
  if (branchSelection && !('error' in branchSelection) && branchSelection.branchId) {
    const userPool = pools.find(p => p.branch_id === branchSelection.branchId)
    if (userPool) defaultOriginPoolId = userPool.id
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-slate-800 mb-6">POS Kargo Loket</h1>
        <CargoPosFullClient
          orgId={orgId}
          cargoShipments={cargoShipments}
          pools={pools}
          cargoTariffs={cargoTariffs}
          defaultOriginPoolId={defaultOriginPoolId}
        />
      </div>
    </div>
  )
}
