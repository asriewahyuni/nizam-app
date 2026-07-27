import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'

// Guard sesi untuk /onboarding: tanpa ini, user yang sesinya sudah expired/logout
// tetap bisa melihat form onboarding dan hanya mendapat error "Tidak terautentikasi"
// saat submit, tanpa arah keluar ke halaman login.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <>{children}</>
}
