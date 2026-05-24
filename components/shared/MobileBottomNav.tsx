'use client'

import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  FileText,
  History,
  User,
  Lock,
} from 'lucide-react'
import { hasEnabledModuleAccess, hasPosOnlyAccess, hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { cn } from '@/lib/utils'

const ROUTE_LOADING_START_EVENT = 'nizam_route_loading_start'
const ATTENDANCE_FREE_ROUTES = ['/karyawan', '/profil-saya', '/billing']

type MobileBottomNavProps = {
  userRole: string
  permissions?: string[]
  enabledModules?: string[]
  requiresAttendanceGate?: boolean
  hasClockedInToday?: boolean
}

export function MobileBottomNav({
  userRole,
  permissions = [],
  enabledModules = [],
  requiresAttendanceGate = false,
  hasClockedInToday = false,
}: MobileBottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())
  const [attendanceToast, setAttendanceToast] = useState(false)

  const isAttendanceFree = (href: string) =>
    ATTENDANCE_FREE_ROUTES.some((r) => href === r || href.startsWith(r + '/'))

  const isLockedByAttendance = (href: string) =>
    requiresAttendanceGate && !hasClockedInToday && !isAttendanceFree(href)

  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setAttendanceToast(true)
    setTimeout(() => setAttendanceToast(false), 3000)
  }

  const prefetchRoute = useCallback((href: string) => {
    const normalizedHref = String(href || '').trim()
    if (!normalizedHref || normalizedHref === pathname || prefetchedRoutesRef.current.has(normalizedHref)) {
      return
    }

    prefetchedRoutesRef.current.add(normalizedHref)
    void router.prefetch(normalizedHref)
  }, [pathname, router])

  const notifyRouteLoadingStart = () => {
    window.dispatchEvent(new Event(ROUTE_LOADING_START_EVENT))
  }

  const items = useMemo(() => ([
    { label: 'Dash', href: '/dashboard', icon: LayoutDashboard, permission_key: 'dashboard' },
    { label: 'POS', href: '/pos', icon: Store, permission_key: 'pos', module_key: 'POS' },
    { label: 'Laporan', href: '/reports', icon: FileText, permission_key: 'reports', module_key: 'Reports' },
    { label: 'Audit', href: '/accounting/audit', icon: History, permission_key: 'audit', module_key: 'Audit' },
    { label: 'Akun', href: '/profil-saya', icon: User },
  ]), [])

  const visibleItems = useMemo(() => {
    const isPosOnlyUser = hasPosOnlyAccess(userRole, permissions)

    return items.filter((item) => {
      if (isPosOnlyUser && item.href !== '/pos') return false
      if (item.href === '/profil-saya') return true
      if (!hasRolePermission(userRole, permissions, item.permission_key)) return false
      if (!hasEnabledModuleAccess(enabledModules, item.module_key)) return false
      return true
    })
  }, [enabledModules, items, permissions, userRole])

  return (
    <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center justify-around pb-safe pt-2 px-2">
      {/* Attendance Gate Toast */}
      {attendanceToast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-2 fade-in duration-200 pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap">
            <Lock size={12} className="text-amber-400 shrink-0" />
            <span>Clock-in dulu untuk akses menu ini</span>
          </div>
        </div>
      )}

      {visibleItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        const locked = isLockedByAttendance(item.href)
        return (
          <Link
            key={item.href}
            href={locked ? '/karyawan' : item.href}
            onMouseEnter={() => !locked && prefetchRoute(item.href)}
            onFocus={() => !locked && prefetchRoute(item.href)}
            onTouchStart={() => !locked && prefetchRoute(item.href)}
            onPointerDown={() => !locked && prefetchRoute(item.href)}
            onClick={(e) => {
              if (locked) { handleLockedClick(e); return }
              prefetchRoute(item.href)
              notifyRouteLoadingStart()
            }}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-colors relative",
              locked ? "opacity-40" : isActive ? "text-[#003366]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl relative",
              isActive && !locked ? "bg-blue-50" : "bg-transparent"
            )}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {locked && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center">
                  <Lock size={7} className="text-white" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
