'use server'

// Klinik Pratama — Rawat Inap: kamar, tempat tidur, admisi/discharge pasien.
// Admisi WAJIB ditautkan ke klinik_kunjungan (poli "Rawat Inap" seperti poli
// lain) supaya mesin Kasir/RME/jurnal yang sudah ada (createTagihan,
// postJurnal) otomatis berlaku saat discharge — bukan jalur billing paralel
// (HUKUM BESI ANTI-SILO, lihat AGENTS.md). Anti-double-booking tempat tidur
// ditegakkan di level database lewat EXCLUDE USING gist pada
// klinik_rawat_inap (supabase/migrations/1432_klinik_pratama_rawat_inap.sql),
// mirror pola klinik_slot_hold — cek FOR UPDATE di sini adalah lapisan kedua,
// bukan satu-satunya penjaga.

import { revalidatePath } from 'next/cache'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { isKlinikOrgAdmin } from './klinik.actions'
import { updateStatusKunjungan } from './klinik-kunjungan.actions'

const NO_ANTRIAN_MAX_RETRIES = 5

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getNextNoAntrian(branchId: string, poliId: string, tanggal: string): Promise<number> {
  const { rows } = await queryPostgres<{ max_no: number | null }>(
    `SELECT MAX(no_antrian) AS max_no FROM public.klinik_kunjungan
     WHERE branch_id = $1 AND poli_id = $2 AND tanggal = $3::date`,
    [branchId, poliId, tanggal],
  )
  return Number(rows[0]?.max_no ?? 0) + 1
}

export type KlinikTempatTidur = {
  id: string
  kode_bed: string
  status: 'TERSEDIA' | 'TERISI' | 'MAINTENANCE'
  pasien_id: string | null
  pasien_nama: string | null
  rawat_inap_id: string | null
  admitted_at: string | null
}

export type KlinikKamar = {
  id: string
  tipe_kamar: string
  nama: string
  ukuran_m2: number | null
  tarif_per_malam: number
  fasilitas: string[]
  is_active: boolean
  beds: KlinikTempatTidur[]
}

export async function getKlinikKamarByBranch(orgId: string, branchId: string): Promise<KlinikKamar[]> {
  const { rows: kamarRows } = await queryPostgres<Omit<KlinikKamar, 'beds'>>(
    `SELECT id::text, tipe_kamar, nama, ukuran_m2, tarif_per_malam, fasilitas, is_active
     FROM public.klinik_kamar
     WHERE org_id = $1 AND branch_id = $2
     ORDER BY nama ASC`,
    [orgId, branchId],
  )
  if (kamarRows.length === 0) return []

  const { rows: bedRows } = await queryPostgres<KlinikTempatTidur & { kamar_id: string }>(
    `SELECT t.id::text, t.kamar_id::text, t.kode_bed, t.status,
            ri.id::text AS rawat_inap_id, ri.admitted_at::text,
            p.id::text AS pasien_id, p.nama AS pasien_nama
     FROM public.klinik_tempat_tidur t
     LEFT JOIN public.klinik_rawat_inap ri ON ri.tempat_tidur_id = t.id AND ri.status = 'DIRAWAT'
     LEFT JOIN public.klinik_pasien p ON p.id = ri.pasien_id
     WHERE t.kamar_id = ANY($1::uuid[])
     ORDER BY t.kode_bed ASC`,
    [kamarRows.map((k) => k.id)],
  )

  return kamarRows.map((kamar) => ({
    ...kamar,
    beds: bedRows.filter((b) => b.kamar_id === kamar.id),
  }))
}

export async function createKlinikKamar(
  orgId: string,
  branchId: string,
  payload: {
    tipeKamar: string
    nama: string
    ukuranM2?: number | null
    tarifPerMalam: number
    fasilitas?: string[]
    jumlahBed: number
  },
): Promise<{ data: KlinikKamar } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat menambah kamar.' }
  }

  const nama = payload.nama.trim()
  const tipeKamar = payload.tipeKamar.trim()
  if (!nama) return { error: 'Nama kamar wajib diisi.' }
  if (!tipeKamar) return { error: 'Tipe kamar wajib diisi.' }
  if (payload.tarifPerMalam < 0) return { error: 'Tarif per malam tidak boleh negatif.' }
  const jumlahBed = Math.floor(payload.jumlahBed)
  if (jumlahBed < 1 || jumlahBed > 50) return { error: 'Jumlah bed wajib antara 1-50.' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO public.klinik_kamar (org_id, branch_id, tipe_kamar, nama, ukuran_m2, tarif_per_malam, fasilitas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [orgId, branchId, tipeKamar, nama, payload.ukuranM2 || null, payload.tarifPerMalam, payload.fasilitas || []],
    )
    const kamarId = rows[0].id

    for (let n = 1; n <= jumlahBed; n += 1) {
      await client.query(
        `INSERT INTO public.klinik_tempat_tidur (kamar_id, kode_bed) VALUES ($1, $2)`,
        [kamarId, `${nama}-${String(n).padStart(2, '0')}`],
      )
    }

    await client.query('COMMIT')
    revalidatePath('/klinik')

    const list = await getKlinikKamarByBranch(orgId, branchId)
    const created = list.find((k) => k.id === kamarId)
    if (!created) return { error: 'Kamar tersimpan tapi gagal dimuat ulang.' }
    return { data: created }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal membuat kamar baru.' }
  } finally {
    client.release()
  }
}

