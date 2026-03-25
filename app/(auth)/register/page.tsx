import type { Metadata } from 'next'
import { signUp } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Daftar Akun NIZAM' }

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Buat akun baru</h1>
        <p className="text-gray-500 text-sm">Gratis, tanpa kartu kredit</p>
      </div>

      <form action={signUp} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
            Nama Lengkap
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            placeholder="Budi Santoso"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="budi@perusahaan.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Minimal 8 karakter"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Gunakan kombinasi huruf dan angka</p>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
            hover:opacity-90 active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
        >
          Buat Akun
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Sudah punya akun?{' '}
        <Link href="/login" className="text-blue-600 font-medium hover:text-blue-700">
          Masuk di sini
        </Link>
      </p>
    </div>
  )
}
