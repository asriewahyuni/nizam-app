'use server'

// Klinik Pratama — rekam medis elektronik (RME) per kunjungan.
// Selama status DRAFT, field klinis boleh diedit (tiap perubahan dicatat ke
// klinik_rekam_medis_history). Setelah FINAL (pemeriksaan selesai), field
// klinis TERKUNCI — koreksi lanjutan wajib lewat addendum (baris history
// baru + teks tertaut waktu ditambahkan ke catatan), bukan overwrite. Ini
// bukan preferensi gaya, tapi kewajiban hukum rekam medis (wajib telusur).

import { revalidatePath } from 'next/cache'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getCurrentKlinikEmployeeId } from './klinik.actions'

export type KlinikRekamMedisPayload = {
  anamnesis?: string | null
  diagnosisIcd10?: string | null
  diagnosisText?: string | null
  terapi?: string | null
  catatan?: string | null
  stafMedisId?: string | null
}

export type KlinikRekamMedis = {
  id: string
  kunjungan_id: string
  staf_medis_id: string | null
  anamnesis: string | null
  diagnosis_icd10: string | null
  diagnosis_text: string | null
  terapi: string | null
  catatan: string | null
  status: 'DRAFT' | 'FINAL'
  finalized_at: string | null
}

export type KlinikRekamMedisHistoryRow = {
  id: string
  action: 'CREATED' | 'UPDATED' | 'FINALIZED' | 'ADDENDUM'
  created_at: string
}

function clinicalSnapshot(row: Partial<KlinikRekamMedis> | null) {
  if (!row) return null
  return {
    anamnesis: row.anamnesis ?? null,
    diagnosis_icd10: row.diagnosis_icd10 ?? null,
    diagnosis_text: row.diagnosis_text ?? null,
    terapi: row.terapi ?? null,
    catatan: row.catatan ?? null,
  }
}

export async function getRekamMedisByKunjungan(kunjunganId: string): Promise<{
  rekamMedis: KlinikRekamMedis | null
  history: KlinikRekamMedisHistoryRow[]
}> {
  const { rows } = await queryPostgres<KlinikRekamMedis>(
    `SELECT id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
            diagnosis_text, terapi, catatan, status, finalized_at::text
     FROM public.klinik_rekam_medis WHERE kunjungan_id = $1 LIMIT 1`,
    [kunjunganId],
  )
  const rekamMedis = rows[0] || null
  if (!rekamMedis) return { rekamMedis: null, history: [] }

  const { rows: historyRows } = await queryPostgres<KlinikRekamMedisHistoryRow>(
    `SELECT id::text, action, created_at::text FROM public.klinik_rekam_medis_history
     WHERE rekam_medis_id = $1 ORDER BY created_at ASC`,
    [rekamMedis.id],
  )
  return { rekamMedis, history: historyRows }
}

