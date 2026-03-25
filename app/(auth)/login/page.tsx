import type { Metadata } from 'next'
import { signIn } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Masuk ke NIZAM' }

// In Next.js 16, searchParams is a Promise — must be awaited
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Selamat datang</h1>
        <p className="text-gray-500 text-sm">Masuk untuk melanjutkan ke dashboard</p>
      </div>

      {params.error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
        >
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form action={signIn} className="space-y-4">
        <input type="hidden" name="redirectTo" value={params.redirectTo || ''} />

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
            placeholder="nama@perusahaan.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
              bg-white text-gray-900 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
              Lupa password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
              bg-white text-gray-900 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-all"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
            transition-all hover:opacity-90 active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
        >
          Masuk
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Belum punya akun?{' '}
        <Link href="/register" className="text-blue-600 font-medium hover:text-blue-700">
          Daftar gratis
        </Link>
      </p>

      <div className="mt-4 pt-4 border-t border-gray-100 text-center">
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all shadow-md shadow-amber-200/50"
        >
          🎮 Coba Demo (Tanpa Registrasi)
        </Link>
      </div>
    </div>
  )
}
