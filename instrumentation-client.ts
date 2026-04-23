/**
 * instrumentation-client.ts
 *
 * Init Sentry di browser sebelum aplikasi interaktif.
 */

import * as Sentry from '@sentry/nextjs'
import { getClientSentryOptions } from '@/lib/monitoring/sentry'

Sentry.init(getClientSentryOptions())

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
