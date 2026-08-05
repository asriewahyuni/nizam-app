'use server'

// Kojasmat — platform koperasi syariah: anggota, simpanan, proyek, pembiayaan, DPS, pelatihan

import { queryPostgres, connectPostgresClient } from '@/lib/db/postgres'
import { getInternalAuthSession, createInternalAuthUser } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'
import {
  jurnalSetorSimpanan,
  jurnalTarikSimpanan,
  jurnalPenerimaanDanaPemodal,
  jurnalUjrahMudharabah,
  jurnalUjrahMurabahah,
  jurnalPembatalanPembiayaan,
  jurnalPembatalanUjrah,
} from '@/lib/erp-bridge/kojasmat-journals'
import { generateTempPassword } from '../lib/temp-password'
import { enqueueNotification } from '@/modules/notifications/outbox.server'

// session.user.id bisa berisi legacy_user_id (Supabase UUID), bukan internal_auth_users.id.
// Gunakan fungsi ini untuk FK yang merujuk ke internal_auth_users(id).
function getInternalUserId(session: { user: { id: string; user_metadata: Record<string, unknown> } }): string {
  return (session.user.user_metadata['internal_user_id'] as string | null) ?? session.user.id
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type KojasmatAnggota = {
  id: string
  org_id: string
  kode_anggota: string
  nama: string
  nik?: string
  email?: string
  phone?: string
  alamat?: string
  pekerjaan?: string
  status: 'CALON' | 'AKTIF' | 'TIDAK_AKTIF' | 'DIBEKUKAN'
  is_verified: boolean
  user_id?: string
  joined_at?: string
  notes?: string
  created_at: string
}

export type KojasmatSimpanan = {
  id: string
  anggota_id: string
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'
  saldo: number
}

export type KojasmatSimpananMutasi = {
  id: string
  simpanan_id: string
  anggota_id: string
  jenis_mutasi: 'SETOR' | 'TARIK' | 'BAGI_HASIL' | 'KOREKSI'
  jumlah: number
  saldo_sebelum: number | null
  saldo_sesudah: number | null
  keterangan?: string
  tanggal: string
  status: 'PENDING' | 'DISETUJUI' | 'DITOLAK'
  metode_bayar?: 'TRANSFER' | 'QRIS' | null
  bukti_dokumen_id?: string | null
  catatan_admin?: string | null
  direview_oleh?: string | null
  direview_at?: string | null
  created_at: string
}

export type KojasmatProyek = {
  id: string
  org_id: string
  pengaju_id: string
  pengaju_nama?: string
  kode_proyek: string
  nama_proyek: string
  deskripsi?: string
  jenis_akad: 'MURABAHAH' | 'MUDHARABAH' | 'INAN'
  kebutuhan_modal: number
  modal_terkumpul: number
  ujrah_nominal: number
  ujrah_wakalah_akad: number
  nisbah_pengaju: number
  nisbah_pemodal: number
  min_investasi: number
  durasi_bulan: number
  tanggal_mulai?: string
  tanggal_selesai?: string
  status: string
  agunan?: string
  notes?: string
  created_at: string
  // alur DMR/DPS → funding → akad
  proposal_version?: number
  funding_mulai?: string
  funding_selesai?: string
  funding_instruksi?: string
  target_modal_awal?: number
  funding_dibuka_at?: string
  funding_ditutup_at?: string
  // joined fields untuk tampilan portal
  is_berminat?: boolean
  sudah_dibiayai?: boolean
  jumlah_minat?: number
  published_at?: string
}

export type KojasmatProyekDiskusi = {
  id: string
  org_id: string
  proyek_id: string
  actor_id: string
  pesan: string
  created_at: string
  // joined fields
  actor_name?: string
}

export type KojasmatProyekReview = {
  id: string
  org_id: string
  proyek_id: string
  tahap: 'DMR' | 'DPS'
  keputusan: 'DISETUJUI' | 'REVISI' | 'DITOLAK'
  catatan?: string
  reviewer_id?: string
  proposal_version: number
  reviewed_at: string
}

export type KojasmatProyekHistory = {
  id: string
  org_id: string
  proyek_id: string
  status_dari?: string
  status_ke: string
  aksi: string
  pesan?: string
  actor_id?: string
  actor_role?: string
  proposal_version?: number
  created_at: string
}

export type KojasmatAkad = {
  id: string
  org_id: string
  proyek_id: string
  tanggal_akad?: string
  jadwal_akad?: string
  saksi_koperasi_id?: string
  saksi_nama?: string
  saksi_2_nama?: string
  pihak_hadir?: unknown
  catatan?: string
  status: 'MENUNGGU_TTD' | 'DITANDATANGANI' | 'BATAL'
  dokumen_file_key?: string
  dokumen_nama_file?: string
  finalized_by?: string
  finalized_at?: string
  created_at: string
  updated_at?: string
}

export type KojasmatPembiayaan = {
  id: string
  proyek_id: string
  pemodal_id: string
  pemodal_nama?: string
  jumlah: number
  porsi_pct: number
  status: 'AKTIF' | 'SELESAI' | 'GAGAL'
  kehadiran_akad?: 'SENDIRI' | 'DIWAKILKAN'
  ujrah_diwakilkan?: number
  created_at: string
  // joined from proyek
  nama_proyek?: string
  jenis_akad?: string
  proyek_status?: string
  kebutuhan_modal?: number
  modal_terkumpul?: number
  ujrah_nominal?: number
}

export type KojasmatPelatihan = {
  id: string
  org_id: string
  judul: string
  deskripsi?: string
  instruktur?: string
  tanggal: string
  lokasi?: string
  kuota: number
  status: 'TERJADWAL' | 'SELESAI' | 'DIBATALKAN'
  peserta_count?: number
}

export type KojasmatDpsReview = {
  id: string
  proyek_id: string
  reviewer_id?: string
  keputusan: 'DISETUJUI' | 'DITOLAK' | 'REVISI'
  catatan?: string
  reviewed_at: string
}

export type KojasmatPenawaran = {
  id: string
  proyek_id: string
  anggota_id: string
  status: 'TERKIRIM' | 'DIBACA' | 'BERMINAT' | 'DIABAIKAN'
  sent_at: string
  nama_proyek?: string
  jenis_akad?: string
  kebutuhan_modal?: number
  modal_terkumpul?: number
  ujrah_nominal?: number
  ujrah_wakalah_akad?: number
  durasi_bulan?: number
  proyek_status?: string
}

// ─── ANGGOTA ─────────────────────────────────────────────────────────────────

export async function getAllAnggota(orgId: string): Promise<KojasmatAnggota[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_anggota WHERE org_id = $1 ORDER BY kode_anggota ASC`,
    [orgId]
  )
  return rows as KojasmatAnggota[]
}

export async function getAnggotaByKode(orgId: string, kode: string): Promise<KojasmatAnggota | null> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_anggota WHERE org_id = $1 AND kode_anggota = $2 LIMIT 1`,
    [orgId, kode]
  )
  return (rows[0] ?? null) as KojasmatAnggota | null
}

