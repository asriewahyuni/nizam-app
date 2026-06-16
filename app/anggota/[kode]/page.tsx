import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import {
  getAnggotaByUserId,
  getAnggotaByKodeOnly,
  getSimpananByAnggota,
  getAllProyek,
  getPembiayaanByAnggota,
  getPenawaranByAnggota,
  getProyekTersedia,
  getPelatihanTerjadwal,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import { getLaporanByAnggota } from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import AnggotaPortalClient from './AnggotaPortalClient'

export const revalidate = 0

export default async function AnggotaPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>
  searchParams: Promise<{ org?: string }>
}) {
  const { kode } = await params
  const { org } = await searchParams

  const session = await getInternalAuthSession()
  if (!session) redirect(`/anggota/login?org=${org ?? ''}&redirectTo=/anggota/${kode}${org ? `?org=${org}` : ''}`)

  // Cari anggota by user_id scope ke org, lalu fallback by kode (admin preview)
  let anggota = await getAnggotaByUserId(session.user.id, org)
  if (!anggota) {
    anggota = await getAnggotaByKodeOnly(kode, org)
  }

  if (!anggota || anggota.kode_anggota.toUpperCase() !== kode.toUpperCase()) {
    redirect(`/anggota/login?org=${org ?? ''}&redirectTo=/anggota/${kode}${org ? `?org=${org}` : ''}`)
  }

  // Fetch nama organisasi
  const { rows: [orgRow] } = await queryPostgres(
    `SELECT name FROM organizations WHERE id=$1 LIMIT 1`,
    [anggota.org_id]
  )

  const [simpanan, proyekSemua, pembiayaan, penawaran, laporan] = await Promise.all([
    getSimpananByAnggota(anggota.id),
    getAllProyek(anggota.org_id),
    getPembiayaanByAnggota(anggota.id),
    getPenawaranByAnggota(anggota.id),
    getLaporanByAnggota(anggota.id),
  ])

  const proyekDiajukan = proyekSemua.filter(p => p.pengaju_id === anggota.id)

  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.saldo), 0)
  const [proyekTersedia, pelatihan] = await Promise.all([
    getProyekTersedia(anggota.org_id, anggota.id, totalSimpanan),
    getPelatihanTerjadwal(anggota.org_id, anggota.id),
  ])

  return (
    <AnggotaPortalClient
      anggota={anggota}
      simpanan={simpanan}
      proyekDiajukan={proyekDiajukan}
      pembiayaan={pembiayaan}
      penawaran={penawaran}
      laporan={laporan}
      proyekTersedia={proyekTersedia}
      pelatihan={pelatihan}
      orgNama={orgRow?.name ?? 'Koperasi'}
    />
  )
}
