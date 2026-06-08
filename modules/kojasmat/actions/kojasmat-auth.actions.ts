'use server'

// Kojasmat — autentikasi anggota koperasi
// Login via kode_anggota + password, scope ke org_id agar data tidak tercampur antar bisnis

import { redirect } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import {
  signInWithInternalAuth,
  createInternalAuthResetTokenByEmail,
} from '@/lib/auth/internal-auth.server'

export async function signInAsAnggota(formData: FormData) {
  const kode = String(formData.get('kode_anggota') || '').trim().toUpperCase()
  const password = String(formData.get('password') || '').trim()
  const redirectTo = String(formData.get('redirectTo') || '').trim()
  const orgId = String(formData.get('org_id') || '').trim()

  if (!kode || !password) {
    const base = orgId ? `/anggota/login?org=${orgId}` : '/anggota/login'
    redirect(`${base}&error=${encodeURIComponent('Kode anggota dan kata sandi wajib diisi.')}`)
  }

  // Scope ke org_id jika tersedia — mencegah data antar bisnis tercampur
  const { rows } = orgId
    ? await queryPostgres(
        `SELECT kode_anggota, email, nik, status
         FROM kojasmat_anggota
         WHERE UPPER(kode_anggota) = $1 AND org_id = $2
         LIMIT 1`,
        [kode, orgId]
      )
    : await queryPostgres(
        `SELECT kode_anggota, email, nik, status
         FROM kojasmat_anggota
         WHERE UPPER(kode_anggota) = $1
         LIMIT 1`,
        [kode]
      )

  const anggota = rows[0]
  const loginBase = orgId ? `/anggota/login?org=${orgId}` : '/anggota/login'

  if (!anggota) {
    redirect(`${loginBase}&error=${encodeURIComponent('Kode anggota tidak ditemukan.')}`)
  }

  if (anggota.status === 'DIBEKUKAN') {
    redirect(`${loginBase}&error=${encodeURIComponent('Akun Anda dibekukan. Hubungi pengurus koperasi.')}`)
  }

  if (!anggota.email && !anggota.nik) {
    redirect(`${loginBase}&error=${encodeURIComponent('Akun belum diaktifkan. Hubungi pengurus koperasi untuk mendapatkan akses login.')}`)
  }

  const result = await signInWithInternalAuth({
    email: (anggota.email as string | null) ?? null,
    nik: (anggota.nik as string | null) ?? null,
    password,
  })

  if ('error' in result) {
    redirect(`${loginBase}&error=${encodeURIComponent('Kode anggota atau kata sandi salah.')}`)
  }

  // Gunakan kode_anggota dari DB (bukan input user) agar URL selalu konsisten
  const kodeAnggota = anggota.kode_anggota as string
  const portalUrl = orgId ? `/anggota/${kodeAnggota}?org=${orgId}` : `/anggota/${kodeAnggota}`
  redirect(redirectTo || portalUrl)
}

export async function requestAnggotaPasswordReset(formData: FormData): Promise<{
  success?: boolean
  error?: string
}> {
  const kode = String(formData.get('kode_anggota') || '').trim().toUpperCase()
  const orgId = String(formData.get('org_id') || '').trim()

  if (!kode) return { error: 'Kode anggota wajib diisi.' }

  const { rows } = orgId
    ? await queryPostgres(
        `SELECT kode_anggota, nama, email FROM kojasmat_anggota
         WHERE UPPER(kode_anggota) = $1 AND org_id = $2 LIMIT 1`,
        [kode, orgId]
      )
    : await queryPostgres(
        `SELECT kode_anggota, nama, email FROM kojasmat_anggota
         WHERE UPPER(kode_anggota) = $1 LIMIT 1`,
        [kode]
      )

  const anggota = rows[0]

  if (!anggota) return { error: 'Kode anggota tidak ditemukan.' }

  if (!anggota.email) {
    await queryPostgres(
      `INSERT INTO kojasmat_reset_requests (kode_anggota, nama, requested_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (kode_anggota) DO UPDATE SET requested_at = NOW()`,
      [kode, anggota.nama]
    ).catch(() => null)
    return { success: true }
  }

  const result = await createInternalAuthResetTokenByEmail(anggota.email as string)
  if ('error' in result) {
    return { error: result.error }
  }

  return { success: true }
}
