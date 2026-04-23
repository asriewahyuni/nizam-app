'use client'

/**
 * components/shared/SentryUserContext.tsx
 *
 * Menempelkan konteks user/org aktif ke scope Sentry di browser.
 * Tujuannya agar error client-side lebih mudah dilacak ke tenant dan role.
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { buildSentryActorContext, type SentryActorContextInput } from '@/lib/monitoring/sentry'

type Props = SentryActorContextInput

export function SentryUserContext(props: Props) {
  useEffect(() => {
    const actor = buildSentryActorContext(props)

    Sentry.setUser(actor.user)

    Object.entries(actor.tags).forEach(([key, value]) => {
      if (value) {
        Sentry.setTag(key, value)
      }
    })

    Sentry.setContext('organization', actor.context.organization)
    Sentry.setContext('branch', actor.context.branch)

    return () => {
      Sentry.setUser(null)
      Sentry.setContext('organization', null)
      Sentry.setContext('branch', null)
    }
  }, [
    props.userId,
    props.email,
    props.fullName,
    props.orgId,
    props.orgName,
    props.branchId,
    props.branchName,
    props.role,
    props.route,
    props.feature,
  ])

  return null
}
