import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'

export default async function SaaSOperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const email = session.email || ''
  if (!isPlatformAdminEmail(email)) {
    redirect('/dashboard')
  }

  return (
    <>
      <div className="print:hidden bg-indigo-100 border-b border-indigo-200 text-indigo-800 text-xs px-4 py-2 font-bold text-center">
        SAAS OPERATOR MODE — Akses khusus pengelola platform
      </div>
      {children}
    </>
  )
}
