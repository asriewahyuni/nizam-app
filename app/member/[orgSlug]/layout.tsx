import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BookOpen,
  LogIn,
  UserRound,
} from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import MemberNavigationClient from './MemberNavigationClient'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  return {
    title: tenant ? `${tenant.portalName} — Member Portal` : 'Member Portal',
    description: tenant
      ? `Courses, orders, subscriptions, and certificates for ${tenant.portalName}.`
      : 'Learning and member portal.',
  }
}

export default async function MemberPortalLayout({ children, params }: LayoutProps) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()

  const member = await getPortalMemberContext(tenant)
  const requestHeaders = await headers()
  const currentHost = String(requestHeaders.get('host') || '').toLowerCase().split(':')[0]
  const isCustomDomain = Boolean(
    tenant.primaryHostname
    && currentHost === tenant.primaryHostname.toLowerCase(),
  )
  const basePath = isCustomDomain ? '' : `/member/${tenant.slug}`
  const portalPath = (cleanPath: string, legacyPath: string) => (
    isCustomDomain ? cleanPath : `${basePath}${legacyPath}`
  )
  const callbackPath = isCustomDomain ? '/dashboard' : (basePath || '/')

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased">
      <a
        href="#konten-utama"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-[var(--color-primary,theme(colors.emerald.800))] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary,theme(colors.emerald.300))]"
      >
        Skip to content
      </a>

      <div
        className="mx-auto flex min-h-screen max-w-[480px] w-full flex-col border-x border-slate-200/80 bg-[#f7fbf9] shadow-2xl relative"
        style={tenant.primaryColor ? {
          '--color-primary': tenant.primaryColor,
          '--color-accent': tenant.accentColor || tenant.primaryColor,
          '--color-accent-hover': tenant.accentColorHover || tenant.accentColor || tenant.primaryColor,
        } as React.CSSProperties : undefined}
      >
        <header className="sticky top-0 z-40 border-b border-[var(--color-primary,theme(colors.emerald.950))]/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-sm">
          <div className="flex min-h-16 items-center gap-3 px-4 justify-between">
            <Link
              href={basePath || '/'}
              className="group flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary,theme(colors.emerald.200))]"
            >
              {tenant.portalLogoUrl ? (
                <img
                  src={tenant.portalLogoUrl}
                  alt={tenant.portalName}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary,theme(colors.emerald.700))] text-white shadow-sm transition-colors duration-200 group-hover:bg-[var(--color-primary,theme(colors.emerald.800))]">
                    <BookOpen aria-hidden="true" size={19} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold tracking-tight">{tenant.portalName}</span>
                    <span className="block text-[10px] font-medium text-[var(--color-accent,theme(colors.emerald.800))]">Member Portal</span>
                  </span>
                </>
              )}
            </Link>

            {member ? (
              <Link
                href={portalPath('/profile', '/profil')}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors duration-200 hover:border-[var(--color-accent,theme(colors.emerald.300))] hover:bg-[var(--color-primary,theme(colors.emerald.700))]/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary,theme(colors.emerald.200))]"
                aria-label={`Open profile of ${member.displayName}`}
              >
                <UserRound aria-hidden="true" size={16} />
                <span className="max-w-24 truncate">{member.displayName}</span>
              </Link>
            ) : (
              <Link
                href={`/login?redirectTo=${encodeURIComponent(callbackPath)}`}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--color-accent,theme(colors.orange.600))] hover:bg-[var(--color-accent-hover,theme(colors.orange.700))] px-3.5 text-xs font-semibold text-white transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-accent,theme(colors.orange.200))]"
              >
                <LogIn aria-hidden="true" size={16} />
                Sign In
              </Link>
            )}
          </div>
        </header>

        <main id="konten-utama" className="flex-grow min-h-[calc(100vh-14rem)] pb-24">
          {children}
        </main>

        <footer className="border-t border-[var(--color-primary,theme(colors.emerald.950))]/10 bg-[var(--color-primary,theme(colors.emerald.950))] text-slate-100 pb-20">
          <div className="flex flex-col gap-3 px-4 py-6">
            <div>
              <p className="text-sm font-semibold">{tenant.portalName}</p>
              <p className="mt-1 text-xs text-slate-300/80 font-medium">Learning and transactions secured by Nizam ERP.</p>
            </div>
          </div>
        </footer>

        <MemberNavigationClient
          member={member}
          tenantSlug={tenant.slug}
          isCustomDomain={isCustomDomain}
          basePath={basePath}
        />
      </div>
    </div>
  )
}
