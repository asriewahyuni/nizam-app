/**
 * sentry.edge.config.ts
 *
 * Inisialisasi Sentry untuk runtime Edge.
 */

import * as Sentry from '@sentry/nextjs'
import { getEdgeSentryOptions } from '@/lib/monitoring/sentry'

Sentry.init(getEdgeSentryOptions())
