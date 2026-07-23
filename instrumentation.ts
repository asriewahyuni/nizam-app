/**
 * instrumentation.ts
 *
 * Titik masuk observability Next.js:
 * - memuat init Sentry untuk runtime node dan edge
 * - meneruskan server/request errors ke Sentry
 */

import * as Sentry from '@sentry/nextjs'

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
  
  // Notify Slack for unhandled server errors
  try {
    const { sendSlackNotification } = await import('@/lib/slack/client')
    await sendSlackNotification({
      message: `*Unhandled Request Error*\nAn unexpected error occurred in the Next.js runtime.`,
      level: 'error',
      context: {
        ErrorMessage: err instanceof Error ? err.message : String(err),
        ErrorStack: err instanceof Error ? err.stack?.substring(0, 500) : 'N/A',
        Url: req?.url || 'Unknown URL',
        Method: req?.method || 'Unknown Method'
      }
    })
  } catch (slackError) {
    // Ignore Slack failure to prevent cascading errors
  }
}
