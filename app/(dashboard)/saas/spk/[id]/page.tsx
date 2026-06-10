import { notFound } from 'next/navigation'
import { getSpkDocument } from '@/modules/saas/actions/spk.actions'
import SpkDocumentView from './SpkDocumentView'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function SpkDocumentPage({ params }: { params: { id: string } }) {
  const doc = await getSpkDocument(params.id)
  if (!doc) notFound()
  return <SpkDocumentView doc={doc} />
}
