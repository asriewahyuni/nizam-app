import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import OnboardingPage from './onboarding/page'

export default async function HomePage() {
  const session = await getSession()
  
  // 1. Jika belum login, barulah kita paksa ke halaman login
  if (!session) {
    redirect('/login')
  }

  const orgData = await getActiveOrg()
  
  // 2. Jika sudah login tapi belum punya organisasi, Tampilkan langsung Onboarding di halaman utama
  if (!orgData) {
    return <OnboardingPage />
  }

  // 3. Jika sudah lengkap semua, barulah masuk ke Dashboard
  redirect('/dashboard')
}
