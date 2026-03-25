import type { Metadata } from 'next'
import { createOrganization } from '@/modules/organization/actions/org.actions'

export const metadata: Metadata = { title: 'Setup Organisasi | NIZAM' }

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div
        className="w-full max-w-md bg-white rounded-2xl p-8 animate-fade-in"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)' }}
          >
            N
          </div>
          <div>
            <p className="font-bold text-gray-900">NIZAM ERP</p>
            <p className="text-xs text-gray-400">Langkah 1 dari 1</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Buat organisasi Anda</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ini adalah nama perusahaan atau bisnis yang akan dikelola di NIZAM.
        </p>

        <form action={createOrganization} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Nama Organisasi / Perusahaan
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              placeholder="cth: PT Maju Sejahtera"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
              hover:opacity-90 active:scale-[0.99] mt-2"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
          >
            Mulai Sekarang →
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Chart of Accounts standar PSAK akan otomatis disiapkan untuk Anda.
        </p>
      </div>
    </div>
  )
}
