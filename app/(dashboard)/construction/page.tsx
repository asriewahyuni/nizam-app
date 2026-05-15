import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import {
  getConstructionDashboard,
  getConstructionProjects,
} from '@/modules/construction/actions/construction.actions'
import { ConstructionClient } from './ConstructionClient'

export const revalidate = 0

export default async function ConstructionPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'Project & Construction')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/construction/onboarding')
  }

  const supabase = await createClient()
  const [projects, dashboard, { data: contacts }] = await Promise.all([
    getConstructionProjects(orgData.org.id),
    getConstructionDashboard(orgData.org.id),
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('org_id', orgData.org.id)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="min-h-screen p-4 md:p-8">
      <ConstructionClient
        orgId={orgData.org.id}
        projects={projects}
        dashboard={dashboard}
        contacts={(contacts || []).map((contact) => ({
          id: String(contact.id || ''),
          name: String(contact.name || ''),
          type: String(contact.type || ''),
        }))}
      />
    </div>
  )
}

