import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getAnggotaByUserId } from '@/modules/kojasmat/actions/kojasmat.actions'
import AnggotaLoginClient from './AnggotaLoginClient'

export const metadata = { title: 'Login Anggota — Portal Koperasi Syariah' }

export default async function AnggotaLoginPage() {
  // Jika sudah login dan adalah anggota, langsung ke portal mereka
  const session = await getInternalAuthSession()
  if (session) {
    const anggota = await getAnggotaByUserId(session.user.id)
    if (anggota) {
      redirect(`/anggota/${anggota.kode_anggota}`)
    }
  }

  return (
    <Suspense fallback={null}>
      <AnggotaLoginClient />
    </Suspense>
  )
}
