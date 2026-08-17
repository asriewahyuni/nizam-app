'use server'

// Klinik Pratama — pencarian & pendaftaran pasien baru.
// Nomor rekam medis (no_rm) di-generate MAX+1 dengan retry saat bentrok
// unique constraint — pola sama seperti penomoran jurnal di
// modules/accounting/actions/journal.actions.ts (SELECT COUNT(*)+1 pernah
// menyebabkan tabrakan nomor di kondisi concurrent, lihat
// supabase/migrations/1366_fix_journal_entry_number_collision.sql).

import { queryPostgres } from '@/lib/db/postgres'
import { getBranchAccessScope } from '@/modules/organization/lib/branch-access.server'

const NO_RM_MAX_RETRIES = 5

function isNoRmCollision(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  const message = String(err.message || '').toLowerCase()
  return err.code === '23505' && message.includes('klinik_pasien_org_id_no_rm_key')
}

async function getNextNoRm(orgId: string): Promise<string> {
  const { rows } = await queryPostgres<{ no_rm: string }>(
    `SELECT no_rm FROM public.klinik_pasien
     WHERE org_id = $1 AND no_rm ~ '^RM-[0-9]+$'
     ORDER BY no_rm DESC LIMIT 1`,
    [orgId],
  )
  const last = rows[0]?.no_rm
  const lastNum = last ? Number.parseInt(last.slice(3), 10) : 0
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1
  return `RM-${String(nextNum).padStart(6, '0')}`
}

export type KlinikPasienSearchResult = {
  id: string
  no_rm: string
  nama: string
  nik: string | null
  no_hp: string | null
  tgl_lahir: string | null
}

export async function searchKlinikPasien(orgId: string, query: string): Promise<KlinikPasienSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  // Owner/admin melihat semua pasien org. Staf lain di-scope ke pasien yang
  // terdaftar di cabang yang bisa mereka akses ATAU pernah punya kunjungan di
  // cabang tsb — supaya pasien lama yang pindah/baru pertama kali ke cabang
  // lain tetap ketemu (menghindari duplikat rekam medis), tanpa membuka
  // seluruh roster pasien organisasi ke staf satu cabang (lihat §4 rencana
  // modul: kontrol akses diturunkan dari kunjungan, bukan browsing bebas).
  const scope = await getBranchAccessScope(orgId)
  const branchFilter = scope.canAccessAllBranches
    ? ''
    : `AND (
        registered_branch_id = ANY($4::uuid[])
        OR EXISTS (
          SELECT 1 FROM public.klinik_kunjungan k
          WHERE k.pasien_id = klinik_pasien.id AND k.branch_id = ANY($4::uuid[])
        )
      )`

  const params: unknown[] = [orgId, `%${trimmed}%`, trimmed]
  if (!scope.canAccessAllBranches) params.push(scope.accessibleBranchIds)

  const { rows } = await queryPostgres<KlinikPasienSearchResult>(
    `SELECT id::text, no_rm, nama, nik, no_hp, tgl_lahir::text
     FROM public.klinik_pasien
     WHERE org_id = $1 AND is_active = TRUE
       AND (nama ILIKE $2 OR no_rm ILIKE $2 OR nik = $3 OR no_hp = $3)
       ${branchFilter}
     ORDER BY nama ASC
     LIMIT 20`,
    params,
  )
  return rows
}

export async function createKlinikPasien(
  orgId: string,
  payload: {
    nama: string
    nik?: string | null
    tglLahir?: string | null
    jenisKelamin?: 'L' | 'P' | null
    alamat?: string | null
    noHp?: string | null
    noBpjs?: string | null
    registeredBranchId?: string | null
  },
): Promise<{ data: { id: string; no_rm: string } } | { error: string }> {
  const nama = payload.nama.trim()
  if (!nama) return { error: 'Nama pasien wajib diisi.' }

  for (let attempt = 0; attempt < NO_RM_MAX_RETRIES; attempt += 1) {
    const noRm = await getNextNoRm(orgId)
    try {
      const { rows } = await queryPostgres<{ id: string; no_rm: string }>(
        `INSERT INTO public.klinik_pasien
           (org_id, no_rm, nik, nama, tgl_lahir, jenis_kelamin, alamat, no_hp, no_bpjs, registered_branch_id)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10::uuid)
         RETURNING id::text, no_rm`,
        [
          orgId,
          noRm,
          payload.nik || null,
          nama,
          payload.tglLahir || null,
          payload.jenisKelamin || null,
          payload.alamat || null,
          payload.noHp || null,
          payload.noBpjs || null,
          payload.registeredBranchId || null,
        ],
      )
      return { data: rows[0] }
    } catch (error) {
      if (!isNoRmCollision(error)) {
        return { error: error instanceof Error ? error.message : 'Gagal mendaftarkan pasien baru.' }
      }
      // no_rm bentrok (concurrent registration) — coba lagi dengan nomor berikutnya.
    }
  }
  return { error: 'Gagal membuat nomor rekam medis setelah beberapa percobaan. Coba lagi.' }
}
