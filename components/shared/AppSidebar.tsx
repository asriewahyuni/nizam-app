'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { approvalSignalMatchesScope, subscribeApprovalSignal } from '@/lib/browser/approval-notifier'
import { scheduleIdleTask } from '@/lib/browser/idle'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { saasModuleCoversCapability, normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { PILLAR_MODULES } from '@/modules/marketplace/lib/module-registry'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Wallet,
  TrendingUp,
  ShoppingCart,
  Package,
  BarChart3,
  ChevronRight,
  ShieldCheck,
  Warehouse,
  Landmark,
  Settings,
  LogOut,
  Users,
  ChevronLeft,
  Target,
  History,
  FileText,
  PieChart,
  Activity,
  Factory,
  Truck,
  Briefcase,
  MapPin,
  Lock,
  LineChart,
  Zap,
  Store,
  Clock,
  Megaphone,
  LifeBuoy,
  Upload,
  Building2,
  Code2,
  Wrench,
  GraduationCap,
  Fingerprint,
  ClipboardCheck,
  Rocket,
  MessageSquare,
  Bus,
  HandHeart,
  type LucideIcon
} from 'lucide-react'
import { signOut } from '@/modules/auth/actions/auth.actions'
import { signOutDemo } from '@/modules/demo/actions/demo.actions'
import { getSidebarChromeMetrics } from '@/modules/organization/actions/dashboard-shell.actions'
import { MiniErpWordmark } from '@/components/shared/MiniErpWordmark'

