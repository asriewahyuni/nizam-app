import { notFound } from 'next/navigation'
import { getUatTemplate } from '@/modules/saas/actions/uat.actions'
import UatTemplateClient from './UatTemplateClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function UatTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getUatTemplate(id)
  if (!data) notFound()
  return <UatTemplateClient template={data.template} items={data.items} />
}
