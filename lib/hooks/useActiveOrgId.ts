'use client'

import { useEffect, useState } from 'react'
import { getActiveOrgIdAction } from '@/modules/organization/actions/org-id.actions'

/**
 * Hook that returns the VERIFIED active org_id for the current user.
 * - Calls server action (mirrors getActiveOrg() logic exactly)
 * - Handles demo cookie, multi-org, and regular users correctly
 * - Single source of truth — no client-side cookie guessing
 */
export function useActiveOrgId() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getActiveOrgIdAction().then((id) => {
      if (!cancelled) {
        setOrgId(id)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [])

  return { orgId, loading }
}

/** No-op export kept for compatibility — cleanup now handled server-side */
export function clearActiveOrgIdCookie() {}
