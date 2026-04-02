'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { saasModuleMatches } from '@/lib/saas/module-catalog'
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
  type LucideIcon
} from 'lucide-react'
import { signOut } from '@/modules/auth/actions/auth.actions'
import { signOutDemo } from '@/modules/demo/actions/demo.actions'

interface NavGroup {
  group: string
  items: {
    label: string
    href: string
    icon: LucideIcon
    phase?: string
    permission_key?: string
    module_key?: string
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Audit Integritas', href: '/accounting/audit', icon: ShieldCheck, permission_key: 'audit', module_key: 'Audit' },
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
      { label: 'Job Order (Jasa)', href: '/services', icon: Briefcase, permission_key: 'services', module_key: 'Job Order (Jasa)' },
    ]
  },
  {
    group: 'Marketing & Sales',
    items: [
      { label: 'Pelanggan (CRM)', href: '/contacts', icon: Users, permission_key: 'crm', module_key: 'CRM' },
      { label: 'POS (Kasir)', href: '/pos', icon: Store, permission_key: 'pos', module_key: 'POS' },
      { label: 'Penawaran (Quotation)', href: '/sales/quotations', icon: FileText, permission_key: 'quotation', module_key: 'Sales' },
      { label: 'Penjualan', href: '/sales', icon: TrendingUp, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Sales Pipeline', href: '/sales/pipeline', icon: Activity, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Target & Komisi', href: '/sales/commission', icon: Target, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Promo & Reward', href: '/sales/promos', icon: Zap, permission_key: 'sales', module_key: 'Sales' },
      { label: 'Sales Page', href: '/sales/pages', icon: Megaphone, permission_key: 'sales', module_key: 'Sales Page' },
    ]
  },
  {
    group: 'HRIS',
    items: [
      { label: 'Karyawan (SDM)', href: '/hris', icon: Users, permission_key: 'employees', module_key: 'HRIS' },
      { label: 'Absensi & Cuti', href: '/hris?tab=attendance', icon: Clock, permission_key: 'attendance', module_key: 'Attendance' },
      { label: 'Payroll Components', href: '/hris?tab=payroll', icon: FileText, permission_key: 'payroll', module_key: 'Payroll' },
      { label: 'Proses Penggajian', href: '/hris?tab=runs', icon: Wallet, permission_key: 'payroll', module_key: 'Payroll' },
      { label: 'Hak Akses', href: '/settings/roles', icon: ShieldCheck, permission_key: 'business', module_key: 'HRIS' },
    ]
  },
  {
    group: 'Insight',
    items: [
      { label: 'Laporan', href: '/reports', icon: BarChart3, permission_key: 'reports', module_key: 'Reports' },
      { label: 'Strategi (BSC)', href: '/reports/bsc', icon: PieChart, permission_key: 'strategy', module_key: 'Reports' },
      { label: 'Proyeksi Kas', href: '/accounting/forecast', icon: LineChart, permission_key: 'forecast', module_key: 'Finance' },
    ]
  },
  {
    group: 'Config',
    items: [
      { label: 'Audit Trail', href: '/settings/audit', icon: ShieldCheck, permission_key: 'audit_trail', module_key: 'Audit' },
      { label: 'Cabang & Divisi', href: '/settings/branches', icon: MapPin, permission_key: 'branch', module_key: 'Consolidation' },
      { label: 'Pengaturan Bisnis', href: '/settings/business', icon: Settings, permission_key: 'business', module_key: 'Config' },
    ]
  }
]

const SAAS_OPERATOR_GROUP: NavGroup = {
  group: 'SaaS Operator',
  items: [
    { label: 'Penawaran SaaS', href: '/saas/penawaran', icon: FileText, permission_key: 'sales' },
    { label: 'Penjualan SaaS', href: '/saas/penjualan', icon: TrendingUp, permission_key: 'sales' },
  ],
}

const SIDEBAR_COLLAPSED_KEY = 'nizam_sidebar_collapsed'
const SIDEBAR_STATE_EVENT = 'nizam_sidebar_state_change'
const SIDEBAR_TOGGLE_EVENT = 'nizam_sidebar_toggle'

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

function subscribeHydration(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  // Trigger exactly once after hydration to switch from server snapshot to client snapshot.
  onStoreChange()
  return () => {}
}

interface AppSidebarProps {
  userRole: string
  jobTitle?: string
  user?: { fullName?: string; email: string }
  permissions?: string[]
  enabledModules?: string[]
  pendingApprovals?: number
  unpostedJournals?: number
  pendingPurchaseRequests?: number
  hrisNotifications?: number
  isDemo?: boolean
  planName?: string
}

