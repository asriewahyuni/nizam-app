import { getUatSessions, getUatTemplates } from '@/modules/saas/actions/uat.actions'
import UatListClient from './UatListClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function UatListPage() {
  const [sessions, templates] = await Promise.all([
    getUatSessions(),
    getUatTemplates(),
  ])
  return <UatListClient sessions={sessions} templates={templates} />
}