export async function getAnggotaByUserId(userId: string, orgId?: string): Promise<KojasmatAnggota | null> {
  const { rows } = orgId
    ? await queryPostgres(
        `SELECT * FROM kojasmat_anggota WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
        [userId, orgId]
      )
    : await queryPostgres(
        `SELECT * FROM kojasmat_anggota WHERE user_id = $1 LIMIT 1`,
        [userId]
      )
  return (rows[0] ?? null) as KojasmatAnggota | null
}

export async function getAnggotaByKodeOnly(kode: string, orgId?: string): Promise<KojasmatAnggota | null> {
  const { rows } = orgId
    ? await queryPostgres(
        `SELECT * FROM kojasmat_anggota WHERE UPPER(kode_anggota) = UPPER($1) AND org_id = $2 LIMIT 1`,
        [kode, orgId]
      )
    : await queryPostgres(
        `SELECT * FROM kojasmat_anggota WHERE UPPER(kode_anggota) = UPPER($1) LIMIT 1`,
        [kode]
      )
  return (rows[0] ?? null) as KojasmatAnggota | null
}

// Preview data anggota oleh staf hanya boleh untuk owner/admin/manajer organisasi terkait —
// mencegah karyawan tanpa wewenang mengintip simpanan & data pribadi anggota lain.
export async function isOrgAdminOrManajemen(userId: string, orgId: string): Promise<boolean> {
  if (!userId || !orgId) return false
  const { rows } = await queryPostgres(
    `SELECT role FROM org_members WHERE user_id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [userId, orgId]
  )
  const role = String(rows[0]?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export async function createAnggota(payload: {
  org_id: string
  nama: string
  nik?: string
  email?: string
  phone?: string
  alamat?: string
  pekerjaan?: string
  joined_at?: string
  notes?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: lastRow } = await queryPostgres(
    `SELECT kode_anggota FROM kojasmat_anggota WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [payload.org_id]
  )
  let nextNum = 1
  if (lastRow[0]) {
    const match = String(lastRow[0].kode_anggota).match(/\d+$/)
    if (match) nextNum = parseInt(match[0]) + 1
  }
  const kode = `KJM-${String(nextNum).padStart(3, '0')}`

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_anggota
       (org_id, kode_anggota, nama, nik, email, phone, alamat, pekerjaan, joined_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      payload.org_id, kode, payload.nama,
      payload.nik ?? null, payload.email ?? null,
      payload.phone ?? null, payload.alamat ?? null,
      payload.pekerjaan ?? null,
      payload.joined_at ?? null, payload.notes ?? null,
    ]
  )

  const anggota = rows[0]
  await queryPostgres(
    `INSERT INTO kojasmat_simpanan (org_id, anggota_id, jenis)
     VALUES ($1,$2,'POKOK'),($1,$2,'WAJIB'),($1,$2,'SUKARELA')`,
    [payload.org_id, anggota.id]
  )

  // Anggota butuh akun login portal member (kode anggota + password) — provisikan
  // internal_auth_users di sini supaya anggota yang dibuat manual maupun lewat bulk
  // import bisa langsung login, bukan cuma tercatat sebagai data tanpa kredensial.
  let tempPassword: string | null = null
  let loginIdentifier: string | null = null
  if (payload.email || payload.nik) {
    tempPassword = generateTempPassword()
    const userResult = await createInternalAuthUser({
      email: payload.email ?? null,
      nik: payload.nik ?? null,
      password: tempPassword,
      fullName: payload.nama,
      userType: 'member',
    })
    if ('error' in userResult) {
      tempPassword = null
    } else {
      await queryPostgres(
        `UPDATE kojasmat_anggota SET user_id=$2 WHERE id=$1`,
        [anggota.id, userResult.internalUserId]
      )
      loginIdentifier = payload.email ?? payload.nik ?? null
    }
  }

  revalidatePath('/kojasmat')
  return { data: anggota as KojasmatAnggota, tempPassword, loginIdentifier }
}

export async function updateAnggota(id: string, payload: Partial<KojasmatAnggota>) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_anggota
     SET nama=$2, nik=$3, email=$4, phone=$5, alamat=$6, pekerjaan=$7,
         status=$8, is_verified=$9, joined_at=$10, notes=$11, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [
      id, payload.nama, payload.nik ?? null, payload.email ?? null,
      payload.phone ?? null, payload.alamat ?? null, payload.pekerjaan ?? null,
      payload.status ?? 'CALON', payload.is_verified ?? false,
      payload.joined_at ?? null, payload.notes ?? null,
    ]
  )
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatAnggota }
}

// Hapus anggota permanen — HANYA diizinkan kalau belum ada transaksi keuangan
// apa pun atas namanya (setoran/tarik simpanan, proyek, pembiayaan, penawaran,
// bagi hasil). Kalau sudah ada satu saja, tolak dan arahkan ke ubah status
// Tidak Aktif/Dibekukan supaya jejak keuangan tidak ikut hilang.
export async function deleteAnggota(id: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [anggota] } = await queryPostgres(
    `SELECT id, org_id, kode_anggota, user_id FROM kojasmat_anggota WHERE id=$1`,
    [id]
  )
  if (!anggota) return { error: 'Anggota tidak ditemukan' }

  if (!(await isOrgAdminOrManajemen(session.user.id, anggota.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat menghapus anggota.' }
  }

  const { rows: [counts] } = await queryPostgres(
    `SELECT
       (SELECT COUNT(*) FROM kojasmat_simpanan_mutasi WHERE anggota_id=$1)::int AS mutasi,
       (SELECT COUNT(*) FROM kojasmat_proyek WHERE pengaju_id=$1)::int AS proyek,
       (SELECT COUNT(*) FROM kojasmat_pembiayaan WHERE pemodal_id=$1)::int AS pembiayaan,
       (SELECT COUNT(*) FROM kojasmat_penawaran WHERE anggota_id=$1)::int AS penawaran,
       (SELECT COUNT(*) FROM kojasmat_bagi_hasil WHERE pemodal_id=$1)::int AS bagi_hasil`,
    [id]
  )
  const alasan: string[] = []
  if (counts.mutasi > 0) alasan.push(`${counts.mutasi} mutasi simpanan`)
  if (counts.proyek > 0) alasan.push(`${counts.proyek} proyek`)
  if (counts.pembiayaan > 0) alasan.push(`${counts.pembiayaan} pembiayaan`)
  if (counts.penawaran > 0) alasan.push(`${counts.penawaran} penawaran`)
  if (counts.bagi_hasil > 0) alasan.push(`${counts.bagi_hasil} bagi hasil`)
  if (alasan.length > 0) {
    return {
      error: `Anggota ini sudah punya riwayat transaksi (${alasan.join(', ')}) — tidak bisa dihapus. Ubah status ke Tidak Aktif atau Dibekukan sebagai gantinya.`,
    }
  }

  // Bersihkan pendaftaran yang tertaut supaya tidak jadi baris "Disetujui" yatim
  await queryPostgres(`DELETE FROM kojasmat_pendaftaran WHERE anggota_id=$1`, [id])
  // Hapus akun login kalau ada — supaya email/NIK bisa dipakai daftar ulang
  if (anggota.user_id) {
    await queryPostgres(`DELETE FROM internal_auth_users WHERE id=$1`, [anggota.user_id])
  }
  // Sisanya (kojasmat_simpanan, minat, pelatihan_peserta, tindakan, laporan_proyek,
  // project_posts) ikut terhapus lewat ON DELETE CASCADE — semuanya kosong/non-finansial
  // karena sudah lolos pengecekan transaksi di atas.
  await queryPostgres(`DELETE FROM kojasmat_anggota WHERE id=$1`, [id])

  revalidatePath('/kojasmat')
  return { success: true }
}

// ─── SIMPANAN ─────────────────────────────────────────────────────────────────

export async function getSimpananByAnggota(anggotaId: string): Promise<KojasmatSimpanan[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_simpanan WHERE anggota_id = $1 ORDER BY jenis`,
    [anggotaId]
  )
  return rows as KojasmatSimpanan[]
}

export async function getMutasiByAnggota(anggotaId: string): Promise<KojasmatSimpananMutasi[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_simpanan_mutasi
     WHERE anggota_id = $1
     ORDER BY tanggal DESC, created_at DESC
     LIMIT 50`,
    [anggotaId]
  )
  return rows as KojasmatSimpananMutasi[]
}

// Inti logika mutasi simpanan — dipakai oleh aksi staf (catatSimpananMutasi) maupun
// alur otomatis (aktivasi anggota baru setelah test+bayar), tanpa cek sesi staf.
export async function postSimpananMutasi(payload: {
  org_id: string
  anggota_id: string
  jenis_simpanan: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'
  jenis_mutasi: 'SETOR' | 'TARIK' | 'BAGI_HASIL' | 'KOREKSI'
  jumlah: number
  keterangan?: string
  tanggal?: string
  created_by?: string | null
}) {
  const { rows: [simpanan] } = await queryPostgres(
    `SELECT * FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis=$2`,
    [payload.anggota_id, payload.jenis_simpanan]
  )
  if (!simpanan) return { error: 'Rekening simpanan tidak ditemukan' }

  if (payload.jenis_mutasi === 'TARIK' && Number(simpanan.saldo) < payload.jumlah) {
    return { error: 'Saldo tidak mencukupi' }
  }

  const sebelum = Number(simpanan.saldo)
  const sesudah = payload.jenis_mutasi === 'TARIK'
    ? sebelum - payload.jumlah
    : sebelum + payload.jumlah

  await queryPostgres(
    `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
    [simpanan.id, sesudah]
  )
  await queryPostgres(
    `INSERT INTO kojasmat_simpanan_mutasi
       (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, tanggal, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      payload.org_id, simpanan.id, payload.anggota_id,
      payload.jenis_mutasi, payload.jumlah,
      sebelum, sesudah,
      payload.keterangan ?? null,
      payload.tanggal ?? new Date().toISOString().split('T')[0],
      payload.created_by ?? null,
    ]
  )

  try {
    if (payload.jenis_mutasi === 'SETOR') {
      await jurnalSetorSimpanan(
        payload.org_id, payload.jenis_simpanan, payload.jumlah,
        String(simpanan.id), payload.keterangan,
      )
    } else if (payload.jenis_mutasi === 'TARIK') {
      await jurnalTarikSimpanan(
        payload.org_id, payload.jenis_simpanan, payload.jumlah,
        String(simpanan.id), payload.keterangan,
      )
    }
  } catch (_) { /* jurnal non-fatal — transaksi simpanan tetap tercatat */ }

  revalidatePath('/kojasmat')
  return { data: { saldo: sesudah } }
}

export async function catatSimpananMutasi(payload: {
  org_id: string
  anggota_id: string
  jenis_simpanan: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'
  jenis_mutasi: 'SETOR' | 'TARIK' | 'KOREKSI'
  jumlah: number
  keterangan?: string
  tanggal?: string
}) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    return await postSimpananMutasi({ ...payload, created_by: getInternalUserId(session) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server'
    return { error: msg }
  }
}

// ─── SETORAN SIMPANAN SELF-SERVICE (anggota) ──────────────────────────────────
// Anggota mengajukan setoran lewat portal member (jenis + nominal + bukti
// transfer). Saldo TIDAK langsung berubah — baris mutasi tercatat berstatus
// PENDING dan baru diposting ke saldo + jurnal setelah pengurus memverifikasi
// bukti transfer secara manual (setujuiSetoranSimpanan), persis pola verifikasi
// manual yang sudah dipakai di alur pendaftaran anggota baru.

export type KojasmatSetoranPending = KojasmatSimpananMutasi & {
  anggota_nama: string
  kode_anggota: string
  jenis_simpanan: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'
  bukti_file_key: string | null
  bukti_nama_file: string | null
}

// Tidak butuh auth staf — dipanggil dari portal member.
export async function ajukanSetoranSimpanan(payload: {
  org_id: string
  anggota_id: string
  jenis_simpanan: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP'
  jumlah: number
  metode_bayar?: 'TRANSFER' | 'QRIS'
  keterangan?: string
  file_key: string
  nama_file: string
  file_size?: number
  mime_type?: string
}) {
  if (payload.jumlah <= 0) return { error: 'Jumlah setoran harus lebih dari nol' }

  const { rows: [simpanan] } = await queryPostgres(
    `SELECT id FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis=$2`,
    [payload.anggota_id, payload.jenis_simpanan]
  )
  if (!simpanan) return { error: 'Rekening simpanan tidak ditemukan' }

  const { rows: [mutasi] } = await queryPostgres(
    `INSERT INTO kojasmat_simpanan_mutasi
       (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, keterangan, status, metode_bayar)
     VALUES ($1,$2,$3,'SETOR',$4,$5,'PENDING',$6)
     RETURNING id, created_at`,
    [payload.org_id, simpanan.id, payload.anggota_id, payload.jumlah, payload.keterangan ?? null, payload.metode_bayar ?? null]
  )

  const { rows: [dokumen] } = await queryPostgres(
    `INSERT INTO kojasmat_dokumen
       (org_id, referensi_type, referensi_id, jenis_dokumen, nama_file, file_key, file_size, mime_type)
     VALUES ($1,'SIMPANAN',$2,'BUKTI_SETORAN',$3,$4,$5,$6)
     RETURNING id`,
    [payload.org_id, mutasi.id, payload.nama_file, payload.file_key, payload.file_size ?? null, payload.mime_type ?? null]
  )

  await queryPostgres(
    `UPDATE kojasmat_simpanan_mutasi SET bukti_dokumen_id=$2 WHERE id=$1`,
    [mutasi.id, dokumen.id]
  )

  revalidatePath('/kojasmat')
  return { data: { id: mutasi.id as string, created_at: mutasi.created_at as string } }
}

export async function getSetoranPendingByOrg(orgId: string): Promise<KojasmatSetoranPending[]> {
  const { rows } = await queryPostgres(
    `SELECT m.*, a.nama AS anggota_nama, a.kode_anggota, s.jenis AS jenis_simpanan,
            d.file_key AS bukti_file_key, d.nama_file AS bukti_nama_file
     FROM kojasmat_simpanan_mutasi m
     JOIN kojasmat_anggota a ON a.id = m.anggota_id
     JOIN kojasmat_simpanan s ON s.id = m.simpanan_id
     LEFT JOIN kojasmat_dokumen d ON d.id = m.bukti_dokumen_id
     WHERE m.org_id=$1 AND m.status='PENDING'
     ORDER BY m.created_at ASC`,
    [orgId]
  )
  return rows as KojasmatSetoranPending[]
}

async function notifikasiSetoranSimpanan(input: {
  orgId: string
  anggotaId: string
  mutasiId: string
  jumlah: number
  jenisSimpanan: string
  disetujui: boolean
  catatan?: string | null
}) {
  const { rows: [anggota] } = await queryPostgres(
    `SELECT nama, email, phone, user_id FROM kojasmat_anggota WHERE id=$1`,
    [input.anggotaId]
  )
  if (!anggota) return

  const judul = input.disetujui ? 'Setoran Simpanan Disetujui' : 'Setoran Simpanan Ditolak'
  const jenisLabel = { POKOK: 'Pokok', WAJIB: 'Wajib', SUKARELA: 'Sukarela' }[input.jenisSimpanan] ?? input.jenisSimpanan
  const nominal = `Rp ${input.jumlah.toLocaleString('id-ID')}`
  const body = input.disetujui
    ? `Halo ${anggota.nama}, setoran simpanan ${jenisLabel} sebesar ${nominal} sudah diverifikasi dan masuk ke saldo Anda.`
    : `Halo ${anggota.nama}, setoran simpanan ${jenisLabel} sebesar ${nominal} ditolak pengurus.${input.catatan ? ` Alasan: ${input.catatan}` : ''} Silakan hubungi pengurus koperasi.`

  const idempotencyKey = `kojasmat-setoran:${input.mutasiId}:${input.disetujui ? 'disetujui' : 'ditolak'}`

  // IN_APP selalu berhasil (tidak butuh provider eksternal) — status setoran
  // juga langsung terlihat di portal anggota begitu login.
  await enqueueNotification({
    orgId: input.orgId, userId: anggota.user_id, eventType: 'kojasmat_setoran_simpanan',
    channel: 'IN_APP', recipient: anggota.user_id || input.anggotaId,
    subject: judul, body, idempotencyKey: `${idempotencyKey}:in_app`,
  }).catch(() => null)

  // WA/Email best-effort — akan benar-benar terkirim begitu provider (Dripsender/
  // Mailketing) disetel org ini; sebelum itu cuma antre di outbox tanpa error.
  if (anggota.email) {
    await enqueueNotification({
      orgId: input.orgId, userId: anggota.user_id, eventType: 'kojasmat_setoran_simpanan',
      channel: 'EMAIL', recipient: anggota.email,
      subject: judul, body, idempotencyKey: `${idempotencyKey}:email`,
    }).catch(() => null)
  }
  if (anggota.phone) {
    await enqueueNotification({
      orgId: input.orgId, userId: anggota.user_id, eventType: 'kojasmat_setoran_simpanan',
      channel: 'WHATSAPP', providerCode: 'DRIPSENDER', recipient: anggota.phone,
      body, idempotencyKey: `${idempotencyKey}:whatsapp`,
    }).catch(() => null)
  }
}

export async function setujuiSetoranSimpanan(mutasiId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [check] } = await queryPostgres(
    `SELECT org_id FROM kojasmat_simpanan_mutasi WHERE id=$1`,
    [mutasiId]
  )
  if (!check) return { error: 'Setoran tidak ditemukan' }
  if (!(await isOrgAdminOrManajemen(session.user.id, check.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat menyetujui setoran.' }
  }

  const client = await connectPostgresClient()
  let committed: { anggotaId: string; jumlah: number; jenisSimpanan: string } | null = null
  try {
    await client.query('BEGIN')

    const { rows: [mutasi] } = await client.query(
      `UPDATE kojasmat_simpanan_mutasi
       SET status='DISETUJUI', direview_oleh=$2, direview_at=NOW()
       WHERE id=$1 AND status='PENDING'
       RETURNING *`,
      [mutasiId, getInternalUserId(session)]
    )
    if (!mutasi) throw new Error('Setoran tidak ditemukan atau sudah diproses')

    const { rows: [simpanan] } = await client.query(
      `SELECT * FROM kojasmat_simpanan WHERE id=$1 FOR UPDATE`,
      [mutasi.simpanan_id]
    )
    if (!simpanan) throw new Error('Rekening simpanan tidak ditemukan')

    const sebelum = Number(simpanan.saldo)
    const sesudah = sebelum + Number(mutasi.jumlah)

    await client.query(
      `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
      [simpanan.id, sesudah]
    )
    await client.query(
      `UPDATE kojasmat_simpanan_mutasi SET saldo_sebelum=$2, saldo_sesudah=$3 WHERE id=$1`,
      [mutasiId, sebelum, sesudah]
    )

    await client.query('COMMIT')
    committed = { anggotaId: mutasi.anggota_id, jumlah: Number(mutasi.jumlah), jenisSimpanan: simpanan.jenis }
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Gagal menyetujui setoran' }
  }
  client.release()

  try {
    await jurnalSetorSimpanan(check.org_id, committed!.jenisSimpanan as 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP', committed!.jumlah, mutasiId)
  } catch (_) { /* jurnal non-fatal */ }

  await notifikasiSetoranSimpanan({
    orgId: check.org_id, anggotaId: committed!.anggotaId, mutasiId,
    jumlah: committed!.jumlah, jenisSimpanan: committed!.jenisSimpanan, disetujui: true,
  }).catch(() => null)

  revalidatePath('/kojasmat')
  return { success: true }
}

export async function tolakSetoranSimpanan(mutasiId: string, catatan: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [check] } = await queryPostgres(
    `SELECT org_id FROM kojasmat_simpanan_mutasi WHERE id=$1`,
    [mutasiId]
  )
  if (!check) return { error: 'Setoran tidak ditemukan' }
  if (!(await isOrgAdminOrManajemen(session.user.id, check.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat menolak setoran.' }
  }

  const { rows: [mutasi] } = await queryPostgres(
    `UPDATE kojasmat_simpanan_mutasi
     SET status='DITOLAK', catatan_admin=$2, direview_oleh=$3, direview_at=NOW()
     WHERE id=$1 AND status='PENDING'
     RETURNING *`,
    [mutasiId, catatan, getInternalUserId(session)]
  )
  if (!mutasi) return { error: 'Setoran tidak ditemukan atau sudah diproses' }

  const { rows: [simpanan] } = await queryPostgres(`SELECT jenis FROM kojasmat_simpanan WHERE id=$1`, [mutasi.simpanan_id])
  await notifikasiSetoranSimpanan({
    orgId: check.org_id, anggotaId: mutasi.anggota_id, mutasiId,
    jumlah: Number(mutasi.jumlah), jenisSimpanan: simpanan?.jenis ?? '', disetujui: false, catatan,
  }).catch(() => null)

  revalidatePath('/kojasmat')
  return { data: mutasi as KojasmatSimpananMutasi }
}

export async function getSetoranByAnggota(anggotaId: string): Promise<KojasmatSimpananMutasi[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_simpanan_mutasi WHERE anggota_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [anggotaId]
  )
  return rows as KojasmatSimpananMutasi[]
}

// ─── PROYEK ───────────────────────────────────────────────────────────────────

export async function getAllProyek(orgId: string): Promise<KojasmatProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, a.nama AS pengaju_nama
     FROM kojasmat_proyek p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pengaju_id
     WHERE p.org_id = $1
     ORDER BY p.created_at DESC`,
    [orgId]
  )
  return rows as KojasmatProyek[]
}

export async function getProyekById(id: string): Promise<KojasmatProyek | null> {
  const { rows } = await queryPostgres(
    `SELECT p.*, a.nama AS pengaju_nama
     FROM kojasmat_proyek p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pengaju_id
     WHERE p.id = $1 LIMIT 1`,
    [id]
  )
  return (rows[0] ?? null) as KojasmatProyek | null
}

export async function createProyek(payload: {
  org_id: string
  pengaju_id: string
  nama_proyek: string
  deskripsi?: string
  jenis_akad: 'MURABAHAH' | 'MUDHARABAH' | 'INAN'
  kebutuhan_modal: number
  ujrah_nominal?: number
  ujrah_wakalah_akad?: number
  nisbah_pengaju?: number
  nisbah_pemodal?: number
  durasi_bulan?: number
  agunan?: string
  notes?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: last } = await queryPostgres(
    `SELECT kode_proyek FROM kojasmat_proyek WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [payload.org_id]
  )
  let nextNum = 1
  if (last[0]) {
    const m = String(last[0].kode_proyek).match(/\d+$/)
    if (m) nextNum = parseInt(m[0]) + 1
  }
  const kode = `PY-${String(nextNum).padStart(4, '0')}`

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, ujrah_nominal, ujrah_wakalah_akad, nisbah_pengaju, nisbah_pemodal,
        durasi_bulan, agunan, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      payload.org_id, payload.pengaju_id, kode, payload.nama_proyek,
      payload.deskripsi ?? null, payload.jenis_akad,
      payload.kebutuhan_modal,
      payload.ujrah_nominal ?? 0,
      payload.ujrah_wakalah_akad ?? 0,
      payload.nisbah_pengaju ?? 30,
      payload.nisbah_pemodal ?? 70,
      payload.durasi_bulan ?? 6,
      payload.agunan ?? null, payload.notes ?? null,
    ]
  )
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatProyek }
}

