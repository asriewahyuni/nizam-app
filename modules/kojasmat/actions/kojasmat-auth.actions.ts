'use server'

// Kojasmat — autentikasi anggota koperasi
// Login via kode_anggota + password, reset password via kode + email

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

  if (!kode || !password) {
    redirect(`/anggota/login?error=${encodeURIComponent('Kode anggota dan kata sandi wajib diisi.')}`)
  }

  const { rows } = await queryPostgres(
    `SELECT kode_anggota, email, nik, status
     FROM kojasmat_anggota
     WHERE UPPER(kode_anggota) = $1
     LIMIT 1`,
    [kode]
  )
  const anggota = rows[0]

  if (!anggota) {
    redirect(`/anggota/login?error=${encodeURIComponent('Kode anggota tidak ditemukan.')}`)
  }

  if (anggota.status === 'DIBEKUKAN') {
    redirect(`/anggota/login?error=${encodeURIComponent('Akun Anda dibekukan. Hubungi pengurus koperasi.')}`)
  }

  if (!anggota.email && !anggota.nik) {
    redirect(`/anggota/login?error=${encodeURIComponent('Akun belum diaktifkan. Hubungi pengurus koperasi untuk mendapatkan akses login.')}`)
  }

  const result = await signInWithInternalAuth({
    email: (anggota.email as string | null) ?? null,
    nik: (anggota.nik as string | null) ?? null,
    password,
  })

  if ('error' in result) {
    redirect(`/anggota/login?error=${encodeURIComponent('Kode anggota atau kata sandi salah.')}`)
  }

  redirect(redirectTo || `/anggota/${kode}`)
}

export async function requestAnggotaPasswordReset(formData: FormData): Promise<{
  success?: boolean
  error?: string
}> {
  const kode = String(formData.get('kode_anggota') || '').trim().toUpperCase()

  if (!kode) return { error: 'Kode anggota wajib diisi.' }

  const { rows } = await queryPostgres(
    `SELECT kode_anggota, nama, email FROM kojasmat_anggota WHERE UPPER(kode_anggota) = $1 LIMIT 1`,
    [kode]
  )
  const anggota = rows[0]

  if (!anggota) return { error: 'Kode anggota tidak ditemukan.' }

  if (!anggota.email) {
    // Tidak ada email — catat sebagai permintaan manual ke admin
    await queryPostgres(
      `INSERT INTO kojasmat_reset_requests (kode_anggota, nama, requested_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (kode_anggota) DO UPDATE SET requested_at = NOW()`,
      [kode, anggota.nama]
    ).catch(() => null) // tabel mungkin belum ada — non-fatal
    return {
      success: true,
    }
  }

  // Ada email — buat token reset
  const result = await createInternalAuthResetTokenByEmail(anggota.email as string)
  if ('error' in result) {
    return { error: result.error }
  }

  // TODO: kirim email reset ke anggota.email via Mailketing
  // Untuk sekarang: kembalikan success — admin bisa lihat token di dashboard

  return { success: true }
}
