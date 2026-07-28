'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  HandCoins,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
import LmsAdminAudioNotifier from './lms/admin/LmsAdminAudioNotifier'

const nav = [
  { to: '/lms', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lms/admin', label: 'Course Catalog', icon: BookOpen },
  { to: '/lms/admin/members', label: 'Member Directory', icon: Users },
  { to: '/lms/admin/penjualan', label: 'Sales & Access', icon: ShoppingCart },
  { to: '/lms/admin/afiliasi', label: 'Afiliasi', icon: HandCoins },
  { to: '/lms/admin/settings', label: 'Settings', icon: Settings },
]

function isNavItemActive(pathname: string, target: string) {
  if (target === '/lms') return pathname === '/lms'
  if (target === '/lms/admin/members') return pathname.startsWith('/lms/admin/members')
  if (target === '/lms/admin/settings') return pathname.startsWith('/lms/admin/settings')
  if (target === '/lms/admin/penjualan') return pathname.startsWith('/lms/admin/penjualan')
  if (target === '/lms/admin/afiliasi') return pathname.startsWith('/lms/admin/afiliasi')
  if (target === '/lms/admin') {
    return (
      pathname.startsWith('/lms/admin') &&
      !pathname.startsWith('/lms/admin/members') &&
      !pathname.startsWith('/lms/admin/settings') &&
      !pathname.startsWith('/lms/admin/penjualan') &&
      !pathname.startsWith('/lms/admin/afiliasi')
    )
  }
  return pathname.startsWith(target)
}

export default function LmsNavbar({ org }: { org: any }) {
  const pathname = usePathname()

  const lmsBranding = org?.settings?.lms_branding || {}
  const brandName = lmsBranding.name || org?.name || 'Nizam'
  const brandLogo = lmsBranding.logo_url || org?.logo_url

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/lms"
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-8 w-auto rounded object-contain"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white uppercase">
                {brandName.substring(0, 1)}
              </div>
            )}
            <span className="text-lg font-semibold tracking-tight">
              {brandName}
            </span>
          </Link>
          <div className="hidden gap-1 md:flex">
            {nav.map((item) => {
              const active = isNavItemActive(pathname, item.to)
              const Icon = item.icon

              return (
                <Link
                  key={item.to}
                  href={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ' +
                    (active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                  }
                >
                  <Icon aria-hidden="true" size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {org?.id && <LmsAdminAudioNotifier orgId={org.id} />}
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            <span className="hidden sm:inline">Back to ERP</span>
          </Link>
          <div className="hidden flex-col items-end lg:flex">
            <span className="text-xs font-semibold text-emerald-600">
              ERP Connected
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Active Ledger
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 md:hidden">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto py-2">
          {nav.map((item) => {
            const active = isNavItemActive(pathname, item.to)
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                href={item.to}
                aria-current={active ? 'page' : undefined}
                className={
                  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ' +
                  (active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                }
              >
                <Icon aria-hidden="true" size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
