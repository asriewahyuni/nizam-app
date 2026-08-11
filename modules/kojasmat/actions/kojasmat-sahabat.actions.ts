'use server'

// Kojasmat — test kedua untuk upgrade anggota tingkat TEMAN ke SAHABAT.
// TEMAN hanya bisa menabung/tarik simpanan + lihat konten dasar; untuk
// eksekusi proyek, transfer, dan fitur lain wajib naik ke SAHABAT lewat test
// ini. Lulus test TIDAK langsung menaikkan tingkat — staf wajib menyetujui
// dulu (persis pola review manual di alur pendaftaran).

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveInternalUserId } from '@/lib/auth/internal-auth.shared'
import { revalidatePath } from 'next/cache'
import { isOrgAdminOrManajemen } from './kojasmat.actions'
import { getModuleSettings } from './kojasmat-test.actions'
import { enqueueNotification } from '@/modules/notifications/outbox.server'

const SOAL_PER_TEST = 40
const PASSING_THRESHOLD = 85

// previewAnggotaId: dipakai saat staf/owner/manajer sedang preview portal anggota
// (pola yang sama dengan app/anggota/[kode]/page.tsx) supaya mereka bisa mencoba
// alur test kedua atas nama anggota yang di-preview — bukan celah untuk anggota
// biasa mengklaim identitas anggota lain, karena tetap divalidasi lewat
// isOrgAdminOrManajemen(session.user.id, ...) di bawah.
type OwnAnggota = { id: string; org_id: string; tingkat: string; nama: string; phone: string | null }

async function getOwnAnggota(previewAnggotaId?: string): Promise<OwnAnggota | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' }
  const userId = resolveInternalUserId(session)
  const { rows: [anggota] } = await queryPostgres(
    `SELECT id, org_id, tingkat, nama, phone FROM kojasmat_anggota WHERE user_id=$1::uuid LIMIT 1`,
    [userId]
  )
  if (anggota) return anggota as OwnAnggota

  if (previewAnggotaId) {
    const { rows: [preview] } = await queryPostgres(
      `SELECT id, org_id, tingkat, nama, phone FROM kojasmat_anggota WHERE id=$1 LIMIT 1`,
      [previewAnggotaId]
    )
    if (preview && await isOrgAdminOrManajemen(session.user.id, preview.org_id)) {
      return preview as OwnAnggota
    }
  }

  return { error: 'Akun Anda bukan anggota koperasi.' }
}

export type KojasmatTestSahabat = {
  id: string
  org_id: string
  anggota_id: string
  soal_ids: string[]
  jawaban: Record<string, string> | null
  jumlah_benar: number | null
  skor: number | null
  passing_threshold: number
  status: 'BERLANGSUNG' | 'LULUS' | 'GAGAL'
  attempt_number: number
  submitted_at: string | null
  status_approval: 'BELUM' | 'DISETUJUI' | 'DITOLAK'
  disetujui_oleh: string | null
  disetujui_at: string | null
  catatan_admin: string | null
  created_at: string
}

