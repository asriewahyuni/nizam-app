import { notFound } from 'next/navigation'
import { getUatSession } from '@/modules/saas/actions/uat.actions'
import UatSessionClient from './UatSessionClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function UatSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getUatSession(id)
  if (!session) notFound()
  return <UatSessionClient session={session} />
}
