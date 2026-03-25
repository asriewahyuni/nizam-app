import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { getPendingApprovalsCount } from '@/modules/organization/actions/approval.actions'
import { getUnpostedJournalsCount } from '@/modules/accounting/actions/journal.actions'
import { getCashFlow } from '@/modules/accounting/actions/reports.actions'
import { isDemoSession } from '@/modules/demo/actions/demo.actions'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { AppHeader } from '@/components/shared/AppHeader'
import { DemoBanner } from '@/components/shared/DemoBanner'
import { StartupWizard } from '@/components/shared/StartupWizard'
import { MobileBottomNav } from '@/components/shared/MobileBottomNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const [pendingApprovals, unpostedJournals, cashFlow, branches, isDemo] = await Promise.all([
    getPendingApprovalsCount(orgData.org.id),
    getUnpostedJournalsCount(orgData.org.id),
    getCashFlow(orgData.org.id),
    getBranches(orgData.org.id),
    isDemoSession()
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <AppSidebar 
        userRole={orgData.role} 
        pendingApprovals={pendingApprovals} 
        unpostedJournals={unpostedJournals} 
        isDemo={isDemo}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader
          user={session}
          org={orgData.org}
          branches={branches || []}
          pendingApprovals={pendingApprovals}
          cashFlow={cashFlow}
        />
        {isDemo && <DemoBanner />}
        <StartupWizard isDemo={isDemo} />
        <main className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
