import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { NizamLandingPage } from '@/components/marketing/NizamLandingPage'
import OnboardingPage from './onboarding/page'

export const metadata: Metadata = {
  title: 'Mini ERP Modular untuk Operasional Bisnis yang Lebih Rapi',
  description:
    'NIZAM adalah mini ERP modular untuk bisnis yang ingin merapikan keuangan, stok, penjualan, SDM, approval, zakat, dan strategi BSC dalam satu alur kerja.',
}

export default async function HomePage() {
  const session = await getSession()

  // Visitor publik melihat landing page. User yang sudah login tetap
  // mengikuti flow lama: onboarding bila belum punya org, dashboard bila sudah siap.
  if (!session) {
    return <NizamLandingPage />
  }

  const orgData = await getActiveOrg()
  
  // 2. Jika sudah login tapi belum punya organisasi, Tampilkan langsung Onboarding di halaman utama
  if (!orgData) {
    return <OnboardingPage />
  }

  // 3. Jika sudah lengkap semua, barulah masuk ke Dashboard
  redirect('/dashboard')
}