export async function updateProyekStatus(id: string, status: string, notes?: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await queryPostgres(
    `UPDATE kojasmat_proyek SET status=$2, notes=COALESCE($3, notes), updated_at=NOW() WHERE id=$1`,
    [id, status, notes ?? null]
  )
  if (status === 'BERJALAN') {
    await queryPostgres(
      `UPDATE kojasmat_proyek SET tanggal_mulai=CURRENT_DATE WHERE id=$1 AND tanggal_mulai IS NULL`,
      [id]
    )
  }
  if (status === 'SELESAI') {
    await queryPostgres(
      `UPDATE kojasmat_proyek SET tanggal_selesai=CURRENT_DATE WHERE id=$1 AND tanggal_selesai IS NULL`,
      [id]
    )
  }
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function updateProyek(id: string, payload: {
  nama_proyek: string
  deskripsi?: string
  jenis_akad: 'MURABAHAH' | 'MUDHARABAH' | 'INAN'
  kebutuhan_modal: number
  ujrah_nominal: number
  ujrah_wakalah_akad?: number
  nisbah_pengaju?: number
  nisbah_pemodal?: number
  durasi_bulan: number
  agunan?: string
  notes?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [existing] } = await queryPostgres(`SELECT status, nisbah_pengaju, nisbah_pemodal FROM kojasmat_proyek WHERE id=$1`, [id])
  if (!existing) return { error: 'Proyek tidak ditemukan' }

  const nisbahTerkunci = existing.status === 'BERJALAN' || existing.status === 'SELESAI'
  const nisbahPengaju = nisbahTerkunci ? Number(existing.nisbah_pengaju) : (payload.nisbah_pengaju ?? 30)
  const nisbahPemodal = nisbahTerkunci ? Number(existing.nisbah_pemodal) : (payload.nisbah_pemodal ?? 70)

  await queryPostgres(
    `UPDATE kojasmat_proyek
     SET nama_proyek=$2, deskripsi=$3, jenis_akad=$4,
         kebutuhan_modal=$5, ujrah_nominal=$6, ujrah_wakalah_akad=$10,
         nisbah_pengaju=$11, nisbah_pemodal=$12,
         durasi_bulan=$7, agunan=$8, notes=$9, updated_at=NOW()
     WHERE id=$1`,
    [
      id, payload.nama_proyek, payload.deskripsi ?? null,
      payload.jenis_akad, payload.kebutuhan_modal, payload.ujrah_nominal,
      payload.durasi_bulan, payload.agunan ?? null, payload.notes ?? null,
      payload.ujrah_wakalah_akad ?? 0,
      nisbahPengaju, nisbahPemodal,
    ]
  )
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function deleteProyek(id: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [p] } = await queryPostgres(
    `SELECT status FROM kojasmat_proyek WHERE id=$1`, [id]
  )
  if (!p) return { error: 'Proyek tidak ditemukan' }
  if (p.status !== 'DRAFT') return { error: 'Hanya proyek berstatus DRAFT yang dapat dihapus' }

  await queryPostgres(`DELETE FROM kojasmat_proyek WHERE id=$1`, [id])
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

// Ambil role aktor di org untuk dicatat di riwayat proyek (audit trail saja, bukan guard izin).
async function getActorRole(userId: string, orgId: string): Promise<string | null> {
  const { rows } = await queryPostgres(
    `SELECT role FROM org_members WHERE user_id=$1 AND org_id=$2 AND is_active=true LIMIT 1`,
    [userId, orgId]
  )
  return rows[0]?.role ?? null
}

async function recordProyekHistory(payload: {
  org_id: string
  proyek_id: string
  status_dari?: string | null
  status_ke: string
  aksi: string
  pesan?: string | null
  actor_id?: string | null
  actor_role?: string | null
  proposal_version?: number | null
}) {
  let proposal_version = payload.proposal_version
  if (proposal_version == null) {
    const { rows } = await queryPostgres(
      `SELECT proposal_version FROM kojasmat_proyek WHERE id=$1`,
      [payload.proyek_id]
    )
    proposal_version = rows[0]?.proposal_version ?? 1
  }

  await queryPostgres(
    `INSERT INTO kojasmat_proyek_history
       (org_id, proyek_id, status_dari, status_ke, aksi, pesan, actor_id, actor_role, proposal_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      payload.org_id, payload.proyek_id, payload.status_dari ?? null, payload.status_ke,
      payload.aksi, payload.pesan ?? null, payload.actor_id ?? null, payload.actor_role ?? null,
      proposal_version,
    ]
  )
}

export async function submitProyekKeDMR(proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek SET status='MENUNGGU_DMR', updated_at=NOW()
     WHERE id=$1 AND status='DRAFT' RETURNING *`,
    [proyekId]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status DRAFT' }

  const proyek = rows[0] as KojasmatProyek
  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: proyek.org_id, proyek_id: proyekId, status_dari: 'DRAFT', status_ke: 'MENUNGGU_DMR',
    aksi: 'AJUKAN_DMR', actor_id: actorId, actor_role: await getActorRole(actorId, proyek.org_id),
    proposal_version: proyek.proposal_version ?? 1,
  })

  revalidatePath('/kojasmat')
  return { data: proyek }
}

// Kirim ulang proyek setelah diminta revisi oleh DMR atau DPS — menaikkan proposal_version.
export async function resubmitProyek(proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [existing] } = await queryPostgres(
    `SELECT org_id, status, proposal_version FROM kojasmat_proyek WHERE id=$1`, [proyekId]
  )
  if (!existing) return { error: 'Proyek tidak ditemukan' }

  const target = existing.status === 'REVISI_DMR' ? 'MENUNGGU_DMR'
    : existing.status === 'REVISI_DPS' ? 'MENUNGGU_DPS'
    : null
  if (!target) return { error: 'Proyek tidak dalam status revisi' }

  const nextVersion = Number(existing.proposal_version ?? 1) + 1
  await queryPostgres(
    `UPDATE kojasmat_proyek SET status=$2, proposal_version=$3, updated_at=NOW() WHERE id=$1`,
    [proyekId, target, nextVersion]
  )

  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: existing.org_id, proyek_id: proyekId, status_dari: existing.status, status_ke: target,
    aksi: 'AJUKAN_ULANG', actor_id: actorId, actor_role: await getActorRole(actorId, existing.org_id),
    proposal_version: nextVersion,
  })

  revalidatePath('/kojasmat')
  return { data: { ok: true, status: target, proposal_version: nextVersion } }
}

