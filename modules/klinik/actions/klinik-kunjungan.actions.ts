'use server'

// Klinik Pratama — pendaftaran kunjungan walk-in & antrian harian per poli.
// Nomor antrian di-generate MAX+1 dengan retry saat bentrok unique constraint
// (branch_id, poli_id, tanggal, no_antrian) — pola sama seperti penomoran
// jurnal di modules/accounting/actions/journal.actions.ts. Loket pendaftaran
// bisa jalan bersamaan, jadi SELECT COUNT(*)+1 tanpa retry rawan tabrakan.

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'

const NO_ANTRIAN_MAX_RETRIES = 5

function isNoAntrianCollision(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  const message = String(err.message || '').toLowerCase()
  return err.code === '23505' && message.includes('klinik_kunjungan_branch_id_poli_id_tanggal_no_antrian_key')
}

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

export async function createKunjunganWalkIn(input: {
  orgId: string
  branchId: string
  pasienId: string
  poliId: string
  jenisKunjungan?: 'umum' | 'bpjs' | 'asuransi'
  keluhan?: string | null
}): Promise<{ data: { id: string; no_antrian: number } } | { error: string }> {
  const today = todayDateString()

  for (let attempt = 0; attempt < NO_ANTRIAN_MAX_RETRIES; attempt += 1) {
    const noAntrian = await getNextNoAntrian(input.branchId, input.poliId, today)
    try {
      const { rows } = await queryPostgres<{ id: string; no_antrian: number }>(
        `INSERT INTO public.klinik_kunjungan
           (org_id, branch_id, pasien_id, poli_id, tanggal, no_antrian, jenis_kunjungan, sumber, keluhan)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, 'WALK_IN', $8)
         RETURNING id::text, no_antrian`,
        [
          input.orgId,
          input.branchId,
          input.pasienId,
          input.poliId,
          today,
          noAntrian,
          input.jenisKunjungan || 'umum',
          input.keluhan || null,
        ],
      )
      revalidatePath('/klinik')
      return { data: rows[0] }
    } catch (error) {
      if (!isNoAntrianCollision(error)) {
        return { error: error instanceof Error ? error.message : 'Gagal mendaftarkan kunjungan.' }
      }
      // no_antrian bentrok (loket lain input bersamaan) — coba lagi dengan nomor berikutnya.
    }
  }
  return { error: 'Gagal mengambil nomor antrian setelah beberapa percobaan. Coba lagi.' }
}

export type KlinikAntrianRow = {
  id: string
  no_antrian: number
  status: 'MENUNGGU' | 'DIPERIKSA' | 'SELESAI' | 'BATAL'
  jenis_kunjungan: string
  keluhan: string | null
  created_at: string
  pasien_id: string
  pasien_nama: string
  pasien_no_rm: string
  // Status tagihan (klinik_tagihan) — null berarti belum ada tagihan dibuat
  // sama sekali. Dipakai kanban Antrian Hari Ini untuk memecah kunjungan
  // SELESAI jadi kolom "Kasir" (belum lunas) vs "Selesai" (lunas), tanpa
  // menambah nilai baru ke CHECK constraint klinik_kunjungan.status.
  tagihan_status: 'BELUM_BAYAR' | 'LUNAS' | 'VOID' | null
}

export async function getAntrianHariIni(branchId: string, poliId: string): Promise<KlinikAntrianRow[]> {
  const today = todayDateString()
  const { rows } = await queryPostgres<KlinikAntrianRow>(
    `SELECT k.id::text, k.no_antrian, k.status, k.jenis_kunjungan, k.keluhan, k.created_at::text,
            p.id::text AS pasien_id, p.nama AS pasien_nama, p.no_rm AS pasien_no_rm,
            t.status AS tagihan_status
     FROM public.klinik_kunjungan k
     JOIN public.klinik_pasien p ON p.id = k.pasien_id
     LEFT JOIN public.klinik_tagihan t ON t.kunjungan_id = k.id
     WHERE k.branch_id = $1 AND k.poli_id = $2 AND k.tanggal = $3::date
     ORDER BY k.no_antrian ASC`,
    [branchId, poliId, today],
  )
  return rows
}

