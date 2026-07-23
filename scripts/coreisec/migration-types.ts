/**
 * Kontrak snapshot Coreisec. Format NDJSON menjaga ekspor besar tetap dapat
 * diproses streaming tanpa memuat seluruh data ke memori.
 */
export const COREISEC_ENTITY_TYPES = [
  'user',
  'course',
  'section',
  'lesson',
  'lesson_asset',
  'instructor',
  'course_instructor',
  'batch',
  'session',
  'enrollment',
  'progress',
  'quiz',
  'question',
  'assignment',
  'product',
  'product_variant',
  'product_course',
  'order_bump',
  'access_package',
  'membership',
  'order_archive',
  'subscription',
  'coupon',
  'affiliate',
  'affiliate_rule',
  'commission',
  'certificate',
  'cms_content',
  'cms_redirect',
  'media',
] as const

export type CoreisecEntityType = typeof COREISEC_ENTITY_TYPES[number]

export type CoreisecManifest = {
  schemaVersion: 1
  sourceSystem: 'WORDPRESS_COREISEC'
  snapshotId: string
  exportedAt: string
  sourceUrl: string
  counts: Partial<Record<CoreisecEntityType, number>>
  aggregateChecksums: Partial<Record<CoreisecEntityType, string>>
  target?: {
    orgId?: string
    storeId?: string
  }
}

export type MigrationEnvelope = {
  entityType: CoreisecEntityType
  externalId: string
  updatedAt: string | null
  checksum: string
  payload: Record<string, unknown>
}

export type UserPayload = {
  email: string
  username: string
  displayName: string
  passwordHash: string
  roles: string[]
  registeredAt: string | null
  profile: Record<string, unknown>
  sourceDeleted?: boolean
}

export type CoursePayload = {
  slug: string
  title: string
  descriptionHtml: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  level: string | null
  featured: boolean
  listed: boolean
  previewVideoUrl: string | null
  durationMinutes: number | null
  outcomes: string[]
  accessDurationValue: number | null
  accessDurationUnit: string | null
  closedAccessMessage: string | null
  seoTitle: string | null
  seoDescription: string | null
  targetId?: string | null
}

export type SectionPayload = {
  courseExternalId: string
  title: string
  description: string | null
  sortOrder: number
}

export type LessonPayload = {
  courseExternalId: string
  sectionExternalId: string | null
  slug: string
  title: string
  lessonType: string
  contentHtml: string
  sortOrder: number
  required: boolean
  preview: boolean
  durationSeconds: number | null
  dripValue: number | null
  dripUnit: string | null
  embedProvider: string | null
  embedUrl: string | null
  mediaItems: unknown[]
  targetId?: string | null
}

export type LessonAssetPayload = {
  lessonExternalId: string
  assetType: 'VIDEO' | 'DOCUMENT' | 'IMAGE' | 'AUDIO' | 'LINK' | 'EMBED' | 'OTHER'
  title: string
  sourceUrl: string | null
  storageKey: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  checksumSha256: string | null
  downloadable: boolean
  sortOrder: number
}

export type EnrollmentPayload = {
  userExternalId: string
  courseExternalId: string
  batchExternalId: string | null
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  startedAt: string | null
  completedAt: string | null
  finalScore: number | null
}

export type ProgressPayload = {
  enrollmentExternalId: string
  lessonExternalId: string
  status: 'VIEWED' | 'COMPLETED'
  viewedAt: string | null
  completedAt: string | null
  lastPositionSeconds: number
}

export type ProductPayload = {
  slug: string
  name: string
  descriptionHtml: string
  sku: string | null
  physical: boolean
  regularPrice: number
  salePrice: number | null
  published: boolean
  featured: boolean
  quantityEnabled: boolean
  purchaseLimitPerUser: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
  followUpContent: unknown[]
  analyticsConfig: Record<string, unknown>
  sourceSnapshot: Record<string, unknown>
}

export type ProductCoursePayload = {
  productExternalId: string
  courseExternalId: string
  accessDurationValue: number | null
  accessDurationUnit: string | null
}

export type OrderArchivePayload = {
  userExternalId: string | null
  orderNumber: string
  customerEmail: string | null
  status: string
  currency: string
  totalAmount: number
  orderedAt: string | null
  completedAt: string | null
  grantsAccess: boolean
  needsReview: boolean
  sourceSnapshot: Record<string, unknown>
}

export type CmsContentPayload = {
  contentType: 'PAGE' | 'ARTICLE'
  slug: string
  title: string
  excerpt: string | null
  contentHtml: string
  featuredImageStorageKey: string | null
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  analyticsConfig: Record<string, unknown>
}

export type MediaPayload = {
  sourceUrl: string
  fileName: string
  mimeType: string | null
  fileSizeBytes: number | null
  checksumSha256: string | null
  storageKey: string | null
  parentExternalId: string | null
  altText: string | null
}

export function isCoreisecEntityType(value: unknown): value is CoreisecEntityType {
  return typeof value === 'string'
    && (COREISEC_ENTITY_TYPES as readonly string[]).includes(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseManifest(value: unknown): CoreisecManifest {
  if (!isRecord(value)) throw new Error('manifest.json bukan object.')
  if (value.schemaVersion !== 1) throw new Error('Versi schema snapshot belum didukung.')
  if (value.sourceSystem !== 'WORDPRESS_COREISEC') throw new Error('Sumber snapshot tidak dikenal.')
  if (typeof value.snapshotId !== 'string' || !value.snapshotId.trim()) {
    throw new Error('snapshotId wajib diisi.')
  }
  if (!isRecord(value.counts) || !isRecord(value.aggregateChecksums)) {
    throw new Error('Counts dan aggregateChecksums wajib tersedia.')
  }
  return value as CoreisecManifest
}

export function parseEnvelope(value: unknown): MigrationEnvelope {
  if (!isRecord(value)) throw new Error('Baris snapshot bukan object.')
  if (!isCoreisecEntityType(value.entityType)) throw new Error('entityType tidak dikenal.')
  if (typeof value.externalId !== 'string' || !value.externalId.trim()) {
    throw new Error('externalId wajib diisi.')
  }
  if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(value.checksum)) {
    throw new Error('Checksum entity tidak valid.')
  }
  if (!isRecord(value.payload)) throw new Error('Payload entity bukan object.')
  return value as MigrationEnvelope
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}
