'use server'

// Kojasmat — alur keanggotaan lengkap: pendaftaran, dokumen, laporan proyek, tindakan/sanksi

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession, createInternalAuthUser } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'
import { postSimpananMutasi } from './kojasmat.actions'
import { jurnalPendapatanBiayaAdmin } from '@/lib/erp-bridge/kojasmat-journals'
import { generateTempPassword } from '../lib/temp-password'

// session.user.id bisa berisi legacy_user_id (Supabase UUID), bukan internal_auth_users.id.
// Gunakan fungsi ini untuk FK yang merujuk ke internal_auth_users(id).
function getInternalUserId(session: { user: { id: string; user_metadata: Record<string, unknown> } }): string {
  return (session.user.user_metadata['internal_user_id'] as string | null) ?? session.user.id
}

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
  biaya_admin_dibayar?: number | null
  simpanan_pokok_dibayar?: number | null
  simpanan_wajib_dibayar?: number | null
  bukti_bayar_dokumen_id?: string | null
  status_bayar?: 'BELUM' | 'SUDAH'
  dibayar_at?: string | null
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
    'LAPORAN_MINGGUAN' | 'AKAD' | 'LAINNYA' |
    'KELAYAKAN_USAHA' | 'PROPOSAL' | 'PENAWARAN_HARGA'
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
  password?: string
  phone?: string
  alamat?: string
  pekerjaan?: string
  alasan_bergabung?: string
}) {
  try {
    // Cek dulu apakah calon anggota ini sudah pernah mendaftar di koperasi ini
    // (email/NIK sama) — supaya submit ganda (network lambat, klik dua kali,
    // reload di tengah wizard) melanjutkan pendaftaran yang sama, bukan gagal
    // dengan pesan generik dari constraint UNIQUE global internal_auth_users.
    if (payload.email || payload.nik) {
      const { rows: existingRows } = await queryPostgres(
        `SELECT id, status, created_at FROM kojasmat_pendaftaran
         WHERE org_id = $1
           AND ((email IS NOT NULL AND email = $2) OR (nik IS NOT NULL AND nik = $3))
         ORDER BY created_at DESC LIMIT 1`,
        [payload.org_id, payload.email ?? null, payload.nik ?? null]
      )
      const existing = existingRows[0]
      if (existing) {
        if (existing.status === 'MENUNGGU' || existing.status === 'DIREVISI') {
          return { data: existing as { id: string; status: string; created_at: string } }
        }
        if (existing.status === 'DISETUJUI') {
          return { error: 'Email/NIK ini sudah terdaftar sebagai anggota. Silakan login di halaman Login Anggota.' }
        }
        return { error: 'Pendaftaran sebelumnya dengan email/NIK ini telah ditolak. Hubungi pengurus koperasi untuk info lebih lanjut.' }
      }
    }

    let authUserId: string | null = null

    // Buat akun auth jika email + password disediakan
    if (payload.email && payload.password) {
      const authResult = await createInternalAuthUser({
        email: payload.email,
        nik: payload.nik ?? null,
        password: payload.password,
        fullName: payload.nama_lengkap,
        userType: 'anggota',
      })
      if ('error' in authResult) {
        // Email/NIK sudah dipakai akun lain di platform Nizam (bukan pendaftaran
        // koperasi ini — sudah dicek di atas) — kemungkinan akun organisasi lain.
        if ((authResult.error ?? '').toLowerCase().includes('sudah terdaftar')) {
          return { error: 'Email atau NIK ini sudah terpakai untuk akun lain di sistem. Gunakan email/NIK berbeda, atau hubungi pengurus koperasi jika Anda yakin ini keliru.' }
        }
        return { error: authResult.error }
      }
      authUserId = authResult.internalUserId ?? null
    }

    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_pendaftaran
         (org_id, user_id, nama_lengkap, nik, email, phone, alamat, pekerjaan, alasan_bergabung)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, status, created_at`,
      [
        payload.org_id, authUserId,
        payload.nama_lengkap,
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

// Inti pembuatan anggota dari pendaftaran — dipakai baik oleh staf yang approve manual
// (status awal CALON) maupun alur otomatis test+bayar (status langsung AKTIF).
async function createAnggotaFromPendaftaran(
  pend: KojasmatPendaftaran & { simpanan_pokok_dibayar?: number | null; simpanan_wajib_dibayar?: number | null; biaya_admin_dibayar?: number | null },
  opts: { status: 'CALON' | 'AKTIF'; reviewedBy?: string | null }
) {
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
  const isAktif = opts.status === 'AKTIF'

  // Buat anggota baru
  const { rows: [anggota] } = await queryPostgres(
    `INSERT INTO kojasmat_anggota
       (org_id, kode_anggota, nama, nik, email, phone, alamat, pekerjaan, status, is_verified, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      pend.org_id, kode, pend.nama_lengkap,
      pend.nik, pend.email, pend.phone,
      pend.alamat, pend.pekerjaan,
      opts.status, isAktif, pend.user_id ?? null,
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
    [pend.id, anggota.id]
  )

  // Login: pakai akun yang sudah dibuat saat buatPendaftaran (pend.user_id) kalau ada;
  // hanya generate akun baru untuk pendaftaran lama yang belum sempat membuat akun di step Data.
  let tempPassword: string | null = null
  let loginIdentifier: string | null = pend.user_id ? (pend.email ?? pend.nik ?? null) : null
  if (!pend.user_id && (pend.email || pend.nik)) {
    tempPassword = generateTempPassword()
    const userResult = await createInternalAuthUser({
      email: pend.email ?? null,
      nik: pend.nik ?? null,
      password: tempPassword,
      fullName: pend.nama_lengkap,
      userType: 'member',
    })
    if ('error' in userResult) {
      // Akun mungkin sudah ada — lanjutkan tanpa error fatal
      tempPassword = null
    } else {
      await queryPostgres(
        `UPDATE kojasmat_anggota SET user_id=$2 WHERE id=$1`,
        [anggota.id, userResult.internalUserId]
      )
      loginIdentifier = pend.email ?? pend.nik ?? null
    }
  }

  // Setoran awal — hanya untuk aktivasi otomatis (test+bayar), supaya tercatat di jurnal
  if (isAktif) {
    const nominalPokok = Number(pend.simpanan_pokok_dibayar || 0)
    const nominalWajib = Number(pend.simpanan_wajib_dibayar || 0)
    const nominalAdmin = Number(pend.biaya_admin_dibayar || 0)
    if (nominalPokok > 0) {
      await postSimpananMutasi({
        org_id: pend.org_id,
        anggota_id: anggota.id,
        jenis_simpanan: 'POKOK',
        jenis_mutasi: 'SETOR',
        jumlah: nominalPokok,
        keterangan: 'Setoran simpanan pokok — pendaftaran anggota baru',
        created_by: pend.user_id ?? null,
      })
    }
    if (nominalWajib > 0) {
      await postSimpananMutasi({
        org_id: pend.org_id,
        anggota_id: anggota.id,
        jenis_simpanan: 'WAJIB',
        jenis_mutasi: 'SETOR',
        jumlah: nominalWajib,
        keterangan: 'Setoran simpanan wajib — pendaftaran anggota baru',
        created_by: pend.user_id ?? null,
      })
    }
    if (nominalAdmin > 0) {
      await jurnalPendapatanBiayaAdmin(pend.org_id, nominalAdmin, pend.id)
    }
  }

  // Update pendaftaran
  await queryPostgres(
    `UPDATE kojasmat_pendaftaran
     SET status='DISETUJUI', anggota_id=$2, ditinjau_oleh=$3, ditinjau_at=NOW(), updated_at=NOW()
     WHERE id=$1`,
    [pend.id, anggota.id, opts.reviewedBy ?? null]
  )

  revalidatePath('/kojasmat')
  return {
    anggota_id: anggota.id,
    kode_anggota: kode,
    temp_password: tempPassword,
    login_identifier: loginIdentifier,
    status: opts.status,
  }
}

// Anggota baru selalu butuh persetujuan manual staf (owner/admin/manager) di sini —
// tidak ada jalur aktivasi otomatis. Kalau pendaftar sudah lulus test masuk DAN sudah
// upload bukti transfer (status_bayar='SUDAH'), approve di sini langsung mengaktifkan
// akun (status AKTIF) serta memposting setoran pokok/wajib & biaya admin ke jurnal —
// karena persetujuan staf DI SINI-lah titik verifikasi manual bahwa dana sudah diterima.
// Kalau belum ada pembayaran online (pendaftaran offline/manual), tetap jadi CALON dulu.
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

    const data = await createAnggotaFromPendaftaran(pend as KojasmatPendaftaran, {
      status: pend.status_bayar === 'SUDAH' ? 'AKTIF' : 'CALON',
      reviewedBy: getInternalUserId(session),
    })
    return { data }
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
      [pendaftaranId, catatan, getInternalUserId(session)]
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
      [pendaftaranId, catatan, getInternalUserId(session)]
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
    const uploadedBy = session ? getInternalUserId(session) : null

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

export async function getLaporanByAnggota(anggotaId: string): Promise<KojasmatLaporanProyek[]> {
  const { rows } = await queryPostgres(
    `SELECT l.*, p.nama_proyek AS proyek_nama
     FROM kojasmat_laporan_proyek l
     LEFT JOIN kojasmat_proyek p ON p.id = l.proyek_id
     WHERE l.pengaju_id = $1
     ORDER BY l.created_at DESC
     LIMIT 50`,
    [anggotaId]
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
        payload.alasan, getInternalUserId(session),
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
