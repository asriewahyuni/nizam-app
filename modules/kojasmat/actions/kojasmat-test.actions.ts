'use server'

// Kojasmat — bank soal test masuk, alur test, dan pembayaran pendaftaran anggota baru

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'

const DEFAULT_PASSING_THRESHOLD = 70
const SOAL_PER_TEST = 20

export type KojasmatBankSoal = {
  id: string
  org_id: string
  pertanyaan: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  jawaban_benar: 'A' | 'B' | 'C' | 'D'
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ApresiasiTier = { min_score: number; label: string }

const DEFAULT_APRESIASI_TIERS: ApresiasiTier[] = [
  { min_score: 90, label: 'Mumtaz' },
  { min_score: 80, label: 'Jayyid Jiddan' },
  { min_score: 70, label: 'Jayyid' },
  { min_score: 60, label: 'Maqbul' },
]

export type KojasmatModuleSettings = {
  passing_threshold: number
  biaya_admin_pendaftaran: number
  nominal_simpanan_pokok: number
  nominal_simpanan_wajib: number
  bank_account_id: string | null
  apresiasi_tiers: ApresiasiTier[]
  qris_image_key: string | null
  qris_image_name: string | null
  ijarah_platform_fee: number
  ijarah_platform_periode_hari: number
  ijarah_sukarela_opsional_minimal: number
}

function resolveApresiasi(skor: number, tiers: ApresiasiTier[]): string | null {
  const sorted = [...tiers].sort((a, b) => b.min_score - a.min_score)
  const match = sorted.find(t => skor >= t.min_score)
  return match?.label ?? null
}

// ─── BANK SOAL (staf) ─────────────────────────────────────────────────────────

export async function getBankSoal(orgId: string): Promise<KojasmatBankSoal[]> {
  const session = await getInternalAuthSession()
  if (!session) return []
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_bank_soal WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  )
  return rows as KojasmatBankSoal[]
}

