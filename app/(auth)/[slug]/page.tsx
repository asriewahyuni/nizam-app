import { redirect } from 'next/navigation'
import { resolveOrgBySlug } from '@/modules/organization/actions/org.actions'
import LoginFormClient from '@/app/(auth)/login/LoginFormClient'

interface SlugLoginPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SlugLoginPageProps) {
  const { slug } = await params
  const org = await resolveOrgBySlug(slug)
  return {
    title: org ? `Login Karyawan · ${org.name}` : 'Masuk Ke Sistem NIZAM',
  }
}

export default async function SlugLoginPage({ params }: SlugLoginPageProps) {
  const { slug } = await params
  const orgContext = await resolveOrgBySlug(slug)

  // Slug tidak ditemukan / org tidak aktif → redirect ke login utama
  if (!orgContext) {
    redirect('/login')
  }

  return <LoginFormClient orgContext={orgContext} />
}