// ─── REVIEW DMR & DPS ─────────────────────────────────────────────────────────

export async function getProyekAntrian(orgId: string, tahap: 'DMR' | 'DPS'): Promise<KojasmatProyek[]> {
  const status = tahap === 'DMR' ? 'MENUNGGU_DMR' : 'MENUNGGU_DPS'
  const { rows } = await queryPostgres(
    `SELECT p.*, a.nama AS pengaju_nama
     FROM kojasmat_proyek p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pengaju_id
     WHERE p.org_id=$1 AND p.status=$2
     ORDER BY p.created_at ASC`,
    [orgId, status]
  )
  return rows as KojasmatProyek[]
}

export async function submitProyekReview(payload: {
  org_id: string
  proyek_id: string
  tahap: 'DMR' | 'DPS'
  keputusan: 'DISETUJUI' | 'REVISI' | 'DITOLAK'
  catatan?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [proyek] } = await queryPostgres(
    `SELECT status, proposal_version FROM kojasmat_proyek WHERE id=$1`, [payload.proyek_id]
  )
  if (!proyek) return { error: 'Proyek tidak ditemukan' }

  const actorId = getInternalUserId(session)
  const proposalVersion = Number(proyek.proposal_version ?? 1)

  await queryPostgres(
    `INSERT INTO kojasmat_proyek_review (org_id, proyek_id, tahap, keputusan, catatan, reviewer_id, proposal_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [payload.org_id, payload.proyek_id, payload.tahap, payload.keputusan, payload.catatan ?? null, actorId, proposalVersion]
  )

  const newStatus = payload.tahap === 'DMR'
    ? (payload.keputusan === 'DISETUJUI' ? 'MENUNGGU_DPS' : payload.keputusan === 'REVISI' ? 'REVISI_DMR' : 'DITOLAK_DMR')
    : (payload.keputusan === 'DISETUJUI' ? 'DISETUJUI' : payload.keputusan === 'REVISI' ? 'REVISI_DPS' : 'DITOLAK_DPS')

  await queryPostgres(
    `UPDATE kojasmat_proyek SET status=$2, updated_at=NOW() WHERE id=$1`,
    [payload.proyek_id, newStatus]
  )

  await recordProyekHistory({
    org_id: payload.org_id, proyek_id: payload.proyek_id, status_dari: proyek.status, status_ke: newStatus,
    aksi: `REVIEW_${payload.tahap}`, pesan: payload.catatan, actor_id: actorId,
    actor_role: await getActorRole(actorId, payload.org_id), proposal_version: proposalVersion,
  })

  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function getProyekReviewHistory(proyekId: string): Promise<KojasmatProyekReview[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_proyek_review WHERE proyek_id=$1 ORDER BY reviewed_at DESC`,
    [proyekId]
  )
  return rows as KojasmatProyekReview[]
}