export async function setKlinikKamarActive(
  orgId: string,
  kamarId: string,
  isActive: boolean,
): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat mengubah status kamar.' }
  }

  await queryPostgres(
    `UPDATE public.klinik_kamar SET is_active = $3, updated_at = NOW() WHERE id = $2 AND org_id = $1`,
    [orgId, kamarId, isActive],
  )
  revalidatePath('/klinik')
  return { success: true }
}

export async function setTempatTidurMaintenance(
  orgId: string,
  tempatTidurId: string,
  isMaintenance: boolean,
): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat mengubah status tempat tidur.' }
  }

  const { rows } = await queryPostgres<{ status: string }>(
    `SELECT t.status FROM public.klinik_tempat_tidur t
     JOIN public.klinik_kamar k ON k.id = t.kamar_id
     WHERE t.id = $1 AND k.org_id = $2`,
    [tempatTidurId, orgId],
  )
  if (!rows[0]) return { error: 'Tempat tidur tidak ditemukan.' }
  if (rows[0].status === 'TERISI') return { error: 'Tempat tidur sedang terisi pasien.' }

  await queryPostgres(
    `UPDATE public.klinik_tempat_tidur SET status = $2, updated_at = NOW() WHERE id = $1`,
    [tempatTidurId, isMaintenance ? 'MAINTENANCE' : 'TERSEDIA'],
  )
  revalidatePath('/klinik')
  return { success: true }
}

export async function admitPasienRawatInap(input: {
  orgId: string
  branchId: string
  tempatTidurId: string
  pasienId: string
  poliRawatInapId: string
  jenisKunjungan?: 'umum' | 'bpjs' | 'asuransi'
  diagnosisMasuk?: string | null
  dokterPenanggungJawabId?: string | null
  catatan?: string | null
}): Promise<{ data: { id: string; kunjunganId: string } } | { error: string }> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows: bedRows } = await client.query<{ id: string; kamar_id: string; status: string }>(
      `SELECT id::text, kamar_id::text, status FROM public.klinik_tempat_tidur WHERE id = $1 FOR UPDATE`,
      [input.tempatTidurId],
    )
    const bed = bedRows[0]
    if (!bed) {
      await client.query('ROLLBACK')
      return { error: 'Tempat tidur tidak ditemukan.' }
    }
    if (bed.status !== 'TERSEDIA') {
      await client.query('ROLLBACK')
      return { error: 'Tempat tidur ini sedang tidak tersedia.' }
    }

    const { rows: kamarRows } = await client.query<{ tarif_per_malam: number }>(
      `SELECT tarif_per_malam FROM public.klinik_kamar WHERE id = $1`,
      [bed.kamar_id],
    )
    const tarifPerMalam = Number(kamarRows[0]?.tarif_per_malam || 0)

    // Bikin kunjungan (mesin sama seperti walk-in) supaya Kasir/RME existing otomatis berlaku.
    const today = todayDateString()
    let kunjunganId: string | null = null
    for (let attempt = 0; attempt < NO_ANTRIAN_MAX_RETRIES; attempt += 1) {
      const noAntrian = await getNextNoAntrian(input.branchId, input.poliRawatInapId, today)
      try {
        const { rows: kunjunganRows } = await client.query<{ id: string }>(
          `INSERT INTO public.klinik_kunjungan
             (org_id, branch_id, pasien_id, poli_id, tanggal, no_antrian, jenis_kunjungan, status, sumber, keluhan)
           VALUES ($1, $2, $3, $4, $5::date, $6, $7, 'DIPERIKSA', 'WALK_IN', $8)
           RETURNING id::text`,
          [
            input.orgId, input.branchId, input.pasienId, input.poliRawatInapId,
            today, noAntrian, input.jenisKunjungan || 'umum', input.diagnosisMasuk || null,
          ],
        )
        kunjunganId = kunjunganRows[0].id
        break
      } catch (error) {
        const err = error as { code?: string; message?: string }
        const collision = err.code === '23505' && String(err.message || '').toLowerCase().includes('no_antrian')
        if (!collision) throw error
      }
    }
    if (!kunjunganId) {
      await client.query('ROLLBACK')
      return { error: 'Gagal membuat kunjungan admisi setelah beberapa percobaan. Coba lagi.' }
    }

    const { rows: rawatInapRows } = await client.query<{ id: string }>(
      `INSERT INTO public.klinik_rawat_inap
         (org_id, branch_id, kamar_id, tempat_tidur_id, pasien_id, kunjungan_id,
          tarif_per_malam_snapshot, diagnosis_masuk, dokter_penanggung_jawab_id, catatan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id::text`,
      [
        input.orgId, input.branchId, bed.kamar_id, input.tempatTidurId, input.pasienId, kunjunganId,
        tarifPerMalam, input.diagnosisMasuk || null, input.dokterPenanggungJawabId || null, input.catatan || null,
      ],
    )

    await client.query(`UPDATE public.klinik_tempat_tidur SET status = 'TERISI', updated_at = NOW() WHERE id = $1`, [input.tempatTidurId])

    await client.query('COMMIT')
    revalidatePath('/klinik')
    return { data: { id: rawatInapRows[0].id, kunjunganId } }
  } catch (error) {
    await client.query('ROLLBACK')
    const err = error as { code?: string; message?: string }
    if (err.code === '23P01') {
      return { error: 'Tempat tidur baru saja diisi pasien lain. Pilih bed lain.' }
    }
    return { error: err.message || 'Gagal memproses admisi pasien.' }
  } finally {
    client.release()
  }
}