export function AppSidebar({ 
  userRole, 
  jobTitle,
  user,
  permissions = [],
  enabledModules = [],
  pendingApprovals = 0, 
  unpostedJournals = 0, 
  pendingPurchaseRequests = 0,
  hrisNotifications = 0,
  isDemo = false,
  planName = 'Trial'
}: AppSidebarProps) {
  const [isSigningOut, startSignOutTransition] = useTransition()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabQuery = searchParams?.get('tab')
  const fullPath = pathname + (tabQuery ? `?tab=${tabQuery}` : '')

  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const handleMobileToggle = () => setIsMobileOpen((prev) => !prev)
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleMobileToggle)
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleMobileToggle)
  }, [])

  const isCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    () => false
  )
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false
  )
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'
  const isPlatformAdmin = isPlatformAdminEmail(user?.email)
  const showSaasOperatorGroup = isHydrated && isPlatformAdmin
  const navGroups = showSaasOperatorGroup
    ? [...NAV_GROUPS, SAAS_OPERATOR_GROUP]
    : NAV_GROUPS

  const handleClientSignOut = () => {
    startSignOutTransition(async () => {
      if (isDemo) {
        await signOutDemo()
        return
      }

      await signOut()
    })
  }

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }

    if (href.includes('?')) {
      return fullPath === href
    }

    return pathname.startsWith(href) && (!href.startsWith('/hris') || !tabQuery)
  }

  const getFilteredItems = (group: NavGroup) => {
    return group.items.filter((item) => {
      // Platform admin should always see SaaS operator shortcuts
      if (showSaasOperatorGroup && group.group === 'SaaS Operator') return true

      // 0. DEMO BYPASS: Tampilkan SEMUA modul di mode Demo/Latihan agar klien bisa eksplorasi fitur penuh
      if (isDemo) return true

      // 1. SaaS Module Check
      if (item.module_key) {
        const entitlementCandidates = [item.module_key, item.label]
        const matches = enabledModules.some((moduleName) =>
          entitlementCandidates.some((candidate) => saasModuleMatches(moduleName, candidate))
        )
        if (!matches) return false
      }

      // 2. RBAC Permission Check
      if (isOwnerOrAdmin) return true
      if (!item.permission_key) return true

      const reqPerms = item.permission_key.split(',').map((key) => key.trim().toLowerCase())
      return permissions.some((permission) => {
        const normalizedPermission = permission.toLowerCase()
        return reqPerms.some((requiredPermission) => normalizedPermission.includes(requiredPermission))
      })
    })
  }

  const toggleCollapse = () => {
    const next = !isCollapsed
    if (typeof window === 'undefined') return

    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next.toString())
    window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT))
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      <aside className={`
        ${isCollapsed ? 'w-20' : 'w-64'} 
        transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-100 group/sidebar z-50 print:hidden
        ${isMobileOpen ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0' : 'fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0 md:flex'}
      `}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full hidden md:flex items-center justify-center text-slate-400 hover:text-emerald-600 shadow-sm z-50 transition-transform hover:scale-110"
      >
        <ChevronLeft size={14} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>

      {/* Logo Section */}
      <div className={`h-20 flex items-center px-6 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
        <>
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-md shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
            <Image
              src="/logo.png"
              alt="NIZAM Logo"
              width={48}
              height={48}
              className="w-full h-full object-cover scale-[1.3]"
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col justify-center overflow-hidden animate-in fade-in duration-500">
              <span className="font-black text-slate-900 text-lg tracking-tighter leading-tight uppercase">NIZAM</span>
              <span className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase opacity-80">Cloud ERP</span>
            </div>
          )}
        </>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar scroll-smooth">
        {navGroups.map((group) => {
          const filteredItems = getFilteredItems(group)

          if (filteredItems.length === 0) return null

          const hasActiveItem = filteredItems.some((item) => isNavItemActive(item.href))
          const groupKey = `${group.group}-${fullPath}`

          return (
            <div key={group.group} className="mb-6">
              {isCollapsed ? (
                <p className="px-4 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none flex items-center justify-center gap-2">
                  •••
                </p>
              ) : (
                <details key={groupKey} name="app-sidebar-categories" open={hasActiveItem || undefined} className="group/details">
                  <summary className="mb-2 flex w-full list-none items-center justify-between rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600 cursor-pointer [&::-webkit-details-marker]:hidden">
                    <span>{group.group}</span>
                    <ChevronRight
                      size={14}
                      className="text-slate-300 transition-transform duration-200 group-open/details:rotate-90 group-open/details:text-[#003366]"
                    />
                  </summary>
                  <ul className="space-y-1.5">
                    {filteredItems.map((item) => {
                      const Icon = item.icon
                      const isActive = isNavItemActive(item.href)

                      // Define Notification Badges Mapping
                      let badgeCount = 0
                      if (item.href === '/accounting/audit') badgeCount = pendingApprovals
                      if (item.href === '/accounting/journal') badgeCount = unpostedJournals
                      if (item.href === '/purchasing') badgeCount = pendingPurchaseRequests
                      if (item.href === '/hris') badgeCount = hrisNotifications

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            title={isCollapsed ? item.label : ''}
                            className={`flex items-center rounded-2xl text-sm font-bold transition-all duration-200 group/item relative
                              ${isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'}
                              ${isActive
                                ? 'bg-[#003366] text-white shadow-lg shadow-[#003366]/20'
                                : 'text-slate-500 hover:text-[#003366] hover:bg-[#003366]/5'
                              }`}
                          >
                            <div className="flex items-center gap-3.5 relative">
                              <div className="relative">
                                <Icon
                                  size={18}
                                  strokeWidth={isActive ? 2.5 : 2}
                                  className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-emerald-500'}`}
                                />
                                {isCollapsed && badgeCount > 0 && (
                                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#003366] border border-white flex items-center justify-center text-[7px] font-black text-white shrink-0">
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                  </div>
                                )}
                              </div>

                              {!isCollapsed && (
                                <span className="tracking-tight truncate flex-1">{item.label}</span>
                              )}
                            </div>

                            {!isCollapsed && (
                              <div className="flex items-center gap-2">
                                {badgeCount > 0 && (
                                  <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-widest leading-none flex items-center justify-center animate-in fade-in zoom-in ${isActive ? 'bg-white text-[#003366] shadow-sm' : 'bg-[#003366] text-white shadow-sm shadow-[#003366]/10'}`}>
                                    {badgeCount}
                                  </div>
                                )}
                                <ChevronRight
                                  size={14}
                                  className={`transition-all ${isActive ? 'text-white opacity-50' : 'text-slate-300 opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0'}`}
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
              {isCollapsed && (
                <ul className="space-y-1.5">
                  {filteredItems.map((item) => {
                    const Icon = item.icon
                    const isActive = isNavItemActive(item.href)

                    let badgeCount = 0
                    if (item.href === '/accounting/audit') badgeCount = pendingApprovals
                    if (item.href === '/accounting/journal') badgeCount = unpostedJournals
                    if (item.href === '/purchasing') badgeCount = pendingPurchaseRequests
                    if (item.href === '/hris') badgeCount = hrisNotifications

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          title={item.label}
                          className={`flex items-center justify-center rounded-2xl p-3 text-sm font-bold transition-all duration-200 group/item relative
                            ${isActive
                              ? 'bg-[#003366] text-white shadow-lg shadow-[#003366]/20'
                              : 'text-slate-500 hover:text-[#003366] hover:bg-[#003366]/5'
                            }`}
                        >
                          <div className="relative">
                            <Icon
                              size={18}
                              strokeWidth={isActive ? 2.5 : 2}
                              className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-emerald-500'}`}
                            />
                            {badgeCount > 0 && (
                              <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#003366] border border-white flex items-center justify-center text-[7px] font-black text-white shrink-0">
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

      {/* Footer / Role */}
      <div className={`p-4 border-t border-slate-50 bg-slate-50/30 ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-4' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
          <Link href="/profil-saya" onClick={() => setIsMobileOpen(false)} className="w-10 h-10 shrink-0 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-black text-slate-800 shadow-sm relative hover:ring-2 hover:ring-blue-400 transition-all" title="Edit Profil Saya">
              {userRole?.slice(0, 1).toUpperCase()}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#003366] border-2 border-white" />
            </Link>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden max-w-[120px]">
                <p className="text-sm font-black text-slate-900 truncate mb-1 leading-tight tracking-tight">{user?.fullName || userRole}</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest truncate">{jobTitle || userRole}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] truncate mt-1">{planName}</p>
              </div>
            )}
          </div>

          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'gap-1'}`}>
            <Link 
              href={isOwnerOrAdmin ? '/settings/business' : '/profil-saya'} 
              onClick={() => setIsMobileOpen(false)}
              title={isOwnerOrAdmin ? 'Pengaturan Bisnis' : 'Profil & Password Saya'}
              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            >
              <Settings size={18} strokeWidth={1.5} />
            </Link>
            <button 
              type="button"
              onClick={handleClientSignOut}
              disabled={isSigningOut}
              title={isDemo ? "Keluar & Reset Demo" : "Keluar"}
              className={`p-2.5 rounded-xl transition-all disabled:cursor-wait disabled:opacity-60 ${isDemo ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
            >
              <LogOut size={18} strokeWidth={2} className={isSigningOut ? 'animate-pulse' : ''} />
            </button>
          </div>
        </div>
      {isCollapsed && (
        <div className="px-3 pb-3">
          <Link href="/billing" onClick={() => setIsMobileOpen(false)} title="Langganan & Billing" className="flex items-center justify-center w-full p-2.5 rounded-xl bg-[#003366]/5 text-[#003366] hover:bg-[#003366] hover:text-white transition-all shadow-sm">
            <Zap size={16} />
          </Link>
        </div>
      )}
      </div>
    </aside>
    </>
  )
}