export async function getProyekHistory(proyekId: string): Promise<KojasmatProyekHistory[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_proyek_history WHERE proyek_id=$1 ORDER BY created_at DESC`,
    [proyekId]
  )
  return rows as KojasmatProyekHistory[]
}

// ─── FUNDING ──────────────────────────────────────────────────────────────────

export async function jadwalkanFunding(payload: {
  org_id: string
  proyek_id: string
  funding_mulai: string
  funding_selesai: string
  funding_instruksi?: string
  target_modal_awal?: number
  published_at?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek
     SET status='FUNDING_DIJADWALKAN', funding_mulai=$2, funding_selesai=$3,
         funding_instruksi=$4, target_modal_awal=COALESCE($5, kebutuhan_modal), published_at=COALESCE($6, published_at), updated_at=NOW()
     WHERE id=$1 AND status='DISETUJUI' RETURNING *`,
    [payload.proyek_id, payload.funding_mulai, payload.funding_selesai, payload.funding_instruksi ?? null, payload.target_modal_awal ?? null, payload.published_at ?? null]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status Disetujui' }

  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: payload.org_id, proyek_id: payload.proyek_id, status_dari: 'DISETUJUI', status_ke: 'FUNDING_DIJADWALKAN',
    aksi: 'JADWALKAN_FUNDING', actor_id: actorId, actor_role: await getActorRole(actorId, payload.org_id),
  })

  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatProyek }
}

export async function bukaFunding(proyekId: string, published_at?: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek SET status='FUNDING_AKTIF', funding_dibuka_at=NOW(), published_at=COALESCE($2, published_at), updated_at=NOW()
     WHERE id=$1 AND status='FUNDING_DIJADWALKAN' RETURNING *`,
    [proyekId, published_at ?? null]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status Funding Dijadwalkan' }

  const proyek = rows[0] as KojasmatProyek
  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: proyek.org_id, proyek_id: proyekId, status_dari: 'FUNDING_DIJADWALKAN', status_ke: 'FUNDING_AKTIF',
    aksi: 'BUKA_FUNDING', actor_id: actorId, actor_role: await getActorRole(actorId, proyek.org_id),
  })

  revalidatePath('/kojasmat')
  return { data: proyek }
}

export async function tutupFunding(proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek SET status='FUNDING_DITUTUP', funding_ditutup_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND status='FUNDING_AKTIF' RETURNING *`,
    [proyekId]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status Funding Aktif' }

  const proyek = rows[0] as KojasmatProyek
  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: proyek.org_id, proyek_id: proyekId, status_dari: 'FUNDING_AKTIF', status_ke: 'FUNDING_DITUTUP',
    aksi: 'TUTUP_FUNDING', actor_id: actorId, actor_role: await getActorRole(actorId, proyek.org_id),
  })

  revalidatePath('/kojasmat')
  return { data: proyek }
}

// ─── AKAD ─────────────────────────────────────────────────────────────────────

export async function getAkadByProyek(proyekId: string): Promise<KojasmatAkad[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_akad WHERE proyek_id=$1 ORDER BY created_at DESC`,
    [proyekId]
  )
  return rows as KojasmatAkad[]
}

export async function jadwalkanAkad(payload: {
  org_id: string
  proyek_id: string
  jadwal_akad: string
  saksi_nama?: string
  saksi_2_nama?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [proyek] } = await queryPostgres(
    `SELECT status FROM kojasmat_proyek WHERE id=$1`, [payload.proyek_id]
  )
  if (!proyek) return { error: 'Proyek tidak ditemukan' }
  if (proyek.status !== 'FUNDING_DITUTUP') return { error: 'Proyek tidak dalam status Funding Ditutup' }

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_akad (org_id, proyek_id, jadwal_akad, saksi_nama, saksi_2_nama, status)
     VALUES ($1,$2,$3,$4,$5,'MENUNGGU_TTD') RETURNING *`,
    [payload.org_id, payload.proyek_id, payload.jadwal_akad, payload.saksi_nama ?? null, payload.saksi_2_nama ?? null]
  )

  await queryPostgres(
    `UPDATE kojasmat_proyek SET status='MENUNGGU_AKAD', updated_at=NOW() WHERE id=$1`,
    [payload.proyek_id]
  )

  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: payload.org_id, proyek_id: payload.proyek_id, status_dari: 'FUNDING_DITUTUP', status_ke: 'MENUNGGU_AKAD',
    aksi: 'JADWALKAN_AKAD', actor_id: actorId, actor_role: await getActorRole(actorId, payload.org_id),
  })

  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatAkad }
}

export async function tandatanganiAkad(akadId: string, proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const actorId = getInternalUserId(session)
  const client = await connectPostgresClient()
  let proyek: KojasmatProyek | null = null

  try {
    await client.query('BEGIN')

    const { rows: proyekRows } = await client.query(
      `SELECT * FROM kojasmat_proyek WHERE id=$1 FOR UPDATE`,
      [proyekId]
    )
    proyek = proyekRows[0]
    if (!proyek) throw new Error('Proyek tidak ditemukan')
    if (proyek.status !== 'MENUNGGU_AKAD') throw new Error('Proyek tidak dalam status Menunggu Akad')

    await client.query(
      `UPDATE kojasmat_akad SET status='DITANDATANGANI', finalized_by=$2, finalized_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [akadId, actorId]
    )

    await client.query(
      `UPDATE kojasmat_proyek SET status='BERJALAN', tanggal_mulai=COALESCE(tanggal_mulai, CURRENT_DATE), updated_at=NOW() WHERE id=$1`,
      [proyekId]
    )

    const { rows: pembiayaanRows } = await client.query(
      `SELECT * FROM kojasmat_pembiayaan WHERE proyek_id=$1 AND status='AKTIF'`,
      [proyekId]
    )

    for (const pb of pembiayaanRows) {
      const { rows: [simpananProyek] } = await client.query(
        `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='PROYEK' FOR UPDATE`,
        [pb.pemodal_id]
      )
      
      let simpananId = simpananProyek?.id
      const saldoSebelum = Number(simpananProyek?.saldo ?? 0)
      const saldoSesudah = saldoSebelum + Number(pb.jumlah)

      if (simpananId) {
        await client.query(
          `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
          [simpananId, saldoSesudah]
        )
      } else {
        const { rows: [newSimpanan] } = await client.query(
          `INSERT INTO kojasmat_simpanan (org_id, anggota_id, jenis, saldo) VALUES ($1, $2, 'PROYEK', $3) RETURNING id`,
          [pb.org_id, pb.pemodal_id, pb.jumlah]
        )
        simpananId = newSimpanan.id
      }

      await client.query(
        `INSERT INTO kojasmat_simpanan_mutasi (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status)
         VALUES ($1, $2, $3, 'SETOR', $4, $5, $6, $7, 'DISETUJUI')`,
        [pb.org_id, simpananId, pb.pemodal_id, pb.jumlah, saldoSebelum, saldoSesudah, `Pembiayaan proyek ${proyek.nama_proyek ?? proyek.kode_proyek} mulai berjalan`]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Terjadi kesalahan sistem' }
  }
  client.release()

  if (proyek) {
    await recordProyekHistory({
      org_id: proyek.org_id, proyek_id: proyekId, status_dari: 'MENUNGGU_AKAD', status_ke: 'BERJALAN',
      aksi: 'TANDATANGANI_AKAD', actor_id: actorId, actor_role: await getActorRole(actorId, proyek.org_id),
    })
  }

  revalidatePath('/kojasmat')
  return { data: proyek }
}

export async function batalkanAkad(akadId: string, proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await queryPostgres(`UPDATE kojasmat_akad SET status='BATAL', updated_at=NOW() WHERE id=$1`, [akadId])

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek SET status='FUNDING_DITUTUP', updated_at=NOW() WHERE id=$1 AND status='MENUNGGU_AKAD' RETURNING *`,
    [proyekId]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status Menunggu Akad' }

  const proyek = rows[0] as KojasmatProyek
  const actorId = getInternalUserId(session)
  await recordProyekHistory({
    org_id: proyek.org_id, proyek_id: proyekId, status_dari: 'MENUNGGU_AKAD', status_ke: 'FUNDING_DITUTUP',
    aksi: 'BATALKAN_AKAD', actor_id: actorId, actor_role: await getActorRole(actorId, proyek.org_id),
  })

  revalidatePath('/kojasmat')
  return { data: proyek }
}

// ─── PEMBIAYAAN ───────────────────────────────────────────────────────────────

export async function getPembiayaanByProyek(proyekId: string): Promise<KojasmatPembiayaan[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, a.nama AS pemodal_nama
     FROM kojasmat_pembiayaan p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pemodal_id
     WHERE p.proyek_id=$1 ORDER BY p.created_at ASC`,
    [proyekId]
  )
  return rows as KojasmatPembiayaan[]
}

