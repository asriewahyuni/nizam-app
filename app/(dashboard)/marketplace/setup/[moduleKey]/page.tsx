'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { SetupClient } from './setup-client'

/**
 * Setup page — fully client-side.
 * Page.tsx dan setup-client.tsx digabung jadi satu file client-only.
 * Tidak ada server-to-client serialization.
 */
export default function ModuleSetupPage() {
  const params = useParams()
  const moduleKey = typeof params?.moduleKey === 'string' ? params.moduleKey : ''

  if (!moduleKey) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Modul tidak ditemukan</h1>
          <a href="/marketplace" className="inline-block px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 mt-4">
            Kembali ke Marketplace
          </a>
        </div>
      </div>
    )
  }

  return <SetupClient moduleKey={moduleKey} />
}
