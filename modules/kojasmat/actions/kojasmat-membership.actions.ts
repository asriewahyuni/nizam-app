'use server'

// Kojasmat — alur keanggotaan lengkap: pendaftaran, dokumen, laporan proyek, tindakan/sanksi

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type KojasmatPendaftaran = {
  id: string
  org_id: string
  user_id?: string
  nama_lengkap: string
  nik?: string
  email?: string
  phone?: string
  alamat?: string
  pekerjaan?: string
  alasan_bergabung?: string
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'DIREVISI'
  catatan_pengurus?: string
  ditinjau_oleh?: string
  ditinjau_at?: string
  anggota_id?: string
  created_at: string
  updated_at: string
}

export type KojasmatDokumen = {
  id: string
  org_id: string
  referensi_type: 'PENDAFTARAN' | 'ANGGOTA' | 'PROYEK' | 'LAPORAN'
  referensi_id: string
  jenis_dokumen: 'KTP' | 'PASSPORT' | 'SURAT_USAHA' | 'FOTO_USAHA' |
    'PROYEKSI_KEUANGAN' | 'ANALISA_BISNIS' | 'PENAWARAN_SYIRKAH' |
    'LAPORAN_MINGGUAN' | 'AKAD' | 'LAINNYA'
  nama_file: string
  file_key: string
  file_size?: number
  mime_type?: string
  status: 'PENDING' | 'DITERIMA' | 'DITOLAK'
  catatan?: string
  uploaded_by?: string
  created_at: string
}

export type KojasmatLaporanProyek = {
  id: string
  org_id: string
  proyek_id: string
  pengaju_id: string
  pengaju_nama?: string
  proyek_nama?: string
  periode_mulai: string
  periode_akhir: string
  ringkasan: string
  omzet_periode: number
  kendala?: string
  rencana_kedepan?: string
  status: 'DIKIRIM' | 'DITINJAU' | 'DIVERIFIKASI'
  catatan_pengurus?: string
  is_terlambat: boolean
  created_at: string
}

export type KojasmatTindakan = {
  id: string
  org_id: string
  anggota_id: string
  anggota_nama?: string
  proyek_id?: string
  proyek_nama?: string
  jenis: 'PERINGATAN' | 'TINJAUAN_ULANG' | 'PENCABUTAN_KEANGGOTAAN'
  alasan: string
  status: 'AKTIF' | 'SELESAI' | 'DIBATALKAN'
  issued_by?: string
  resolved_at?: string
  created_at: string
}

// ─── PENDAFTARAN ──────────────────────────────────────────────────────────────

export async function getAllPendaftaran(orgId: string): Promise<KojasmatPendaftaran[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_pendaftaran
     WHERE org_id = $1
     ORDER BY CASE status WHEN 'MENUNGGU' THEN 0 WHEN 'DIREVISI' THEN 1 ELSE 2 END,
              created_at DESC`,
    [orgId]
  )
  return rows as KojasmatPendaftaran[]
}

export async function getPendaftaranById(id: string): Promise<KojasmatPendaftaran | null> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_pendaftaran WHERE id = $1 LIMIT 1`,
    [id]
  )
  return (rows[0] ?? null) as KojasmatPendaftaran | null
}