// Status upgrade anggota sendiri — dipakai member portal untuk menampilkan
// banner "menunggu persetujuan" / "ditolak" / tombol mulai test.
export async function getTestSahabatByAnggota(anggotaId: string): Promise<KojasmatTestSahabat | null> {
  const { rows: [test] } = await queryPostgres(
    `SELECT * FROM kojasmat_test_sahabat WHERE anggota_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [anggotaId]
  )
  return (test as KojasmatTestSahabat | undefined) ?? null
}

export async function mulaiTestSahabat(previewAnggotaId?: string): Promise<
  { data: { test_id: string; attempt_number: number; soal: { id: string; pertanyaan: string; pilihan_a: string; pilihan_b: string; pilihan_c: string; pilihan_d: string }[] } }
  | { error: string }
> {
  const anggota = await getOwnAnggota(previewAnggotaId)
  if ('error' in anggota) return anggota
  if (anggota.tingkat === 'SAHABAT') return { error: 'Anda sudah tingkat Sahabat.' }

  const { rows: [existing] } = await queryPostgres(
    `SELECT id, status, status_approval FROM kojasmat_test_sahabat
     WHERE anggota_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [anggota.id]
  )
  if (existing?.status === 'BERLANGSUNG') {
    const { rows: soalRows } = await queryPostgres(
      `SELECT s.id, s.pertanyaan, s.pilihan_a, s.pilihan_b, s.pilihan_c, s.pilihan_d
       FROM kojasmat_test_sahabat t, unnest(t.soal_ids) WITH ORDINALITY AS o(soal_id, ord)
       JOIN kojasmat_bank_soal s ON s.id = o.soal_id
       WHERE t.id=$1 ORDER BY o.ord`,
      [existing.id]
    )
    return { data: { test_id: existing.id, attempt_number: existing.attempt_number, soal: soalRows as any } }
  }
  if (existing?.status === 'LULUS' && existing.status_approval === 'BELUM') {
    return { error: 'Anda sudah lulus test kedua dan sedang menunggu persetujuan pengurus.' }
  }

  const { rows: countRows } = await queryPostgres(
    `SELECT COUNT(*)::int AS n FROM kojasmat_bank_soal WHERE org_id=$1 AND is_active=TRUE AND jenis='SAHABAT'`,
    [anggota.org_id]
  )
  if ((countRows[0]?.n ?? 0) < SOAL_PER_TEST) {
    return { error: `Bank soal test kedua belum siap (minimal ${SOAL_PER_TEST} soal aktif dibutuhkan). Hubungi pengurus.` }
  }

  const { rows: soalRows } = await queryPostgres(
    `SELECT id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d
     FROM kojasmat_bank_soal
     WHERE org_id=$1 AND is_active=TRUE AND jenis='SAHABAT'
     ORDER BY RANDOM() LIMIT $2`,
    [anggota.org_id, SOAL_PER_TEST]
  )
  const soalIds = soalRows.map((r: any) => r.id)

  const attemptNumber = (existing?.status === 'GAGAL' || existing?.status_approval === 'DITOLAK')
    ? await queryPostgres(
        `SELECT COALESCE(MAX(attempt_number), 0)::int AS n FROM kojasmat_test_sahabat WHERE anggota_id=$1`,
        [anggota.id]
      ).then(r => (r.rows[0]?.n ?? 0) + 1)
    : 1

  const { rows: [test] } = await queryPostgres(
    `INSERT INTO kojasmat_test_sahabat (org_id, anggota_id, soal_ids, attempt_number, passing_threshold)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, attempt_number`,
    [anggota.org_id, anggota.id, soalIds, attemptNumber, PASSING_THRESHOLD]
  )

  return {
    data: {
      test_id: test.id,
      attempt_number: test.attempt_number,
      soal: soalRows as { id: string; pertanyaan: string; pilihan_a: string; pilihan_b: string; pilihan_c: string; pilihan_d: string }[],
    }
  }
}

export async function submitTestSahabat(testId: string, jawaban: Record<string, string>, previewAnggotaId?: string): Promise<
  { data: { skor: number; jumlah_benar: number; total_soal: number; status: 'LULUS' | 'GAGAL'; passing_threshold: number } }
  | { error: string }
> {
  const anggota = await getOwnAnggota(previewAnggotaId)
  if ('error' in anggota) return anggota

  const { rows: [test] } = await queryPostgres(
    `SELECT * FROM kojasmat_test_sahabat WHERE id=$1 AND anggota_id=$2`,
    [testId, anggota.id]
  )
  if (!test) return { error: 'Sesi test tidak ditemukan' }
  if (test.status !== 'BERLANGSUNG') return { error: 'Test ini sudah pernah disubmit' }

  const soalIds: string[] = test.soal_ids
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
  const status: 'LULUS' | 'GAGAL' = skor >= test.passing_threshold ? 'LULUS' : 'GAGAL'

  await queryPostgres(
    `UPDATE kojasmat_test_sahabat
     SET jawaban=$2, jumlah_benar=$3, skor=$4, status=$5, submitted_at=NOW()
     WHERE id=$1`,
    [testId, JSON.stringify(jawaban), jumlahBenar, skor, status]
  )

  if (status === 'LULUS' && anggota.phone) {
    const settings = await getModuleSettings(anggota.org_id)
    const tmpl = settings.pesan_otomatis.sahabat_menunggu_approval
    if (tmpl.enabled) {
      await enqueueNotification({
        orgId: anggota.org_id,
        userId: null,
        eventType: 'kojasmat_test_sahabat_lulus',
        channel: 'WHATSAPP',
        providerCode: 'DRIPSENDER',
        recipient: anggota.phone,
        body: tmpl.body,
        variables: {
          nama: anggota.nama,
          skor,
          jumlah_benar: jumlahBenar,
          total_soal: soalIds.length,
        },
        idempotencyKey: `kojasmat-test-sahabat:${testId}:lulus:whatsapp`,
      }).catch(() => null)
    }
  }

  revalidatePath('/kojasmat')
  return {
    data: {
      skor, jumlah_benar: jumlahBenar, total_soal: soalIds.length,
      status, passing_threshold: test.passing_threshold as number,
    }
  }
}

