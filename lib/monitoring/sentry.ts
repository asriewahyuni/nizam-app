/**
 * lib/monitoring/sentry.ts
 *
 * Konfigurasi Sentry yang dibagi ke client/server/edge.
 * Fokusnya sengaja konservatif:
 * - hanya error tracking dasar
 * - tracing/replay dimatikan dulu
 * - data sensitif dibersihkan sebelum event dikirim
 */

import type { Breadcrumb, ErrorEvent } from '@sentry/core'
import type { BrowserOptions } from '@sentry/react'
import type { VercelEdgeOptions } from '@sentry/vercel-edge'
import type { NodeOptions } from '@sentry/node'

const REDACTED_VALUE = '[REDACTED]'
const MAX_REDACTION_DEPTH = 6
const SENTRY_IGNORE_ERRORS = [/NEXT_REDIRECT/i, /NEXT_NOT_FOUND/i]
const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /session/i,
  /key_hash/i,
  /webhook_secret/i,
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function shouldRedactKey(key: string) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function sanitizeUrl(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return raw

  try {
    const url = new URL(raw)
    for (const key of Array.from(url.searchParams.keys())) {
      if (shouldRedactKey(key)) {
        url.searchParams.set(key, REDACTED_VALUE)
      }
    }
    return url.toString()
  } catch {
    return raw
  }
}

function redactValue(value: unknown, depth: number = 0): unknown {
  if (depth >= MAX_REDACTION_DEPTH) return '[Truncated]'

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const sanitizedEntries = Object.entries(value).map(([key, nestedValue]) => {
    if (shouldRedactKey(key)) {
      return [key, REDACTED_VALUE]
    }

    if (key.toLowerCase() === 'url') {
      return [key, sanitizeUrl(nestedValue)]
    }

    return [key, redactValue(nestedValue, depth + 1)]
  })

  return Object.fromEntries(sanitizedEntries)
}

function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  const nextEvent: ErrorEvent = { ...event }

  if (nextEvent.request) {
    nextEvent.request = {
      ...nextEvent.request,
      url: sanitizeUrl(nextEvent.request.url),
      data: redactValue(nextEvent.request.data),
      headers: redactValue(nextEvent.request.headers) as Record<string, string> | undefined,
      cookies: redactValue(nextEvent.request.cookies) as Record<string, string> | undefined,
    }
  }

  if (nextEvent.user) {
    nextEvent.user = redactValue(nextEvent.user) as ErrorEvent['user']
  }

  if (nextEvent.extra) {
    nextEvent.extra = redactValue(nextEvent.extra) as ErrorEvent['extra']
  }

  if (nextEvent.contexts) {
    nextEvent.contexts = redactValue(nextEvent.contexts) as ErrorEvent['contexts']
  }

  return nextEvent
}

function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    data: redactValue(breadcrumb.data) as Breadcrumb['data'],
  }
}

function getSentryDsn() {
  return String(
    process.env.NEXT_PUBLIC_SENTRY_DSN
    || process.env.SENTRY_DSN
    || ''
  ).trim() || undefined
}

function getSentryEnvironment() {
  return String(
    process.env.SENTRY_ENVIRONMENT
    || process.env.VERCEL_ENV
    || process.env.NODE_ENV
    || 'development'
  ).trim()
}

function isSentryEnabled() {
  return Boolean(getSentryDsn()) && process.env.SENTRY_ENABLED !== 'false'
}

function buildCommonOptions() {
  return {
    dsn: getSentryDsn(),
    enabled: isSentryEnabled(),
    environment: getSentryEnvironment(),
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    normalizeDepth: 6,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend(event: ErrorEvent) {
      return sanitizeEvent(event)
    },
    beforeBreadcrumb(breadcrumb: Breadcrumb) {
      return sanitizeBreadcrumb(breadcrumb)
    },
  }
}

export function getClientSentryOptions(): BrowserOptions {
  return {
    ...buildCommonOptions(),
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  }
}

export function getServerSentryOptions(): NodeOptions {
  return {
    ...buildCommonOptions(),
    tracesSampleRate: 0,
  }
}

export function getEdgeSentryOptions(): VercelEdgeOptions {
  return {
    ...buildCommonOptions(),
    tracesSampleRate: 0,
  }
}
