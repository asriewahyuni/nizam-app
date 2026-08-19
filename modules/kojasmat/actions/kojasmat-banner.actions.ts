'use server'

// Banner promosi beranda portal anggota Kojasmat — dikelola staf lewat
// pengaturan, ditampilkan sebagai carousel di TabBeranda portal anggota.

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'
import { isOrgAdminOrManajemen } from './kojasmat.actions'

export interface KojasmatPortalBanner {
  id: string
  org_id: string
  judul: string
  subjudul: string | null
  gambar_url: string | null
  warna_mulai: string
  warna_akhir: string
  link_type: 'NONE' | 'PROYEK' | 'URL'
  proyek_id: string | null
  url: string | null
  urutan: number
  aktif: boolean
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  created_at: string
}

// Dipakai portal anggota — hanya banner aktif & dalam jendela tanggal (kalau diisi).
export async function getActivePortalBanners(orgId: string): Promise<KojasmatPortalBanner[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_portal_banners
     WHERE org_id=$1 AND aktif=true
       AND (tanggal_mulai IS NULL OR tanggal_mulai <= CURRENT_DATE)
       AND (tanggal_selesai IS NULL OR tanggal_selesai >= CURRENT_DATE)
     ORDER BY urutan ASC, created_at ASC`,
    [orgId]
  )
  return rows as KojasmatPortalBanner[]
}

// Dipakai halaman pengaturan staf — semua banner (aktif maupun tidak).
export async function getAllPortalBanners(orgId: string): Promise<KojasmatPortalBanner[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_portal_banners WHERE org_id=$1 ORDER BY urutan ASC, created_at ASC`,
    [orgId]
  )
  return rows as KojasmatPortalBanner[]
}

async function requireStaffAccess(orgId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { error: 'Hanya owner/admin/manager yang dapat mengelola banner.' }
  }
  return { ok: true as const }
}

export async function createPortalBanner(payload: {
  org_id: string
  judul: string
  subjudul?: string
  gambar_url?: string
  warna_mulai?: string
  warna_akhir?: string
  link_type: 'NONE' | 'PROYEK' | 'URL'
  proyek_id?: string
  url?: string
  urutan?: number
  tanggal_mulai?: string
  tanggal_selesai?: string
}) {
  const gate = await requireStaffAccess(payload.org_id)
  if ('error' in gate) return gate

  if (!payload.judul.trim()) return { error: 'Judul banner wajib diisi.' }
  if (payload.link_type === 'PROYEK' && !payload.proyek_id) return { error: 'Pilih proyek untuk banner bertipe Proyek.' }
  if (payload.link_type === 'URL' && !payload.url?.trim()) return { error: 'URL wajib diisi untuk banner bertipe URL.' }

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_portal_banners
       (org_id, judul, subjudul, gambar_url, warna_mulai, warna_akhir, link_type, proyek_id, url, urutan, tanggal_mulai, tanggal_selesai)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      payload.org_id, payload.judul.trim(), payload.subjudul || null, payload.gambar_url || null,
      payload.warna_mulai || '#0f766e', payload.warna_akhir || '#164e63',
      payload.link_type, payload.link_type === 'PROYEK' ? payload.proyek_id : null,
      payload.link_type === 'URL' ? payload.url : null,
      payload.urutan ?? 0, payload.tanggal_mulai || null, payload.tanggal_selesai || null,
    ]
  )
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatPortalBanner }
}

export async function updatePortalBanner(id: string, payload: {
  org_id: string
  judul: string
  subjudul?: string
  gambar_url?: string
  warna_mulai?: string
  warna_akhir?: string
  link_type: 'NONE' | 'PROYEK' | 'URL'
  proyek_id?: string
  url?: string
  urutan?: number
  aktif?: boolean
  tanggal_mulai?: string
  tanggal_selesai?: string
}) {
  const gate = await requireStaffAccess(payload.org_id)
  if ('error' in gate) return gate

  if (!payload.judul.trim()) return { error: 'Judul banner wajib diisi.' }
  if (payload.link_type === 'PROYEK' && !payload.proyek_id) return { error: 'Pilih proyek untuk banner bertipe Proyek.' }
  if (payload.link_type === 'URL' && !payload.url?.trim()) return { error: 'URL wajib diisi untuk banner bertipe URL.' }

  const { rows } = await queryPostgres(
    `UPDATE kojasmat_portal_banners
     SET judul=$3, subjudul=$4, gambar_url=$5, warna_mulai=$6, warna_akhir=$7,
         link_type=$8, proyek_id=$9, url=$10, urutan=$11, aktif=COALESCE($12, aktif),
         tanggal_mulai=$13, tanggal_selesai=$14, updated_at=NOW()
     WHERE id=$1 AND org_id=$2
     RETURNING *`,
    [
      id, payload.org_id, payload.judul.trim(), payload.subjudul || null, payload.gambar_url || null,
      payload.warna_mulai || '#0f766e', payload.warna_akhir || '#164e63',
      payload.link_type, payload.link_type === 'PROYEK' ? payload.proyek_id : null,
      payload.link_type === 'URL' ? payload.url : null,
      payload.urutan ?? 0, payload.aktif ?? null, payload.tanggal_mulai || null, payload.tanggal_selesai || null,
    ]
  )
  if (!rows[0]) return { error: 'Banner tidak ditemukan.' }
  revalidatePath('/kojasmat')
  return { data: rows[0] as KojasmatPortalBanner }
}

export async function toggleAktifPortalBanner(id: string, orgId: string, aktif: boolean) {
  const gate = await requireStaffAccess(orgId)
  if ('error' in gate) return gate

  await queryPostgres(
    `UPDATE kojasmat_portal_banners SET aktif=$3, updated_at=NOW() WHERE id=$1 AND org_id=$2`,
    [id, orgId, aktif]
  )
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}

export async function deletePortalBanner(id: string, orgId: string) {
  const gate = await requireStaffAccess(orgId)
  if ('error' in gate) return gate

  await queryPostgres(`DELETE FROM kojasmat_portal_banners WHERE id=$1 AND org_id=$2`, [id, orgId])
  revalidatePath('/kojasmat')
  return { data: { ok: true } }
}
