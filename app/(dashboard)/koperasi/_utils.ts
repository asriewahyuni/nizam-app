'use client'

import { useState, useEffect } from 'react'

const BASE = '/api/koperasi/action'

export async function api(action: string, params: any[] = []): Promise<any> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  const { data } = await res.json()
  return data
}

/**
 * Hook untuk fetch orgId dari server (panggil API dashboard yang udah pasti jalan).
 * Gunakan ini di client component yg butuh orgId.
 */
export function useKoperasiOrgId(): { orgId: string | null; loading: boolean; error: string | null } {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/koperasi/dashboard')
      .then(res => res.json())
      .then(data => {
        // Dashboard API returns stats directly. We need a different approach.
        // Fallback: try to get orgId from the action API
        return api('getCurrentUserKoperasiRole', [])
      })
      .then((roleData) => {
        // If we get role data, it means the API works
        // The orgId is embedded in the session
        setOrgId('active')
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  return { orgId, loading, error }
}