export async function getPembiayaanByAnggota(anggotaId: string): Promise<KojasmatPembiayaan[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, pr.nama_proyek, pr.jenis_akad, pr.status AS proyek_status,
            pr.kebutuhan_modal, pr.modal_terkumpul, pr.ujrah_nominal
     FROM kojasmat_pembiayaan p
     LEFT JOIN kojasmat_proyek pr ON pr.id = p.proyek_id
     WHERE p.pemodal_id=$1 ORDER BY p.created_at DESC`,
    [anggotaId]
  )
  return rows as KojasmatPembiayaan[]
}

export async function createPembiayaan(payload: {
  org_id: string
  proyek_id: string
  pemodal_id: string
  jumlah: number
  kehadiran_akad?: 'SENDIRI' | 'DIWAKILKAN'
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const client = await connectPostgresClient()
  let resultRow: any = null
  let proyekData: any = null

  try {
    await client.query('BEGIN')

    const { rows: proyekRows } = await client.query(
      `SELECT * FROM kojasmat_proyek WHERE id=$1 FOR UPDATE`,
      [payload.proyek_id]
    )
    proyekData = proyekRows[0]

    if (!proyekData) throw new Error('Proyek tidak ditemukan')
    if (proyekData.status !== 'FUNDING_AKTIF') throw new Error('Proyek tidak dalam status Funding Aktif')

    const sisa = Number(proyekData.kebutuhan_modal) - Number(proyekData.modal_terkumpul)
    if (payload.jumlah > sisa) {
      await client.query('ROLLBACK')
      client.release()
      return { 
        error: `Melebihi sisa kebutuhan (Rp ${sisa.toLocaleString('id-ID')})`, 
        quota_error: true,
        modal_terkumpul: Number(proyekData.modal_terkumpul) 
      }
    }

    // Pembiayaan hanya boleh memakai simpanan SUKARELA — simpanan pokok/wajib
    // adalah setoran keanggotaan, bukan dana yang boleh diinvestasikan ke proyek.
    const { rows: [simpananSukarela] } = await client.query(
      `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`,
      [payload.pemodal_id]
    )
    if (!simpananSukarela) throw new Error('Rekening simpanan sukarela tidak ditemukan')

    const saldoSukarela = Number(simpananSukarela.saldo)
    if (payload.jumlah > saldoSukarela) {
      await client.query('ROLLBACK')
      client.release()
      return { error: `Melebihi saldo simpanan sukarela Anda (Rp ${saldoSukarela.toLocaleString('id-ID')})` }
    }

    const saldoSesudahSukarela = saldoSukarela - payload.jumlah

    // Potong saldo sukarela (Hold)
    await client.query(
      `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
      [simpananSukarela.id, saldoSesudahSukarela]
    )
    
    // Catat mutasi penarikan
    await client.query(
      `INSERT INTO kojasmat_simpanan_mutasi (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status)
       VALUES ($1, $2, $3, 'TARIK', $4, $5, $6, $7, 'DISETUJUI')`,
      [payload.org_id, simpananSukarela.id, payload.pemodal_id, payload.jumlah, saldoSukarela, saldoSesudahSukarela, `Hold dana untuk pembiayaan proyek ${proyekData.nama_proyek ?? proyekData.kode_proyek}`]
    )

    // Hanya blokir kalau masih ada pembiayaan AKTIF ke proyek ini — pendanaan yang
    // sudah dibatalkan (GAGAL) tidak menghalangi investasi ulang (lihat migrasi 1401).
    const { rows: [existing] } = await client.query(
      `SELECT id FROM kojasmat_pembiayaan WHERE proyek_id=$1 AND pemodal_id=$2 AND status='AKTIF'`,
      [payload.proyek_id, payload.pemodal_id]
    )
    if (existing) throw new Error('Anda sudah membiayai proyek ini sebelumnya.')

    const porsiPct = (payload.jumlah / Number(proyekData.kebutuhan_modal)) * 100
    const kehadiranAkad = payload.kehadiran_akad ?? 'SENDIRI'
    const ujrahDiwakilkan = kehadiranAkad === 'DIWAKILKAN' ? Number(proyekData.ujrah_wakalah_akad ?? 0) : 0

    // status di-set eksplisit 'AKTIF' — jangan andalkan DEFAULT kolom. Kolom ini
    // pernah di-drift di database (default berubah jadi 'KOMITMEN') tanpa kode
    // aplikasi pernah dibuat untuk mengelola status selain AKTIF/SELESAI/GAGAL,
    // yang bikin pembiayaan baru macet dan tidak bisa dibatalkan (batalkanPembiayaan
    // & sudah_dibiayai sama-sama mensyaratkan status='AKTIF').
    const { rows } = await client.query(
      `INSERT INTO kojasmat_pembiayaan (org_id, proyek_id, pemodal_id, jumlah, porsi_pct, kehadiran_akad, ujrah_diwakilkan, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'AKTIF') RETURNING *`,
      [payload.org_id, payload.proyek_id, payload.pemodal_id, payload.jumlah, porsiPct, kehadiranAkad, ujrahDiwakilkan]
    )
    resultRow = rows[0]

    const newModal = Number(proyekData.modal_terkumpul) + payload.jumlah
    const tutupOtomatis = newModal >= Number(proyekData.kebutuhan_modal)
    const newStatus = tutupOtomatis ? 'FUNDING_DITUTUP' : proyekData.status

    await client.query(
      `UPDATE kojasmat_proyek
       SET modal_terkumpul=$2, status=$3, funding_ditutup_at=CASE WHEN $4 THEN NOW() ELSE funding_ditutup_at END, updated_at=NOW()
       WHERE id=$1`,
      [payload.proyek_id, newModal, newStatus, tutupOtomatis]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Terjadi kesalahan sistem' }
  }
  client.release()

  const ujrahDiwakilkan = payload.kehadiran_akad === 'DIWAKILKAN' ? Number(proyekData?.ujrah_wakalah_akad ?? 0) : 0


  try {
    await jurnalPenerimaanDanaPemodal(
      payload.org_id, proyekData.jenis_akad as 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
      payload.jumlah, String(resultRow.id), String(proyekData.kode_proyek),
    )
    if (ujrahDiwakilkan > 0) {
      if (proyekData.jenis_akad === 'MURABAHAH') {
        await jurnalUjrahMurabahah(payload.org_id, ujrahDiwakilkan, String(resultRow.id), String(proyekData.kode_proyek))
      } else {
        await jurnalUjrahMudharabah(payload.org_id, ujrahDiwakilkan, String(resultRow.id), String(proyekData.kode_proyek))
      }
    }
  } catch (_) { /* jurnal non-fatal */ }

  revalidatePath('/kojasmat')
  return { data: resultRow }
}

export async function batalkanPembiayaan(pembiayaanId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows: pembiayaanRows } = await client.query(`SELECT * FROM kojasmat_pembiayaan WHERE id=$1 FOR UPDATE`, [pembiayaanId])
    const pb = pembiayaanRows[0]
    if (!pb) throw new Error('Data pembiayaan tidak ditemukan')
    if (pb.status !== 'AKTIF') throw new Error('Pembiayaan ini sudah tidak aktif')

    const { rows: proyekRows } = await client.query(`SELECT * FROM kojasmat_proyek WHERE id=$1 FOR UPDATE`, [pb.proyek_id])
    const proyek = proyekRows[0]
    if (!proyek) throw new Error('Proyek tidak ditemukan')
    if (!['FUNDING_AKTIF', 'FUNDING_DITUTUP'].includes(proyek.status)) {
      throw new Error('Pembiayaan hanya dapat dibatalkan sebelum proyek berjalan')
    }

    await client.query(`UPDATE kojasmat_pembiayaan SET status='GAGAL' WHERE id=$1`, [pembiayaanId])

    const newModal = Number(proyek.modal_terkumpul) - Number(pb.jumlah)
    const newStatus = proyek.status === 'FUNDING_DITUTUP' && newModal < Number(proyek.kebutuhan_modal) ? 'FUNDING_AKTIF' : proyek.status

    await client.query(
      `UPDATE kojasmat_proyek SET modal_terkumpul=$2, status=$3, updated_at=NOW() WHERE id=$1`,
      [pb.proyek_id, newModal, newStatus]
    )
    
    // Kembalikan dana ke Simpanan Sukarela
    const { rows: [simpananSukarela] } = await client.query(
      `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`,
      [pb.pemodal_id]
    )
    if (simpananSukarela) {
      const saldoSebelum = Number(simpananSukarela.saldo)
      const saldoSesudah = saldoSebelum + Number(pb.jumlah)
      await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [simpananSukarela.id, saldoSesudah])
      await client.query(
        `INSERT INTO kojasmat_simpanan_mutasi (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status)
         VALUES ($1, $2, $3, 'SETOR', $4, $5, $6, $7, 'DISETUJUI')`,
        [pb.org_id, simpananSukarela.id, pb.pemodal_id, pb.jumlah, saldoSebelum, saldoSesudah, `Pengembalian dana pembatalan proyek ${proyek.kode_proyek}`]
      )
    }
    
    await client.query('COMMIT')
    
    try {
      await jurnalPembatalanPembiayaan(
        proyek.org_id, proyek.jenis_akad as 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
        Number(pb.jumlah), pembiayaanId, String(proyek.kode_proyek),
      )
      if (Number(pb.ujrah_diwakilkan) > 0) {
        await jurnalPembatalanUjrah(proyek.org_id, proyek.jenis_akad, Number(pb.ujrah_diwakilkan), pembiayaanId, String(proyek.kode_proyek))
      }
    } catch (_) { /* jurnal non-fatal */ }

  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Terjadi kesalahan saat membatalkan pembiayaan' }
  }
  
  client.release()



  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

// ─── PELATIHAN ─────────────────────────────────────────────────────────────────

export async function getAllPelatihan(orgId: string): Promise<KojasmatPelatihan[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, COUNT(pp.id)::int AS peserta_count
     FROM kojasmat_pelatihan p
     LEFT JOIN kojasmat_pelatihan_peserta pp ON pp.pelatihan_id = p.id
     WHERE p.org_id=$1
     GROUP BY p.id
     ORDER BY p.tanggal DESC`,
    [orgId]
  )
  return rows as KojasmatPelatihan[]
}

export type KojasmatPelatihanTerjadwal = KojasmatPelatihan & { is_terdaftar: boolean }

export async function getPelatihanTerjadwal(orgId: string, anggotaId: string): Promise<KojasmatPelatihanTerjadwal[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, COUNT(pp.id)::int AS peserta_count,
            EXISTS(
              SELECT 1 FROM kojasmat_pelatihan_peserta x
              WHERE x.pelatihan_id = p.id AND x.anggota_id = $2
            ) AS is_terdaftar
     FROM kojasmat_pelatihan p
     LEFT JOIN kojasmat_pelatihan_peserta pp ON pp.pelatihan_id = p.id
     WHERE p.org_id = $1 AND p.status = 'TERJADWAL'
     GROUP BY p.id
     ORDER BY p.tanggal ASC`,
    [orgId, anggotaId]
  )
  return rows as KojasmatPelatihanTerjadwal[]
}

export async function createPelatihan(payload: {
  org_id: string
  judul: string
  deskripsi?: string
  instruktur?: string
  tanggal: string
  lokasi?: string
  kuota?: number
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_pelatihan (org_id, judul, deskripsi, instruktur, tanggal, lokasi, kuota)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      payload.org_id, payload.judul,
      payload.deskripsi ?? null, payload.instruktur ?? null,
      payload.tanggal, payload.lokasi ?? null, payload.kuota ?? 30,
    ]
  )
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatPelatihan }
}

export async function getPesertaPelatihan(pelatihanId: string) {
  const { rows } = await queryPostgres(
    `SELECT pp.*, a.nama, a.kode_anggota, a.phone
     FROM kojasmat_pelatihan_peserta pp
     LEFT JOIN kojasmat_anggota a ON a.id = pp.anggota_id
     WHERE pp.pelatihan_id=$1 ORDER BY a.nama`,
    [pelatihanId]
  )
  return rows
}