// ─── STAF: PERSETUJUAN UPGRADE SAHABAT ────────────────────────────────────────

export type KojasmatTestSahabatPending = KojasmatTestSahabat & {
  anggota_nama: string
  kode_anggota: string
}

export async function getTestSahabatPendingByOrg(orgId: string): Promise<KojasmatTestSahabatPending[]> {
  const { rows } = await queryPostgres(
    `SELECT t.*, a.nama AS anggota_nama, a.kode_anggota
     FROM kojasmat_test_sahabat t
     JOIN kojasmat_anggota a ON a.id = t.anggota_id
     WHERE t.org_id=$1 AND t.status='LULUS' AND t.status_approval='BELUM'
     ORDER BY t.submitted_at ASC`,
    [orgId]
  )
  return rows as KojasmatTestSahabatPending[]
}

export async function setujuiTestSahabat(testId: string): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [test] } = await queryPostgres(
    `SELECT t.org_id, t.anggota_id, t.status, a.nama, a.phone, a.kode_anggota
     FROM kojasmat_test_sahabat t
     JOIN kojasmat_anggota a ON a.id = t.anggota_id
     WHERE t.id=$1`,
    [testId]
  )
  if (!test) return { error: 'Test tidak ditemukan' }
  if (!(await isOrgAdminOrManajemen(session.user.id, test.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat menyetujui upgrade Sahabat.' }
  }
  if (test.status !== 'LULUS') return { error: 'Test ini belum lulus.' }

  const internalUserId = resolveInternalUserId(session)
  const { rows: [updated] } = await queryPostgres(
    `UPDATE kojasmat_test_sahabat
     SET status_approval='DISETUJUI', disetujui_oleh=$2, disetujui_at=NOW()
     WHERE id=$1 AND status_approval='BELUM'
     RETURNING id`,
    [testId, internalUserId]
  )
  if (!updated) return { error: 'Test ini sudah diproses.' }

  await queryPostgres(`UPDATE kojasmat_anggota SET tingkat='SAHABAT', updated_at=NOW() WHERE id=$1`, [test.anggota_id])

  if (test.phone) {
    const settings = await getModuleSettings(test.org_id)
    const tmpl = settings.pesan_otomatis.sahabat_disetujui
    if (tmpl.enabled) {
      await enqueueNotification({
        orgId: test.org_id,
        userId: null,
        eventType: 'kojasmat_sahabat_disetujui',
        channel: 'WHATSAPP',
        providerCode: 'DRIPSENDER',
        recipient: test.phone,
        body: tmpl.body,
        variables: { nama: test.nama, kode_anggota: test.kode_anggota },
        idempotencyKey: `kojasmat-test-sahabat:${testId}:disetujui:whatsapp`,
      }).catch(() => null)
    }
  }

  revalidatePath('/kojasmat')
  return { success: true }
}

export async function tolakTestSahabat(testId: string, catatan: string): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [test] } = await queryPostgres(
    `SELECT org_id FROM kojasmat_test_sahabat WHERE id=$1`,
    [testId]
  )
  if (!test) return { error: 'Test tidak ditemukan' }
  if (!(await isOrgAdminOrManajemen(session.user.id, test.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat menolak upgrade Sahabat.' }
  }

  const internalUserId = resolveInternalUserId(session)
  const { rows: [updated] } = await queryPostgres(
    `UPDATE kojasmat_test_sahabat
     SET status_approval='DITOLAK', catatan_admin=$2, disetujui_oleh=$3, disetujui_at=NOW()
     WHERE id=$1 AND status_approval='BELUM'
     RETURNING id`,
    [testId, catatan, internalUserId]
  )
  if (!updated) return { error: 'Test ini sudah diproses.' }

  revalidatePath('/kojasmat')
  return { success: true }
}