/** Buat baru (kalau belum ada) atau update rekam medis selagi masih DRAFT. */
export async function saveRekamMedisDraft(
  orgId: string,
  kunjunganId: string,
  payload: KlinikRekamMedisPayload,
): Promise<{ data: KlinikRekamMedis } | { error: string }> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows: existingRows } = await client.query<KlinikRekamMedis>(
      `SELECT id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
              diagnosis_text, terapi, catatan, status, finalized_at::text
       FROM public.klinik_rekam_medis WHERE kunjungan_id = $1 FOR UPDATE`,
      [kunjunganId],
    )
    const existing = existingRows[0] || null

    if (existing && existing.status === 'FINAL') {
      await client.query('ROLLBACK')
      return { error: 'Rekam medis sudah final dan terkunci. Gunakan addendum untuk koreksi.' }
    }

    let result: KlinikRekamMedis

    if (!existing) {
      const { rows } = await client.query<KlinikRekamMedis>(
        `INSERT INTO public.klinik_rekam_medis
           (org_id, kunjungan_id, staf_medis_id, anamnesis, diagnosis_icd10, diagnosis_text, terapi, catatan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
                   diagnosis_text, terapi, catatan, status, finalized_at::text`,
        [
          orgId, kunjunganId, payload.stafMedisId || null,
          payload.anamnesis || null, payload.diagnosisIcd10 || null, payload.diagnosisText || null,
          payload.terapi || null, payload.catatan || null,
        ],
      )
      result = rows[0]
      await client.query(
        `INSERT INTO public.klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id, before, after)
         VALUES ($1, 'CREATED', $2, NULL, $3::jsonb)`,
        [result.id, payload.stafMedisId || null, JSON.stringify(clinicalSnapshot(result))],
      )
    } else {
      const before = clinicalSnapshot(existing)
      const { rows } = await client.query<KlinikRekamMedis>(
        `UPDATE public.klinik_rekam_medis SET
           staf_medis_id = COALESCE($2, staf_medis_id),
           anamnesis = $3, diagnosis_icd10 = $4, diagnosis_text = $5, terapi = $6, catatan = $7,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
                   diagnosis_text, terapi, catatan, status, finalized_at::text`,
        [
          existing.id, payload.stafMedisId || null,
          payload.anamnesis || null, payload.diagnosisIcd10 || null, payload.diagnosisText || null,
          payload.terapi || null, payload.catatan || null,
        ],
      )
      result = rows[0]
      await client.query(
        `INSERT INTO public.klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id, before, after)
         VALUES ($1, 'UPDATED', $2, $3::jsonb, $4::jsonb)`,
        [result.id, payload.stafMedisId || null, JSON.stringify(before), JSON.stringify(clinicalSnapshot(result))],
      )
    }

    await client.query('COMMIT')
    revalidatePath('/klinik')
    return { data: result }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan rekam medis.' }
  } finally {
    client.release()
  }
}