export async function daftarPesertaPelatihan(payload: {
  org_id: string
  pelatihan_id: string
  anggota_id: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await queryPostgres(
    `INSERT INTO kojasmat_pelatihan_peserta (org_id, pelatihan_id, anggota_id)
     VALUES ($1,$2,$3) ON CONFLICT (pelatihan_id, anggota_id) DO NOTHING`,
    [payload.org_id, payload.pelatihan_id, payload.anggota_id]
  )
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function luluskanPeserta(pesertaId: string, anggotaId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await queryPostgres(
    `UPDATE kojasmat_pelatihan_peserta SET status='LULUS' WHERE id=$1`,
    [pesertaId]
  )
  await queryPostgres(
    `UPDATE kojasmat_anggota SET is_verified=TRUE, status='AKTIF', updated_at=NOW()
     WHERE id=$1 AND NOT is_verified`,
    [anggotaId]
  )
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

// ─── PENAWARAN ─────────────────────────────────────────────────────────────────

export async function kirimPenawaranProyek(payload: {
  org_id: string
  proyek_id: string
  anggota_ids: string[]
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  for (const anggotaId of payload.anggota_ids) {
    await queryPostgres(
      `INSERT INTO kojasmat_penawaran (org_id, proyek_id, anggota_id)
       VALUES ($1,$2,$3) ON CONFLICT (proyek_id, anggota_id) DO NOTHING`,
      [payload.org_id, payload.proyek_id, anggotaId]
    )
  }
  revalidatePath('/kojasmat')
  return { data: { sent: payload.anggota_ids.length } }
}

export async function getPenawaranByAnggota(anggotaId: string): Promise<KojasmatPenawaran[]> {
  const { rows } = await queryPostgres(
    `SELECT pn.*, p.nama_proyek, p.jenis_akad, p.kebutuhan_modal,
            p.modal_terkumpul, p.ujrah_nominal, p.ujrah_wakalah_akad, p.durasi_bulan, p.status AS proyek_status
     FROM kojasmat_penawaran pn
     LEFT JOIN kojasmat_proyek p ON p.id = pn.proyek_id
     WHERE pn.anggota_id=$1 ORDER BY pn.sent_at DESC`,
    [anggotaId]
  )
  return rows as KojasmatPenawaran[]
}

export async function updateStatusPenawaran(id: string, status: string) {
  await queryPostgres(
    `UPDATE kojasmat_penawaran SET status=$2 WHERE id=$1`,
    [id, status]
  )
  return { data: { ok: true } }
}

// ─── STATISTIK ─────────────────────────────────────────────────────────────────

export type KojasmatStats = {
  total_anggota: number
  anggota_aktif: number
  total_proyek: number
  proyek_berjalan: number
  antrian_dmr: number
  antrian_dps: number
  antrian_pendaftaran: number
  total_simpanan: number
  simpanan_breakdown?: { jenis: string; total: number }[]
  total_pembiayaan: number
}

// ─── PROYEK TERSEDIA & KETERTARIKAN ──────────────────────────────────────────

export async function getProyekTersedia(
  orgId: string,
  anggotaId: string,
  saldoSukarela: number
): Promise<KojasmatProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT
       p.*,
       a.nama AS pengaju_nama,
       COUNT(DISTINCT pb.id)::int           AS jumlah_pemodal,
       COUNT(DISTINCT km.id)::int           AS jumlah_minat,
       EXISTS(
         SELECT 1 FROM kojasmat_minat km2
         WHERE km2.proyek_id=p.id AND km2.anggota_id=$2
       )                                    AS is_berminat,
       EXISTS(
         SELECT 1 FROM kojasmat_pembiayaan pb2
         WHERE pb2.proyek_id=p.id AND pb2.pemodal_id=$2 AND pb2.status='AKTIF'
       )                                    AS sudah_dibiayai
     FROM kojasmat_proyek p
     LEFT JOIN kojasmat_anggota a  ON a.id  = p.pengaju_id
     LEFT JOIN kojasmat_pembiayaan pb ON pb.proyek_id = p.id AND pb.status='AKTIF'
     LEFT JOIN kojasmat_minat km   ON km.proyek_id = p.id
     WHERE p.org_id = $1
       AND p.status = 'FUNDING_AKTIF'
       AND p.pengaju_id != $2
       AND (p.published_at IS NULL OR p.published_at <= NOW())
     GROUP BY p.id, a.nama
     ORDER BY
       -- Proyek yang diminati anggota ini duluan
       EXISTS(SELECT 1 FROM kojasmat_minat WHERE proyek_id=p.id AND anggota_id=$2) DESC,
       -- Lalu proyek yang sesuai kapasitas (sisa kebutuhan ≤ saldo simpanan sukarela)
       (p.kebutuhan_modal - p.modal_terkumpul) <= $3 DESC,
       -- Proyek dengan progress paling mendekati penuh (butuh dorongan akhir)
       (p.modal_terkumpul::float / NULLIF(p.kebutuhan_modal,0)) DESC`,
    [orgId, anggotaId, saldoSukarela]
  )
  return rows as KojasmatProyek[]
}

export async function toggleMinatProyek(payload: {
  org_id: string
  proyek_id: string
  anggota_id: string
}): Promise<{ is_berminat: boolean }> {
  const { rows: [existing] } = await queryPostgres(
    `SELECT id FROM kojasmat_minat WHERE proyek_id=$1 AND anggota_id=$2`,
    [payload.proyek_id, payload.anggota_id]
  )
  if (existing) {
    await queryPostgres(
      `DELETE FROM kojasmat_minat WHERE proyek_id=$1 AND anggota_id=$2`,
      [payload.proyek_id, payload.anggota_id]
    )
    return { is_berminat: false }
  }
  await queryPostgres(
    `INSERT INTO kojasmat_minat (org_id, proyek_id, anggota_id) VALUES ($1,$2,$3)`,
    [payload.org_id, payload.proyek_id, payload.anggota_id]
  )
  return { is_berminat: true }
}

// ─── PENDAFTARAN MANDIRI PELATIHAN (PUBLIK) ───────────────────────────────────

export type PelatihanPublik = {
  id: string
  org_id: string
  judul: string
  deskripsi: string | null
  instruktur: string | null
  tanggal: string
  lokasi: string | null
  kuota: number
  status: string
  peserta_count: number
}

export async function getPelatihanPublik(pelatihanId: string): Promise<PelatihanPublik | null> {
  const { rows } = await queryPostgres(
    `SELECT p.*, COUNT(pp.id)::int AS peserta_count
     FROM kojasmat_pelatihan p
     LEFT JOIN kojasmat_pelatihan_peserta pp ON pp.pelatihan_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [pelatihanId]
  )
  return (rows[0] as PelatihanPublik) ?? null
}

export async function daftarMandiriPelatihan(payload: {
  pelatihan_id: string
  kode_anggota: string
}): Promise<{ success?: boolean; sudah_terdaftar?: boolean; error?: string }> {
  const { rows: [pelatihan] } = await queryPostgres(
    `SELECT p.*, COUNT(pp.id)::int AS peserta_count
     FROM kojasmat_pelatihan p
     LEFT JOIN kojasmat_pelatihan_peserta pp ON pp.pelatihan_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [payload.pelatihan_id]
  )
  if (!pelatihan) return { error: 'Pelatihan tidak ditemukan' }
  if (pelatihan.status !== 'TERJADWAL') return { error: 'Pendaftaran pelatihan ini sudah ditutup' }
  if (Number(pelatihan.peserta_count) >= Number(pelatihan.kuota)) {
    return { error: 'Kuota pelatihan sudah penuh' }
  }

  const { rows: [anggota] } = await queryPostgres(
    `SELECT * FROM kojasmat_anggota
     WHERE org_id = $1 AND UPPER(kode_anggota) = UPPER($2)
     LIMIT 1`,
    [pelatihan.org_id, payload.kode_anggota]
  )
  if (!anggota) return { error: 'Kode anggota tidak ditemukan. Pastikan kode anggota benar.' }
  if (anggota.status !== 'AKTIF') return { error: 'Hanya anggota aktif yang dapat mendaftar pelatihan' }

  const { rows: [existing] } = await queryPostgres(
    `SELECT id FROM kojasmat_pelatihan_peserta WHERE pelatihan_id=$1 AND anggota_id=$2`,
    [payload.pelatihan_id, anggota.id]
  )
  if (existing) return { sudah_terdaftar: true }

  await queryPostgres(
    `INSERT INTO kojasmat_pelatihan_peserta (org_id, pelatihan_id, anggota_id)
     VALUES ($1,$2,$3)`,
    [pelatihan.org_id, payload.pelatihan_id, anggota.id]
  )

  return { success: true }
}

// ─── STATS ────────────────────────────────────────────────────────────────────

export async function getKojasmatStats(orgId: string): Promise<KojasmatStats> {
  const { rows } = await queryPostgres(
    `SELECT
       (SELECT COUNT(*) FROM kojasmat_anggota WHERE org_id=$1)::int               AS total_anggota,
       (SELECT COUNT(*) FROM kojasmat_anggota WHERE org_id=$1 AND status='AKTIF')::int AS anggota_aktif,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1)::int               AS total_proyek,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1 AND status='BERJALAN')::int AS proyek_berjalan,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1 AND status='MENUNGGU_DMR')::int AS antrian_dmr,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1 AND status='MENUNGGU_DPS')::int AS antrian_dps,
       (SELECT COUNT(*) FROM kojasmat_pendaftaran WHERE org_id=$1 AND status IN ('MENUNGGU','DIREVISI'))::int AS antrian_pendaftaran,
       (SELECT COALESCE(SUM(s.saldo),0)
        FROM kojasmat_simpanan s JOIN kojasmat_anggota a ON a.id=s.anggota_id
        WHERE a.org_id=$1)::numeric AS total_simpanan,
       (SELECT COALESCE(json_agg(json_build_object('jenis', s.jenis, 'total', s.saldo)), '[]'::json) 
        FROM (SELECT s2.jenis, SUM(s2.saldo) as saldo FROM kojasmat_simpanan s2 JOIN kojasmat_anggota a2 ON a2.id=s2.anggota_id WHERE a2.org_id=$1 GROUP BY s2.jenis) s) AS simpanan_breakdown,
       (SELECT COALESCE(SUM(modal_terkumpul),0)
        FROM kojasmat_proyek WHERE org_id=$1 AND status IN ('BERJALAN','FUNDING_DITUTUP'))::numeric AS total_pembiayaan`,
    [orgId]
  )
  return (rows[0] ?? {
    total_anggota: 0, anggota_aktif: 0, total_proyek: 0,
    proyek_berjalan: 0, antrian_dmr: 0, antrian_dps: 0, antrian_pendaftaran: 0,
    total_simpanan: 0, simpanan_breakdown: [], total_pembiayaan: 0,
  }) as KojasmatStats
}

export type KojasmatSimpananReport = {
  breakdown_per_jenis: { jenis: string; total: number }[]
  breakdown_per_anggota: {
    anggota_id: string;
    kode_anggota: string;
    nama: string;
    simpanan: Record<string, number>;
    total: number;
  }[]
}

export async function getSimpananReport(orgId: string, startDate?: string, endDate?: string): Promise<KojasmatSimpananReport> {
  const params: (string | number)[] = [orgId]
  let dateFilter = ''
  
  if (startDate) {
    params.push(startDate)
    dateFilter += ` AND m.tanggal >= $${params.length}`
  }
  if (endDate) {
    params.push(endDate)
    dateFilter += ` AND m.tanggal <= $${params.length}`
  }

  const { rows: jenisRows } = await queryPostgres(`
    SELECT s.jenis, SUM(CASE WHEN m.jenis_mutasi = 'TARIK' THEN -m.jumlah ELSE m.jumlah END) as total
    FROM kojasmat_simpanan_mutasi m
    JOIN kojasmat_simpanan s ON s.id = m.simpanan_id
    WHERE m.org_id = $1 AND m.status = 'DISETUJUI' ${dateFilter}
    GROUP BY s.jenis
  `, params)

  const { rows: aggRows } = await queryPostgres(`
    SELECT m.anggota_id, s.jenis, SUM(CASE WHEN m.jenis_mutasi = 'TARIK' THEN -m.jumlah ELSE m.jumlah END) as total
    FROM kojasmat_simpanan_mutasi m
    JOIN kojasmat_simpanan s ON s.id = m.simpanan_id
    WHERE m.org_id = $1 AND m.status = 'DISETUJUI' ${dateFilter}
    GROUP BY m.anggota_id, s.jenis
  `, params)

  const { rows: anggotaRows } = await queryPostgres(
    `SELECT id, kode_anggota, nama FROM kojasmat_anggota WHERE org_id = $1 ORDER BY kode_anggota ASC`, 
    [orgId]
  )

  const breakdown_per_anggota = anggotaRows.map(a => {
    const mutasi = aggRows.filter(m => m.anggota_id === a.id)
    const simpanan: Record<string, number> = {}
    let total = 0
    for (const m of mutasi) {
      simpanan[m.jenis] = Number(m.total)
      total += Number(m.total)
    }
    return {
      anggota_id: a.id,
      kode_anggota: a.kode_anggota,
      nama: a.nama,
      simpanan,
      total
    }
  })

  return {
    breakdown_per_jenis: jenisRows.map(r => ({ jenis: r.jenis, total: Number(r.total) })),
    breakdown_per_anggota
  }
}

// ─── DISKUSI PROYEK ─────────────────────────────────────────────────────────

export async function getProyekDiskusi(proyekId: string): Promise<KojasmatProyekDiskusi[]> {
  const session = await getInternalAuthSession()
  if (!session) return []

  // Ambil data anggota atau fallback ke info user admin
  const { rows } = await queryPostgres(
    `SELECT d.*,
            COALESCE(a.nama, u.login_email) AS actor_name
     FROM kojasmat_proyek_diskusi d
     LEFT JOIN internal_auth_users u ON u.id = d.actor_id
     LEFT JOIN kojasmat_anggota a ON a.user_id = u.id
     WHERE d.proyek_id = $1
     ORDER BY d.created_at ASC`,
    [proyekId]
  )
  return rows as KojasmatProyekDiskusi[]
}

export async function kirimPesanDiskusi(payload: { org_id: string; proyek_id: string; pesan: string }) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const actorId = getInternalUserId(session)
  const role = await getActorRole(actorId, payload.org_id)
  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager'

  // Pastikan actor adalah admin ATAU anggota yang mendanai proyek ini
  if (!isAdmin) {
    const { rows: anggota } = await queryPostgres(
      `SELECT id FROM kojasmat_anggota WHERE user_id=$1 AND org_id=$2 LIMIT 1`,
      [actorId, payload.org_id]
    )
    if (!anggota[0]) return { error: 'Anda bukan anggota koperasi ini' }

    const { rows: pembiayaan } = await queryPostgres(
      `SELECT id FROM kojasmat_pembiayaan WHERE pemodal_id=$1 AND proyek_id=$2 LIMIT 1`,
      [anggota[0].id, payload.proyek_id]
    )
    if (!pembiayaan[0]) {
      // Izinkan jika dia adalah pengaju proyek
      const { rows: proyek } = await queryPostgres(`SELECT pengaju_id FROM kojasmat_proyek WHERE id=$1`, [payload.proyek_id])
      if (proyek[0]?.pengaju_id !== anggota[0].id) {
        return { error: 'Hanya admin, pengaju, dan pemodal yang dapat berdiskusi' }
      }
    }
  }

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_proyek_diskusi (org_id, proyek_id, actor_id, pesan)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [payload.org_id, payload.proyek_id, actorId, payload.pesan]
  )

  // TODO: Implement push notification and email sending to all other investors.
  // For now, it will just show in the portal.

  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatProyekDiskusi }
}
// [DUMMY IMPORT FIX UP] 

// ─── TRANSFER SALDO ─────────────────────────────────────────────────────────

export async function getAnggotaNameByKode(orgId: string, kode: string): Promise<{ nama: string, id: string } | null> {
  const { rows } = await queryPostgres(
    `SELECT id, nama FROM kojasmat_anggota WHERE org_id=$1 AND kode_anggota=$2 AND status='AKTIF'`,
    [orgId, kode]
  )
  if (rows[0]) return { nama: rows[0].nama as string, id: rows[0].id as string }
  return null
}

export async function transferSaldoSukarela(payload: { sender_anggota_id: string, recipient_kode: string, jumlah: number }) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  if (payload.jumlah < 1000) return { error: 'Nominal transfer minimum Rp 1.000' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows: [sender] } = await client.query(
      `SELECT id, org_id, nama, kode_anggota, status FROM kojasmat_anggota WHERE id=$1`,
      [payload.sender_anggota_id]
    )
    if (!sender) throw new Error('Anggota pengirim tidak ditemukan')
    if (sender.status !== 'AKTIF') throw new Error('Status pengirim tidak aktif')

    const { rows: [recipient] } = await client.query(
      `SELECT id, nama, kode_anggota, status FROM kojasmat_anggota WHERE org_id=$1 AND kode_anggota=$2`,
      [sender.org_id, payload.recipient_kode]
    )
    if (!recipient) throw new Error(`Penerima dengan kode ${payload.recipient_kode} tidak ditemukan`)
    if (recipient.status !== 'AKTIF') throw new Error('Status penerima tidak aktif')
    if (sender.id === recipient.id) throw new Error('Tidak bisa transfer ke diri sendiri')

    // Lock in consistent order to prevent deadlock
    const lockFirst = sender.id < recipient.id ? sender.id : recipient.id
    const lockSecond = sender.id < recipient.id ? recipient.id : sender.id
    
    await client.query(`SELECT id FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`, [lockFirst])
    await client.query(`SELECT id FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`, [lockSecond])

    const { rows: [senderSimpanan] } = await client.query(
      `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA'`,
      [sender.id]
    )
    if (!senderSimpanan) throw new Error('Rekening simpanan sukarela Anda tidak ditemukan')
    
    const senderSaldo = Number(senderSimpanan.saldo)
    if (payload.jumlah > senderSaldo) throw new Error('Saldo simpanan sukarela Anda tidak mencukupi')

    let { rows: [recipientSimpanan] } = await client.query(
      `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA'`,
      [recipient.id]
    )
    if (!recipientSimpanan) {
      const { rows: [newSimpanan] } = await client.query(
        `INSERT INTO kojasmat_simpanan (org_id, anggota_id, jenis, saldo) VALUES ($1, $2, 'SUKARELA', 0) RETURNING id, saldo`,
        [sender.org_id, recipient.id]
      )
      recipientSimpanan = newSimpanan
    }

    const recipientSaldo = Number(recipientSimpanan.saldo)

    const newSenderSaldo = senderSaldo - payload.jumlah
    await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [senderSimpanan.id, newSenderSaldo])
    await client.query(
      `INSERT INTO kojasmat_simpanan_mutasi (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status)
       VALUES ($1, $2, $3, 'TARIK', $4, $5, $6, $7, 'DISETUJUI')`,
      [sender.org_id, senderSimpanan.id, sender.id, payload.jumlah, senderSaldo, newSenderSaldo, `Transfer Saldo ke ${recipient.nama} (${recipient.kode_anggota})`]
    )

    const newRecipientSaldo = recipientSaldo + payload.jumlah
    await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [recipientSimpanan.id, newRecipientSaldo])
    await client.query(
      `INSERT INTO kojasmat_simpanan_mutasi (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status)
       VALUES ($1, $2, $3, 'SETOR', $4, $5, $6, $7, 'DISETUJUI')`,
      [sender.org_id, recipientSimpanan.id, recipient.id, payload.jumlah, recipientSaldo, newRecipientSaldo, `Terima Transfer dari ${sender.nama} (${sender.kode_anggota})`]
    )

    await client.query('COMMIT')
    client.release()

    revalidatePath('/kojasmat')
    return { data: { success: true, newSaldo: newSenderSaldo } }
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat transfer' }
  }
}
