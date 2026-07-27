import React from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'

export const metadata = {
  title: 'LMS Portal',
  description: 'Learning Management System',
}

export default async function LMSLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getInternalAuthSession()
  const isLoggedIn = !!session?.user

  // Fetch organization settings from DB to resolve branding dynamically
  const orgResult = await queryPostgres<{ name: string; logo_url: string | null; settings: any }>(
    `SELECT name, logo_url, settings FROM public.organizations WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
    [orgSlug]
  )
  const org = orgResult.rows[0]
  const branding = org?.settings?.lms_branding
  const brandingRecord = branding && typeof branding === 'object'
    ? branding as Record<string, unknown>
    : {}

  const portalName = String(brandingRecord.name || org?.name || 'LMS Portal')
  const portalLogoUrl = String(brandingRecord.logo_url || org?.logo_url || '') || null
  const primaryColor = String(brandingRecord.primary_color || '') || null
  const accentColor = String(brandingRecord.accent_color || '') || null
  const accentColorHover = String(brandingRecord.accent_color_hover || '') || null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased flex flex-col">
      <div
        className="mx-auto flex min-h-screen max-w-[480px] w-full flex-col border-x border-slate-200/80 bg-[#f7fbf9] shadow-2xl"
        style={primaryColor ? {
          '--color-primary': primaryColor,
          '--color-accent': accentColor || primaryColor,
          '--color-accent-hover': accentColorHover || accentColor || primaryColor,
        } as React.CSSProperties : undefined}
      >
        <header className="sticky top-0 z-50 border-b border-emerald-950/10 border-[var(--color-primary)]/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex min-h-16 items-center gap-3 px-4 justify-between">
            <div className="flex items-center gap-2.5">
              {portalLogoUrl ? (
                <Link href={`/lms/${orgSlug}`}>
                  <img
                    src={portalLogoUrl}
                    alt={portalName}
                    className="h-8 w-auto object-contain"
                  />
                </Link>
              ) : (
                <>
                  <div className="w-10 h-10 bg-emerald-700 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-white shadow-sm">
                    <BookOpen size={19} />
                  </div>
                  <div>
                    <Link href={`/lms/${orgSlug}`} className="text-sm font-bold text-slate-900 tracking-tight hover:text-[var(--color-primary,theme(colors.indigo.600))] transition-colors">
                      {portalName}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{orgSlug}</p>
                  </div>
                </>
              )}
            </div>
            <nav className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link href={`/lms/${orgSlug}/my-progress`} className="text-xs font-bold text-slate-600 hover:text-[var(--color-primary,theme(colors.indigo.600))] transition-colors">
                    Kelas Saya
                  </Link>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                    <span className="text-xs font-semibold text-slate-700 max-w-24 truncate">
                      {String(session?.user?.user_metadata.full_name || session?.user?.email || 'Member')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    href={`/login?callbackUrl=/lms/${orgSlug}`}
                    className="text-xs font-bold text-[var(--color-primary,theme(colors.indigo.600))] hover:text-[var(--color-accent,theme(colors.indigo.700))] transition-colors"
                  >
                    Masuk
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        
        <main className="flex-1 w-full">
          {children}
        </main>
        
        <footer className="border-t border-emerald-950/10 border-[var(--color-primary)]/10 bg-emerald-950 bg-[var(--color-primary)] text-emerald-50 py-6 mt-auto">
          <div className="px-4 text-center">
            <p className="text-[10px] text-emerald-100/75 font-medium">Powered by NIZAM ERP</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
