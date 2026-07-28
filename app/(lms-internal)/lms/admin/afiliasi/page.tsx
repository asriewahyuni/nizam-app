import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getAdminAffiliateList,
  getAdminAffiliatePayouts,
} from '@/modules/ecommerce/lib/affiliate.server'
import AdminAffiliateClient from './AdminAffiliateClient'

export const metadata = {
  title: 'Manajemen Afiliasi — Nizam LMS Admin',
  description: 'Kelola akun afiliasi dan proses pengajuan pencairan komisi.',
}

export default async function LmsAdminAffiliatePage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) return null

  const [affiliates, payouts] = await Promise.all([
    getAdminAffiliateList(orgData.org.id),
    getAdminAffiliatePayouts(orgData.org.id),
  ])

  return <AdminAffiliateClient affiliates={affiliates} payouts={payouts} />
}
