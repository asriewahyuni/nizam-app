'use client'

import { useState } from 'react'

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  async function run() {
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/koperasi-db-migrate')
      const json = await res.json()
      setResult(JSON.stringify(json, null, 2))
    } catch (e: any) {
      setResult('Error: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 20, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Migrasi Database Koperasi</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Jalankan sekali untuk membuat semua tabel koperasi di database.
      </p>
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: '10px 24px', fontSize: 16, fontWeight: 600,
          background: loading ? '#94a3b8' : '#2563eb', color: 'white',
          border: 'none', borderRadius: 8, cursor: 'pointer'
        }}
      >
        {loading ? 'Menjalankan...' : '🏃 Jalankan Migrasi'}
      </button>
      {result && (
        <pre style={{ marginTop: 20, padding: 16, background: '#f1f5f9', borderRadius: 8, overflow: 'auto' }}>
          {result}
        </pre>
      )}
    </div>
  )
}
