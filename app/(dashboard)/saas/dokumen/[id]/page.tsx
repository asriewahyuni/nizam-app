import { notFound } from 'next/navigation'
import SaasDocumentView from '@/app/(dashboard)/saas/dokumen/[id]/SaasDocumentView'
import { getOperatorInvoiceDocument } from '@/modules/saas/actions/operator-sales.actions'

export default async function SaasDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const snapshot = await getOperatorInvoiceDocument(id)

  if (!snapshot) {
    notFound()
  }

  return <SaasDocumentView snapshot={snapshot} />
}
