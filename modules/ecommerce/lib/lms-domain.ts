/**
 * Kontrak domain publik LMS dan helper URL tenant yang dipakai storefront,
 * portal member, serta pemutar course.
 */
import { generateSlug } from '@/lib/utils'

export type LmsDomainRootBehavior = 'STOREFRONT' | 'LOGIN'
export type LmsDomainStatus = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'DISABLED'
export type LmsDomainProviderMode = 'MANUAL' | 'RAILWAY' | 'RAILWAY_CLOUDFLARE'

export type LmsDomainDnsRecord = {
  type: string
  name: string
  value: string
  status?: string
  proxied?: boolean
}

export type LmsTenantDomainView = {
  id: string
  orgId: string
  storeId: string | null
  hostname: string
  purpose: 'LMS' | 'MEMBER_PORTAL'
  rootBehavior: LmsDomainRootBehavior
  status: LmsDomainStatus
  providerMode: LmsDomainProviderMode
  isPrimary: boolean
  dnsStatus: string
  certificateStatus: string
  requiredDnsRecords: LmsDomainDnsRecord[]
  lastCheckedAt: string | null
  lastError: string | null
  verifiedAt: string | null
}

export type ResolvedLmsTenantDomain = {
  domainId: string
  orgId: string
  orgSlug: string
  orgName: string
  storeId: string | null
  storeSlug: string | null
  rootBehavior: LmsDomainRootBehavior
  purpose: 'LMS' | 'MEMBER_PORTAL'
}

export type LmsPublicRouteContext = {
  customDomain: boolean
  orgSlug: string
  storeSlug: string | null
}

const RESERVED_SLUGS = new Set([
  'api',
  'auth',
  'catalog',
  'course',
  'dashboard',
  'ecommerce',
  'learn',
  'login',
  'logout',
  'lms',
  'member',
  'order',
  'product',
  'register',
  'toko',
])

export function normalizeLmsHostname(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.$/, '')

  if (
    !raw
    || raw.length > 253
    || raw === 'localhost'
    || /^[0-9.]+$/.test(raw)
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw)
  ) {
    return ''
  }
  return raw
}

export function normalizePublicSlug(
  value: unknown,
  fallback: string,
  options?: { maxLength?: number; allowReserved?: boolean },
): string {
  const maxLength = Math.max(3, options?.maxLength || 120)
  const normalized = generateSlug(String(value || '')).slice(0, maxLength)
    || generateSlug(fallback).slice(0, maxLength)

  if (!normalized || normalized.length < 3) return ''
  if (!options?.allowReserved && RESERVED_SLUGS.has(normalized)) return ''
  return normalized
}

export function buildTenantPath(
  context: LmsPublicRouteContext,
  route:
    | { kind: 'home' }
    | { kind: 'catalog' }
    | { kind: 'product'; slug: string }
    | { kind: 'cart' }
    | { kind: 'order'; orderNumber: string }
    | { kind: 'dashboard' }
    | { kind: 'courses' }
    | { kind: 'my-courses' }
    | { kind: 'course'; slug: string }
    | { kind: 'learn'; courseSlug: string; lessonSlug: string }
    | { kind: 'member'; section: string },
): string {
  if (context.customDomain) {
    switch (route.kind) {
      case 'home': return '/'
      case 'catalog': return '/catalog'
      case 'product': return `/product/${route.slug}`
      case 'cart': return '/cart'
      case 'order': return `/order/${route.orderNumber}`
      case 'dashboard': return '/dashboard'
      case 'courses': return '/courses'
      case 'my-courses': return '/my-courses'
      case 'course': return `/course/${route.slug}`
      case 'learn': return `/learn/${route.courseSlug}/${route.lessonSlug}`
      case 'member': return `/${route.section.replace(/^\/+/, '')}`
    }
  }

  switch (route.kind) {
    case 'home':
    case 'dashboard':
      return `/member/${context.orgSlug}`
    case 'catalog':
      return context.storeSlug
        ? `/store/${context.orgSlug}/${context.storeSlug}/catalog`
        : `/member/${context.orgSlug}/katalog`
    case 'product':
      return context.storeSlug
        ? `/store/${context.orgSlug}/${context.storeSlug}/product/${route.slug}`
        : `/member/${context.orgSlug}/katalog`
    case 'cart':
      return context.storeSlug
        ? `/store/${context.orgSlug}/${context.storeSlug}/cart`
        : `/member/${context.orgSlug}/checkout`
    case 'order':
      return context.storeSlug
        ? `/store/${context.orgSlug}/${context.storeSlug}/order/${route.orderNumber}`
        : `/member/${context.orgSlug}/pesanan`
    case 'courses':
      return `/member/${context.orgSlug}/katalog`
    case 'my-courses':
      return `/member/${context.orgSlug}/kelas`
    case 'course':
      return `/lms/${context.orgSlug}/course/${route.slug}`
    case 'learn':
      return `/lms/${context.orgSlug}/learn/${route.courseSlug}/${route.lessonSlug}`
    case 'member':
      return `/member/${context.orgSlug}/${route.section.replace(/^\/+/, '')}`
  }
}