// Tidak butuh auth — form publik untuk calon anggota
export async function buatPendaftaran(payload: {
  org_id: string
  nama_lengkap: string
  nik?: string
  email?: string
  phone?: string
  alamat?: string
  pekerjaan?: string
  alasan_bergabung?: string
}) {
  try {
    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_pendaftaran
         (org_id, nama_lengkap, nik, email, phone, alamat, pekerjaan, alasan_bergabung)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, status, created_at`,
      [
        payload.org_id, payload.nama_lengkap,
        payload.nik ?? null, payload.email ?? null,
        payload.phone ?? null, payload.alamat ?? null,
        payload.pekerjaan ?? null, payload.alasan_bergabung ?? null,
      ]
    )
    return { data: rows[0] as { id: string; status: string; created_at: string } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan pendaftaran' }
  }
}

export async function setujuiPendaftaran(pendaftaranId: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    const { rows: [pend] } = await queryPostgres(
      `SELECT * FROM kojasmat_pendaftaran WHERE id = $1`,
      [pendaftaranId]
    )
    if (!pend) return { error: 'Pendaftaran tidak ditemukan' }
    if (pend.status !== 'MENUNGGU' && pend.status !== 'DIREVISI') {
      return { error: 'Pendaftaran sudah diproses' }
    }

    // Buat nomor anggota baru
    const { rows: lastRow } = await queryPostgres(
      `SELECT kode_anggota FROM kojasmat_anggota WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [pend.org_id]
    )
    let nextNum = 1
    if (lastRow[0]) {
      const m = String(lastRow[0].kode_anggota).match(/\d+$/)
      if (m) nextNum = parseInt(m[0]) + 1
    }
    const kode = `KJM-${String(nextNum).padStart(3, '0')}`

    // Buat anggota baru
    const { rows: [anggota] } = await queryPostgres(
      `INSERT INTO kojasmat_anggota
         (org_id, kode_anggota, nama, nik, email, phone, alamat, pekerjaan, status, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CALON',FALSE)
       RETURNING id`,
      [
        pend.org_id, kode, pend.nama_lengkap,
        pend.nik, pend.email, pend.phone,
        pend.alamat, pend.pekerjaan,
      ]
    )

    // Buat 3 rekening simpanan
    await queryPostgres(
      `INSERT INTO kojasmat_simpanan (org_id, anggota_id, jenis)
       VALUES ($1,$2,'POKOK'),($1,$2,'WAJIB'),($1,$2,'SUKARELA')`,
      [pend.org_id, anggota.id]
    )

    // Pindahkan dokumen pendaftaran ke referensi anggota
    await queryPostgres(
      `UPDATE kojasmat_dokumen
       SET referensi_type='ANGGOTA', referensi_id=$2, status='DITERIMA'
       WHERE referensi_type='PENDAFTARAN' AND referensi_id=$1`,
      [pendaftaranId, anggota.id]
    )

    // Update pendaftaran
    await queryPostgres(
      `UPDATE kojasmat_pendaftaran
       SET status='DISETUJUI', anggota_id=$2, ditinjau_oleh=$3, ditinjau_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [pendaftaranId, anggota.id, session.user.id]
    )

    revalidatePath('/kojasmat')
    return { data: { anggota_id: anggota.id, kode_anggota: kode } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyetujui pendaftaran' }
  }
}

export async function tolakPendaftaran(pendaftaranId: string, catatan: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    await queryPostgres(
      `UPDATE kojasmat_pendaftaran
       SET status='DITOLAK', catatan_pengurus=$2, ditinjau_oleh=$3, ditinjau_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [pendaftaranId, catatan, session.user.id]
    )
    revalidatePath('/kojasmat')
    return { data: { ok: true } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menolak pendaftaran' }
  }
}

