import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import KlinikNavbar from './KlinikNavbar'

const ALLOWED_STAFF_TYPES = ['owner', 'admin', 'staff']

export default async function KlinikLayout({ children }: { children: ReactNode }) {
  const session = await getInternalAuthSession()
  if (!session) {
    const pathname = (await headers()).get('x-pathname') || '/klinik'
    redirect(`/login?redirectTo=${encodeURIComponent(pathname)}`)
  }

  // Allowlist positif — beda dari app/(kojasmat-internal)/layout.tsx yang cuma
  // cek `if (!session)`. Tanpa allowlist ini, akun user_type lain (mis. akun
  // portal pasien) yang sudah login bisa membuka area staf klinik cukup
  // dengan mengetik URL-nya langsung.
  const loginType = String(session.user.user_metadata?.login_type || '').toLowerCase()
  if (loginType === 'pasien') {
    redirect('/pasien/login')
  }
  if (!ALLOWED_STAFF_TYPES.includes(loginType)) {
    redirect('/login')
  }

  const orgData = await getActiveOrg()
  if (!orgData) {
    return redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <KlinikNavbar org={orgData.org} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