export async function dischargePasienRawatInap(
  orgId: string,
  rawatInapId: string,
): Promise<{ success: true } | { error: string }> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string; kunjungan_id: string; tempat_tidur_id: string; status: string }>(
      `SELECT id::text, kunjungan_id::text, tempat_tidur_id::text, status
       FROM public.klinik_rawat_inap WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [rawatInapId, orgId],
    )
    const rawatInap = rows[0]
    if (!rawatInap) {
      await client.query('ROLLBACK')
      return { error: 'Data rawat inap tidak ditemukan.' }
    }
    if (rawatInap.status !== 'DIRAWAT') {
      await client.query('ROLLBACK')
      return { error: 'Pasien ini sudah tidak berstatus dirawat.' }
    }

    await client.query(
      `UPDATE public.klinik_rawat_inap SET status = 'PULANG', discharged_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [rawatInapId],
    )
    await client.query(
      `UPDATE public.klinik_tempat_tidur SET status = 'TERSEDIA', updated_at = NOW() WHERE id = $1`,
      [rawatInap.tempat_tidur_id],
    )

    await client.query('COMMIT')

    // Di luar transaksi kamar/bed — updateStatusKunjungan sudah idempoten & punya revalidatePath sendiri.
    await updateStatusKunjungan(rawatInap.kunjungan_id, 'SELESAI')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal memproses pemulangan pasien.' }
  } finally {
    client.release()
  }
}

export async function cancelAdmisiRawatInap(
  orgId: string,
  rawatInapId: string,
): Promise<{ success: true } | { error: string }> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string; tempat_tidur_id: string; status: string }>(
      `SELECT id::text, tempat_tidur_id::text, status FROM public.klinik_rawat_inap WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [rawatInapId, orgId],
    )
    const rawatInap = rows[0]
    if (!rawatInap) {
      await client.query('ROLLBACK')
      return { error: 'Data rawat inap tidak ditemukan.' }
    }
    if (rawatInap.status !== 'DIRAWAT') {
      await client.query('ROLLBACK')
      return { error: 'Admisi ini sudah tidak aktif.' }
    }

    await client.query(`UPDATE public.klinik_rawat_inap SET status = 'DIBATALKAN', updated_at = NOW() WHERE id = $1`, [rawatInapId])
    await client.query(`UPDATE public.klinik_tempat_tidur SET status = 'TERSEDIA', updated_at = NOW() WHERE id = $1`, [rawatInap.tempat_tidur_id])

    await client.query('COMMIT')
    revalidatePath('/klinik')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal membatalkan admisi.' }
  } finally {
    client.release()
  }
}

export type KlinikRawatInapDetail = {
  id: string
  admitted_at: string
  discharged_at: string | null
  status: 'DIRAWAT' | 'PULANG' | 'DIBATALKAN'
  tarif_per_malam_snapshot: number
  kamar_nama: string
  tempat_tidur_kode: string
  malam: number
}

/** Dipakai PemeriksaanPanel untuk menampilkan baris "Kamar — N malam" di Kasir. */
export async function getRawatInapByKunjungan(kunjunganId: string): Promise<KlinikRawatInapDetail | null> {
  const { rows } = await queryPostgres<Omit<KlinikRawatInapDetail, 'malam'>>(
    `SELECT ri.id::text, ri.admitted_at::text, ri.discharged_at::text, ri.status,
            ri.tarif_per_malam_snapshot, k.nama AS kamar_nama, t.kode_bed AS tempat_tidur_kode
     FROM public.klinik_rawat_inap ri
     JOIN public.klinik_kamar k ON k.id = ri.kamar_id
     JOIN public.klinik_tempat_tidur t ON t.id = ri.tempat_tidur_id
     WHERE ri.kunjungan_id = $1`,
    [kunjunganId],
  )
  const row = rows[0]
  if (!row) return null

  const admitted = new Date(row.admitted_at).getTime()
  const discharged = row.discharged_at ? new Date(row.discharged_at).getTime() : Date.now()
  const malam = Math.max(1, Math.ceil((discharged - admitted) / 86_400_000))

  return { ...row, malam }
}