export async function mintaRevisiPendaftaran(pendaftaranId: string, catatan: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    await queryPostgres(
      `UPDATE kojasmat_pendaftaran
       SET status='DIREVISI', catatan_pengurus=$2, ditinjau_oleh=$3, ditinjau_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [pendaftaranId, catatan, session.user.id]
    )
    revalidatePath('/kojasmat')
    return { data: { ok: true } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal meminta revisi' }
  }
}

// ─── DOKUMEN ──────────────────────────────────────────────────────────────────

export async function simpanDokumen(payload: {
  org_id: string
  referensi_type: KojasmatDokumen['referensi_type']
  referensi_id: string
  jenis_dokumen: KojasmatDokumen['jenis_dokumen']
  nama_file: string
  file_key: string
  file_size?: number
  mime_type?: string
}) {
  try {
    const session = await getInternalAuthSession()
    const uploadedBy = session?.user.id ?? null

    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_dokumen
         (org_id, referensi_type, referensi_id, jenis_dokumen,
          nama_file, file_key, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        payload.org_id, payload.referensi_type, payload.referensi_id,
        payload.jenis_dokumen, payload.nama_file, payload.file_key,
        payload.file_size ?? null, payload.mime_type ?? null, uploadedBy,
      ]
    )
    return { data: rows[0] as KojasmatDokumen }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan dokumen' }
  }
}

// Untuk pendaftaran publik (tidak ada session) — overload tanpa auth check
export async function simpanDokumenPendaftaran(payload: {
  org_id: string
  referensi_id: string
  jenis_dokumen: KojasmatDokumen['jenis_dokumen']
  nama_file: string
  file_key: string
  file_size?: number
  mime_type?: string
}) {
  try {
    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_dokumen
         (org_id, referensi_type, referensi_id, jenis_dokumen,
          nama_file, file_key, file_size, mime_type)
       VALUES ($1,'PENDAFTARAN',$2,$3,$4,$5,$6,$7)
       RETURNING id, jenis_dokumen, nama_file`,
      [
        payload.org_id, payload.referensi_id,
        payload.jenis_dokumen, payload.nama_file, payload.file_key,
        payload.file_size ?? null, payload.mime_type ?? null,
      ]
    )
    return { data: rows[0] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan dokumen' }
  }
}

export async function getDokumenByRef(
  refType: KojasmatDokumen['referensi_type'],
  refId: string
): Promise<KojasmatDokumen[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_dokumen
     WHERE referensi_type=$1 AND referensi_id=$2
     ORDER BY created_at ASC`,
    [refType, refId]
  )
  return rows as KojasmatDokumen[]
}

export async function hapusDokumen(id: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }
    await queryPostgres(`DELETE FROM kojasmat_dokumen WHERE id=$1`, [id])
    return { data: { ok: true } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menghapus dokumen' }
  }
}

// ─── LAPORAN PROYEK ───────────────────────────────────────────────────────────

export async function kirimLaporanProyek(payload: {
  org_id: string
  proyek_id: string
  pengaju_id: string
  periode_mulai: string
  periode_akhir: string
  ringkasan: string
  omzet_periode?: number
  kendala?: string
  rencana_kedepan?: string
}) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    // Cek keterlambatan: laporan wajib dikirim tiap minggu
    const { rows: [lastLaporan] } = await queryPostgres(
      `SELECT periode_akhir FROM kojasmat_laporan_proyek
       WHERE proyek_id=$1 ORDER BY periode_akhir DESC LIMIT 1`,
      [payload.proyek_id]
    )

    let isTerlambat = false
    if (lastLaporan) {
      const lastDate = new Date(lastLaporan.periode_akhir)
      const periodeStart = new Date(payload.periode_mulai)
      const diffDays = (periodeStart.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      isTerlambat = diffDays > 9  // toleransi 2 hari dari jadwal mingguan
    }

    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_laporan_proyek
         (org_id, proyek_id, pengaju_id, periode_mulai, periode_akhir,
          ringkasan, omzet_periode, kendala, rencana_kedepan, is_terlambat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        payload.org_id, payload.proyek_id, payload.pengaju_id,
        payload.periode_mulai, payload.periode_akhir,
        payload.ringkasan, payload.omzet_periode ?? 0,
        payload.kendala ?? null, payload.rencana_kedepan ?? null,
        isTerlambat,
      ]
    )
    revalidatePath('/kojasmat')
    return { data: rows[0] as KojasmatLaporanProyek }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal mengirim laporan' }
  }
}

export async function getAllLaporan(orgId: string): Promise<KojasmatLaporanProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT l.*, a.nama AS pengaju_nama, p.nama_proyek AS proyek_nama
     FROM kojasmat_laporan_proyek l
     LEFT JOIN kojasmat_anggota a ON a.id = l.pengaju_id
     LEFT JOIN kojasmat_proyek p ON p.id = l.proyek_id
     WHERE l.org_id = $1
     ORDER BY l.created_at DESC
     LIMIT 100`,
    [orgId]
  )
  return rows as KojasmatLaporanProyek[]
}

