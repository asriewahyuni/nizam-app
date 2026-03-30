import SaasOperatorClient from '@/app/(dashboard)/saas/SaasOperatorClient'
import { getOperatorSaasSnapshot } from '@/modules/saas/actions/operator-sales.actions'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function SaaSPenawaranPage() {
  const snapshot = await getOperatorSaasSnapshot()
  return <SaasOperatorClient mode="quotes" snapshot={snapshot} />
}
