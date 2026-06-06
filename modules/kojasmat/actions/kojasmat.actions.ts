'use server'

// Kojasmat — platform koperasi syariah: anggota, simpanan, proyek, pembiayaan, DPS, pelatihan

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { revalidatePath } from 'next/cache'

// Non-fatal ERP journal helper — silently skips if default accounts are not configured
async function tryRecordRevenue(orgId: string, amount: number, description: string, refId: string) {
  try {
    const [debitAcct, creditAcct] = await Promise.all([
      ERPBridge.getDefaultAccount(orgId, '1-10001'),
      ERPBridge.getDefaultAccount(orgId, '4-10001'),
    ])
    if (!debitAcct || !creditAcct) return
    await ERPBridge.recordRevenue({
      orgId,
      amount,
      date: new Date().toISOString().split('T')[0],
      description,
      referenceType: 'KOJASMAT',
      referenceId: refId,
      debitAccountId: debitAcct,
      creditAccountId: creditAcct,
    })
  } catch (_) { /* non-fatal */ }
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
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA'
  saldo: number
}

export type KojasmatSimpananMutasi = {
  id: string
  simpanan_id: string
  anggota_id: string
  jenis_mutasi: 'SETOR' | 'TARIK' | 'BAGI_HASIL' | 'KOREKSI'
  jumlah: number
  saldo_sebelum: number
  saldo_sesudah: number
  keterangan?: string
  tanggal: string
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
  durasi_bulan: number
  tanggal_mulai?: string
  tanggal_selesai?: string
  status: string
  agunan?: string
  notes?: string
  created_at: string
}

export type KojasmatPembiayaan = {
  id: string
  proyek_id: string
  pemodal_id: string
  pemodal_nama?: string
  jumlah: number
  porsi_pct: number
  status: 'AKTIF' | 'SELESAI' | 'GAGAL'
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

export async function getAnggotaByUserId(userId: string): Promise<KojasmatAnggota | null> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_anggota WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  return (rows[0] ?? null) as KojasmatAnggota | null
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

  revalidatePath('/kojasmat')
  return { data: anggota as KojasmatAnggota }
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

export async function catatSimpananMutasi(payload: {
  org_id: string
  anggota_id: string
  jenis_simpanan: 'POKOK' | 'WAJIB' | 'SUKARELA'
  jenis_mutasi: 'SETOR' | 'TARIK' | 'KOREKSI'
  jumlah: number
  keterangan?: string
  tanggal?: string
}) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

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
        session.user.id,
      ]
    )

    if (payload.jenis_mutasi === 'SETOR') {
      await tryRecordRevenue(
        payload.org_id, payload.jumlah,
        `Setoran simpanan ${payload.jenis_simpanan} anggota ${payload.anggota_id}`,
        String(simpanan.id),
      )
    }

    revalidatePath('/kojasmat')
    return { data: { saldo: sesudah } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server'
    return { error: msg }
  }
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
        kebutuhan_modal, ujrah_nominal, durasi_bulan, agunan, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      payload.org_id, payload.pengaju_id, kode, payload.nama_proyek,
      payload.deskripsi ?? null, payload.jenis_akad,
      payload.kebutuhan_modal,
      payload.ujrah_nominal ?? 0,
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

export async function submitProyekKeDPS(proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_proyek SET status='REVIEW_DPS', updated_at=NOW()
     WHERE id=$1 AND status='DRAFT' RETURNING *`,
    [proyekId]
  )
  if (!rows[0]) return { error: 'Proyek tidak dalam status DRAFT' }
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatProyek }
}

// ─── DPS REVIEW ───────────────────────────────────────────────────────────────

export async function getProyekAntrianDPS(orgId: string): Promise<KojasmatProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT p.*, a.nama AS pengaju_nama
     FROM kojasmat_proyek p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pengaju_id
     WHERE p.org_id=$1 AND p.status='REVIEW_DPS'
     ORDER BY p.created_at ASC`,
    [orgId]
  )
  return rows as KojasmatProyek[]
}

