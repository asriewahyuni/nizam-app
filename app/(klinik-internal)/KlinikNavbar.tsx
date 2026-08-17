'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Stethoscope, ArrowLeft } from 'lucide-react'

const nav = [
  { to: '/klinik', label: 'Dashboard Klinik' },
]

type KlinikNavbarOrg = { name?: string | null; logo_url?: string | null }

export default function KlinikNavbar({ org }: { org: KlinikNavbarOrg | null | undefined }) {
  const pathname = usePathname()

  const brandName = org?.name || 'Klinik'
  const brandLogo = org?.logo_url

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/klinik" className="flex items-center gap-2">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-8 w-auto rounded object-contain"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-600 text-white">
                <Stethoscope className="size-4" aria-hidden="true" />
              </div>
            )}
            <span className="text-lg font-semibold tracking-tight">
              {brandName}
            </span>
          </Link>
          <div className="hidden gap-1 md:flex">
            {nav.map((item) => {
              const active = pathname === item.to

              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ' +
                    (active
                      ? 'bg-cyan-50 text-cyan-700'
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
            className="mr-2 flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Kembali ke ERP
          </Link>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs font-semibold text-cyan-600">
              ERP Connected
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Akuntansi Active
            </span>
          </div>
          <div className="size-9 rounded-full bg-slate-200 shadow-sm outline outline-1 outline-offset-2 outline-slate-100" />
        </div>
      </div>
    </nav>
  )
}
