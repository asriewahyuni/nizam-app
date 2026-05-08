/**
 * instrumentation-client.ts
 *
 * Init Sentry di browser sebelum aplikasi interaktif.
 */

import * as Sentry from '@sentry/nextjs'
import Clarity from '@microsoft/clarity'
import { getClientSentryOptions } from '@/lib/monitoring/sentry'

Sentry.init(getClientSentryOptions())

const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim()

if (clarityProjectId) {
  Clarity.init(clarityProjectId)
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
