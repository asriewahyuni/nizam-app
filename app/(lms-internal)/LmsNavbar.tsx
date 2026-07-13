'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { to: '/lms', label: 'Dashboard' },
  { to: '/lms/admin', label: 'Course Catalog' },
  { to: '/lms/admin/settings', label: 'Settings' },
]

export default function LmsNavbar({ org }: { org: any }) {
  const pathname = usePathname()

  const lmsBranding = org?.settings?.lms_branding || {}
  const brandName = lmsBranding.name || org?.name || 'Nizam'
  const brandLogo = lmsBranding.logo_url || org?.logo_url

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/lms" className="flex items-center gap-2">
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
              let active = false
              if (item.to === '/lms') {
                active = pathname === '/lms'
              } else if (item.to === '/lms/admin/settings') {
                active = pathname.startsWith('/lms/admin/settings')
              } else if (item.to === '/lms/admin') {
                active = pathname.startsWith('/lms/admin') && !pathname.startsWith('/lms/admin/settings')
              }

              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                    (active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:text-slate-900')
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mr-2"
          >
            &larr; Back to ERP
          </Link>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs font-semibold text-emerald-600">
              ERP Connected
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Buku Besar Active
            </span>
          </div>
          <div className="size-9 rounded-full bg-slate-200 shadow-sm outline outline-1 outline-offset-2 outline-slate-100" />
        </div>
      </div>
    </nav>
  )
}
