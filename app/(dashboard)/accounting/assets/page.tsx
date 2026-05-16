import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getFixedAssets } from '@/modules/accounting/actions/assets.actions'
import { createClient } from '@/lib/supabase/server'
import { AssetClient } from './AssetClient'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Hanya owner, admin, manager yang bisa akses Accounting & Assets
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const activeBranch = await getActiveBranch(orgData.org.id)

  const [assets, totalCountRes, coaRes] = await Promise.all([
    getFixedAssets(orgData.org.id, activeBranch?.id),
    supabase.from('fixed_assets').select('id', { count: 'exact', head: true }).eq('org_id', orgData.org.id),
    supabase.from('accounts').select('*').eq('org_id', orgData.org.id).eq('is_active', true).order('code')
  ])

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <AssetClient
        orgId={orgData.org.id}
        orgName={orgData.org.name}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        initialAssets={assets}
        totalAssetCount={totalCountRes.count ?? 0}
        coa={coaRes.data || []}
      />
    </div>
  )
}