export async function simpanBankSoal(payload: {
  id?: string
  org_id: string
  pertanyaan: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  jawaban_benar: 'A' | 'B' | 'C' | 'D'
  is_active?: boolean
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  try {
    if (payload.id) {
      await queryPostgres(
        `UPDATE kojasmat_bank_soal
         SET pertanyaan=$2, pilihan_a=$3, pilihan_b=$4, pilihan_c=$5, pilihan_d=$6,
             jawaban_benar=$7, is_active=$8, updated_at=NOW()
         WHERE id=$1 AND org_id=$9`,
        [
          payload.id, payload.pertanyaan, payload.pilihan_a, payload.pilihan_b,
          payload.pilihan_c, payload.pilihan_d, payload.jawaban_benar,
          payload.is_active ?? true, payload.org_id,
        ]
      )
    } else {
      await queryPostgres(
        `INSERT INTO kojasmat_bank_soal
           (org_id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          payload.org_id, payload.pertanyaan, payload.pilihan_a, payload.pilihan_b,
          payload.pilihan_c, payload.pilihan_d, payload.jawaban_benar,
          payload.is_active ?? true,
        ]
      )
    }
    revalidatePath('/kojasmat')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan soal' }
  }
}

export async function hapusBankSoal(id: string, orgId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: usedIn } = await queryPostgres(
    `SELECT id FROM kojasmat_test_masuk WHERE $1 = ANY(soal_ids) LIMIT 1`,
    [id]
  )
  if (usedIn.length > 0) {
    // Sudah pernah dipakai di attempt test — nonaktifkan saja supaya riwayat tidak rusak
    await queryPostgres(
      `UPDATE kojasmat_bank_soal SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    )
    revalidatePath('/kojasmat')
    return { success: true, deactivated: true }
  }

  await queryPostgres(`DELETE FROM kojasmat_bank_soal WHERE id=$1 AND org_id=$2`, [id, orgId])
  revalidatePath('/kojasmat')
  return { success: true, deactivated: false }
}

// ─── PENGATURAN MODUL (staf) ──────────────────────────────────────────────────

export async function getModuleSettings(orgId: string): Promise<KojasmatModuleSettings> {
  const { rows } = await queryPostgres(
    `SELECT settings FROM org_module_instances WHERE org_id=$1 AND module_key='Kojasmat' LIMIT 1`,
    [orgId]
  )
  const settings = (rows[0]?.settings ?? {}) as Record<string, unknown>
  return {
    passing_threshold: Number(settings.passing_threshold ?? DEFAULT_PASSING_THRESHOLD),
    biaya_admin_pendaftaran: Number(settings.biaya_admin_pendaftaran ?? 0),
    nominal_simpanan_pokok: Number(settings.nominal_simpanan_pokok ?? 0),
    nominal_simpanan_wajib: Number(settings.nominal_simpanan_wajib ?? 0),
    bank_account_id: (settings.bank_account_id as string) ?? null,
    apresiasi_tiers: Array.isArray(settings.apresiasi_tiers) && settings.apresiasi_tiers.length > 0
      ? settings.apresiasi_tiers as ApresiasiTier[]
      : DEFAULT_APRESIASI_TIERS,
    qris_image_key: (settings.qris_image_key as string) ?? null,
    qris_image_name: (settings.qris_image_name as string) ?? null,
    ijarah_platform_fee: Number(settings.ijarah_platform_fee ?? 25000),
    ijarah_platform_periode_hari: Number(settings.ijarah_platform_periode_hari ?? 30),
    ijarah_sukarela_opsional_minimal: Number(settings.ijarah_sukarela_opsional_minimal ?? 20000),
  }
}

export async function updateModuleSettings(orgId: string, partial: Partial<KojasmatModuleSettings>) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  try {
    await queryPostgres(
      `UPDATE org_module_instances
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
       WHERE org_id = $1 AND module_key = 'Kojasmat'`,
      [orgId, JSON.stringify(partial)]
    )
    revalidatePath('/kojasmat')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan' }
  }
}

// ─── TEST MASUK (publik — bagian wizard pendaftaran) ──────────────────────────

// Tidak butuh auth — bagian dari wizard publik pendaftaran
export async function mulaiTestMasuk(orgId: string, pendaftaranId: string) {
  try {
    const { rows: [pend] } = await queryPostgres(
      `SELECT id, status FROM kojasmat_pendaftaran WHERE id=$1 AND org_id=$2`,
      [pendaftaranId, orgId]
    )
    if (!pend) return { error: 'Pendaftaran tidak ditemukan' }
    if (pend.status !== 'MENUNGGU' && pend.status !== 'DIREVISI') {
      return { error: 'Pendaftaran sudah diproses, test tidak dapat dimulai lagi' }
    }

    const { rows: countRows } = await queryPostgres(
      `SELECT COUNT(*)::int AS n FROM kojasmat_bank_soal WHERE org_id=$1 AND is_active=TRUE`,
      [orgId]
    )
    if ((countRows[0]?.n ?? 0) < SOAL_PER_TEST) {
      return { error: `Bank soal belum siap (minimal ${SOAL_PER_TEST} soal aktif dibutuhkan)` }
    }

    const settings = await getModuleSettings(orgId)

    const { rows: soalRows } = await queryPostgres(
      `SELECT id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d
       FROM kojasmat_bank_soal
       WHERE org_id=$1 AND is_active=TRUE
       ORDER BY RANDOM() LIMIT $2`,
      [orgId, SOAL_PER_TEST]
    )
    const soalIds = soalRows.map((r: any) => r.id)

    const { rows: attemptRows } = await queryPostgres(
      `SELECT COALESCE(MAX(attempt_number), 0)::int AS n FROM kojasmat_test_masuk WHERE pendaftaran_id=$1`,
      [pendaftaranId]
    )
    const attemptNumber = (attemptRows[0]?.n ?? 0) + 1

    const { rows: [testMasuk] } = await queryPostgres(
      `INSERT INTO kojasmat_test_masuk (org_id, pendaftaran_id, soal_ids, passing_threshold, attempt_number)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, attempt_number`,
      [orgId, pendaftaranId, soalIds, settings.passing_threshold, attemptNumber]
    )

    return {
      data: {
        test_masuk_id: testMasuk.id as string,
        attempt_number: testMasuk.attempt_number as number,
        soal: soalRows as { id: string; pertanyaan: string; pilihan_a: string; pilihan_b: string; pilihan_c: string; pilihan_d: string }[],
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal memulai test' }
  }
}

// Tidak butuh auth — bagian dari wizard publik pendaftaran
export async function submitTestMasuk(testMasukId: string, jawaban: Record<string, string>) {
  try {
    const { rows: [testMasuk] } = await queryPostgres(
      `SELECT * FROM kojasmat_test_masuk WHERE id=$1`,
      [testMasukId]
    )
    if (!testMasuk) return { error: 'Sesi test tidak ditemukan' }
    if (testMasuk.status !== 'BERLANGSUNG') {
      return { error: 'Test ini sudah pernah disubmit' }
    }

    const soalIds: string[] = testMasuk.soal_ids
    const { rows: soalRows } = await queryPostgres(
      `SELECT id, jawaban_benar FROM kojasmat_bank_soal WHERE id = ANY($1::uuid[])`,
      [soalIds]
    )
    const jawabanBenarMap = new Map(soalRows.map((r: any) => [r.id, r.jawaban_benar]))

    let jumlahBenar = 0
    for (const soalId of soalIds) {
      if (jawaban[soalId] && jawaban[soalId] === jawabanBenarMap.get(soalId)) jumlahBenar++
    }
    const skor = Math.round((jumlahBenar / soalIds.length) * 100 * 100) / 100
    const status: 'LULUS' | 'GAGAL' = skor >= testMasuk.passing_threshold ? 'LULUS' : 'GAGAL'

    await queryPostgres(
      `UPDATE kojasmat_test_masuk
       SET jawaban=$2, jumlah_benar=$3, skor=$4, status=$5, submitted_at=NOW()
       WHERE id=$1`,
      [testMasukId, JSON.stringify(jawaban), jumlahBenar, skor, status]
    )

    const settings = await getModuleSettings(testMasuk.org_id)
    const apresiasi = resolveApresiasi(skor, settings.apresiasi_tiers)

    return {
      data: {
        skor,
        jumlah_benar: jumlahBenar,
        total_soal: soalIds.length,
        status,
        passing_threshold: testMasuk.passing_threshold as number,
        apresiasi,
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal submit test' }
  }
}

// ─── PEMBAYARAN PENDAFTARAN (publik — bagian wizard pendaftaran) ─────────────

// Tidak butuh auth — bagian dari wizard publik pendaftaran
type BankAccountInfo = { bank_name: string; account_number: string; account_holder: string }

export async function getInfoPembayaran(orgId: string) {
  const settings = await getModuleSettings(orgId)
  let bankAccount: BankAccountInfo | null = null
  if (settings.bank_account_id) {
    const { rows } = await queryPostgres(
      `SELECT bank_name, account_number, account_holder FROM bank_accounts WHERE id=$1 AND org_id=$2`,
      [settings.bank_account_id, orgId]
    )
    bankAccount = (rows[0] as BankAccountInfo | undefined) ?? null
  }
  let qrisImageUrl: string | null = null
  if (settings.qris_image_key) {
    const { createSignedStorageGetUrl } = await import('@/lib/storage/object-storage.server')
    qrisImageUrl = await createSignedStorageGetUrl(settings.qris_image_key).catch(() => null)
  }
  return {
    data: {
      biaya_admin_pendaftaran: settings.biaya_admin_pendaftaran,
      nominal_simpanan_pokok: settings.nominal_simpanan_pokok,
      nominal_simpanan_wajib: settings.nominal_simpanan_wajib,
      ijarah_platform_fee: settings.ijarah_platform_fee,
      ijarah_platform_periode_hari: settings.ijarah_platform_periode_hari,
      ijarah_sukarela_opsional_minimal: settings.ijarah_sukarela_opsional_minimal,
      bank_account: bankAccount,
      qris_image_url: qrisImageUrl,
    }
  }
}

// Tidak butuh auth — bagian dari wizard publik pendaftaran
export async function submitPembayaranPendaftaran(pendaftaranId: string, payload: {
  org_id: string
  biaya_admin: number
  simpanan_pokok: number
  simpanan_wajib: number
  ijarah_fee: number
  sukarela_topup: number
  file_key: string
  nama_file: string
  file_size?: number
  mime_type?: string
}) {
  try {
    const { rows: [pend] } = await queryPostgres(
      `SELECT * FROM kojasmat_pendaftaran WHERE id=$1 AND org_id=$2`,
      [pendaftaranId, payload.org_id]
    )
    if (!pend) return { error: 'Pendaftaran tidak ditemukan' }
    if (pend.status !== 'MENUNGGU' && pend.status !== 'DIREVISI') {
      return { error: 'Pendaftaran sudah diproses' }
    }

    const { rows: [latestTest] } = await queryPostgres(
      `SELECT status FROM kojasmat_test_masuk
       WHERE pendaftaran_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [pendaftaranId]
    )
    if (!latestTest || latestTest.status !== 'LULUS') {
      return { error: 'Test masuk belum lulus, tidak dapat melanjutkan pembayaran' }
    }

    const settings = await getModuleSettings(payload.org_id)
    if (payload.sukarela_topup > 0 && payload.sukarela_topup < settings.ijarah_sukarela_opsional_minimal) {
      return { error: `Tabungan sukarela tambahan minimal Rp ${settings.ijarah_sukarela_opsional_minimal.toLocaleString('id-ID')}` }
    }

    const { rows: [dokumen] } = await queryPostgres(
      `INSERT INTO kojasmat_dokumen
         (org_id, referensi_type, referensi_id, jenis_dokumen, nama_file, file_key, file_size, mime_type)
       VALUES ($1,'PENDAFTARAN',$2,'BUKTI_BAYAR',$3,$4,$5,$6)
       RETURNING id`,
      [payload.org_id, pendaftaranId, payload.nama_file, payload.file_key, payload.file_size ?? null, payload.mime_type ?? null]
    )

    await queryPostgres(
      `UPDATE kojasmat_pendaftaran
       SET biaya_admin_dibayar=$2, simpanan_pokok_dibayar=$3, simpanan_wajib_dibayar=$4,
           ijarah_fee_dibayar=$5, simpanan_sukarela_dibayar=$6, bukti_bayar_dokumen_id=$7,
           status_bayar='SUDAH', dibayar_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [pendaftaranId, payload.biaya_admin, payload.simpanan_pokok, payload.simpanan_wajib,
        payload.ijarah_fee, payload.sukarela_topup, dokumen.id]
    )

    // Status pendaftaran TETAP MENUNGGU — aktivasi anggota (termasuk posting
    // setoran pokok/wajib ke jurnal) baru terjadi saat pengurus memverifikasi
    // bukti transfer secara manual lewat setujuiPendaftaran(). Lihat kojasmat-membership.actions.ts.
    return { data: { activated: false } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan pembayaran' }
  }
}

// ─── RIWAYAT TEST (staf) ──────────────────────────────────────────────────────

export type KojasmatTestMasukRingkas = {
  id: string
  attempt_number: number
  skor: number | null
  jumlah_benar: number | null
  passing_threshold: number
  status: 'BERLANGSUNG' | 'LULUS' | 'GAGAL'
  apresiasi: string | null
  submitted_at: string | null
  created_at: string
}

export async function getTestMasukByPendaftaran(orgId: string, pendaftaranId: string): Promise<KojasmatTestMasukRingkas[]> {
  const session = await getInternalAuthSession()
  if (!session) return []

  const settings = await getModuleSettings(orgId)
  const { rows } = await queryPostgres(
    `SELECT id, attempt_number, skor, jumlah_benar, passing_threshold, status, submitted_at, created_at
     FROM kojasmat_test_masuk
     WHERE org_id=$1 AND pendaftaran_id=$2
     ORDER BY attempt_number ASC`,
    [orgId, pendaftaranId]
  )
  return rows.map((r: any) => ({
    ...r,
    apresiasi: r.skor != null ? resolveApresiasi(Number(r.skor), settings.apresiasi_tiers) : null,
  })) as KojasmatTestMasukRingkas[]
}
