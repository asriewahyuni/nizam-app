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

type RouteModuleEntry = {
  path: string
  requiredModule: string
  aliases?: string[]
  permissionKeys?: string[]
}

function normalizeName(value: string) {
  return value.toLowerCase().trim()
}

function moduleNameMatches(enabledModuleRaw: string, candidateRaw: string) {
  const enabled = normalizeName(enabledModuleRaw)
  const candidate = normalizeName(candidateRaw)

  if (enabled === candidate) return true

  // Marketing & Sales family
  if (
    (candidate.includes('sales') || candidate.includes('marketing') || candidate.includes('crm')) &&
    (enabled.includes('sales') || enabled.includes('marketing'))
  ) {
    return true
  }

  // Finance / Accounting family
  if (
    (candidate.includes('finance') || candidate.includes('accounting') || candidate.includes('buku besar') || candidate.includes('akun')) &&
    (enabled.includes('finance') || enabled.includes('accounting') || enabled.includes('buku besar') || enabled.includes('akun'))
  ) {
    return true
  }

  // Manufacturing family
  if (
    (candidate.includes('manufacturing') || candidate.includes('factory')) &&
    (enabled.includes('manufacturing') || enabled.includes('factory'))
  ) {
    return true
  }

  // Inventory / Warehouse family
  if (
    (candidate.includes('inventory') || candidate.includes('inventori') || candidate.includes('warehouse') || candidate.includes('gudang')) &&
    (enabled.includes('inventory') || enabled.includes('inventori') || enabled.includes('warehouse') || enabled.includes('gudang'))
  ) {
    return true
  }

  // Fleet family
  if (candidate.includes('fleet') && enabled.includes('fleet')) {
    return true
  }

  // Service / Job Order family
  if (
    (candidate.includes('job order') || candidate.includes('jasa') || candidate.includes('service')) &&
    (enabled.includes('job order') || enabled.includes('service'))
  ) {
    return true
  }

  // HRIS family (attendance/payroll bundled under HRIS)
  if (
    (candidate.includes('hris') || candidate.includes('attendance') || candidate.includes('payroll') || candidate.includes('employee')) &&
    enabled.includes('hris')
  ) {
    return true
  }

  // Reports/Insight family
  if (
    (candidate.includes('reports') || candidate.includes('laporan') || candidate.includes('insight')) &&
    (enabled.includes('reports') || enabled.includes('insight') || enabled.includes('laporan'))
  ) {
    return true
  }

  // POS family
  if (candidate.includes('pos') && enabled.includes('pos')) {
    return true
  }

  return false
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
  // Each entry can have multiple aliases to support both English & Indonesian module names
  const routeModuleMap: RouteModuleEntry[] = [
    { path: '/sales/pages', requiredModule: 'Sales Page', aliases: ['Sales Page', 'Marketing & Sales', 'Operasional'], permissionKeys: ['sales'] },
    { path: '/inventory/warehouses', requiredModule: 'Warehouse', aliases: ['Warehouse', 'Inventory', 'Inventori', 'Operasional'], permissionKeys: ['inventory', 'warehouse'] },
    {
      path: '/accounting',
      requiredModule: 'Accounting',
      aliases: ['Accounting', 'Finance', 'Akun (CoA)', 'Buku Besar', 'Utama'],
      permissionKeys: ['finance', 'accounting', 'journal', 'bank', 'tax', 'zakat', 'assets', 'budget', 'forecast', 'reimburse', 'aging', 'approval', 'audit', 'closing'],
    },
    { path: '/cash', requiredModule: 'Finance', aliases: ['Finance', 'Accounting', 'Akun (CoA)', 'Buku Besar'], permissionKeys: ['finance', 'bank', 'cash', 'journal'] },
    { path: '/contacts', requiredModule: 'CRM', aliases: ['CRM', 'Marketing & Sales', 'Sales', 'Penjualan'], permissionKeys: ['sales', 'crm', 'contacts', 'customer'] },
    { path: '/inventory', requiredModule: 'Inventory', aliases: ['Inventory', 'Inventori', 'Operasional'], permissionKeys: ['inventory', 'warehouse'] },
    { path: '/factory', requiredModule: 'Manufacturing', aliases: ['Manufacturing', 'Operasional'], permissionKeys: ['factory', 'manufacturing'] },
    { path: '/purchasing', requiredModule: 'Purchasing', aliases: ['Purchasing', 'Pembelian', 'Operasional'], permissionKeys: ['purchasing', 'purchase'] },
    { path: '/sales', requiredModule: 'Sales', aliases: ['Sales', 'Penjualan', 'Marketing & Sales', 'Operasional'], permissionKeys: ['sales', 'quotation'] },
    { path: '/pos', requiredModule: 'POS', aliases: ['POS', 'POS (Kasir)', 'Operasional'], permissionKeys: ['pos', 'sales'] },
    { path: '/fleet', requiredModule: 'Fleet & Rental', aliases: ['Fleet & Rental', 'Fleet Management', 'Operasional'], permissionKeys: ['fleet'] },
    { path: '/hris', requiredModule: 'HRIS', aliases: ['HRIS', 'Karyawan (HRIS)'], permissionKeys: ['hris', 'employee', 'employees', 'attendance', 'payroll'] },
    { path: '/audit', requiredModule: 'Audit', aliases: ['Audit', 'Audit Trail'], permissionKeys: ['audit', 'approval'] },
    { path: '/reports', requiredModule: 'Reports', aliases: ['Reports', 'Laporan', 'Insight'], permissionKeys: ['reports', 'strategy', 'forecast'] },
    { path: '/services', requiredModule: 'Job Order (Jasa)', aliases: ['Job Order (Jasa)', 'Industrial Job Order', 'Services', 'Operasional'], permissionKeys: ['services', 'service', 'job_order'] },
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
      const normalizedPermissions = orgData.permissions.map((p: string) => p.toLowerCase())
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