interface NavGroup {
  group: string
  items: {
    label: string
    href: string
    icon: LucideIcon
    phase?: string
    permission_key?: string
    module_key?: string
    saas_assessor_only?: boolean
    admin_only?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission_key: 'dashboard' },
      { label: 'Panduan Memulai', href: '/quick-start', icon: Rocket, permission_key: 'dashboard' },
      { label: 'Modul Marketplace', href: '/marketplace', icon: Store, permission_key: 'config', admin_only: true },
      { label: 'Approval Center', href: '/accounting/approvals', icon: ClipboardCheck, permission_key: 'approval', module_key: 'Accounting' },
      { label: 'Audit Integritas', href: '/accounting/audit', icon: ShieldCheck, permission_key: 'audit', module_key: 'Audit' },
      { label: 'Pengaturan', href: '/settings/business', icon: Settings, permission_key: 'config', admin_only: true },
    ]
  },
  {
    group: 'Finance',
    items: [
      { label: 'Akun (CoA)', href: '/settings/accounts', icon: Layers, permission_key: 'coa', module_key: 'Finance' },
      { label: 'Kas & Bank', href: '/cash', icon: Wallet, permission_key: 'bank', module_key: 'Finance' },
      { label: 'Buku Besar', href: '/accounting/journal', icon: BookOpen, permission_key: 'journal', module_key: 'Accounting' },
      { label: 'Aging (AR/AP)', href: '/accounting/aging', icon: History, permission_key: 'aging', module_key: 'Finance' },
      { label: 'Manajemen Zakat', href: '/accounting/zakat', icon: Zap, permission_key: 'zakat', module_key: 'Accounting' },
      { label: 'Manajemen Pajak', href: '/accounting/tax', icon: ShieldCheck, permission_key: 'tax', module_key: 'Accounting' },
      { label: 'Reimbursement', href: '/accounting/reimburse', icon: FileText, permission_key: 'reimburse', module_key: 'Finance' },
      { label: 'Penutupan Buku', href: '/accounting/closing', icon: Lock, permission_key: 'closing', module_key: 'Accounting' },
      { label: 'Aset Tetap', href: '/accounting/assets', icon: Landmark, permission_key: 'assets', module_key: 'Finance' },
      { label: 'Anggaran', href: '/accounting/budgets', icon: Target, permission_key: 'budget', module_key: 'Accounting' },
    ]
  },
  {
    group: 'Operasional',
    items: [
      { label: 'Pembelian', href: '/purchasing', icon: ShoppingCart, permission_key: 'purchasing', module_key: 'Purchasing' },
      { label: 'Inventori', href: '/inventory', icon: Package, permission_key: 'inventory', module_key: 'Inventory' },
      { label: 'Gudang (WMS)', href: '/inventory/warehouses', icon: Warehouse, permission_key: 'inventory', module_key: 'Warehouse' },
      { label: 'Manufaktur (BoM)', href: '/factory', icon: Factory, permission_key: 'factory', module_key: 'Manufacturing' },
      { label: 'Fleet & Rental', href: '/fleet', icon: Truck, permission_key: 'fleet', module_key: 'Fleet & Rental' },
      { label: 'PO Bus', href: '/po-bus', icon: Bus, permission_key: 'po_bus', module_key: 'PO Bus' },
      { label: 'Kojasmat', href: '/kojasmat', icon: HandHeart, permission_key: 'kojasmat', module_key: 'Kojasmat' },
      { label: 'Job Order (Jasa)', href: '/services', icon: Briefcase, permission_key: 'services', module_key: 'Job Order (Jasa)' },
      { label: 'Bengkel Motor', href: '/workshop', icon: Wrench, permission_key: 'workshop', module_key: 'Workshop' },
      { label: 'Project Konstruksi', href: '/construction', icon: Building2, permission_key: 'construction,project,services', module_key: 'Project & Construction' },
      { label: 'LMS (Pelatihan Komersial)', href: '/lms', icon: GraduationCap, permission_key: 'learning', module_key: 'LMS' },
      { label: 'Panel Penilai', href: '/lms/assessment-center', icon: ShieldCheck, permission_key: 'learning:write', module_key: 'LMS', saas_assessor_only: true },
    ]
  },
  {
    group: 'Marketing & Sales',
    items: [
      { label: 'Pelanggan (CRM)', href: '/contacts', icon: Users, permission_key: 'crm', module_key: 'CRM' },
      { label: 'Keluhan & Permintaan', href: '/crm/tickets', icon: MessageSquare, permission_key: 'crm', module_key: 'CRM' },
      { label: 'POS (Kasir)', href: '/pos', icon: Store, permission_key: 'pos', module_key: 'POS' },
      { label: 'Penawaran (Quotation)', href: '/sales/quotations', icon: FileText, permission_key: 'quotation', module_key: 'Sales' },
      { label: 'Penjualan', href: '/sales', icon: TrendingUp, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Canvassing (Co-Sales)', href: '/sales/co-sales', icon: Truck, permission_key: 'canvassing', module_key: 'Mobile Canvassing' },
      { label: 'Sales Pipeline', href: '/sales/pipeline', icon: Activity, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Target & Komisi', href: '/sales/commission', icon: Target, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Promo & Reward', href: '/sales/promos', icon: Zap, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Sales Page', href: '/sales/pages', icon: Megaphone, permission_key: 'sales', module_key: 'Sales Page' },
      { label: 'E-Commerce', href: '/ecommerce', icon: ShoppingCart, permission_key: 'sales', module_key: 'Sales' },
    ]
  },
  {
    group: 'HRIS',
    items: [
      { label: 'Karyawan (HRIS)', href: '/hris', icon: Users, permission_key: 'employees', module_key: 'HRIS' },
      { label: 'Portal Karyawan', href: '/karyawan', icon: Fingerprint, permission_key: 'employees', module_key: 'HRIS' },
      { label: 'Absensi & Cuti', href: '/hris?tab=attendance', icon: Clock, permission_key: 'attendance', module_key: 'Attendance' },
      { label: 'Payroll Components', href: '/hris?tab=payroll', icon: FileText, permission_key: 'payroll', module_key: 'Payroll' },
      { label: 'Proses Penggajian', href: '/hris?tab=runs', icon: Wallet, permission_key: 'payroll', module_key: 'Payroll' },
      { label: 'Peningkatan Kompetensi', href: '/learning', icon: BookOpen, permission_key: 'employees', module_key: 'HRIS' },
      { label: 'Akses & Jabatan', href: '/settings/roles', icon: ShieldCheck, permission_key: 'business', module_key: 'HRIS' },
    ]
  },
  {
    group: 'Insight',
    items: [
      { label: 'Laporan', href: '/reports', icon: BarChart3, permission_key: 'reports', module_key: 'Reports' },
      { label: 'Nizametrics', href: '/reports/nizametrics', icon: PieChart, permission_key: 'strategy', module_key: 'Reports' },
      { label: 'Proyeksi Kas', href: '/accounting/forecast', icon: LineChart, permission_key: 'forecast', module_key: 'Finance' },
    ]
  },
  {
    group: 'Syirkah',
    items: [
      { label: 'Akad Syirkah', href: '/syirkah', icon: Briefcase, permission_key: 'syirkah', module_key: 'Syirkah' },
    ]
  },
  {
    group: 'Config',
    items: [
      { label: 'Audit Trail', href: '/settings/audit', icon: ShieldCheck, permission_key: 'audit_trail', module_key: 'Audit' },
      { label: 'Anak Perusahaan', href: '/settings/sub-orgs', icon: Layers, permission_key: 'business', module_key: 'Consolidation' },
      { label: 'Cabang', href: '/settings/branches', icon: MapPin, permission_key: 'branch' },
      { label: 'Pengaturan Bisnis', href: '/settings/business', icon: Settings, permission_key: 'business', module_key: 'Config' },
      { label: 'API & Integrasi', href: '/developers/api', icon: Code2, permission_key: 'business', module_key: 'Integrasi API' },
      { label: 'Migrasi Data', href: '/settings/business/migration', icon: Upload, permission_key: 'business', module_key: 'Config' },
      { label: 'Support Ticket', href: '/settings/ticketing', icon: LifeBuoy, permission_key: 'business', module_key: 'Config' },
    ]
  }
]

// Module keys yang termasuk Core ERP — dipakai untuk badge CORE di sidebar
const CORE_MODULE_KEYS = new Set([
  'Accounting', 'Finance', 'Inventory', 'Purchasing', 'Sales', 'POS', 'CRM', 'HRIS', 'Payroll', 'Attendance', 'Syirkah',
])

const SAAS_OPERATOR_GROUP: NavGroup = {
  group: 'SaaS Operator',
  items: [
    { label: 'Penawaran SaaS', href: '/saas/penawaran', icon: FileText, permission_key: 'sales' },
    { label: 'Penjualan SaaS', href: '/saas/penjualan', icon: TrendingUp, permission_key: 'sales' },
    { label: 'SPK', href: '/saas/spk', icon: ClipboardCheck, permission_key: 'sales' },
    { label: 'UAT', href: '/saas/uat', icon: Rocket, permission_key: 'sales' },
    { label: 'BAST', href: '/saas/bast', icon: HandHeart, permission_key: 'sales' },
    { label: 'Support Ticket SaaS', href: '/saas/ticketing', icon: LifeBuoy, permission_key: 'sales' },
    { label: 'Pengaturan', href: '/saas/pengaturan', icon: Settings, permission_key: 'config:write' },
  ],
}

const SIDEBAR_COLLAPSED_KEY = 'nizam_sidebar_collapsed'
const SIDEBAR_STATE_EVENT = 'nizam_sidebar_state_change'
const SIDEBAR_TOGGLE_EVENT = 'nizam_sidebar_toggle'
const ROUTE_LOADING_START_EVENT = 'nizam_route_loading_start'
const SIDEBAR_NAV_SKELETON_GROUPS = [3, 4, 3, 4] as const

function getSidebarCollapsedSnapshot() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
}

