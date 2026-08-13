/**
 * instrumentation.ts
 *
 * Titik masuk observability Next.js:
 * - memuat init Sentry untuk runtime node dan edge
 * - meneruskan server/request errors ke Sentry
 */

import * as Sentry from '@sentry/nextjs'
import {
  buildRequestErrorContext,
  buildUserErrorContext,
} from '@/lib/monitoring/request-error-context'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError: typeof Sentry.captureRequestError = async (err, req, ctx) => {
  Sentry.captureRequestError(err, req, ctx)

  // Next.js instrumentation exposes req.path (bukan req.url) serta route metadata di ctx.
  // Context disanitasi: header/cookie mentah, payload, parameter query, dan detail nilai DB tidak dikirim.
  try {
    const { sendSlackNotification } = await import('@/lib/slack/client')
    const errorContext = buildRequestErrorContext(err, req, ctx)
    let userContext = buildUserErrorContext(null)

    try {
      const { getInternalAuthSession } = await import('@/lib/auth/internal-auth.server')
      const { cookies } = await import('next/headers')
      const { queryPostgres } = await import('@/lib/db/postgres')
      const { ACTIVE_ORG_COOKIE } = await import('@/modules/organization/lib/org-context')
      const session = await getInternalAuthSession()

      if (session?.user) {
        const activeOrgId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
        let organization: { id: string; name: string; role: string | null } | null = null

        if (activeOrgId) {
          const membership = await queryPostgres<{ id: string; name: string; role: string | null }>(
            `SELECT o.id::text, o.name, om.role
             FROM public.organizations o
             LEFT JOIN public.org_members om
               ON om.org_id = o.id
              AND om.user_id = $2::uuid
              AND om.is_active = TRUE
             WHERE o.id = $1::uuid
             LIMIT 1`,
            [activeOrgId, session.user.id],
          )
          organization = membership.rows[0] || null
        }

        userContext = buildUserErrorContext({ user: session.user, organization })
      }
    } catch {
      // Identitas bersifat best-effort; kegagalan lookup tidak boleh menutupi error utama.
    }

    await sendSlackNotification({
      message: `*Unhandled Request Error*\n${errorContext.ErrorCategory} pada ${errorContext.Method} ${errorContext.RequestPath}`,
      level: 'error',
      context: { ...userContext, ...errorContext },
    })
  } catch {
    // Ignore Slack failure to prevent cascading errors.
  }
}
