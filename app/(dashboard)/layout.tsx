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
import { SentryUserContext } from '@/components/shared/SentryUserContext'
import { StartupWizard } from '@/components/shared/StartupWizard'
import { MobileBottomNav } from '@/components/shared/MobileBottomNav'
import { MobilePullToRefresh } from '@/components/shared/MobilePullToRefresh'
import { RouteProgressBar } from '@/components/shared/RouteProgressBar'
import { RouteErrorToast } from '@/components/shared/RouteErrorToast'
import { UserActivityTracker } from '@/components/shared/UserActivityTracker'
import { GlobalApprovalNotifier } from '@/components/shared/GlobalApprovalNotifier'
import { EduModeShell } from '@/components/edu/EduModeShell'
import { hasEnabledModuleAccess, hasPosOnlyAccess } from '@/modules/organization/lib/navigation-access'
import { createClient } from '@/lib/supabase/server'
import { getSaasAssessorContext } from '@/modules/edu/lib/assessment-access.server'
import { resolveRuntimeDatabaseTarget } from '@/lib/db/runtime-target'
import { getOrgModuleInstances } from '@/modules/marketplace/actions/marketplace.actions'

type RouteModuleEntry = {
  path: string
  requiredModule: string
  aliases?: string[]
  permissionKeys?: string[]
}

function moduleNameMatches(enabledModuleRaw: string, candidateRaw: string) {
  return saasModuleMatches(enabledModuleRaw, candidateRaw)
}

