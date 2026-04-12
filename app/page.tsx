import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import OnboardingPage from './onboarding/page'

export default async function HomePage() {
  const session = await getSession()

  // Visitor publik / tanpa sesi langsung lempar ke halaman login
  if (!session) {
    redirect('/login')
  }

  const orgData = await getActiveOrg()
  
  // Jika sudah login tapi belum punya organisasi, selesaikan Onboarding
  if (!orgData) {
    return <OnboardingPage />
  }

  // Jika semua lengkap, masuk ke Dashboard
  redirect('/dashboard')
}
