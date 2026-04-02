'use client'

import { useEffect, useState } from 'react'
import { getActiveBranchIdAction, getActiveOrgIdAction } from '@/modules/organization/actions/org-id.actions'

const ACTIVE_ORG_CHANGE_EVENT = 'nizam_active_org_change'
const ACTIVE_BRANCH_CHANGE_EVENT = 'nizam_active_branch_change'

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

    const load = () => {
      setLoading(true)
      getActiveOrgIdAction().then((id) => {
        if (!cancelled) {
          setOrgId(id)
          setLoading(false)
        }
      })
    }

    const handleOrgChange = () => {
      load()
    }

    load()
    window.addEventListener(ACTIVE_ORG_CHANGE_EVENT, handleOrgChange)

    return () => {
      cancelled = true
      window.removeEventListener(ACTIVE_ORG_CHANGE_EVENT, handleOrgChange)
    }
  }, [])

  return { orgId, loading }
}

/**
 * Hook that returns the VERIFIED active branch_id for the current org.
 * Returns null when all units are selected or when the persisted cookie is invalid.
 */
export function useActiveBranchId(orgId: string | null | undefined) {
  const [branchId, setBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      if (!orgId) {
        setBranchId(null)
        setLoading(false)
        return
      }

      setLoading(true)
      getActiveBranchIdAction(orgId).then((id) => {
        if (!cancelled) {
          setBranchId(id)
          setLoading(false)
        }
      })
    }

    const handleOrgChange = () => {
      load()
    }

    const handleBranchChange = () => {
      load()
    }

    load()
    window.addEventListener(ACTIVE_ORG_CHANGE_EVENT, handleOrgChange)
    window.addEventListener(ACTIVE_BRANCH_CHANGE_EVENT, handleBranchChange)

    return () => {
      cancelled = true
      window.removeEventListener(ACTIVE_ORG_CHANGE_EVENT, handleOrgChange)
      window.removeEventListener(ACTIVE_BRANCH_CHANGE_EVENT, handleBranchChange)
    }
  }, [orgId])

  return { branchId, loading }
}

/** No-op export kept for compatibility — cleanup now handled server-side */
export function clearActiveOrgIdCookie() {}
