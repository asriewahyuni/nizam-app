import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Ambil email dari data auth pengguna saat ini
  const userEmail = session.email || ''

  // Pengecekan krusial: Jika email bukan platform admin,
  // maka segera tendang kembali ke halaman dashboard umum!
  if (!isPlatformAdminEmail(userEmail)) {
    console.warn(`[SECURITY] Percobaan akses tanpa izin ke /admin oleh: ${userEmail}`)
    redirect('/dashboard')
  }

  // Jika aman (bob@executive.id), tampilkan halaman admin SaaS
  return (
    <>
      <div className="bg-amber-100 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 font-bold text-center flex items-center justify-center gap-2">
        <span className="relative flex h-2 w-2">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        SYSADMIN MODE — Anda login sebagai {userEmail}
      </div>
      {children}
    </>
  )
}
