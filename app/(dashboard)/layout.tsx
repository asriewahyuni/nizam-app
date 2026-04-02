import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAdminImpersonationState, getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { getPendingApprovalsCount } from '@/modules/organization/actions/approval.actions'
import { getUnpostedJournalsCount } from '@/modules/accounting/actions/journal.actions'
import { getPendingPurchaseRequestsCount } from '@/modules/purchasing/actions/purchasing.actions'
import { getResetRequestsCount } from '@/modules/organization/actions/hris.actions'
import { getCashFlow } from '@/modules/accounting/actions/reports.actions'
import { isDemoSession } from '@/modules/demo/actions/demo.actions'
import { getAiTokenHeaderSummary } from '@/modules/ai/lib/ai-token.server'
import { saasModuleMatches } from '@/lib/saas/module-catalog'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { AppHeader } from '@/components/shared/AppHeader'
import { AdminImpersonationBanner } from '@/components/shared/AdminImpersonationBanner'
import { DemoBanner } from '@/components/shared/DemoBanner'
import { StartupWizard } from '@/components/shared/StartupWizard'
import { FloatingPlanBadge } from '@/components/shared/FloatingPlanBadge'
import { MobileBottomNav } from '@/components/shared/MobileBottomNav'

type RouteModuleEntry = {
  path: string
  requiredModule: string
  aliases?: string[]
  permissionKeys?: string[]
}

function moduleNameMatches(enabledModuleRaw: string, candidateRaw: string) {
  return saasModuleMatches(enabledModuleRaw, candidateRaw)
}

