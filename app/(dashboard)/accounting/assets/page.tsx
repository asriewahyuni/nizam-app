import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getFixedAssets } from '@/modules/accounting/actions/assets.actions'
import { AssetClient } from './AssetClient'
import { toPlainSerializable } from '@/lib/serialization'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Hanya owner, admin, manager yang bisa akses Accounting & Assets
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    redirect('/dashboard')
  }

  const activeBranch = await getActiveBranch(orgData.org.id)

  const [assets, coaRes] = await Promise.all([
    getFixedAssets(orgData.org.id, activeBranch?.id),
    getChartOfAccounts(orgData.org.id),
  ])

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <AssetClient 
        orgId={orgData.org.id} 
        orgName={orgData.org.name}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialAssets={toPlainSerializable(assets)} 
        coa={toPlainSerializable(coaRes.filter((account) => account.is_active))} 
      />
    </div>
  )
}
