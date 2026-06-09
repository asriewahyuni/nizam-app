import { notFound } from 'next/navigation'
import { getBastDocument } from '@/modules/saas/actions/bast.actions'
import BastDocumentView from './BastDocumentView'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function BastDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const doc = await getBastDocument(id)
  if (!doc) notFound()
  return <BastDocumentView doc={doc} />
}