/** Finalisasi rekam medis (kunci field klinis) + tandai kunjungan selesai. */
export async function finalizeRekamMedis(
  rekamMedisId: string,
  actorEmployeeId?: string | null,
): Promise<{ success: true } | { error: string }> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string; kunjungan_id: string; status: string }>(
      `SELECT id::text, kunjungan_id::text, status FROM public.klinik_rekam_medis WHERE id = $1 FOR UPDATE`,
      [rekamMedisId],
    )
    const existing = rows[0]
    if (!existing) {
      await client.query('ROLLBACK')
      return { error: 'Rekam medis tidak ditemukan.' }
    }
    if (existing.status === 'FINAL') {
      await client.query('ROLLBACK')
      return { error: 'Rekam medis sudah final.' }
    }

    await client.query(
      `UPDATE public.klinik_rekam_medis SET status = 'FINAL', finalized_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [rekamMedisId],
    )
    await client.query(
      `INSERT INTO public.klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id)
       VALUES ($1, 'FINALIZED', $2)`,
      [rekamMedisId, actorEmployeeId || null],
    )
    await client.query(
      `UPDATE public.klinik_kunjungan SET status = 'SELESAI', updated_at = NOW() WHERE id = $1`,
      [existing.kunjungan_id],
    )

    await client.query('COMMIT')
    revalidatePath('/klinik')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal memfinalisasi rekam medis.' }
  } finally {
    client.release()
  }
}

export type KlinikRekamMedisHistoryByPasienRow = KlinikRekamMedis & {
  tanggal: string
  poli_nama: string
  staf_medis_nama: string | null
}

/** Riwayat RM lengkap 1 pasien lintas semua kunjungan — dipakai tab Daftar Pasien. */
export async function getRekamMedisHistoryByPasien(pasienId: string): Promise<KlinikRekamMedisHistoryByPasienRow[]> {
  const { rows } = await queryPostgres<KlinikRekamMedisHistoryByPasienRow>(
    `SELECT rm.id::text, rm.kunjungan_id::text, rm.staf_medis_id::text, rm.anamnesis, rm.diagnosis_icd10,
            rm.diagnosis_text, rm.terapi, rm.catatan, rm.status, rm.finalized_at::text,
            k.tanggal::text, po.nama AS poli_nama,
            TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS staf_medis_nama
     FROM public.klinik_rekam_medis rm
     JOIN public.klinik_kunjungan k ON k.id = rm.kunjungan_id
     JOIN public.klinik_poli po ON po.id = k.poli_id
     LEFT JOIN public.klinik_staf_medis sm ON sm.id = rm.staf_medis_id
     LEFT JOIN public.employees e ON e.id = sm.employee_id
     WHERE k.pasien_id = $1
     ORDER BY k.tanggal DESC, k.created_at DESC`,
    [pasienId],
  )
  return rows
}

/**
 * Catat akses ke riwayat lengkap rekam medis pasien (audit trail —
 * klinik_akses_rekam_log). actor_employee_id sengaja DIAMBIL DARI SESI
 * SERVER (getCurrentKlinikEmployeeId), bukan parameter dari client — kalau
 * dipercaya dari client, siapapun bisa memalsukan/mengosongkan siapa yang
 * tercatat mengakses.
 */
export async function logAksesRekamMedis(
  orgId: string,
  pasienId: string,
  alasan: string,
): Promise<void> {
  const actorEmployeeId = await getCurrentKlinikEmployeeId(orgId)
  await queryPostgres(
    `INSERT INTO public.klinik_akses_rekam_log (org_id, actor_employee_id, pasien_id, alasan)
     VALUES ($1, $2, $3, $4)`,
    [orgId, actorEmployeeId, pasienId, alasan],
  )
}

/** Tambah addendum setelah rekam medis FINAL — append-only, tidak overwrite. */
export async function addRekamMedisAddendum(
  rekamMedisId: string,
  catatanTambahan: string,
  actorEmployeeId?: string | null,
): Promise<{ data: KlinikRekamMedis } | { error: string }> {
  const teks = catatanTambahan.trim()
  if (!teks) return { error: 'Teks addendum wajib diisi.' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<KlinikRekamMedis>(
      `SELECT id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
              diagnosis_text, terapi, catatan, status, finalized_at::text
       FROM public.klinik_rekam_medis WHERE id = $1 FOR UPDATE`,
      [rekamMedisId],
    )
    const existing = rows[0]
    if (!existing) {
      await client.query('ROLLBACK')
      return { error: 'Rekam medis tidak ditemukan.' }
    }
    if (existing.status !== 'FINAL') {
      await client.query('ROLLBACK')
      return { error: 'Addendum hanya berlaku untuk rekam medis yang sudah final.' }
    }

    const before = clinicalSnapshot(existing)
    const timestamp = new Date().toISOString()
    const addendumBlock = `\n\n[Addendum ${timestamp}]\n${teks}`
    const newCatatan = `${existing.catatan || ''}${addendumBlock}`

    const { rows: updatedRows } = await client.query<KlinikRekamMedis>(
      `UPDATE public.klinik_rekam_medis SET catatan = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id::text, kunjungan_id::text, staf_medis_id::text, anamnesis, diagnosis_icd10,
                 diagnosis_text, terapi, catatan, status, finalized_at::text`,
      [rekamMedisId, newCatatan],
    )
    const result = updatedRows[0]

    await client.query(
      `INSERT INTO public.klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id, before, after)
       VALUES ($1, 'ADDENDUM', $2, $3::jsonb, $4::jsonb)`,
      [rekamMedisId, actorEmployeeId || null, JSON.stringify(before), JSON.stringify(clinicalSnapshot(result))],
    )

    await client.query('COMMIT')
    revalidatePath('/klinik')
    return { data: result }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Gagal menambah addendum.' }
  } finally {
    client.release()
  }
}
