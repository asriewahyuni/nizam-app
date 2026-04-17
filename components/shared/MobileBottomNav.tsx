'use client'

import Link from 'next/link'
import { useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Store, 
  FileText, 
  History, 
  User 
} from 'lucide-react'
import { hasEnabledModuleAccess, hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { cn } from '@/lib/utils'

const ROUTE_LOADING_START_EVENT = 'nizam_route_loading_start'

type MobileBottomNavProps = {
  userRole: string
  permissions?: string[]
  enabledModules?: string[]
}

export function MobileBottomNav({
  userRole,
  permissions = [],
  enabledModules = [],
}: MobileBottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())

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
    return items.filter((item) => {
      if (item.href === '/profil-saya') return true
      if (!hasRolePermission(userRole, permissions, item.permission_key)) return false
      if (!hasEnabledModuleAccess(enabledModules, item.module_key)) return false
      return true
    })
  }, [enabledModules, items, permissions, userRole])

  return (
    <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center justify-around pb-safe pt-2 px-2">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link 
            key={item.href} 
            href={item.href}
            onMouseEnter={() => prefetchRoute(item.href)}
            onFocus={() => prefetchRoute(item.href)}
            onTouchStart={() => prefetchRoute(item.href)}
            onPointerDown={() => prefetchRoute(item.href)}
            onClick={() => {
              prefetchRoute(item.href)
              notifyRouteLoadingStart()
            }}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
              isActive ? "text-[#003366]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl",
              isActive ? "bg-blue-50" : "bg-transparent"
            )}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
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
