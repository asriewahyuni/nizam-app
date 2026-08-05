'use server'

// Kojasmat — akad ijarah (sewa manfaat platform) berulang tiap N hari.
// Satu fungsi pemotongan (tagihIjarah) dipakai baik untuk siklus pertama (dipanggil
// sekali langsung setelah aktivasi pendaftaran) maupun siklus berkala (dipanggil oleh
// cron harian) — bukan dua jalur kode terpisah. Terms (nominal_fee, periode_hari)
// di-snapshot per-akad per-anggota saat dibuat, supaya admin bisa memberi harga
// custom / menonaktifkan per anggota (status='BERHENTI') tanpa memengaruhi anggota lain.

import { queryPostgres, connectPostgresClient } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { jurnalTagihanIjarah } from '@/lib/erp-bridge/kojasmat-journals'
import { enqueueNotification } from '@/modules/notifications/outbox.server'
import { isOrgAdminOrManajemen } from './kojasmat.actions'
import { revalidatePath } from 'next/cache'

export type KojasmatAkadIjarah = {
  id: string
  org_id: string
  anggota_id: string
  nominal_fee: number
  periode_hari: number
  status: 'AKTIF' | 'DIBEKUKAN' | 'BERHENTI'
  tanggal_mulai: string
  tagihan_berikutnya: string
  catatan_admin: string | null
}

export async function getAkadIjarahByAnggota(anggotaId: string): Promise<KojasmatAkadIjarah | null> {
  const { rows: [akad] } = await queryPostgres(
    `SELECT * FROM kojasmat_akad_ijarah WHERE anggota_id=$1 LIMIT 1`,
    [anggotaId]
  )
  return (akad as KojasmatAkadIjarah | undefined) ?? null
}

// Jalur satu-satunya untuk memotong biaya ijarah — dipanggil dari createAnggotaFromPendaftaran
// (siklus pertama) dan dari cron harian (siklus berikutnya).
export async function tagihIjarah(akadId: string): Promise<{ success: true; charged: boolean } | { error: string }> {
  const client = await connectPostgresClient()
  let posted: { orgId: string; jumlah: number } | null = null
  let frozen: { orgId: string; anggotaId: string; nominal: number } | null = null
  try {
    await client.query('BEGIN')

    const { rows: [akad] } = await client.query(
      `SELECT * FROM kojasmat_akad_ijarah WHERE id=$1 FOR UPDATE`,
      [akadId]
    )
    if (!akad) throw new Error('Akad ijarah tidak ditemukan')
    if (akad.status === 'BERHENTI') {
      await client.query('COMMIT')
      client.release()
      return { success: true, charged: false }
    }

    const { rows: [simpanan] } = await client.query(
      `SELECT * FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`,
      [akad.anggota_id]
    )
    if (!simpanan) throw new Error('Rekening simpanan sukarela tidak ditemukan')

    const wasFrozenByIjarah = akad.status === 'DIBEKUKAN'
    const saldo = Number(simpanan.saldo)
    const fee = Number(akad.nominal_fee)

    if (saldo >= fee) {
      const sesudah = saldo - fee
      await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [simpanan.id, sesudah])
      await client.query(
        `INSERT INTO kojasmat_simpanan_mutasi
           (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status, direview_at)
         VALUES ($1,$2,$3,'IJARAH',$4,$5,$6,$7,'DISETUJUI',NOW())`,
        [akad.org_id, simpanan.id, akad.anggota_id, fee, saldo, sesudah, `Tagihan ijarah platform ${akad.periode_hari} hari`]
      )
      const nextDue = new Date(`${akad.tagihan_berikutnya}T00:00:00Z`)
      nextDue.setUTCDate(nextDue.getUTCDate() + akad.periode_hari)
      await client.query(
        `UPDATE kojasmat_akad_ijarah SET status='AKTIF', tagihan_berikutnya=$2, updated_at=NOW() WHERE id=$1`,
        [akad.id, nextDue.toISOString().split('T')[0]]
      )
      if (wasFrozenByIjarah) {
        await client.query(
          `UPDATE kojasmat_anggota SET status='AKTIF', updated_at=NOW() WHERE id=$1 AND status='DIBEKUKAN'`,
          [akad.anggota_id]
        )
      }
      await client.query('COMMIT')
      client.release()
      posted = { orgId: akad.org_id, jumlah: fee }
      await jurnalTagihanIjarah(posted.orgId, posted.jumlah, akad.id).catch(() => null)
      revalidatePath('/kojasmat')
      return { success: true, charged: true }
    }

    // Saldo tidak cukup — bekukan akad + anggota, JANGAN majukan tagihan_berikutnya
    // supaya cron terus mencoba tiap hari sampai anggota top-up.
    await client.query(`UPDATE kojasmat_akad_ijarah SET status='DIBEKUKAN', updated_at=NOW() WHERE id=$1`, [akad.id])
    await client.query(`UPDATE kojasmat_anggota SET status='DIBEKUKAN', updated_at=NOW() WHERE id=$1`, [akad.anggota_id])
    await client.query('COMMIT')
    client.release()
    frozen = { orgId: akad.org_id, anggotaId: akad.anggota_id, nominal: fee }
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Gagal memproses tagihan ijarah' }
  }

  if (frozen) {
    const { rows: [anggota] } = await queryPostgres(
      `SELECT nama, phone, user_id FROM kojasmat_anggota WHERE id=$1`,
      [frozen.anggotaId]
    )
    if (anggota) {
      const body = `Halo ${anggota.nama}, saldo simpanan sukarela Anda tidak mencukupi untuk tagihan ijarah platform (Rp ${frozen.nominal.toLocaleString('id-ID')}). Akun Anda dibekukan sementara — silakan top-up simpanan sukarela untuk mengaktifkan kembali.`
      const idempotencyKey = `kojasmat-ijarah-bekukan:${akadId}:${new Date().toISOString().split('T')[0]}`
      await enqueueNotification({
        orgId: frozen.orgId, userId: anggota.user_id, eventType: 'kojasmat_ijarah_dibekukan',
        channel: 'IN_APP', recipient: anggota.user_id || frozen.anggotaId,
        subject: 'Akun Dibekukan — Tagihan Ijarah Platform', body, idempotencyKey: `${idempotencyKey}:in_app`,
      }).catch(() => null)
      if (anggota.phone) {
        await enqueueNotification({
          orgId: frozen.orgId, userId: anggota.user_id, eventType: 'kojasmat_ijarah_dibekukan',
          channel: 'WHATSAPP', providerCode: 'DRIPSENDER', recipient: anggota.phone,
          body, idempotencyKey: `${idempotencyKey}:whatsapp`,
        }).catch(() => null)
      }
    }
    revalidatePath('/kojasmat')
    return { success: true, charged: false }
  }

  return { success: true, charged: false }
}

