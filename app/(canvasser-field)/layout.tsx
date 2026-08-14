import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { checkModuleRouteAccess } from '@/modules/organization/lib/navigation-access'
import { queryPostgres } from '@/lib/db/postgres'

// Shell PWA minimal untuk layar canvasser lapangan — tanpa sidebar/header ERP
// dashboard, full-bleed mobile frame. Guard akses direplikasi dari entry
// '/sales/co-sales' di app/(dashboard)/layout.tsx via checkModuleRouteAccess
// supaya perilaku ACL tetap sama walau route ini dipindah keluar dari sana.
export const metadata: Metadata = {
  title: 'Canvasser - Nizam ERP',
  description: 'Aplikasi lapangan canvasser — kunjungan, order, dan piutang.',
  manifest: '/canvasser-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Canvasser',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

const VAN_LINK_RE = /^\/sales\/co-sales\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i

// Sesi bisa expired (cookie masih ada, tapi tokennya sudah lewat 30 hari) di
// tengah pemakaian link van yang di-bookmark PIC lapangan. Beda dengan "belum
// pernah login" (ditangkap proxy sebelum sampai sini), arahkan balik ke login
// ber-slug org supaya PIC tidak nyasar ke /login generik tanpa redirectTo.
async function resolveVanReloginPath(pathname: string): Promise<string> {
  const match = pathname.match(VAN_LINK_RE)
  if (match) {
    try {
      const { rows } = await queryPostgres<{ slug: string }>(
        `select o.slug from public.canvasser_vans v
         join public.organizations o on o.id = v.org_id
         where v.id = $1::uuid and o.is_active = true limit 1`,
        [match[1]],
      )
      if (rows[0]?.slug) return `/${rows[0].slug}?redirectTo=${encodeURIComponent(pathname)}`
    } catch {
      // fallback ke /login generik di bawah
    }
  }
  return `/login?redirectTo=${encodeURIComponent(pathname)}`
}

export default async function CanvasserFieldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getInternalAuthSession()
  if (!session) {
    const pathname = (await headers()).get('x-pathname') || '/'
    redirect(await resolveVanReloginPath(pathname))
  }

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const allowed = checkModuleRouteAccess({
    enabledModules: orgData.enabledModules,
    permissions: orgData.permissions,
    role: orgData.role,
    requiredModule: 'Mobile Canvassing',
    aliases: ['Canvassing', 'Mobile Stock', 'Mobile POS'],
    permissionKeys: ['sales', 'canvassing'],
  })
  if (!allowed) redirect('/')

  return (
    <div className="min-h-screen bg-slate-50 md:flex md:items-center md:justify-center md:bg-slate-100 md:p-8">
      {/* Di layar lebar, shell mobile ini dipusatkan sebagai frame seukuran HP
          (bukan melebar penuh) — md:transform sengaja dipasang tanpa translate/scale
          apa pun supaya jadi containing block CSS untuk elemen `fixed` di dalam
          VanOperationalClient (bottom action bar), agar tetap menempel di frame
          ini alih-alih membentang penuh ke tepi browser. */}
      <div className="flex flex-col overscroll-none bg-slate-50 md:h-[calc(100vh-4rem)] md:w-full md:max-w-[440px] md:overflow-y-auto md:rounded-[32px] md:border md:border-slate-200/80 md:shadow-2xl md:transform">
        {children}
      </div>
    </div>
  )
}
