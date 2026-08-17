'use server'

// Klinik Pratama — helper otorisasi & aksi dasar modul.

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

export async function isKlinikOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  if (!userId || !orgId) return false
  const { rows } = await queryPostgres(
    `SELECT role FROM org_members WHERE user_id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [userId, orgId]
  )
  const role = String(rows[0]?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export type KlinikPoli = {
  id: string
  kode: string
  nama: string
}

export async function getKlinikPoliByBranch(orgId: string, branchId: string): Promise<KlinikPoli[]> {
  const { rows } = await queryPostgres<KlinikPoli>(
    `SELECT id::text, kode, nama FROM public.klinik_poli
     WHERE org_id = $1 AND branch_id = $2 AND is_active = TRUE
     ORDER BY nama ASC`,
    [orgId, branchId]
  )
  return rows
}

export async function createKlinikPoli(
  orgId: string,
  branchId: string,
  payload: { kode: string; nama: string },
): Promise<{ data: KlinikPoli } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat menambah poli.' }
  }

  const kode = payload.kode.trim().toUpperCase()
  const nama = payload.nama.trim()
  if (!kode) return { error: 'Kode poli wajib diisi.' }
  if (!nama) return { error: 'Nama poli wajib diisi.' }

  try {
    const { rows } = await queryPostgres<KlinikPoli>(
      `INSERT INTO public.klinik_poli (org_id, branch_id, kode, nama)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, kode, nama`,
      [orgId, branchId, kode, nama],
    )
    return { data: rows[0] }
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (err.code === '23505') {
      return { error: 'Kode poli sudah dipakai di cabang ini.' }
    }
    return { error: err.message || 'Gagal membuat poli baru.' }
  }
}

export type KlinikStafMedis = {
  id: string
  employee_id: string
  employee_name: string
  jenis: 'dokter' | 'perawat' | 'bidan' | 'apoteker'
  str_number: string | null
  sip_number: string | null
  spesialisasi: string | null
  poli_id: string | null
}

export async function getKlinikStafMedis(orgId: string): Promise<KlinikStafMedis[]> {
  const { rows } = await queryPostgres<KlinikStafMedis>(
    `SELECT sm.id::text, sm.employee_id::text,
            TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS employee_name,
            sm.jenis, sm.str_number, sm.sip_number, sm.spesialisasi, sm.poli_id::text
     FROM public.klinik_staf_medis sm
     JOIN public.employees e ON e.id = sm.employee_id
     WHERE sm.org_id = $1 AND sm.is_active = TRUE
     ORDER BY employee_name ASC`,
    [orgId],
  )
  return rows
}

export async function createKlinikStafMedis(
  orgId: string,
  payload: {
    employeeId: string
    jenis: 'dokter' | 'perawat' | 'bidan' | 'apoteker'
    strNumber?: string | null
    sipNumber?: string | null
    spesialisasi?: string | null
    poliId?: string | null
  },
): Promise<{ data: KlinikStafMedis } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat menambah tenaga medis.' }
  }

  try {
    const { rows } = await queryPostgres<{ id: string }>(
      `INSERT INTO public.klinik_staf_medis (org_id, employee_id, jenis, str_number, sip_number, spesialisasi, poli_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [orgId, payload.employeeId, payload.jenis, payload.strNumber || null, payload.sipNumber || null, payload.spesialisasi || null, payload.poliId || null],
    )
    const list = await getKlinikStafMedis(orgId)
    const created = list.find((s) => s.id === rows[0].id)
    if (!created) return { error: 'Tenaga medis tersimpan tapi gagal dimuat ulang.' }
    return { data: created }
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (err.code === '23505') {
      return { error: 'Karyawan ini sudah terdaftar sebagai tenaga medis.' }
    }
    return { error: err.message || 'Gagal menambah tenaga medis.' }
  }
}

export type KlinikTarifLayanan = {
  id: string
  nama_layanan: string
  kategori: 'Konsultasi' | 'Tindakan' | 'Lainnya'
  harga: number
}

/** branch_id nullable = berlaku semua cabang (fallback), lihat 1425_klinik_pratama_foundation.sql */
export async function getKlinikTarifLayananByBranch(orgId: string, branchId: string): Promise<KlinikTarifLayanan[]> {
  const { rows } = await queryPostgres<KlinikTarifLayanan>(
    `SELECT id::text, nama_layanan, kategori, harga
     FROM public.klinik_tarif_layanan
     WHERE org_id = $1 AND (branch_id = $2 OR branch_id IS NULL) AND is_active = TRUE
     ORDER BY nama_layanan ASC`,
    [orgId, branchId],
  )
  return rows
}

export async function createKlinikTarifLayanan(
  orgId: string,
  branchId: string | null,
  payload: { namaLayanan: string; kategori: 'Konsultasi' | 'Tindakan' | 'Lainnya'; harga: number },
): Promise<{ data: KlinikTarifLayanan } | { error: string }> {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await isKlinikOrgAdmin(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat menambah tarif layanan.' }
  }

  const namaLayanan = payload.namaLayanan.trim()
  if (!namaLayanan) return { error: 'Nama layanan wajib diisi.' }
  if (payload.harga < 0) return { error: 'Harga tidak boleh negatif.' }

  try {
    const { rows } = await queryPostgres<KlinikTarifLayanan>(
      `INSERT INTO public.klinik_tarif_layanan (org_id, branch_id, nama_layanan, kategori, harga)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text, nama_layanan, kategori, harga`,
      [orgId, branchId, namaLayanan, payload.kategori, payload.harga],
    )
    return { data: rows[0] }
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (err.code === '23505') {
      return { error: 'Nama layanan ini sudah ada untuk cakupan cabang yang sama.' }
    }
    return { error: err.message || 'Gagal menambah tarif layanan.' }
  }
}
