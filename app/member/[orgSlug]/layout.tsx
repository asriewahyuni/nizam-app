import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  DatabaseZap,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Menu,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  return {
    title: tenant ? `${tenant.portalName} — Portal Member` : 'Portal Member',
    description: tenant
      ? `Kelas, pesanan, langganan, dan sertifikat ${tenant.portalName}.`
      : 'Portal pembelajaran dan member.',
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
  const navigation = [
    { href: portalPath('/dashboard', ''), label: 'Beranda', icon: LayoutDashboard },
    { href: portalPath('/courses', '/katalog'), label: 'Katalog', icon: BookOpen },
    ...(member ? [
      { href: portalPath('/my-courses', '/kelas'), label: 'Kelas Saya', icon: GraduationCap },
      { href: portalPath('/consulting', '/konsultasi'), label: 'Consulting 360', icon: BriefcaseBusiness },
      { href: portalPath('/orders', '/pesanan'), label: 'Pesanan', icon: ReceiptText },
      { href: portalPath('/subscriptions', '/langganan'), label: 'Langganan', icon: WalletCards },
      { href: portalPath('/certificates', '/sertifikat'), label: 'Sertifikat', icon: BadgeCheck },
    ] : []),
    ...(member?.isTutor ? [
      { href: portalPath('/tutor', '/tutor'), label: 'Panel Tutor', icon: UsersRound },
      { href: portalPath('/tutor/consulting', '/tutor/konsultasi'), label: 'Jadwal Konsultasi', icon: CalendarClock },
    ] : []),
    ...(member?.isAdmin && !isCustomDomain ? [
      { href: `${basePath}/admin/sertifikat`, label: 'Template Sertifikat', icon: BadgeCheck },
      { href: `${basePath}/admin/migrasi`, label: 'Migrasi', icon: DatabaseZap },
    ] : []),
    ...(member?.isAffiliate ? [
      { href: portalPath('/affiliate', '/afiliasi'), label: 'Afiliasi', icon: PackageCheck },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased">
      <a
        href="#konten-utama"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-emerald-300"
      >
        Lewati ke konten
      </a>

      <div className="mx-auto flex min-h-screen max-w-[480px] w-full flex-col border-x border-slate-200/80 bg-[#f7fbf9] shadow-2xl">
        <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex min-h-16 items-center gap-3 px-4 justify-between">
            <Link
              href={basePath || '/'}
              className="group flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition-colors duration-200 group-hover:bg-emerald-800">
                <BookOpen aria-hidden="true" size={19} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight">{tenant.portalName}</span>
                <span className="block text-[10px] font-medium text-emerald-800">Portal member</span>
              </span>
            </Link>

            {member ? (
              <Link
                href={portalPath('/profile', '/profil')}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                aria-label={`Buka profil ${member.displayName}`}
              >
                <UserRound aria-hidden="true" size={16} />
                <span className="max-w-24 truncate">{member.displayName}</span>
              </Link>
            ) : (
              <Link
                href={`/login?redirectTo=${encodeURIComponent(callbackPath)}`}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                <LogIn aria-hidden="true" size={16} />
                Masuk
              </Link>
            )}
          </div>

          <nav
            aria-label="Navigasi portal"
            className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2"
          >
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                >
                  <Icon aria-hidden="true" size={15} />
                  {item.label}
                </Link>
              )
            })}
            <span className="sr-only">
              <Menu aria-hidden="true" />
            </span>
          </nav>
        </header>

        <main id="konten-utama" className="flex-grow min-h-[calc(100vh-14rem)]">
          {children}
        </main>

        <footer className="border-t border-emerald-950/10 bg-emerald-950 text-emerald-50">
          <div className="flex flex-col gap-3 px-4 py-6">
            <div>
              <p className="text-sm font-semibold">{tenant.portalName}</p>
              <p className="mt-1 text-xs text-emerald-100/75">Pembelajaran dan transaksi dilindungi Nizam ERP.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-100/90">
              <ShieldCheck aria-hidden="true" size={16} />
              Akses terisolasi per organisasi
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
