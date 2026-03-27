import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { getPendingApprovalsCount } from '@/modules/organization/actions/approval.actions'
import { getUnpostedJournalsCount } from '@/modules/accounting/actions/journal.actions'
import { getPendingPurchaseRequestsCount } from '@/modules/purchasing/actions/purchasing.actions'
import { getResetRequestsCount } from '@/modules/organization/actions/hris.actions'
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

  const [pendingApprovals, unpostedJournals, pendingPurchaseRequests, resetRequests, cashFlow, branches, isDemo] = await Promise.all([
    getPendingApprovalsCount(orgData.org.id),
    getUnpostedJournalsCount(orgData.org.id),
    getPendingPurchaseRequestsCount(orgData.org.id),
    getResetRequestsCount(orgData.org.id),
    getCashFlow(orgData.org.id),
    getBranches(orgData.org.id),
    isDemoSession()
  ])

  // ─────────────────────────────────────────────────────────────
  // 3. RBAC PATH GUARD (Protect direct URL access)
  // ─────────────────────────────────────────────────────────────
  const isOwnerOrAdmin = orgData.role === 'owner' || orgData.role === 'admin'
  const pathname = (await headers()).get('x-pathname') || ''

  // Only guard if NOT owner/admin
  if (!isOwnerOrAdmin) {
    // Map paths to their required permission keys
    const routePermissionMap: Record<string, string> = {
      '/accounting': 'accounting',
      '/finance': 'finance',
      '/inventory': 'inventory',
      '/factory': 'factory',
      '/purchasing': 'purchasing',
      '/sales': 'sales',
      '/pos': 'pos',
      '/fleet': 'fleet',
      '/hris': 'hris',
      '/audit': 'audit',
      '/reports': 'reports',
      '/settings': 'config'
    }

    // Identify which module is being accessed
    const accessedModule = Object.keys(routePermissionMap).find(path => pathname.startsWith(path))
    
    if (accessedModule) {
      const requiredKey = routePermissionMap[accessedModule]
      const hasPermission = orgData.permissions.some(p => p.toLowerCase().includes(requiredKey.toLowerCase()))

      if (!hasPermission) {
        // Forbidden access! Redirect back home.
        return redirect('/dashboard')
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <AppSidebar 
        userRole={orgData.role} 
        jobTitle={orgData.jobTitle}
        user={{
          fullName: orgData.user?.user_metadata?.full_name || orgData.user?.email,
          email: orgData.user?.email || ''
        }}
        permissions={orgData.permissions}
        pendingApprovals={pendingApprovals} 
        unpostedJournals={unpostedJournals} 
        pendingPurchaseRequests={pendingPurchaseRequests}
        hrisNotifications={resetRequests}
        isDemo={isDemo}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader
          user={{
            fullName: orgData.user?.user_metadata?.full_name || orgData.user?.email,
            email: orgData.user?.email || ''
          }}
          jobTitle={orgData.jobTitle}
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