function subscribeSidebarCollapsed(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_KEY) {
      onStoreChange()
    }
  }

  const handleStateChange = () => {
    onStoreChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(SIDEBAR_STATE_EVENT, handleStateChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(SIDEBAR_STATE_EVENT, handleStateChange)
  }
}

function getHydratedSnapshot() {
  return true
}

function getServerHydratedSnapshot() {
  return false
}

function subscribeHydration(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  const timeoutId = window.setTimeout(onStoreChange, 0)
  return () => window.clearTimeout(timeoutId)
}

function isSidebarItemActive(pathname: string, fullPath: string, href: string, hasTabQuery: boolean) {
  if (href === '/dashboard') {
    return pathname === '/dashboard'
  }

  if (href.includes('?')) {
    return fullPath === href
  }

  if (href === '/settings/business') {
    return pathname === href
  }

  return pathname.startsWith(href) && (!href.startsWith('/hris') || !hasTabQuery)
}

function notifyRouteLoadingStart() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ROUTE_LOADING_START_EVENT))
}

interface AppSidebarProps {
  orgId: string
  activeBranchId?: string | null
  userRole: string
  jobTitle?: string
  user?: { fullName?: string; email: string }
  permissions?: string[]
  enabledModules?: string[]
  pendingModules?: string[]  // modul yang aktif tapi belum selesai onboarding
  pendingApprovals?: number
  unpostedJournals?: number
  pendingPurchaseRequests?: number
  hrisNotifications?: number
  pendingCoaRequests?: number
  newCrmTickets?: number
  isDemo?: boolean
  planName?: string
  canManageSubOrganizations?: boolean
  isSaasAssessor?: boolean
  isStaffEmployee?: boolean
  requiresAttendanceGate?: boolean
  hasClockedInToday?: boolean
}

