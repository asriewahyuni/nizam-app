'use server'

// Kojasmat — transfer simpanan Sukarela antar anggota lewat scan QR internal.
// Berbeda dari Setor/Tarik: dana tidak keluar dari koperasi (cuma pindah antar
// sub-ledger anggota di GL "Simpanan Sukarela" yang sama), jadi tidak perlu
// verifikasi manual pengurus — transfer diproses instan setelah anggota
// mengonfirmasi ulang passwordnya. Tidak posting jurnal akuntansi karena debit
// dan kredit jatuh di akun GL yang persis sama (net effect nol di buku besar);
// jejak audit cukup lewat dua baris kojasmat_simpanan_mutasi di bawah.

import { queryPostgres, connectPostgresClient } from '@/lib/db/postgres'
import { getInternalAuthSession, verifyPasswordByUserId } from '@/lib/auth/internal-auth.server'
import { resolveInternalUserId } from '@/lib/auth/internal-auth.shared'
import { revalidatePath } from 'next/cache'
import { enqueueNotification } from '@/modules/notifications/outbox.server'
import { requireSahabatOrStaff } from './kojasmat.actions'

async function getAuthorizedPengirim(dariAnggotaId?: string): Promise<{ id: string; org_id: string; nama: string; kode_anggota: string } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  const userId = resolveInternalUserId(session)

  if (dariAnggotaId) {
    const { rows: [anggota] } = await queryPostgres(
      `SELECT id, org_id, nama, kode_anggota, user_id FROM kojasmat_anggota WHERE id = $1::uuid LIMIT 1`,
      [dariAnggotaId]
    )
    if (!anggota) return { error: 'Data anggota pengirim tidak ditemukan.' }
    
    if (anggota.user_id === userId) {
      return { id: anggota.id, org_id: anggota.org_id, nama: anggota.nama, kode_anggota: anggota.kode_anggota }
    }
    
    const { rows: [orgMember] } = await queryPostgres(
      `SELECT role FROM org_members WHERE org_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
      [anggota.org_id, userId]
    )
    if (orgMember && ['owner', 'admin', 'staff'].includes(orgMember.role)) {
      return { id: anggota.id, org_id: anggota.org_id, nama: anggota.nama, kode_anggota: anggota.kode_anggota }
    }
    return { error: 'Anda tidak memiliki akses untuk mentransfer saldo anggota ini.' }
  }

  const { rows: [anggota] } = await queryPostgres(
    `SELECT id, org_id, nama, kode_anggota FROM kojasmat_anggota WHERE user_id = $1::uuid LIMIT 1`,
    [userId]
  )
  if (!anggota) return { error: 'Akun Anda bukan Anggota Koperasi.' }
  return anggota as { id: string; org_id: string; nama: string; kode_anggota: string }
}

export type KojasmatTransferPreview = {
  id: string
  nama: string
  kode_anggota: string
}

// Dipanggil setelah scan QR — validasi target sebelum menampilkan form nominal.
export async function getAnggotaTransferPreview(keAnggotaId: string, dariAnggotaId?: string): Promise<{ data: KojasmatTransferPreview } | { error: string }> {
  const pengirim = await getAuthorizedPengirim(dariAnggotaId)
  if ('error' in pengirim) return { error: pengirim.error }

  const { rows: [tujuan] } = await queryPostgres(
    `SELECT id, org_id, nama, kode_anggota, status FROM kojasmat_anggota WHERE id = $1::uuid LIMIT 1`,
    [keAnggotaId]
  )
  if (!tujuan) return { error: 'QR tidak dikenali. Pastikan Anda memindai QR anggota koperasi ini.' }
  if (tujuan.org_id !== pengirim.org_id) return { error: 'Anggota tujuan bukan dari koperasi yang sama.' }
  if (tujuan.id === pengirim.id) return { error: 'Tidak bisa transfer ke diri sendiri.' }
  if (tujuan.status === 'DIBEKUKAN') return { error: 'Anggota tujuan sedang dibekukan dan tidak bisa menerima transfer.' }

  return { data: { id: tujuan.id, nama: tujuan.nama, kode_anggota: tujuan.kode_anggota } }
}

async function notifikasiTransferSimpanan(input: {
  orgId: string
  penerimaAnggotaId: string
  pengirimNama: string
  jumlah: number
}) {
  const { rows: [penerima] } = await queryPostgres(
    `SELECT nama, email, phone, user_id FROM kojasmat_anggota WHERE id=$1`,
    [input.penerimaAnggotaId]
  )
  if (!penerima) return

  const nominal = `Rp ${input.jumlah.toLocaleString('id-ID')}`
  const body = `Halo ${penerima.nama}, Anda menerima transfer simpanan sukarela sebesar ${nominal} dari ${input.pengirimNama}.`
  const idempotencyKey = `kojasmat-transfer-masuk:${input.penerimaAnggotaId}:${Date.now()}`

  await enqueueNotification({
    orgId: input.orgId, userId: penerima.user_id, eventType: 'kojasmat_transfer_simpanan',
    channel: 'IN_APP', recipient: penerima.user_id || input.penerimaAnggotaId,
    subject: 'Transfer Simpanan Diterima', body, idempotencyKey: `${idempotencyKey}:in_app`,
  }).catch(() => null)

  if (penerima.phone) {
    await enqueueNotification({
      orgId: input.orgId, userId: penerima.user_id, eventType: 'kojasmat_transfer_simpanan',
      channel: 'WHATSAPP', providerCode: 'DRIPSENDER', recipient: penerima.phone,
      body, idempotencyKey: `${idempotencyKey}:whatsapp`,
    }).catch(() => null)
  }
}

export async function kirimTransferSimpanan(payload: {
  dari_anggota_id?: string
  ke_anggota_id: string
  jumlah: number
  password: string
  catatan?: string
}): Promise<{ success: true } | { error: string }> {
  if (!(payload.jumlah > 0)) return { error: 'Jumlah transfer harus lebih dari nol' }

  const session = await getInternalAuthSession()
  if (!session) return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' }

  const internalUserId = resolveInternalUserId(session)
  const passwordValid = await verifyPasswordByUserId(internalUserId, payload.password)
  if (!passwordValid) return { error: 'Password tidak sesuai.' }

  const pengirimRes = await getAuthorizedPengirim(payload.dari_anggota_id)
  if ('error' in pengirimRes) return { error: pengirimRes.error }
  const pengirim = pengirimRes

  const gate = await requireSahabatOrStaff(pengirim.id, pengirim.org_id, session.user.id)
  if ('error' in gate) return gate

  const { rows: [tujuan] } = await queryPostgres(
    `SELECT id, org_id, nama, kode_anggota, status FROM kojasmat_anggota WHERE id = $1::uuid LIMIT 1`,
    [payload.ke_anggota_id]
  )
  if (!tujuan) return { error: 'Anggota tujuan tidak ditemukan.' }
  if (tujuan.org_id !== pengirim.org_id) return { error: 'Anggota tujuan bukan dari koperasi yang sama.' }
  if (tujuan.id === pengirim.id) return { error: 'Tidak bisa transfer ke diri sendiri.' }
  if (tujuan.status === 'DIBEKUKAN') return { error: 'Anggota tujuan sedang dibekukan dan tidak bisa menerima transfer.' }

  const { rows: [simpananPengirim] } = await queryPostgres(
    `SELECT id FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA'`,
    [pengirim.id]
  )
  const { rows: [simpananTujuan] } = await queryPostgres(
    `SELECT id FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA'`,
    [tujuan.id]
  )
  if (!simpananPengirim || !simpananTujuan) return { error: 'Rekening simpanan sukarela tidak ditemukan.' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    // Lock kedua baris simpanan dalam urutan id yang konsisten supaya dua transfer
    // berlawanan arah yang berjalan bersamaan tidak saling deadlock.
    const lockIds = [simpananPengirim.id, simpananTujuan.id].sort()
    for (const id of lockIds) {
      await client.query(`SELECT id FROM kojasmat_simpanan WHERE id=$1 FOR UPDATE`, [id])
    }

    const { rows: [saldoPengirim] } = await client.query(
      `SELECT saldo FROM kojasmat_simpanan WHERE id=$1`, [simpananPengirim.id]
    )
    const { rows: [saldoTujuan] } = await client.query(
      `SELECT saldo FROM kojasmat_simpanan WHERE id=$1`, [simpananTujuan.id]
    )

    const sebelumPengirim = Number(saldoPengirim.saldo)
    if (sebelumPengirim < payload.jumlah) throw new Error('Saldo simpanan sukarela tidak mencukupi')
    const sesudahPengirim = sebelumPengirim - payload.jumlah

    const sebelumTujuan = Number(saldoTujuan.saldo)
    const sesudahTujuan = sebelumTujuan + payload.jumlah

    await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [simpananPengirim.id, sesudahPengirim])
    await client.query(`UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`, [simpananTujuan.id, sesudahTujuan])

    const keteranganKeluar = `Transfer ke ${tujuan.nama} (${tujuan.kode_anggota})${payload.catatan ? ` — ${payload.catatan}` : ''}`
    const keteranganMasuk = `Transfer dari ${pengirim.nama} (${pengirim.kode_anggota})${payload.catatan ? ` — ${payload.catatan}` : ''}`

    await client.query(
      `INSERT INTO kojasmat_simpanan_mutasi
         (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status, direview_at)
       VALUES ($1,$2,$3,'TRANSFER_KELUAR',$4,$5,$6,$7,'DISETUJUI',NOW())`,
      [pengirim.org_id, simpananPengirim.id, pengirim.id, payload.jumlah, sebelumPengirim, sesudahPengirim, keteranganKeluar]
    )
    await client.query(
      `INSERT INTO kojasmat_simpanan_mutasi
         (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, status, direview_at)
       VALUES ($1,$2,$3,'TRANSFER_MASUK',$4,$5,$6,$7,'DISETUJUI',NOW())`,
      [tujuan.org_id, simpananTujuan.id, tujuan.id, payload.jumlah, sebelumTujuan, sesudahTujuan, keteranganMasuk]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Gagal memproses transfer' }
  }
  client.release()

  await notifikasiTransferSimpanan({
    orgId: pengirim.org_id, penerimaAnggotaId: tujuan.id, pengirimNama: pengirim.nama, jumlah: payload.jumlah,
  }).catch(() => null)

  revalidatePath('/kojasmat')
  revalidatePath(`/anggota/${tujuan.kode_anggota}`)
  return { success: true }
}

export async function getAnggotaTransferPreviewByKode(kodeAnggota: string, dariAnggotaId?: string): Promise<{ data: KojasmatTransferPreview } | { error: string }> {
  const pengirim = await getAuthorizedPengirim(dariAnggotaId)
  if ('error' in pengirim) return { error: pengirim.error }

  const { rows: [tujuan] } = await queryPostgres(
    `SELECT id, org_id, nama, kode_anggota, status FROM kojasmat_anggota WHERE kode_anggota = $1 AND org_id = $2 LIMIT 1`,
    [kodeAnggota, pengirim.org_id]
  )
  if (!tujuan) return { error: 'Kode anggota tidak ditemukan di koperasi Anda.' }
  if (tujuan.id === pengirim.id) return { error: 'Tidak bisa transfer ke diri sendiri.' }
  if (tujuan.status === 'DIBEKUKAN') return { error: 'Anggota tujuan sedang dibekukan dan tidak bisa menerima transfer.' }

  return { data: { id: tujuan.id, nama: tujuan.nama, kode_anggota: tujuan.kode_anggota } }
}
