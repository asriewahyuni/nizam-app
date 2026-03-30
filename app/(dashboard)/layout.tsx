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
import { getAiTokenHeaderSummary } from '@/modules/ai/lib/ai-token.server'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { AppHeader } from '@/components/shared/AppHeader'
import { DemoBanner } from '@/components/shared/DemoBanner'
import { StartupWizard } from '@/components/shared/StartupWizard'
import { FloatingPlanBadge } from '@/components/shared/FloatingPlanBadge'
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

  const [pendingApprovals, unpostedJournals, pendingPurchaseRequests, resetRequests, cashFlow, branches, isDemo, aiTokens] = await Promise.all([
    getPendingApprovalsCount(orgData.org.id),
    getUnpostedJournalsCount(orgData.org.id),
    getPendingPurchaseRequestsCount(orgData.org.id),
    getResetRequestsCount(orgData.org.id),
    getCashFlow(orgData.org.id),
    getBranches(orgData.org.id),
    isDemoSession(),
    getAiTokenHeaderSummary(orgData.org.id),
  ])

  // ─────────────────────────────────────────────────────────────
  // 3. SAAS MODULE & RBAC GUARD (Protect direct URL access)
  // ─────────────────────────────────────────────────────────────
  const isOwnerOrAdmin = orgData.role === 'owner' || orgData.role === 'admin'
  const pathname = (await headers()).get('x-pathname') || ''

  // Map paths to their required module names (matching saas_packages.modules)
  const routeModuleMap: Array<{ path: string; requiredModule: string; permissionKey?: string }> = [
    { path: '/sales/pages', requiredModule: 'Sales Page', permissionKey: 'sales' },
    { path: '/accounting', requiredModule: 'Accounting' },
    { path: '/finance', requiredModule: 'Finance' },
    { path: '/inventory', requiredModule: 'Inventory' },
    { path: '/factory', requiredModule: 'Manufacturing' },
    { path: '/purchasing', requiredModule: 'Purchasing' },
    { path: '/sales', requiredModule: 'Sales', permissionKey: 'sales' },
    { path: '/pos', requiredModule: 'POS', permissionKey: 'pos' },
    { path: '/fleet', requiredModule: 'Fleet & Rental', permissionKey: 'fleet' },
    { path: '/hris', requiredModule: 'HRIS', permissionKey: 'hris' },
    { path: '/audit', requiredModule: 'Audit' },
    { path: '/reports', requiredModule: 'Reports', permissionKey: 'reports' },
    { path: '/marketing', requiredModule: 'Marketing' },
    { path: '/crm', requiredModule: 'CRM', permissionKey: 'sales' },
    { path: '/warehouse', requiredModule: 'Warehouse', permissionKey: 'inventory' },
    { path: '/consolidation', requiredModule: 'Consolidation' },
    { path: '/services', requiredModule: 'Job Order (Jasa)', permissionKey: 'services' },
  ]

  // Identify which module is being accessed
  const accessedEntry = routeModuleMap.find((entry) => pathname.startsWith(entry.path))
  
  if (accessedEntry) {
    const { requiredModule, permissionKey = requiredModule } = accessedEntry
    
    // 1. SAAS MODULE GUARD (Check for EVERYONE, including owner)
    const isModulePaid = orgData.enabledModules?.some(
      (m: string) => m.toLowerCase().trim() === requiredModule.toLowerCase().trim()
    )

    if (!isModulePaid) {
      console.log(`[ACL] Redirecting - Module not paid: ${requiredModule} for path: ${pathname}`)
      return redirect('/dashboard')
    }

    // 2. RBAC PERMISSION GUARD (Only check if NOT owner/admin)
    if (!isOwnerOrAdmin) {
      const hasPermission = orgData.permissions.some(
        (p: string) => p.toLowerCase().includes(permissionKey.toLowerCase())
      )
      if (!hasPermission) {
        console.log(`[ACL] Redirecting - No permission for: ${requiredModule} for path: ${pathname}`)
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
        enabledModules={orgData.enabledModules}
        pendingApprovals={pendingApprovals} 
        unpostedJournals={unpostedJournals} 
        pendingPurchaseRequests={pendingPurchaseRequests}
        hrisNotifications={resetRequests}
        isDemo={isDemo}
        planName={orgData.org.settings?.plan}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isDemo && <DemoBanner />}
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
          aiTokens={aiTokens}
        />
        <StartupWizard isDemo={isDemo} />
        <main className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <MobileBottomNav />
        <FloatingPlanBadge planName={orgData.org.settings?.plan} />
      </div>
    </div>
  )
}
