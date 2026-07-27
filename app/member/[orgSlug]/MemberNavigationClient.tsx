'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GraduationCap,
  PackageCheck,
  Menu,
  X,
  BookOpen,
  BriefcaseBusiness,
  ReceiptText,
  WalletCards,
  BadgeCheck,
  UsersRound,
  CalendarClock,
  DatabaseZap
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<any>
}

type Props = {
  member: any
  tenantSlug: string
  isCustomDomain: boolean
  basePath: string
  portalPath: (path: string, legacy: string) => string
}

export default function MemberNavigationClient({
  member,
  tenantSlug,
  isCustomDomain,
  basePath,
  portalPath,
}: Props) {
  const pathname = usePathname()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  // Build full list of menu items
  const allItems: NavItem[] = [
    { href: portalPath('/dashboard', ''), label: 'Home', icon: LayoutDashboard },
    ...(tenantSlug !== 'core-isec' ? [
      { href: portalPath('/courses', '/katalog'), label: 'Catalog', icon: BookOpen }
    ] : []),
    ...(member ? [
      { href: portalPath('/my-courses', '/kelas'), label: 'My Courses', icon: GraduationCap },
      { href: portalPath('/consulting', '/konsultasi'), label: 'Consulting 360', icon: BriefcaseBusiness },
      { href: portalPath('/orders', '/pesanan'), label: 'Orders', icon: ReceiptText },
      { href: portalPath('/subscriptions', '/langganan'), label: 'Subscriptions', icon: WalletCards },
      { href: portalPath('/certificates', '/sertifikat'), label: 'Certificates', icon: BadgeCheck },
    ] : []),
    ...(member?.isTutor ? [
      { href: portalPath('/tutor', '/tutor'), label: 'Tutor Panel', icon: UsersRound },
      { href: portalPath('/tutor/consulting', '/tutor/konsultasi'), label: 'Consultation Schedule', icon: CalendarClock },
    ] : []),
    ...(member?.isAdmin && !isCustomDomain ? [
      { href: `${basePath}/admin/sertifikat`, label: 'Certificate Templates', icon: BadgeCheck },
      { href: `${basePath}/admin/migrasi`, label: 'Migration', icon: DatabaseZap },
    ] : []),
    ...(member ? [
      { href: portalPath('/affiliate', '/afiliasi'), label: 'Affiliate', icon: PackageCheck },
    ] : []),
  ]

  // Primary bottom navigation items (3 items + More button)
  const bottomItems = [
    { href: portalPath('/dashboard', ''), label: 'Home', icon: LayoutDashboard },
    { href: portalPath('/my-courses', '/kelas'), label: 'My Courses', icon: GraduationCap },
    { href: portalPath('/affiliate', '/afiliasi'), label: 'Affiliate', icon: PackageCheck },
  ].filter(item => allItems.some(all => all.href === item.href))

  const isSelected = (href: string) => {
    if (href === basePath || href === `${basePath}/`) {
      return pathname === basePath || pathname === `${basePath}/` || pathname.endsWith('/dashboard')
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Bottom Nav Bar with Glassmorphism */}
      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-4 pb-4">
        <nav className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/75 px-3 py-2.5 shadow-lg backdrop-blur-lg">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const active = isSelected(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 transition-all duration-200 ${
                  active
                    ? 'text-[var(--color-primary,theme(colors.emerald.700))] scale-105'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={20} className={active ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 text-slate-500 hover:text-slate-800 transition-all duration-200"
          >
            <Menu size={20} className="stroke-[2px]" />
            <span className="text-[10px] font-bold">More</span>
          </button>
        </nav>
      </div>

      {/* Slide-up Menu Drawer with Glassmorphism overlay */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300">
          {/* Dismiss tap area */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsMoreOpen(false)} />

          {/* Drawer content */}
          <div className="relative w-full max-w-[480px] rounded-t-3xl border-t border-white/30 bg-white/90 p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
            {/* Handle bar */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />

            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Menu</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {allItems.map((item) => {
                const Icon = item.icon
                const active = isSelected(item.href)
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 ${
                      active
                        ? 'border-[var(--color-primary,theme(colors.emerald.50))]/30 bg-[var(--color-primary,theme(colors.emerald.700))]/5 text-[var(--color-primary,theme(colors.emerald.800))] font-semibold'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className={`rounded-xl p-2 transition-colors ${
                      active 
                        ? 'bg-[var(--color-primary,theme(colors.emerald.700))] text-white' 
                        : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Icon size={18} />
                    </span>
                    <span className="text-[10px] leading-tight font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