export async function submitDpsReview(payload: {
  org_id: string
  proyek_id: string
  keputusan: 'DISETUJUI' | 'DITOLAK' | 'REVISI'
  catatan?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await queryPostgres(
    `INSERT INTO kojasmat_dps_review (org_id, proyek_id, reviewer_id, keputusan, catatan)
     VALUES ($1,$2,$3,$4,$5)`,
    [payload.org_id, payload.proyek_id, session.user.id, payload.keputusan, payload.catatan ?? null]
  )

  const newStatus = payload.keputusan === 'DISETUJUI' ? 'DISETUJUI'
    : payload.keputusan === 'DITOLAK' ? 'DITOLAK'
    : 'DRAFT'

  await queryPostgres(
    `UPDATE kojasmat_proyek SET status=$2, updated_at=NOW() WHERE id=$1`,
    [payload.proyek_id, newStatus]
  )

  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function getDpsReviewHistory(proyekId: string): Promise<KojasmatDpsReview[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_dps_review WHERE proyek_id=$1 ORDER BY reviewed_at DESC`,
    [proyekId]
  )
  return rows as KojasmatDpsReview[]
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
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [proyek] } = await queryPostgres(
    `SELECT * FROM kojasmat_proyek WHERE id=$1`,
    [payload.proyek_id]
  )
  if (!proyek) return { error: 'Proyek tidak ditemukan' }
  if (proyek.status !== 'OPEN') return { error: 'Proyek tidak dalam status OPEN' }

  const sisa = Number(proyek.kebutuhan_modal) - Number(proyek.modal_terkumpul)
  if (payload.jumlah > sisa) {
    return { error: `Melebihi sisa kebutuhan (Rp ${sisa.toLocaleString('id-ID')})` }
  }

  const porsiPct = (payload.jumlah / Number(proyek.kebutuhan_modal)) * 100

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_pembiayaan (org_id, proyek_id, pemodal_id, jumlah, porsi_pct)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [payload.org_id, payload.proyek_id, payload.pemodal_id, payload.jumlah, porsiPct]
  )

  const newModal = Number(proyek.modal_terkumpul) + payload.jumlah
  const newStatus = newModal >= Number(proyek.kebutuhan_modal) ? 'TERPENUHI' : proyek.status

  await queryPostgres(
    `UPDATE kojasmat_proyek SET modal_terkumpul=$2, status=$3, updated_at=NOW() WHERE id=$1`,
    [payload.proyek_id, newModal, newStatus]
  )

  await tryRecordRevenue(
    payload.org_id, payload.jumlah,
    `Pembiayaan proyek ${String(proyek.kode_proyek)}`,
    String(rows[0].id),
  )

  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatPembiayaan }
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
            p.modal_terkumpul, p.ujrah_nominal, p.durasi_bulan, p.status AS proyek_status
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
  antrian_dps: number
  total_simpanan: number
  total_pembiayaan: number
}

export async function getKojasmatStats(orgId: string): Promise<KojasmatStats> {
  const { rows } = await queryPostgres(
    `SELECT
       (SELECT COUNT(*) FROM kojasmat_anggota WHERE org_id=$1)::int               AS total_anggota,
       (SELECT COUNT(*) FROM kojasmat_anggota WHERE org_id=$1 AND status='AKTIF')::int AS anggota_aktif,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1)::int               AS total_proyek,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1 AND status='BERJALAN')::int AS proyek_berjalan,
       (SELECT COUNT(*) FROM kojasmat_proyek  WHERE org_id=$1 AND status='REVIEW_DPS')::int AS antrian_dps,
       (SELECT COALESCE(SUM(s.saldo),0)
        FROM kojasmat_simpanan s JOIN kojasmat_anggota a ON a.id=s.anggota_id
        WHERE a.org_id=$1)::numeric AS total_simpanan,
       (SELECT COALESCE(SUM(modal_terkumpul),0)
        FROM kojasmat_proyek WHERE org_id=$1 AND status IN ('BERJALAN','TERPENUHI'))::numeric AS total_pembiayaan`,
    [orgId]
  )
  return (rows[0] ?? {
    total_anggota: 0, anggota_aktif: 0, total_proyek: 0,
    proyek_berjalan: 0, antrian_dps: 0, total_simpanan: 0, total_pembiayaan: 0,
  }) as KojasmatStats
}
