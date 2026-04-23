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

export const onRequestError = Sentry.captureRequestError