// Admin: ubah tarif custom per anggota, atau nonaktifkan/aktifkan kembali akadnya.
export async function setAkadIjarahOverride(akadId: string, input: {
  nominal_fee?: number
  status?: 'AKTIF' | 'BERHENTI'
  catatan?: string
}): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const { rows: [akad] } = await queryPostgres(`SELECT org_id FROM kojasmat_akad_ijarah WHERE id=$1`, [akadId])
  if (!akad) return { error: 'Akad ijarah tidak ditemukan' }
  if (!(await isOrgAdminOrManajemen(session.user.id, akad.org_id))) {
    return { error: 'Hanya owner/admin/manager yang dapat mengubah akad ijarah.' }
  }
  if (input.nominal_fee !== undefined && !(input.nominal_fee > 0)) {
    return { error: 'Nominal fee harus lebih dari nol' }
  }

  const internalUserId = (session.user.user_metadata['internal_user_id'] as string | null) ?? session.user.id
  await queryPostgres(
    `UPDATE kojasmat_akad_ijarah
     SET nominal_fee = COALESCE($2, nominal_fee),
         status = COALESCE($3, status),
         catatan_admin = COALESCE($4, catatan_admin),
         diubah_oleh = $5,
         updated_at = NOW()
     WHERE id=$1`,
    [akadId, input.nominal_fee ?? null, input.status ?? null, input.catatan ?? null, internalUserId]
  )

  revalidatePath('/kojasmat')
  return { success: true }
}

// Admin: buat akad ijarah manual untuk anggota yang belum punya baris akad
// (mis. anggota lama sebelum backfill, atau anggota dibuat lewat jalur staf tanpa
// pembayaran online).
export async function buatAkadIjarahManual(orgId: string, anggotaId: string, input: {
  nominal_fee: number
  periode_hari?: number
}): Promise<{ success: true } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat membuat akad ijarah.' }
  }
  if (!(input.nominal_fee > 0)) return { error: 'Nominal fee harus lebih dari nol' }

  const { rows: [existing] } = await queryPostgres(`SELECT id FROM kojasmat_akad_ijarah WHERE anggota_id=$1`, [anggotaId])
  if (existing) return { error: 'Anggota ini sudah memiliki akad ijarah' }

  await queryPostgres(
    `INSERT INTO kojasmat_akad_ijarah (org_id, anggota_id, nominal_fee, periode_hari, tanggal_mulai, tagihan_berikutnya)
     VALUES ($1,$2,$3,$4,CURRENT_DATE,CURRENT_DATE + ($4 || ' days')::interval)`,
    [orgId, anggotaId, input.nominal_fee, input.periode_hari ?? 30]
  )

  revalidatePath('/kojasmat')
  return { success: true }
}