export type KlinikAntrianDisplayPoli = {
  poli_id: string
  poli_nama: string
  sedang_dipanggil: number | null
  menunggu: number[]
  dokter_praktik: string | null
}

/**
 * Data untuk layar antrian publik (TV/monitor ruang tunggu) — sengaja HANYA
 * nomor antrian, tanpa nama pasien (halaman ini tanpa login, jangan bocorkan
 * data pribadi ke layar publik). Nama dokter yang ditampilkan diambil dari
 * klinik_jadwal_praktik yang aktif SEKARANG (weekday + jam berjalan), bukan
 * dari kunjungan.staf_medis_id (kosong untuk walk-in) atau rekam_medis
 * (baru terisi setelah dokter mulai periksa) — supaya selalu ada nama dokter
 * begitu poli buka, bukan cuma pas ada pasien lagi diperiksa. Jadwal yang
 * lagi diblokir klinik_jadwal_pengecualian (cuti/rapat) ikut dikecualikan,
 * pola sama seperti getAvailableSlots().
 */
export async function getAntrianDisplayBoard(branchId: string): Promise<KlinikAntrianDisplayPoli[]> {
  const today = todayDateString()
  const now = new Date()
  const weekday = now.getDay()
  const nowTime = now.toTimeString().slice(0, 8)

  const { rows } = await queryPostgres<KlinikAntrianDisplayPoli>(
    `SELECT
        p.id::text AS poli_id,
        p.nama AS poli_nama,
        (
          SELECT k.no_antrian FROM public.klinik_kunjungan k
          WHERE k.branch_id = $1 AND k.poli_id = p.id AND k.tanggal = $2::date AND k.status = 'DIPERIKSA'
          ORDER BY k.updated_at DESC LIMIT 1
        ) AS sedang_dipanggil,
        COALESCE((
          SELECT array_agg(k.no_antrian ORDER BY k.no_antrian ASC) FROM public.klinik_kunjungan k
          WHERE k.branch_id = $1 AND k.poli_id = p.id AND k.tanggal = $2::date AND k.status = 'MENUNGGU'
        ), ARRAY[]::int[]) AS menunggu,
        (
          SELECT TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))
          FROM public.klinik_jadwal_praktik jp
          JOIN public.klinik_staf_medis sm ON sm.id = jp.staf_medis_id
          JOIN public.employees e ON e.id = sm.employee_id
          WHERE jp.branch_id = $1 AND jp.poli_id = p.id AND jp.weekday = $3 AND jp.is_active = TRUE
            AND jp.valid_from <= $2::date AND (jp.valid_until IS NULL OR jp.valid_until >= $2::date)
            AND jp.start_local <= $4::time AND jp.end_local > $4::time
            AND NOT EXISTS (
              SELECT 1 FROM public.klinik_jadwal_pengecualian pe
              WHERE pe.staf_medis_id = jp.staf_medis_id AND pe.status = 'BLOCKED'
                AND pe.starts_at <= NOW() AND pe.ends_at > NOW()
            )
          ORDER BY jp.start_local ASC LIMIT 1
        ) AS dokter_praktik
     FROM public.klinik_poli p
     WHERE p.branch_id = $1 AND p.is_active = TRUE
     ORDER BY p.nama ASC`,
    [branchId, today, weekday, nowTime],
  )
  return rows
}

export async function updateStatusKunjungan(
  kunjunganId: string,
  status: 'MENUNGGU' | 'DIPERIKSA' | 'SELESAI' | 'BATAL',
): Promise<{ success: true } | { error: string }> {
  try {
    await queryPostgres(
      `UPDATE public.klinik_kunjungan SET status = $2, updated_at = NOW() WHERE id = $1`,
      [kunjunganId, status],
    )
    revalidatePath('/klinik')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui status kunjungan.' }
  }
}