function resolveDashboardDependency<T>(
  label: string,
  result: PromiseSettledResult<T>,
  fallback: T
) {
  if (result.status === 'fulfilled') return result.value

  console.error(`[DashboardLayout] Failed to load ${label}:`, result.reason)
  return fallback
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const adminImpersonation = await getAdminImpersonationState()

  const dependencyResults = await Promise.allSettled([
    getPendingApprovalsCount(orgData.org.id),
    getUnpostedJournalsCount(orgData.org.id),
    getPendingPurchaseRequestsCount(orgData.org.id),
    getResetRequestsCount(orgData.org.id),
    getCashFlow(orgData.org.id),
    getBranches(orgData.org.id),
    isDemoSession(),
    getAiTokenHeaderSummary(orgData.org.id),
  ])
  const pendingApprovals = resolveDashboardDependency('pending approvals', dependencyResults[0], 0)
  const unpostedJournals = resolveDashboardDependency('unposted journals', dependencyResults[1], 0)
  const pendingPurchaseRequests = resolveDashboardDependency('pending purchase requests', dependencyResults[2], 0)
  const resetRequests = resolveDashboardDependency('HR reset requests', dependencyResults[3], 0)
  const cashFlow = resolveDashboardDependency('cash flow summary', dependencyResults[4], null)
  const branches = resolveDashboardDependency('branches', dependencyResults[5], [])
  const isDemo = resolveDashboardDependency('demo session state', dependencyResults[6], false)
  const aiTokens = resolveDashboardDependency('AI token summary', dependencyResults[7], null)

  // ─────────────────────────────────────────────────────────────
  // 3. SAAS MODULE & RBAC GUARD (Protect direct URL access)
  // ─────────────────────────────────────────────────────────────
  const isOwnerOrAdmin = orgData.role === 'owner' || orgData.role === 'admin'
  const pathname = (await headers()).get('x-pathname') || ''

  // Map paths to their required module names (matching saas_packages.modules)
  // Each entry can have multiple aliases to support both English & Indonesian module names
  const routeModuleMap: RouteModuleEntry[] = [
    { path: '/sales/pages', requiredModule: 'Sales Page', aliases: ['Sales Page'], permissionKeys: ['sales'] },
    { path: '/inventory/warehouses', requiredModule: 'Warehouse', aliases: ['Warehouse', 'WMS'], permissionKeys: ['inventory', 'warehouse'] },
    { path: '/accounting/audit', requiredModule: 'Audit', aliases: ['Audit', 'Audit Trail'], permissionKeys: ['audit', 'approval'] },
    { path: '/settings/audit', requiredModule: 'Audit', aliases: ['Audit', 'Audit Trail'], permissionKeys: ['audit', 'approval'] },
    {
      path: '/accounting',
      requiredModule: 'Accounting',
      aliases: ['Accounting', 'Akun (CoA)', 'Buku Besar'],
      permissionKeys: ['finance', 'accounting', 'journal', 'bank', 'tax', 'zakat', 'assets', 'budget', 'forecast', 'reimburse', 'aging', 'approval', 'audit', 'closing', 'coa'],
    },
    { path: '/cash', requiredModule: 'Finance', aliases: ['Finance', 'Kas & Bank'], permissionKeys: ['finance', 'bank', 'cash', 'journal'] },
    { path: '/contacts', requiredModule: 'CRM', aliases: ['CRM', 'Pelanggan (CRM)', 'Marketing'], permissionKeys: ['sales', 'crm', 'contacts', 'customer'] },
    { path: '/inventory', requiredModule: 'Inventory', aliases: ['Inventory', 'Inventori'], permissionKeys: ['inventory', 'warehouse'] },
    { path: '/factory', requiredModule: 'Manufacturing', aliases: ['Manufacturing', 'Factory'], permissionKeys: ['factory', 'manufacturing'] },
    { path: '/purchasing', requiredModule: 'Purchasing', aliases: ['Purchasing', 'Pembelian'], permissionKeys: ['purchasing', 'purchase'] },
    { path: '/sales', requiredModule: 'Sales', aliases: ['Sales', 'Penjualan'], permissionKeys: ['sales', 'quotation'] },
    { path: '/pos', requiredModule: 'POS', aliases: ['POS', 'POS (Kasir)'], permissionKeys: ['pos', 'sales'] },
    { path: '/fleet', requiredModule: 'Fleet & Rental', aliases: ['Fleet & Rental', 'Fleet Management', 'Smart Fleet Management'], permissionKeys: ['fleet'] },
    { path: '/hris', requiredModule: 'HRIS', aliases: ['HRIS', 'Karyawan (HRIS)', 'Attendance', 'Payroll'], permissionKeys: ['hris', 'employee', 'employees', 'attendance', 'payroll'] },
    { path: '/reports', requiredModule: 'Reports', aliases: ['Reports', 'Laporan', 'Insight'], permissionKeys: ['reports', 'strategy', 'forecast'] },
    { path: '/services', requiredModule: 'Job Order (Jasa)', aliases: ['Job Order (Jasa)', 'Industrial Job Order', 'Services'], permissionKeys: ['services', 'service', 'job_order'] },
  ]

  // Identify which module is being accessed
  const accessedEntry = routeModuleMap.find((entry) => pathname.startsWith(entry.path))
  
  if (accessedEntry) {
    const { requiredModule, aliases = [requiredModule], permissionKeys = [] } = accessedEntry
    const allNames = Array.from(new Set([requiredModule, ...aliases])).map(s => s.toLowerCase().trim())
    
    // 1. SAAS MODULE GUARD (Check for EVERYONE, including owner)
    const isModulePaid = !orgData.enabledModules || orgData.enabledModules.length === 0
      ? true  // If no modules are configured, allow access (e.g. during setup)
      : orgData.enabledModules.some((m: string) => allNames.some((candidate) => moduleNameMatches(m, candidate)))

    if (!isModulePaid) {
      console.log(`[ACL] Redirecting - Module not paid: ${requiredModule} (checked aliases: ${allNames.join(', ')}) for path: ${pathname}`)
      return redirect('/dashboard')
    }

    // 2. RBAC PERMISSION GUARD (Only check if NOT owner/admin)
    if (!isOwnerOrAdmin && permissionKeys.length > 0) {
      const normalizedPermissions = Array.isArray(orgData.permissions)
        ? orgData.permissions
            .filter((permission): permission is string => typeof permission === 'string')
            .map((permission) => permission.toLowerCase())
        : []
      const hasPermission = normalizedPermissions.some(
        (permission) => permissionKeys.some((permissionKey) => permission.includes(permissionKey.toLowerCase()))
      )
      if (!hasPermission) {
        console.log(`[ACL] Redirecting - No permission for: ${requiredModule} for path: ${pathname}`)
        return redirect('/dashboard')
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 print:block print:h-auto print:overflow-visible print:bg-white">
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
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
        {adminImpersonation && (
          <AdminImpersonationBanner
            adminEmail={adminImpersonation.email}
            orgName={orgData.org.name}
          />
        )}
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
        <main className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 print:overflow-visible print:p-0 print:pb-0">
          <div className="max-w-7xl mx-auto print:max-w-none">
            {children}
          </div>
        </main>
        <MobileBottomNav />
        <FloatingPlanBadge planName={orgData.org.settings?.plan} />
      </div>
    </div>
  )
}
