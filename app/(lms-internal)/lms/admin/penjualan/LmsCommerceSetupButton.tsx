'use client'

import { useState } from 'react'
import { Rocket, Loader2 } from 'lucide-react'
import { setupLmsCommerceAction } from '@/modules/edu/actions/lms-commercial.actions'

export function LmsCommerceSetupButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSetup = async () => {
    setLoading(true)
    setError('')
    const res = await setupLmsCommerceAction()
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Rocket size={24} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Mulai Jualan Kelas</h2>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          Anda belum memiliki Store E-Commerce. Untuk menjual kelas, sistem membutuhkan Gudang, Cabang, dan Rekening tujuan. Klik tombol di bawah untuk membuat semuanya secara otomatis.
        </p>
        
        {error && (
          <div className="mt-4 w-full max-w-md rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSetup}
          disabled={loading}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Menyiapkan Sistem...
            </>
          ) : (
            'Buat Store Digital Otomatis'
          )}
        </button>
      </div>
    </div>
  )
}
