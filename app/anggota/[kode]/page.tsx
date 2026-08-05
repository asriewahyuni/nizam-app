import { redirect } from 'next/navigation'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveInternalUserId } from '@/lib/auth/internal-auth.shared'
import { queryPostgres } from '@/lib/db/postgres'
import {
  getAnggotaByUserId,
  getAnggotaByKodeOnly,
  getSimpananByAnggota,
  getSetoranByAnggota,
  getAllProyek,
  getPembiayaanByAnggota,
  getPenawaranByAnggota,
  getProyekTersedia,
  getPelatihanTerjadwal,
  isOrgAdminOrManajemen,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import { getLaporanByAnggota } from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import { getAkadIjarahByAnggota } from '@/modules/kojasmat/actions/kojasmat-ijarah.actions'
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

  // Cari anggota by user_id scope ke org, lalu fallback by kode HANYA untuk
  // owner/admin/manajer organisasi terkait (preview) — bukan sembarang staf yang login.
  let anggota = await getAnggotaByUserId(resolveInternalUserId(session), org)
  if (!anggota) {
    const preview = await getAnggotaByKodeOnly(kode, org)
    // isOrgAdminOrManajemen mengecek org_members, yang menyimpan legacy_user_id
    // (session.user.id mentah) — berbeda dari kojasmat_anggota.user_id yang FK ke internal_auth_users(id).
    if (preview && await isOrgAdminOrManajemen(session.user.id, preview.org_id)) {
      anggota = preview
    }
  }

  if (!anggota || anggota.kode_anggota.toUpperCase() !== kode.toUpperCase()) {
    redirect(`/anggota/login?org=${org ?? ''}&redirectTo=/anggota/${kode}${org ? `?org=${org}` : ''}`)
  }

  // Fetch nama organisasi
  const { rows: [orgRow] } = await queryPostgres(
    `SELECT name FROM organizations WHERE id=$1 LIMIT 1`,
    [anggota.org_id]
  )

  const [simpanan, setoran, proyekSemua, pembiayaan, penawaran, laporan, akadIjarah] = await Promise.all([
    getSimpananByAnggota(anggota.id),
    getSetoranByAnggota(anggota.id),
    getAllProyek(anggota.org_id),
    getPembiayaanByAnggota(anggota.id),
    getPenawaranByAnggota(anggota.id),
    getLaporanByAnggota(anggota.id),
    getAkadIjarahByAnggota(anggota.id),
  ])

  const proyekDiajukan = proyekSemua.filter(p => p.pengaju_id === anggota.id)

  // Kapasitas investasi hanya dari simpanan SUKARELA — pokok/wajib adalah setoran
  // keanggotaan, bukan dana yang boleh dipakai membiayai proyek.
  const saldoSukarela = Number(simpanan.find(s => s.jenis === 'SUKARELA')?.saldo ?? 0)
  const [proyekTersedia, pelatihan] = await Promise.all([
    getProyekTersedia(anggota.org_id, anggota.id, saldoSukarela),
    getPelatihanTerjadwal(anggota.org_id, anggota.id),
  ])

  return (
    <AnggotaPortalClient
      anggota={anggota}
      simpanan={simpanan}
      setoran={setoran}
      proyekDiajukan={proyekDiajukan}
      pembiayaan={pembiayaan}
      penawaran={penawaran}
      laporan={laporan}
      proyekTersedia={proyekTersedia}
      pelatihan={pelatihan}
      akadIjarah={akadIjarah}
      orgNama={orgRow?.name ?? 'Koperasi'}
    />
  )
}
