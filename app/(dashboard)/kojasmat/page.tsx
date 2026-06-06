import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getAllAnggota, getAllProyek, getAllPelatihan, getKojasmatStats,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  getAllPendaftaran, getAllLaporan, getAllTindakan,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import KojasmatClient from './KojasmatClient'

export const revalidate = 0

export default async function KojasmatPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  const stats       = await getKojasmatStats(orgId)
  const anggota     = await getAllAnggota(orgId)
  const proyek      = await getAllProyek(orgId)
  const pelatihan   = await getAllPelatihan(orgId)
  const pendaftaran = await getAllPendaftaran(orgId)
  const laporan     = await getAllLaporan(orgId)
  const tindakan    = await getAllTindakan(orgId)

  return (
    <KojasmatClient
      orgId={orgId}
      stats={stats}
      anggota={anggota}
      proyek={proyek}
      pelatihan={pelatihan}
      pendaftaran={pendaftaran}
      laporan={laporan}
      tindakan={tindakan}
    />
  )
}
