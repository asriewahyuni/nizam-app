/**
 * sentry.server.config.ts
 *
 * Inisialisasi Sentry untuk runtime Node.js.
 * Wizard sudah membuat fondasinya, lalu kita arahkan ke helper internal
 * supaya konfigurasi client/server/edge konsisten dan aman.
 */

import * as Sentry from '@sentry/nextjs'
import { getServerSentryOptions } from '@/lib/monitoring/sentry'

Sentry.init(getServerSentryOptions())
