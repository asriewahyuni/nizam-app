'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function KoperasiDashboardPage() {
  const [data, setData] = useState<string>('Loading...')

  useEffect(() => {
    fetch('/api/koperasi/dashboard')
      .then(res => res.json())
      .then(d => setData(JSON.stringify(d, null, 2)))
      .catch(e => setData('Error: ' + e.message))
  }, [])

  return (
    <div className="min-h-screen bg-[#07080a] p-8">
      <h1 className="text-2xl font-semibold text-white mb-4">Koperasi Syariah</h1>
      <pre className="text-white/70 text-sm whitespace-pre-wrap">{data}</pre>
    </div>
  )
}
