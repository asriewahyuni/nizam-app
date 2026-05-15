'use client'

import { useState } from 'react'
import { runKoperasiMigration } from '@/modules/koperasi/actions/migrate.actions'
import { PageHeader, SectionCard, SafeButton } from '@/components/ui/NizamUI'

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function handleRun() {
    setLoading(true)
    setResult(null)
    try {
      const res = await runKoperasiMigration()
      setResult(res)
    } catch (e: any) {
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-4">
      <PageHeader title="Migrasi Database Koperasi" subtitle="Jalankan sekali untuk membuat semua tabel koperasi" />

      <SectionCard>
        <p className="text-slate-600 mb-4">
          Halaman ini akan membuat 11 tabel koperasi di database Railway PostgreSQL.
          Cukup jalankan sekali.
        </p>
        <SafeButton onClick={handleRun} disabled={loading}>
          {loading ? 'Menjalankan...' : '🏃 Jalankan Migrasi'}
        </SafeButton>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${result.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {result.error || result.message}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
