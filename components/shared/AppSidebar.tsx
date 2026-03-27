'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Store
} from 'lucide-react'
import { signOut } from '@/modules/auth/actions/auth.actions'
import { signOutDemo } from '@/modules/demo/actions/demo.actions'

interface NavGroup {
  group: string
  items: {
    label: string
    href: string
    icon: any
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
      { label: 'Audit Integritas', href: '/accounting/audit', icon: ShieldCheck, permission_key: 'audit' },
    ]
  },
  {
    group: 'Finance',
    items: [
      { label: 'Buku Besar', href: '/accounting/journal', icon: BookOpen, permission_key: 'finance' },
      { label: 'Kas & Bank', href: '/cash', icon: Wallet, permission_key: 'finance' },
      { label: 'Aging (AR/AP)', href: '/accounting/aging', icon: History, permission_key: 'finance' },
      { label: 'Manajemen Zakat', href: '/accounting/zakat', icon: Zap, permission_key: 'finance' },
      { label: 'Manajemen Pajak', href: '/accounting/tax', icon: ShieldCheck, permission_key: 'finance' },
      { label: 'Reimbursement', href: '/accounting/reimburse', icon: FileText, permission_key: 'finance' },
      { label: 'Penutupan Buku', href: '/accounting/closing', icon: Lock, permission_key: 'finance' },
      { label: 'Akun (CoA)', href: '/settings/accounts', icon: Layers, permission_key: 'finance' },
      { label: 'Aset Tetap', href: '/accounting/assets', icon: Landmark, permission_key: 'finance' },
      { label: 'Anggaran', href: '/accounting/budgets', icon: Target, permission_key: 'finance' },
    ]
  },
  {
    group: 'Operasional',
    items: [
      { label: 'Pembelian', href: '/purchasing', icon: ShoppingCart, permission_key: 'purchasing', module_key: 'purchasing' },
      { label: 'Inventori', href: '/inventory', icon: Package, permission_key: 'inventory', module_key: 'inventory' },
      { label: 'Gudang (WMS)', href: '/inventory/warehouses', icon: Warehouse, permission_key: 'inventory', module_key: 'inventory' },
      { label: 'Manufaktur (BoM)', href: '/factory', icon: Factory, permission_key: 'factory', module_key: 'factory' },
      { label: 'Fleet & Rental', href: '/fleet', icon: Truck, permission_key: 'fleet', module_key: 'fleet' },
      { label: 'Job Order (Jasa)', href: '/services', icon: Briefcase, permission_key: 'services', module_key: 'services' },
    ]
  },
  {
    group: 'Marketing & Sales',
    items: [
      { label: 'Pelanggan (CRM)', href: '/contacts', icon: Users, permission_key: 'sales', module_key: 'sales' },
      { label: 'POS (Kasir)', href: '/pos', icon: Store, permission_key: 'pos', module_key: 'pos' },
      { label: 'Penawaran (Quotation)', href: '/sales/quotations', icon: FileText, permission_key: 'sales', module_key: 'sales' },
      { label: 'Penjualan', href: '/sales', icon: TrendingUp, permission_key: 'sales', module_key: 'sales' },
      { label: 'Sales Pipeline', href: '/sales/pipeline', icon: Activity, permission_key: 'sales', module_key: 'sales' },
      { label: 'Target & Komisi', href: '/sales/commission', icon: Target, permission_key: 'sales', module_key: 'sales' },
      { label: 'Promo & Reward', href: '/sales/promos', icon: Zap, permission_key: 'sales', module_key: 'sales' },
    ]
  },
  {
    group: 'HRIS',
    items: [
      { label: 'Karyawan (HRIS)', href: '/hris', icon: Users, permission_key: 'hris', module_key: 'hris' },
      { label: 'Akses & Jabatan', href: '/settings/roles', icon: ShieldCheck, permission_key: 'hris', module_key: 'hris' },
    ]
  },
  {
    group: 'Insight',
    items: [
      { label: 'Laporan', href: '/reports', icon: BarChart3, permission_key: 'reports', module_key: 'reports' },
      { label: 'Strategi (BSC)', href: '/reports/bsc', icon: PieChart, permission_key: 'reports', module_key: 'reports' },
      { label: 'Proyeksi Kas', href: '/accounting/forecast', icon: LineChart, permission_key: 'reports', module_key: 'reports' },
    ]
  },
  {
    group: 'Config',
    items: [
      { label: 'Audit Trail', href: '/settings/audit', icon: ShieldCheck, permission_key: 'config', module_key: 'config' },
      { label: 'Cabang & Divisi', href: '/settings/branches', icon: MapPin, permission_key: 'config', module_key: 'config' },
      { label: 'Pengaturan Bisnis', href: '/settings/business', icon: Settings, permission_key: 'config', module_key: 'config' },
    ]
  }
]

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
  isDemo = false 
}: AppSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('nizam_sidebar_collapsed')
    if (saved === 'true') setIsCollapsed(true)
    setMounted(true)

    // Listen for mobile toggle
    const handleMobileToggle = () => setIsCollapsed(prev => !prev)
    window.addEventListener('nizam_sidebar_toggle', handleMobileToggle)
    return () => window.removeEventListener('nizam_sidebar_toggle', handleMobileToggle)
  }, [])

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('nizam_sidebar_collapsed', next.toString())
  }

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-100 relative group/sidebar z-40 hidden md:flex`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 shadow-sm z-50 transition-transform hover:scale-110"
      >
        <ChevronLeft size={14} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>

      {/* Logo Section */}
      <div className={`h-20 flex items-center px-6 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
        {mounted ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-md shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
              <img src="/logo.png" alt="NIZAM Logo" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col justify-center overflow-hidden animate-in fade-in duration-500">
                <span className="font-black text-slate-900 text-lg tracking-tighter leading-tight uppercase">NIZAM</span>
                <span className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase opacity-80">Cloud ERP</span>
              </div>
            )}
          </>
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar scroll-smooth">
        {NAV_GROUPS.map((group, gIdx) => {
          // Filter items based on permissions
          const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'
          const filteredItems = group.items.filter(item => {
            // 1. SaaS Module Check (Has this organization paid/enabled this module?)
            if (item.module_key && !enabledModules.some(m => m.toLowerCase() === item.module_key!.toLowerCase())) {
              return false
            }

            // 2. RBAC Permission Check
            if (isOwnerOrAdmin) return true
            if (!item.permission_key) return true // Public menus
            return permissions.some(p => p.toLowerCase().includes(item.permission_key!.toLowerCase()))
          })

          if (filteredItems.length === 0) return null

          return (
            <div key={group.group} className="mb-8">
              <p className={`px-4 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
                {isCollapsed ? '•••' : group.group}
              </p>
              <ul className="space-y-1.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon
                  const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)

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
                        title={isCollapsed ? item.label : ''}
                        className={`flex items-center rounded-2xl text-sm font-bold transition-all duration-200 group/item relative
                          ${isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'}
                          ${isActive
                            ? 'bg-[#003366] text-white shadow-lg shadow-[#003366]/20'
                            : 'text-slate-500 hover:text-[#003366] hover:bg-[#003366]/5'
                          }`}
                      >
                        <div className="flex items-center gap-3.5 relative">
                          {/* Icon Container with absolute badge for collapsed mode */}
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

                        {/* Notifications / Chevrons for Expanded Mode */}
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
            </div>
          )
        })}
      </nav>

      {/* Footer / Role */}
      <div className={`p-4 border-t border-slate-50 bg-slate-50/30 ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-4' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-800 shadow-sm relative">
              {userRole?.slice(0, 1).toUpperCase()}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#003366] border-2 border-white" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden max-w-[120px]">
                <p className="text-sm font-black text-slate-900 truncate mb-1 leading-tight tracking-tight">{user?.fullName || userRole}</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest truncate">{jobTitle || userRole}</p>
              </div>
            )}
          </div>

          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'gap-1'}`}>
            <Link href="/settings/business" className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
              <Settings size={18} strokeWidth={1.5} />
            </Link>
            <form action={isDemo ? signOutDemo : signOut}>
              <button 
                type="submit" 
                title={isDemo ? "Keluar & Reset Demo" : "Keluar"}
                className={`p-2.5 rounded-xl transition-all ${isDemo ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
              >
                <LogOut size={18} strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  )
}
