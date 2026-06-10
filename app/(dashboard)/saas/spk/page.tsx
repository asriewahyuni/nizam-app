import { getSpkDocuments } from '@/modules/saas/actions/spk.actions'
import SpkListClient from './SpkListClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function SpkListPage() {
  const spks = await getSpkDocuments()
  return <SpkListClient spks={spks} />
}