function isPosCashierRoute(pathname: string) {
  return pathname === '/pos' || pathname.startsWith('/pos/') || pathname === '/sales/co-sales' || pathname.startsWith('/sales/co-sales/')
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
  const runtimeDb = resolveRuntimeDatabaseTarget()
  const orgSettings =
    orgData.org.settings && typeof orgData.org.settings === 'object' && !Array.isArray(orgData.org.settings)
      ? orgData.org.settings as Record<string, unknown>
      : {}
  const startupWizardEnabled = orgSettings.startup_wizard_enabled !== false
  const [adminImpersonation, activeBranch, allowAllBranchSelection, isDemo, moduleInstances] = await Promise.all([
    getAdminImpersonationState(),
    getActiveBranch(orgData.org.id),
    canAccessAllBranchesForOrg(orgData.org.id),
    isDemoSession(),
    getOrgModuleInstances(orgData.org.id),
  ])
  const effectivePlanName = isDemo ? 'Demo' : (orgData.org.settings?.plan || 'Trial')
  const saasAssessorContext = await getSaasAssessorContext({
    email: orgData.user?.email,
    impersonationEmail: adminImpersonation?.email || null,
  })

  // ── DEMO SESSION EXPIRY ENFORCEMENT ──────────────────────────────────────
  // isDemoSession() returns false when the 12-hour cookie has expired.
  // If the org is a demo org but the cookie is gone, force signout.
  // Sumber kebenaran utama = organizations.is_demo (kolom DB).
  // settings.is_demo hanya fallback legacy (org lama sebelum kolom is_demo ada).
  const isDemoOrg = orgData.org.is_demo === true || orgData.org.settings?.is_demo === true
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
  const isPosOnlyUser = hasPosOnlyAccess(orgData.role, orgData.permissions)

  // ── EMPLOYEE DETECTION + ATTENDANCE GATE ────────────────────────────────
  // isStaffEmployee: bukan owner/admin, punya employee record, tanpa permission → portal-only
  // requiresAttendanceGate: semua employee (termasuk manajer) wajib clock-in dulu
  // hasClockedInToday: sudah clock-in hari ini (Asia/Jakarta) atau belum
  let isStaffEmployee = false
  let requiresAttendanceGate = false
  let hasClockedInToday = false

  if (!isOwnerOrAdmin) {
    const userId = String(orgData.user?.id || '').trim()
    if (userId) {
      const supabaseForEmpCheck = await createClient()
      const { data: empRecord } = await (supabaseForEmpCheck as any)
        .from('employees')
        .select('id')
        .eq('org_id', orgData.org.id)
        .eq('user_id', userId)
        .maybeSingle()

      const hasEmployeeRecord = !!empRecord?.id
      const hasAssignedPermissions = Array.isArray(orgData.permissions) && orgData.permissions.length > 0

      // Portal-only: karyawan tanpa permission ERP
      isStaffEmployee = hasEmployeeRecord && !hasAssignedPermissions

      // Attendance gate: SEMUA employee wajib punya sesi aktif (clock-in tanpa clock-out)
      // Mendukung multi-sesi per hari: ambil record TERBARU hari ini
      if (hasEmployeeRecord) {
        requiresAttendanceGate = true
        const todayJkt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        const { data: todayRows } = await (supabaseForEmpCheck as any)
          .from('attendance')
          .select('check_in, check_out')
          .eq('org_id', orgData.org.id)
          .eq('employee_id', empRecord.id)
          .eq('record_date', todayJkt)
          .order('created_at', { ascending: false })
          .limit(1)
        const latestToday = todayRows?.[0] ?? null
        // Menu aktif HANYA jika ada sesi aktif: sudah clock-in DAN belum clock-out
        hasClockedInToday = !!latestToday?.check_in && !latestToday?.check_out
      }
    }
  }
  const isSaasAssessorRouteAccess =
    requestPathname.startsWith('/lms') &&
    saasAssessorContext.hasAccess

  if (
    isPosOnlyUser &&
    !isPosCashierRoute(requestPathname)
  ) {
    return redirect('/')
  }

  // Map paths to their required module names (matching saas_packages.modules)
  // Each entry can have multiple aliases to support both English & Indonesian module names
  const routeModuleMap: RouteModuleEntry[] = [
    { path: '/marketplace', requiredModule: 'Config', aliases: ['Config'], permissionKeys: ['config', 'business'] },
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
    { path: '/ecommerce', requiredModule: 'Sales', aliases: ['Sales', 'E-Commerce', 'Penjualan'], permissionKeys: ['sales', 'crm', 'inventory'] },
    { path: '/inventory', requiredModule: 'Inventory', aliases: ['Inventory', 'Inventori'], permissionKeys: ['inventory', 'warehouse'] },
    { path: '/factory', requiredModule: 'Manufacturing', aliases: ['Manufacturing', 'Factory'], permissionKeys: ['factory', 'manufacturing'] },
    { path: '/purchasing', requiredModule: 'Purchasing', aliases: ['Purchasing', 'Pembelian'], permissionKeys: ['purchasing', 'purchase'] },
    { path: '/sales/co-sales', requiredModule: 'Mobile Canvassing', aliases: ['Canvassing', 'Mobile Stock', 'Mobile POS'], permissionKeys: ['sales', 'canvassing'] },
    { path: '/sales', requiredModule: 'Sales', aliases: ['Sales', 'Penjualan'], permissionKeys: ['sales', 'quotation'] },
    { path: '/pos', requiredModule: 'POS', aliases: ['POS', 'POS (Kasir)'], permissionKeys: ['pos'] },
    { path: '/po-bus', requiredModule: 'PO Bus & Cargo', aliases: ['PO Bus & Cargo', 'Manajemen Tiket'], permissionKeys: ['po-bus'] },
    { path: '/ticketing', requiredModule: 'Ticketing', aliases: ['Ticketing (Theme Park)'], permissionKeys: ['ticketing'] },
    { path: '/hris', requiredModule: 'HRIS', aliases: ['HRIS', 'Karyawan (HRIS)', 'Attendance', 'Payroll'], permissionKeys: ['hris', 'employee', 'employees', 'attendance', 'payroll'] },
    { path: '/learning', requiredModule: 'HRIS', aliases: ['HRIS', 'Learning', 'Peningkatan Kompetensi'], permissionKeys: ['learning', 'hris', 'employee', 'employees'] },
    { path: '/lms', requiredModule: 'LMS', aliases: ['LMS', 'LMS (E-Learning)', 'Training Center'], permissionKeys: ['learning'] },
    { path: '/reports', requiredModule: 'Reports', aliases: ['Reports', 'Laporan', 'Insight'], permissionKeys: ['reports', 'strategy', 'forecast'] },
    { path: '/services', requiredModule: 'Job Order (Jasa)', aliases: ['Job Order (Jasa)', 'Industrial Job Order', 'Services'], permissionKeys: ['services', 'service', 'job_order'] },
    { path: '/construction', requiredModule: 'Project & Construction', aliases: ['Project & Construction', 'Construction', 'Project Construction', 'Project Konstruksi', 'Job Order (Jasa)'], permissionKeys: ['construction', 'project', 'services', 'job_order'] },
    { path: '/syirkah', requiredModule: 'Syirkah', aliases: ['Syirkah', 'Partnership'], permissionKeys: ['syirkah'] },
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

    if (!isModulePaid && !isSaasAssessorRouteAccess) {
      console.warn(`[ACL] Redirecting - Module not paid: ${requiredModule} (checked aliases: ${allNames.join(', ')}) for path: ${requestPathname}`)
      return redirect('/')
    }

    // 2. RBAC PERMISSION GUARD (Only check if NOT owner/admin)
    if (!isOwnerOrAdmin && !isSaasAssessorRouteAccess && permissionKeys.length > 0) {
      const normalizedPermissions = Array.isArray(orgData.permissions)
        ? orgData.permissions
            .filter((permission): permission is string => typeof permission === 'string')
            .map((permission) => permission.toLowerCase())
        : []
      const hasPermission = normalizedPermissions.some(
        (permission) => permissionKeys.some((permissionKey) => permission.includes(permissionKey.toLowerCase()))
      )
      if (!hasPermission) {
        console.warn(`[ACL] Redirecting - No permission for: ${requiredModule} for path: ${requestPathname}`)
        return redirect('/')
      }
    }
  }

  // Halaman ESS karyawan (clock-in / self-service) — tampil full-screen tanpa sidebar & header
  // HANYA saat karyawan belum clock-in. Setelah clock-in (router.refresh()), hasClockedInToday = true
  // → isEssPage = false → sidebar & header muncul otomatis.
  const isEssPage = (requestPathname === '/karyawan' || requestPathname.startsWith('/karyawan/'))
    && requiresAttendanceGate
    && !hasClockedInToday

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 print:block print:h-auto print:overflow-visible print:bg-white">
      <SentryUserContext
        userId={orgData.user?.id || null}
        email={orgData.user?.email || null}
        fullName={String(orgData.user?.user_metadata?.full_name || orgData.user?.email || '')}
        orgId={orgData.org.id}
        orgName={orgData.org.name}
        branchId={activeBranch?.id || null}
        branchName={activeBranch?.name || null}
        role={orgData.role}
        route={requestPathname}
        feature="dashboard"
      />
      <RouteProgressBar />
      <RouteErrorToast />
      <UserActivityTracker />
      <GlobalApprovalNotifier
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id || null}
      />
      <EduModeShell />
      {/* Sidebar — disembunyikan di halaman ESS karyawan */}
      {!isEssPage && <AppSidebar
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
        pendingModules={(moduleInstances as any[]).filter(i => i.status !== 'READY').map(i => i.module_key)}
        isDemo={isDemo}
        planName={effectivePlanName}
        canManageSubOrganizations={canManageSubOrganizations}
        isSaasAssessor={saasAssessorContext.hasAccess}
        isStaffEmployee={isStaffEmployee}
        requiresAttendanceGate={requiresAttendanceGate}
        hasClockedInToday={hasClockedInToday}
      />}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
        {adminImpersonation && (
          <AdminImpersonationBanner
            adminEmail={adminImpersonation.email}
            orgName={orgData.org.name}
          />
        )}
        {isDemo && <DemoBanner />}
        {/* Header — disembunyikan di halaman ESS karyawan */}
        <div className={isEssPage ? 'hidden' : (isStaffEmployee ? 'hidden md:block' : '')}>
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
          runtimeDatabaseMode={runtimeDb.mode}
          runtimeDatabaseSource={runtimeDb.sourceKey}
          planName={effectivePlanName}
        />
        </div>
        {!isEssPage && !isStaffEmployee && <StartupWizard isDemo={isDemo} enabled={startupWizardEnabled} />}
        {!isEssPage && !isStaffEmployee && <MobilePullToRefresh scrollContainerId="dashboard-scroll-root" />}
        <main
          id="dashboard-scroll-root"
          className={isEssPage
            ? 'flex-1 overflow-y-auto'
            : isStaffEmployee
              ? 'flex-1 overflow-hidden print:overflow-visible'
              : 'flex-1 overflow-y-auto p-6 pb-24 md:pb-6 print:overflow-visible print:p-0 print:pb-0'
          }
        >
          {isEssPage ? children : isStaffEmployee ? children : (
            <div className="max-w-7xl mx-auto print:max-w-none">
              {allowAllBranchSelection && !activeBranch && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-600">Mode Semua Unit</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-700">
                        Ringkasan lintas unit aktif. Pilih satu unit dari header untuk membuat transaksi.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-600">Read-only</span>
                  </div>
                </div>
              )}
              {children}
            </div>
          )}
        </main>
        {!isEssPage && !isStaffEmployee && (
          <MobileBottomNav
            userRole={orgData.role}
            permissions={orgData.permissions}
            enabledModules={orgData.enabledModules}
            requiresAttendanceGate={requiresAttendanceGate}
            hasClockedInToday={hasClockedInToday}
          />
        )}
        {/* FloatingPlanBadge dihapus — plan info sudah ada di AppHeader */}
      </div>
    </div>
  )
}