export async function getLaporanByProyek(proyekId: string): Promise<KojasmatLaporanProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT l.*, a.nama AS pengaju_nama
     FROM kojasmat_laporan_proyek l
     LEFT JOIN kojasmat_anggota a ON a.id = l.pengaju_id
     WHERE l.proyek_id = $1
     ORDER BY l.periode_mulai DESC`,
    [proyekId]
  )
  return rows as KojasmatLaporanProyek[]
}

export async function ulasLaporan(id: string, catatan: string, status: 'DITINJAU' | 'DIVERIFIKASI') {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    await queryPostgres(
      `UPDATE kojasmat_laporan_proyek
       SET status=$2, catatan_pengurus=$3, updated_at=NOW()
       WHERE id=$1`,
      [id, status, catatan]
    )
    revalidatePath('/kojasmat')
    return { data: { ok: true } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal mengulas laporan' }
  }
}

// ─── TINDAKAN / SANKSI ────────────────────────────────────────────────────────

export async function beriTindakan(payload: {
  org_id: string
  anggota_id: string
  proyek_id?: string
  jenis: KojasmatTindakan['jenis']
  alasan: string
}) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_tindakan
         (org_id, anggota_id, proyek_id, jenis, alasan, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        payload.org_id, payload.anggota_id,
        payload.proyek_id ?? null, payload.jenis,
        payload.alasan, session.user.id,
      ]
    )

    // Jika PENCABUTAN, bekukan anggota
    if (payload.jenis === 'PENCABUTAN_KEANGGOTAAN') {
      await queryPostgres(
        `UPDATE kojasmat_anggota SET status='DIBEKUKAN', updated_at=NOW() WHERE id=$1`,
        [payload.anggota_id]
      )
    }

    revalidatePath('/kojasmat')
    return { data: rows[0] as KojasmatTindakan }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal memberikan tindakan' }
  }
}

export async function getAllTindakan(orgId: string): Promise<KojasmatTindakan[]> {
  const { rows } = await queryPostgres(
    `SELECT t.*, a.nama AS anggota_nama, p.nama_proyek AS proyek_nama
     FROM kojasmat_tindakan t
     LEFT JOIN kojasmat_anggota a ON a.id = t.anggota_id
     LEFT JOIN kojasmat_proyek p ON p.id = t.proyek_id
     WHERE t.org_id = $1
     ORDER BY t.created_at DESC`,
    [orgId]
  )
  return rows as KojasmatTindakan[]
}

export async function selesaikanTindakan(id: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session) return { error: 'Tidak terautentikasi' }

    await queryPostgres(
      `UPDATE kojasmat_tindakan SET status='SELESAI', resolved_at=NOW() WHERE id=$1`,
      [id]
    )
    revalidatePath('/kojasmat')
    return { data: { ok: true } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyelesaikan tindakan' }
  }
}

// ─── STATS EXTENSION ──────────────────────────────────────────────────────────

export async function getPendaftaranStats(orgId: string) {
  const { rows } = await queryPostgres(
    `SELECT
       COUNT(*) FILTER (WHERE status='MENUNGGU')::int AS menunggu,
       COUNT(*) FILTER (WHERE status='DIREVISI')::int  AS revisi,
       COUNT(*)::int                                   AS total
     FROM kojasmat_pendaftaran
     WHERE org_id=$1`,
    [orgId]
  )
  return rows[0] as { menunggu: number; revisi: number; total: number }
}
