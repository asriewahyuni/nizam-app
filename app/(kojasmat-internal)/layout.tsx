import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import KojasmatNavbar from './KojasmatNavbar'

export default async function KojasmatLayout({ children }: { children: ReactNode }) {
  const orgData = await getActiveOrg()

  if (!orgData) {
    return redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <KojasmatNavbar org={orgData.org} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
