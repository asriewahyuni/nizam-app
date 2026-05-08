import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getConstructionBillingTerms,
  getConstructionBudgetItems,
  getConstructionChangeOrders,
  getConstructionProjectById,
  getConstructionProgressLogs,
  getConstructionProjectStages,
} from '@/modules/construction/actions/construction.actions'
import { ConstructionDetailClient } from './ConstructionDetailClient'

export const metadata = {
  title: 'Detail Project Konstruksi | Nizam ERP',
}

export default async function ConstructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const activeOrgData = await getActiveOrg()
  if (!activeOrgData) redirect('/onboarding')

  const resolvedParams = await params
  const projectId = resolvedParams.id

  const supabase = await createClient()
  const [project, stages, budgetItems, progressLogs, billingTerms, changeOrders, { data: contacts }] = await Promise.all([
    getConstructionProjectById(activeOrgData.org.id, projectId),
    getConstructionProjectStages(activeOrgData.org.id, projectId),
    getConstructionBudgetItems(activeOrgData.org.id, projectId),
    getConstructionProgressLogs(activeOrgData.org.id, projectId),
    getConstructionBillingTerms(activeOrgData.org.id, projectId),
    getConstructionChangeOrders(activeOrgData.org.id, projectId),
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('org_id', activeOrgData.org.id)
      .order('name', { ascending: true }),
  ])

  if (!project) redirect('/construction')

  return (
    <div className="min-h-screen p-4 md:p-8">
      <ConstructionDetailClient
        orgId={activeOrgData.org.id}
        project={project}
        stages={stages}
        budgetItems={budgetItems}
        progressLogs={progressLogs}
        billingTerms={billingTerms}
        changeOrders={changeOrders}
        contacts={(contacts || []).map((contact) => ({
          id: String(contact.id || ''),
          name: String(contact.name || ''),
          type: String(contact.type || ''),
        }))}
      />
    </div>
  )
}
