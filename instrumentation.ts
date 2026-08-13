/**
 * instrumentation.ts
 *
 * Titik masuk observability Next.js:
 * - memuat init Sentry untuk runtime node dan edge
 * - meneruskan server/request errors ke Sentry
 */

import * as Sentry from '@sentry/nextjs'
import { buildRequestErrorContext } from '@/lib/monitoring/request-error-context'

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
  // Context disanitasi: headers, payload, parameter query, dan detail nilai DB tidak dikirim.
  try {
    const { sendSlackNotification } = await import('@/lib/slack/client')
    const errorContext = buildRequestErrorContext(err, req, ctx)
    await sendSlackNotification({
      message: `*Unhandled Request Error*\n${errorContext.ErrorCategory} pada ${errorContext.Method} ${errorContext.RequestPath}`,
      level: 'error',
      context: errorContext,
    })
  } catch {
    // Ignore Slack failure to prevent cascading errors.
  }
}
