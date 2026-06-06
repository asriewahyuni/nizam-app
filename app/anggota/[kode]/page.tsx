import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import {
  getAnggotaByUserId,
  getSimpananByAnggota,
  getAllProyek,
  getPembiayaanByAnggota,
  getPenawaranByAnggota,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import AnggotaPortalClient from './AnggotaPortalClient'

export const revalidate = 0

export default async function AnggotaPortalPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params

  const session = await getInternalAuthSession()
  if (!session) redirect('/login')

  // Cari anggota by user_id session
  const anggota = await getAnggotaByUserId(session.user.id)

  if (!anggota || anggota.kode_anggota.toUpperCase() !== kode.toUpperCase()) {
    redirect('/login')
  }

  // Fetch nama organisasi
  const { rows: [org] } = await queryPostgres(
    `SELECT nama FROM organizations WHERE id=$1 LIMIT 1`,
    [anggota.org_id]
  )

  const [simpanan, proyekSemua, pembiayaan, penawaran] = await Promise.all([
    getSimpananByAnggota(anggota.id),
    getAllProyek(anggota.org_id),
    getPembiayaanByAnggota(anggota.id),
    getPenawaranByAnggota(anggota.id),
  ])

  const proyekDiajukan = proyekSemua.filter(p => p.pengaju_id === anggota.id)

  return (
    <AnggotaPortalClient
      anggota={anggota}
      simpanan={simpanan}
      proyekDiajukan={proyekDiajukan}
      pembiayaan={pembiayaan}
      penawaran={penawaran}
      orgNama={org?.nama ?? 'Koperasi'}
    />
  )
}
