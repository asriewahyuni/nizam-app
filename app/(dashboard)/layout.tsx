import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { unstable_noStore as noStore } from 'next/cache'
import { getAdminImpersonationState } from '@/modules/auth/actions/auth.actions'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { canAccessAllBranchesForOrg } from '@/modules/organization/lib/branch-access.server'
import { isDemoSession } from '@/modules/demo/actions/demo.actions'
import { saasModuleMatches } from '@/lib/saas/module-catalog'
import { AppSidebar } from '@/components/shared/AppSidebar'
import { AppHeader } from '@/components/shared/AppHeader'
import { AdminImpersonationBanner } from '@/components/shared/AdminImpersonationBanner'
import { DemoBanner } from '@/components/shared/DemoBanner'
import { StartupWizard } from '@/components/shared/StartupWizard'
import { FloatingPlanBadge } from '@/components/shared/FloatingPlanBadge'
import { MobileBottomNav } from '@/components/shared/MobileBottomNav'
import { MobilePullToRefresh } from '@/components/shared/MobilePullToRefresh'
import { RouteProgressBar } from '@/components/shared/RouteProgressBar'

type RouteModuleEntry = {
  path: string
  requiredModule: string
  aliases?: string[]
  permissionKeys?: string[]
}

function moduleNameMatches(enabledModuleRaw: string, candidateRaw: string) {
  return saasModuleMatches(enabledModuleRaw, candidateRaw)
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  noStore()
  const requestPathname = (await headers()).get('x-pathname') || ''
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')
  const [adminImpersonation, activeBranch, allowAllBranchSelection, isDemo] = await Promise.all([
    getAdminImpersonationState(),
    getActiveBranch(orgData.org.id),
    canAccessAllBranchesForOrg(orgData.org.id),
    isDemoSession(),
  ])
  const effectivePlanName = isDemo ? 'Demo' : (orgData.org.settings?.plan || 'Trial')

  // ── DEMO SESSION EXPIRY ENFORCEMENT ──────────────────────────────────────
  // isDemoSession() returns false when the 12-hour cookie has expired.
  // If the org is a demo org but the cookie is gone, force signout.
  const isDemoOrg = orgData.org.settings?.is_demo === true || orgData.org.is_demo === true
  if (isDemoOrg && !isDemo && !adminImpersonation) {
    redirect('/auth/signout')
  }

  // ── SUBSCRIPTION EXPIRY ENFORCEMENT ──────────────────────────────────────
  // Admins doing impersonation are always allowed through.
  // Demo sessions are also excluded (their plan is time-unlimited).
  if (orgData.isSubscriptionExpired && !isDemo && !adminImpersonation) {
    redirect('/expired')
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SAAS MODULE & RBAC GUARD (Protect direct URL access)
  // ─────────────────────────────────────────────────────────────
  const isOwnerOrAdmin = orgData.role === 'owner' || orgData.role === 'admin'
  const canManageSubOrganizations = isOwnerOrAdmin

  // Map paths to their required module names (matching saas_packages.modules)
  // Each entry can have multiple aliases to support both English & Indonesian module names
  const routeModuleMap: RouteModuleEntry[] = [
    { path: '/sales/pages', requiredModule: 'Sales Page', aliases: ['Sales Page'], permissionKeys: ['sales'] },
    { path: '/inventory/warehouses', requiredModule: 'Warehouse', aliases: ['Warehouse', 'WMS'], permissionKeys: ['inventory', 'warehouse'] },
    { path: '/accounting/audit', requiredModule: 'Audit', aliases: ['Audit', 'Audit Trail'], permissionKeys: ['audit', 'approval'] },
    { path: '/settings/audit', requiredModule: 'Audit', aliases: ['Audit', 'Audit Trail'], permissionKeys: ['audit', 'approval'] },
    { path: '/settings/ticketing', requiredModule: 'Config', aliases: ['Config', 'Ticketing', 'Support Ticket', 'Doc Update Ticketing', 'Dokumen Update Support Ticket'], permissionKeys: ['business', 'support', 'ticketing'] },
    { path: '/settings/roles', requiredModule: 'HRIS', aliases: ['HRIS', 'Akses & Jabatan'], permissionKeys: ['business'] },
    { path: '/settings/branches', requiredModule: 'Config', aliases: ['Config', 'Cabang & Divisi'], permissionKeys: ['branch'] },
    { path: '/developers/api', requiredModule: 'Integrasi API', aliases: ['Integrasi API', 'API & Integrasi', 'Developers', 'Open API'], permissionKeys: ['business'] },
    { path: '/settings/api', requiredModule: 'Integrasi API', aliases: ['Integrasi API', 'API & Integrasi', 'Developers', 'Open API'], permissionKeys: ['business'] },
    { path: '/settings/business', requiredModule: 'Config', aliases: ['Config', 'Pengaturan Bisnis'], permissionKeys: ['business'] },
    { path: '/settings/accounts', requiredModule: 'Finance', aliases: ['Finance', 'Akun (CoA)'], permissionKeys: ['coa'] },
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
    { path: '/syirkah', requiredModule: 'Syirkah', aliases: ['Syirkah', 'Partnership'] },
  ]

  // Identify which module is being accessed
  const accessedEntry = routeModuleMap.find((entry) => requestPathname.startsWith(entry.path))
  
  if (accessedEntry) {
    const { requiredModule, aliases = [requiredModule], permissionKeys = [] } = accessedEntry
    const allNames = Array.from(new Set([requiredModule, ...aliases])).map(s => s.toLowerCase().trim())
    
    // 1. SAAS MODULE GUARD (Check for EVERYONE, including owner)
    const isModulePaid = !orgData.enabledModules || orgData.enabledModules.length === 0
      ? true  // If no modules are configured, allow access (e.g. during setup)
      : orgData.enabledModules.some((m: string) => allNames.some((candidate) => moduleNameMatches(m, candidate)))

    if (!isModulePaid) {
      console.log(`[ACL] Redirecting - Module not paid: ${requiredModule} (checked aliases: ${allNames.join(', ')}) for path: ${requestPathname}`)
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
        console.log(`[ACL] Redirecting - No permission for: ${requiredModule} for path: ${requestPathname}`)
        return redirect('/dashboard')
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 print:block print:h-auto print:overflow-visible print:bg-white">
      <RouteProgressBar />
      {/* Sidebar */}
      <AppSidebar 
        key={`sidebar:${orgData.org.id}:${activeBranch?.id || 'all'}`}
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id || null}
        userRole={orgData.role} 
        jobTitle={orgData.jobTitle}
        user={{
          fullName: orgData.user?.user_metadata?.full_name || orgData.user?.email,
          email: orgData.user?.email || ''
        }}
        permissions={orgData.permissions}
        enabledModules={orgData.enabledModules}
        isDemo={isDemo}
        planName={effectivePlanName}
        canManageSubOrganizations={canManageSubOrganizations}
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
          key={`header:${orgData.org.id}:${activeBranch?.id || 'all'}`}
          user={{
            fullName: orgData.user?.user_metadata?.full_name || orgData.user?.email,
            email: orgData.user?.email || ''
          }}
          jobTitle={orgData.jobTitle}
          org={orgData.org}
          activeOrgId={orgData.org.id}
          activeBranchId={activeBranch?.id || null}
          activeBranch={activeBranch}
          activeOrgRole={orgData.role}
          activeOrgParentId={(orgData.org as { parent_org_id?: string | null }).parent_org_id ?? null}
          allowAllBranchSelection={allowAllBranchSelection}
          canManageBranches={isOwnerOrAdmin}
        />
        <StartupWizard isDemo={isDemo} />
        <MobilePullToRefresh scrollContainerId="dashboard-scroll-root" />
        <main id="dashboard-scroll-root" className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 print:overflow-visible print:p-0 print:pb-0">
          <div className="max-w-7xl mx-auto print:max-w-none">
            {allowAllBranchSelection && !activeBranch && (
              <div className="mb-6 rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Mode Semua Unit</div>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      Ringkasan lintas unit sedang aktif. Pilih satu unit dari header untuk membuat transaksi baru.
                    </p>
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                    Read-only agregat
                  </div>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
        <MobileBottomNav />
        <FloatingPlanBadge planName={effectivePlanName} />
      </div>
    </div>
  )
}