export function AppSidebar({
  orgId,
  activeBranchId = null,
  userRole,
  jobTitle,
  user,
  permissions = [],
  enabledModules = [],
  pendingModules = [],
  pendingApprovals = 0,
  unpostedJournals = 0,
  pendingPurchaseRequests = 0,
  hrisNotifications = 0,
  pendingCoaRequests = 0,
  newCrmTickets = 0,
  isDemo = false,
  planName = 'Trial',
  canManageSubOrganizations = true,
  isSaasAssessor = false,
  isStaffEmployee = false,
  requiresAttendanceGate = false,
  hasClockedInToday = false,
}: AppSidebarProps) {
  const router = useRouter()
  const [isSigningOut, startSignOutTransition] = useTransition()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabQuery = searchParams?.get('tab')
  const fullPath = pathname + (tabQuery ? `?tab=${tabQuery}` : '')
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [attendanceToast, setAttendanceToast] = useState(false)
  const [badgeMetrics, setBadgeMetrics] = useState(() => ({
    pendingApprovals,
    unpostedJournals,
    pendingPurchaseRequests,
    hrisNotifications,
    pendingCoaRequests,
    newCrmTickets,
  }))

  // Route yang bebas diakses meskipun belum clock-in
  const ATTENDANCE_FREE_ROUTES = ['/karyawan', '/profil-saya', '/billing']
  const isAttendanceFree = (href: string) =>
    ATTENDANCE_FREE_ROUTES.some((r) => href === r || href.startsWith(r + '/') || href.startsWith(r + '?'))

  // Gate check: apakah item ini terkunci karena belum presensi?
  const isLockedByAttendance = (href: string) =>
    requiresAttendanceGate && !hasClockedInToday && !isAttendanceFree(href)

  // Gate check: pillar module yang belum diaktifasi dari Marketplace
  const isLockedByActivation = (item: NavGroup['items'][number]) => {
    if (!item.module_key || isDemo || enabledModules.length === 0) return false
    const isPillar = PILLAR_MODULES.some(p => p.key.toLowerCase() === item.module_key!.toLowerCase())
    if (!isPillar) return false
    return !enabledModules.some((moduleName) => {
      const lower = moduleName.trim().toLowerCase()
      if (lower === item.module_key!.toLowerCase()) return true
      if (lower === item.label.trim().toLowerCase()) return true
      const normalized = normalizeSaasEntitlementName(moduleName)
      return normalized.trim()
        ? saasModuleCoversCapability(normalized, item.module_key!) || saasModuleCoversCapability(moduleName, item.module_key!)
        : false
    })
  }

  // Handler klik saat gate aktif
  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setAttendanceToast(true)
    setTimeout(() => setAttendanceToast(false), 3000)
  }

  useEffect(() => {
    const handleMobileToggle = () => setIsMobileOpen((prev) => !prev)
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleMobileToggle)
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleMobileToggle)
  }, [])

  const hasMounted = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
  const isCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    () => false
  )
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'
  const isPlatformAdmin = isPlatformAdminEmail(user?.email)
  const showSaasOperatorGroup = isPlatformAdmin
  const effectiveIsCollapsed = hasMounted ? isCollapsed : false
  const navGroups = useMemo(() => (
    showSaasOperatorGroup
      ? [...NAV_GROUPS, SAAS_OPERATOR_GROUP]
      : NAV_GROUPS
  ), [showSaasOperatorGroup])

  const loadSidebarMetrics = useCallback(async () => {
    try {
      const metrics = await getSidebarChromeMetrics(orgId, activeBranchId)
      setBadgeMetrics(metrics)
    } catch (error) {
      console.error('[AppSidebar] Failed to load badge metrics:', error)
    }
  }, [activeBranchId, orgId])

  const prefetchRoute = useCallback((href: string) => {
    const normalizedHref = String(href || '').trim()
    if (!normalizedHref || normalizedHref === fullPath || prefetchedRoutesRef.current.has(normalizedHref)) {
      return
    }

    prefetchedRoutesRef.current.add(normalizedHref)
    void router.prefetch(normalizedHref)
  }, [fullPath, router])

  const handleClientSignOut = () => {
    startSignOutTransition(async () => {
      if (isDemo) {
        await signOutDemo()
        return
      }

      await signOut()
    })
  }

  useEffect(() => {
    let isCancelled = false
    const cancelIdleTask = scheduleIdleTask(() => {
      void (async () => {
        try {
          const metrics = await getSidebarChromeMetrics(orgId, activeBranchId)
          if (isCancelled) return
          setBadgeMetrics(metrics)
        } catch (error) {
          if (!isCancelled) {
            console.error('[AppSidebar] Failed to load badge metrics:', error)
          }
        }
      })()
    })

    return () => {
      isCancelled = true
      cancelIdleTask()
    }
  }, [activeBranchId, orgId])

  useEffect(() => {
    const handleWindowFocus = () => {
      void loadSidebarMetrics()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadSidebarMetrics()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSidebarMetrics()
      }
    }, 15000)

    return () => {
      window.clearInterval(pollInterval)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadSidebarMetrics])

  useEffect(() => {
    return subscribeApprovalSignal((signal) => {
      if (!approvalSignalMatchesScope(signal, orgId, activeBranchId)) {
        return
      }

      setBadgeMetrics((current) => ({
        ...current,
        pendingApprovals: signal.pendingCount,
      }))
    })
  }, [activeBranchId, orgId])

  const isNavItemActive = (href: string) => {
    return isSidebarItemActive(pathname, fullPath, href, Boolean(tabQuery))
  }

  const isItemVisible = useCallback((group: NavGroup, item: NavGroup['items'][number]) => {
    // Always show Sub-Org menu for eligible parent context (owner/admin on main org),
    // regardless of paid-module mapping labels.
    if (item.href === '/settings/sub-orgs') {
      return canManageSubOrganizations
    }

    if (item.saas_assessor_only) {
      const hasAccess = isSaasAssessor || hasRolePermission(userRole, permissions, item.permission_key)
      if (!hasAccess) return false
    }

    // Cabang adalah fitur core — selalu tampilkan untuk owner/admin
    if (item.href === '/settings/branches') {
      return isOwnerOrAdmin
    }

    // Platform admin should always see SaaS operator shortcuts
    if (group.group === SAAS_OPERATOR_GROUP.group) {
      return showSaasOperatorGroup
    }

    // 0. DEMO BYPASS: Tampilkan SEMUA modul di mode Demo/Latihan agar klien bisa eksplorasi fitur penuh
    if (isDemo) return true

    // 1. SaaS Module Check
    let passesSaaSCheck = true
    if (item.module_key && enabledModules.length > 0) {
      // 0b. PILLAR BYPASS: Modul pillar (Finance, Marketing, HRIS) selalu aktif secara SaaS
      const isPillar = PILLAR_MODULES.some(p => p.key.toLowerCase() === item.module_key!.toLowerCase())
      
      if (!isPillar) {
        const matches = enabledModules.some((moduleName) => {
          const enabledLower = moduleName.trim().toLowerCase()
          if (enabledLower === item.label.trim().toLowerCase()) return true
          const normalizedEnabled = normalizeSaasEntitlementName(moduleName)
          if (normalizedEnabled.trim()) {
            if (saasModuleCoversCapability(normalizedEnabled, item.module_key!) ||
                saasModuleCoversCapability(moduleName, item.module_key!)) return true
          }
          return false
        })
        if (!matches) passesSaaSCheck = false
      }
    }

    if (!passesSaaSCheck) return false

    // 2. RBAC Permission Check
    return hasRolePermission(userRole, permissions, item.permission_key)
  }, [
    canManageSubOrganizations,
    enabledModules,
    isDemo,
    isOwnerOrAdmin,
    isSaasAssessor,
    permissions,
    showSaasOperatorGroup,
    userRole,
  ])

  const STAFF_NAV_GROUPS: NavGroup[] = useMemo(() => [
    {
      group: 'Portal Saya',
      items: [
        { label: 'Portal Karyawan', href: '/karyawan', icon: Fingerprint },
      ],
    },
  ], [])

  const visibleNavGroups = useMemo(() => {
    if (isStaffEmployee) return STAFF_NAV_GROUPS
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isItemVisible(group, item)),
      }))
      .filter((group) => group.items.length > 0)
  }, [isItemVisible, isStaffEmployee, navGroups, STAFF_NAV_GROUPS])

  const toggleCollapse = () => {
    const next = !isCollapsed
    if (typeof window === 'undefined') return

    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next.toString())
    window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT))
  }

  const warmupHrefs = useMemo(() => {
    const topRoutes = visibleNavGroups
      .map((group) => group.items[0]?.href)
      .filter((href): href is string => Boolean(href))

    const activeGroup = visibleNavGroups.find((group) =>
      group.items.some((item) =>
        isSidebarItemActive(pathname, fullPath, item.href, Boolean(tabQuery))
      )
    )

    const activeGroupRoutes = activeGroup ? activeGroup.items.map((item) => item.href) : []
    const settingsRoute = isOwnerOrAdmin ? '/settings/business' : '/karyawan'

    return Array.from(new Set([
      '/dashboard',
      ...topRoutes,
      ...activeGroupRoutes,
      settingsRoute,
      '/billing',
    ])).filter((href) => href !== fullPath)
  }, [
    fullPath,
    isOwnerOrAdmin,
    pathname,
    tabQuery,
    visibleNavGroups,
  ])

  useEffect(() => {
    if (warmupHrefs.length === 0) return

    const timeoutIds: number[] = []
    const kickoffId = window.setTimeout(() => {
      warmupHrefs.slice(0, 10).forEach((href, index) => {
        const timeoutId = window.setTimeout(() => {
          prefetchRoute(href)
        }, index * 160)
        timeoutIds.push(timeoutId)
      })
    }, 180)

    timeoutIds.push(kickoffId)

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [prefetchRoute, warmupHrefs])

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Attendance Gate Toast */}
      {attendanceToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-2.5 bg-slate-900 text-white text-sm font-semibold px-4 py-3 rounded-lg shadow-lg">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>Lakukan clock-in terlebih dahulu</span>
          </div>
        </div>
      )}
      
      <aside className={`
        ${effectiveIsCollapsed ? 'w-16' : 'w-60'}
        transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200 group/sidebar z-50 print:hidden
        ${isMobileOpen ? 'fixed inset-y-0 left-0 shadow-md translate-x-0' : 'fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0 md:flex'}
      `}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full hidden md:flex items-center justify-center text-slate-400 hover:text-slate-700 shadow-sm z-50 transition-colors"
      >
        <ChevronLeft size={14} className={`transition-transform duration-300 ${effectiveIsCollapsed ? 'rotate-180' : ''}`} />
      </button>

      {/* Logo Section */}
      <div className={`h-14 flex items-center border-b border-slate-100 px-4 ${effectiveIsCollapsed ? 'justify-center' : 'gap-2.5'}`}>
        <>
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/logo.png"
              alt="NIZAM Logo"
              width={48}
              height={48}
              className="w-full h-full object-cover scale-[1.3]"
            />
          </div>
          {!effectiveIsCollapsed && (
            <div className="flex flex-col justify-center overflow-hidden animate-in fade-in duration-500">
              <span className="font-bold text-slate-900 text-base tracking-tight leading-tight">Nizam</span>
              <MiniErpWordmark className="text-[9px] font-semibold tracking-[0.15em] uppercase text-slate-400" erpClassName="text-slate-400" />
            </div>
          )}
        </>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar scroll-smooth">
        {!hasMounted ? (
          <div className="space-y-6" aria-hidden="true">
            {SIDEBAR_NAV_SKELETON_GROUPS.map((itemCount, groupIndex) => (
              <div key={`sidebar-skeleton-${groupIndex}`} className="mb-6">
                <div className="mb-3 h-3 w-20 rounded-full bg-slate-100" />
                <div className="space-y-1.5">
                  {Array.from({ length: itemCount }).map((_, itemIndex) => (
                    <div
                      key={`sidebar-skeleton-item-${groupIndex}-${itemIndex}`}
                      className="h-8 rounded-md bg-slate-100/80"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : visibleNavGroups.map((group) => {
          const filteredItems = group.items
          const hasActiveItem = filteredItems.some((item) => isNavItemActive(item.href))
          const groupKey = `${group.group}-${fullPath}`

          return (
            <div key={group.group} className="mb-4">
              {effectiveIsCollapsed ? (
                <p className="px-2 mb-2 text-[10px] font-semibold text-slate-300 uppercase tracking-[0.12em] leading-none flex items-center justify-center">
                  ···
                </p>
              ) : (
                <details key={groupKey} name="app-sidebar-categories" open={hasActiveItem || undefined} className="group/details">
                  <summary className="mb-1.5 flex w-full list-none items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 transition-colors duration-150 hover:text-slate-600 cursor-pointer [&::-webkit-details-marker]:hidden">
                    <span>{group.group}</span>
                    <ChevronRight
                      size={12}
                      className="text-slate-300 transition-transform duration-200 group-open/details:rotate-90"
                    />
                  </summary>
                  <ul className="space-y-1.5">
                    {filteredItems.map((item) => {
                      const Icon = item.icon
                      const isActive = isNavItemActive(item.href)
                      const isCore = item.module_key ? CORE_MODULE_KEYS.has(item.module_key) : false

                      // Define Notification Badges Mapping
                      let badgeCount = 0
                      if (item.href === '/accounting/approvals') badgeCount = badgeMetrics.pendingApprovals
                      if (item.href === '/accounting/journal') badgeCount = badgeMetrics.unpostedJournals
                      if (item.href === '/purchasing') badgeCount = badgeMetrics.pendingPurchaseRequests
                      if (item.href === '/hris') badgeCount = badgeMetrics.hrisNotifications
                      if (item.href === '/cash') badgeCount = badgeMetrics.pendingCoaRequests
                      if (item.href === '/crm/tickets') badgeCount = badgeMetrics.newCrmTickets

                      const locked = isLockedByAttendance(item.href)
                      const lockedByActivation = !locked && isLockedByActivation(item)
                      const anyLocked = locked || lockedByActivation
                      return (
                        <li key={`${group.group}:${item.label}:${item.href}`}>
                          <Link
                            href={locked ? '/karyawan' : lockedByActivation ? '/marketplace' : (item.module_key && pendingModules.includes(item.module_key) ? `/marketplace/setup/${item.module_key}` : item.href)}
                            onMouseEnter={() => !anyLocked && prefetchRoute(item.href)}
                            onFocus={() => !anyLocked && prefetchRoute(item.href)}
                            onTouchStart={() => !anyLocked && prefetchRoute(item.href)}
                            onPointerDown={() => !anyLocked && prefetchRoute(item.href)}
                            onClick={(e) => {
                              if (locked) { handleLockedClick(e); return }
                              if (!lockedByActivation) {
                                prefetchRoute(item.href)
                                notifyRouteLoadingStart()
                              }
                              setIsMobileOpen(false)
                            }}
                            title={effectiveIsCollapsed ? item.label : (locked ? 'Clock-in dulu untuk akses menu ini' : lockedByActivation ? 'Aktifkan modul ini di Marketplace' : '')}
                            className={`flex items-center rounded-md text-sm font-medium transition-colors duration-150 group/item relative
                              ${effectiveIsCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                              ${anyLocked
                                ? 'opacity-50 cursor-not-allowed'
                                : isActive
                                  ? 'bg-[#003366] text-white'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                          >
                            <div className="flex items-center gap-3.5 relative">
                              <div className="relative">
                                <Icon
                                  size={16}
                                  strokeWidth={isActive ? 2 : 1.75}
                                  className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-slate-700'}`}
                                />
                                {anyLocked && (
                                  <div className={`absolute -top-1 -right-1.5 w-3 h-3 rounded-full border border-white flex items-center justify-center ${lockedByActivation ? 'bg-blue-500' : 'bg-amber-400'}`}>
                                    <Lock size={6} className="text-white" />
                                  </div>
                                )}
                                {!anyLocked && effectiveIsCollapsed && badgeCount > 0 && (
                                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#003366] border border-white flex items-center justify-center text-[7px] font-semibold text-white shrink-0">
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                  </div>
                                )}
                              </div>

                              {!effectiveIsCollapsed && (
                                <span className="tracking-tight truncate flex-1">{item.label}</span>
                              )}
                            </div>

                            {!effectiveIsCollapsed && (
                              <div className="flex items-center gap-2">
                                {!anyLocked && badgeCount > 0 && (
                                  <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide leading-none flex items-center justify-center animate-in fade-in zoom-in ${isActive ? 'bg-white text-[#003366] shadow-sm' : 'bg-[#003366] text-white shadow-sm shadow-[#003366]/10'}`}>
                                    {badgeCount}
                                  </div>
                                )}
                                {lockedByActivation && (
                                  <div className="px-1.5 py-0.5 rounded-md text-[8px] font-semibold tracking-wide leading-none bg-blue-50 text-blue-600 border border-blue-200/80 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150">
                                    AKTIFKAN
                                  </div>
                                )}
                                {!anyLocked && item.module_key && pendingModules.includes(item.module_key) && badgeCount === 0 && (
                                  <div className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide leading-none bg-amber-400 text-white animate-in fade-in zoom-in">
                                    SETUP
                                  </div>
                                )}
                                {!anyLocked && isCore && !isActive && badgeCount === 0 && !(item.module_key && pendingModules.includes(item.module_key)) && (
                                  <div className="px-1.5 py-0.5 rounded-md text-[8px] font-semibold tracking-wide leading-none bg-teal-50 text-teal-600 border border-teal-200/80 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150">
                                    CORE
                                  </div>
                                )}
                                <ChevronRight
                                  size={12}
                                  className={`transition-all ${isActive ? 'text-white/40' : 'text-slate-300 opacity-0 group-hover/item:opacity-100'}`}
                                />
                              </div>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}
              {effectiveIsCollapsed && (
                <ul className="space-y-1.5">
                  {filteredItems.map((item) => {
                    const Icon = item.icon
                    const isActive = isNavItemActive(item.href)

                    let badgeCount = 0
                    if (item.href === '/accounting/approvals') badgeCount = badgeMetrics.pendingApprovals
                    if (item.href === '/accounting/journal') badgeCount = badgeMetrics.unpostedJournals
                    if (item.href === '/purchasing') badgeCount = badgeMetrics.pendingPurchaseRequests
                    if (item.href === '/hris') badgeCount = badgeMetrics.hrisNotifications
                    if (item.href === '/cash') badgeCount = badgeMetrics.pendingCoaRequests
                    if (item.href === '/crm/tickets') badgeCount = badgeMetrics.newCrmTickets

                    const locked = isLockedByAttendance(item.href)
                    const lockedByActivation = !locked && isLockedByActivation(item)
                    const anyLocked = locked || lockedByActivation
                    return (
                      <li key={`${group.group}:${item.label}:${item.href}`}>
                        <Link
                          href={locked ? '/karyawan' : lockedByActivation ? '/marketplace' : (item.module_key && pendingModules.includes(item.module_key) ? `/marketplace/setup/${item.module_key}` : item.href)}
                          onMouseEnter={() => !anyLocked && prefetchRoute(item.href)}
                          onFocus={() => !anyLocked && prefetchRoute(item.href)}
                          onTouchStart={() => !anyLocked && prefetchRoute(item.href)}
                          onPointerDown={() => !anyLocked && prefetchRoute(item.href)}
                          onClick={(e) => {
                            if (locked) { handleLockedClick(e); return }
                            if (!lockedByActivation) {
                              prefetchRoute(item.href)
                              notifyRouteLoadingStart()
                            }
                            setIsMobileOpen(false)
                          }}
                          title={locked ? 'Clock-in dulu' : lockedByActivation ? `Aktifkan ${item.label} di Marketplace` : item.label}
                          className={`flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-colors duration-150 group/item relative
                            ${anyLocked
                              ? 'opacity-50 cursor-not-allowed'
                              : isActive
                                ? 'bg-[#003366] text-white'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                          <div className="relative">
                            <Icon
                              size={16}
                              strokeWidth={isActive ? 2 : 1.75}
                              className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-slate-700'}`}
                            />
                            {anyLocked && (
                              <div className={`absolute -top-1 -right-1.5 w-3 h-3 rounded-full border border-white flex items-center justify-center ${lockedByActivation ? 'bg-blue-500' : 'bg-amber-400'}`}>
                                <Lock size={6} className="text-white" />
                              </div>
                            )}
                            {!anyLocked && badgeCount > 0 && (
                              <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#003366] border border-white flex items-center justify-center text-[7px] font-semibold text-white shrink-0">
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </div>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer — avatar + nama + logout */}
      <div className={`p-3 border-t border-slate-100 bg-white ${effectiveIsCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between w-full gap-3'}`}>
        <div className={`flex items-center gap-3 ${effectiveIsCollapsed ? '' : 'min-w-0 flex-1'}`}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-xs font-semibold text-white relative" title={user?.fullName || userRole}>
            {user?.fullName?.slice(0, 1).toUpperCase() || userRole?.slice(0, 1).toUpperCase()}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-800" />
          </div>
          {!effectiveIsCollapsed && (
            <div className="flex flex-col overflow-hidden min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{user?.fullName || userRole}</p>
              <p className="text-[11px] text-slate-500 truncate">{jobTitle || userRole} &middot; {planName}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleClientSignOut}
          disabled={isSigningOut}
          title={isDemo ? 'Keluar & Reset Demo' : 'Keluar'}
          className={`shrink-0 p-2 rounded-md transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${isDemo ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
        >
          <LogOut size={18} strokeWidth={2} className={isSigningOut ? 'animate-pulse' : ''} />
        </button>
      </div>
    </aside>
    </>
  )
}
