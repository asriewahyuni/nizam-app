import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getAllProyek, getAllTabungan, getAllAnggota } from '@/modules/kojasmat/actions/kojasmat.actions'
import KojasmatClient from './KojasmatClient'

export const revalidate = 0

export default async function KojasmatPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  const [proyek, tabungan, anggota] = await Promise.all([
    getAllProyek(orgId),
    getAllTabungan(orgId),
    getAllAnggota(orgId),
  ])

  return (
    <KojasmatClient
      orgId={orgId}
      proyek={proyek}
      tabungan={tabungan}
      anggota={anggota}
    />
  )
}
