import 'server-only'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type ObjectUploadInput = {
  body: Buffer | Uint8Array | string
  key: string
  contentType: string
  cacheControl?: string
  contentDisposition?: string
}

type ObjectStorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  signedUrlTtlSeconds: number
}

const LOGO_PREFIX = 'logos/'
const EXPORT_PREFIX = 'exports/'
const RECEIPT_PREFIX = 'receipts/'
const AVATAR_PREFIX = 'avatars/'
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60

let cachedClient: S3Client | null = null
let cachedConfig: ObjectStorageConfig | null | undefined

/**
 * Membaca konfigurasi bucket Railway dari env lokal atau variable reference Railway.
 */
function readObjectStorageConfig(): ObjectStorageConfig | null {
  if (cachedConfig !== undefined) return cachedConfig

  const endpoint = readEnv('RAILWAY_STORAGE_ENDPOINT', 'ENDPOINT')
  const region = readEnv('RAILWAY_STORAGE_REGION', 'REGION') || 'auto'
  const bucket = readEnv('RAILWAY_STORAGE_BUCKET', 'BUCKET')
  const accessKeyId = readEnv('RAILWAY_STORAGE_ACCESS_KEY_ID', 'ACCESS_KEY_ID')
  const secretAccessKey = readEnv('RAILWAY_STORAGE_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY')

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    cachedConfig = null
    return cachedConfig
  }

  const forcePathStyleValue = readEnv('RAILWAY_STORAGE_FORCE_PATH_STYLE')
  const forcePathStyle =
    forcePathStyleValue
      ? ['1', 'true', 'yes'].includes(forcePathStyleValue.toLowerCase())
      : endpoint.includes('storageapi.dev')

  const signedUrlTtlSeconds = Math.max(
    60,
    Number(readEnv('RAILWAY_STORAGE_SIGNED_URL_TTL_SECONDS') || DEFAULT_SIGNED_URL_TTL_SECONDS)
  )

  cachedConfig = {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    signedUrlTtlSeconds,
  }

  return cachedConfig
}

function readEnv(...names: string[]): string {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }

  return ''
}

function getObjectStorageClient(): S3Client {
  if (cachedClient) return cachedClient

  const config = getRequiredObjectStorageConfig()

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return cachedClient
}

function getRequiredObjectStorageConfig(): ObjectStorageConfig {
  const config = readObjectStorageConfig()
  if (!config) {
    throw new Error('Bucket Railway belum dikonfigurasi di environment.')
  }

  return config
}

/**
 * Mengecek apakah integrasi bucket Railway sudah siap dipakai.
 */
export function isObjectStorageConfigured(): boolean {
  return Boolean(readObjectStorageConfig())
}

/**
 * Memudahkan pemisahan toggle per jenis file tanpa mematikan seluruh bucket.
 */
export function isObjectStorageFeatureEnabled(feature: 'logos' | 'exports'): boolean {
  if (!isObjectStorageConfigured()) return false

  const value = readEnv(
    feature === 'logos' ? 'RAILWAY_STORAGE_ENABLE_LOGO_UPLOADS' : 'RAILWAY_STORAGE_ENABLE_EXPORTS'
  )

  if (!value) return true
  return ['1', 'true', 'yes'].includes(value.toLowerCase())
}

/**
 * Upload file ke bucket Railway dengan metadata dasar agar browser tahu tipe filenya.
 */
export async function uploadObjectToStorage(input: ObjectUploadInput): Promise<void> {
  const config = getRequiredObjectStorageConfig()
  const client = getObjectStorageClient()

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.cacheControl,
    ContentDisposition: input.contentDisposition,
  }))
}

/**
 * Hapus file lama jika sebelumnya juga dikelola bucket Railway.
 */
export async function deleteObjectFromStorage(key: string): Promise<void> {
  if (!key) return

  const config = getRequiredObjectStorageConfig()
  const client = getObjectStorageClient()

  await client.send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }))
}

/**
 * Membuat link sementara agar file private bisa diakses langsung dari bucket.
 */
export async function createSignedStorageGetUrl(
  key: string,
  options?: {
    contentDisposition?: string
    contentType?: string
    expiresInSeconds?: number
  }
): Promise<string> {
  const config = getRequiredObjectStorageConfig()
  const client = getObjectStorageClient()

  return getSignedUrl(client, new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ResponseContentDisposition: options?.contentDisposition,
    ResponseContentType: options?.contentType,
  }), {
    expiresIn: options?.expiresInSeconds ?? config.signedUrlTtlSeconds,
  })
}

/**
 * Menyusun key file logo per organisasi agar mudah dicari dan dibersihkan.
 */
export function buildLogoStorageKey(orgId: string, originalFileName: string): string {
  const safeName = sanitizeFileName(originalFileName, 'logo')
  return `${LOGO_PREFIX}${orgId}/${Date.now()}-${safeName}`
}

/**
 * Menyusun key file export per organisasi dan per bulan.
 */
export function buildExportStorageKey(orgId: string, filename: string, dateFolder: string): string {
  const safeDateFolder = sanitizeFolderName(dateFolder)
  const [year = 'unknown', month = 'unknown'] = safeDateFolder.split('-')
  const safeName = sanitizeFileName(filename, 'export')
  return `${EXPORT_PREFIX}${orgId}/${year}/${month}/${safeName}`
}

/**
 * Menyusun key file nota reimburse per org/user agar mudah dibersihkan.
 */
export function buildReceiptStorageKey(orgId: string, userId: string, originalFileName: string): string {
  const safeName = sanitizeFileName(originalFileName, 'receipt')
  return `${RECEIPT_PREFIX}${orgId}/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${safeName}`
}

/**
 * Menyusun key file avatar karyawan per org/user.
 */
export function buildAvatarStorageKey(orgId: string, userId: string, originalFileName: string): string {
  const safeName = sanitizeFileName(originalFileName, 'avatar')
  return `${AVATAR_PREFIX}${orgId}/${userId}/${Date.now()}-${safeName}`
}

/**
 * Mengecek prefix nota reimburse untuk akses publik.
 */
export function isPublicReceiptStorageKey(key: string): boolean {
  return key.startsWith(RECEIPT_PREFIX)
}

/**
 * Mengecek prefix avatar karyawan untuk akses publik.
 */
export function isPublicAvatarStorageKey(key: string): boolean {
  return key.startsWith(AVATAR_PREFIX)
}

/**
 * URL stabil yang bisa disimpan di database untuk logo perusahaan.
 */
export function buildPublicStorageObjectPath(key: string): string {
  return `/api/storage/public/${encodeStorageKeyForPath(key)}`
}

/**
 * URL internal untuk download file private setelah lolos auth.
 */
export function buildPrivateStorageObjectPath(key: string): string {
  return `/api/storage/private/${encodeStorageKeyForPath(key)}`
}

/**
 * Mengecek prefix agar route publik tidak bocor ke file lain.
 */
export function isPublicLogoStorageKey(key: string): boolean {
  return key.startsWith(LOGO_PREFIX)
}

/**
 * Mengecek prefix export agar route private hanya melayani file laporan.
 */
export function isPrivateExportStorageKey(key: string): boolean {
  return key.startsWith(EXPORT_PREFIX)
}

/**
 * Mengambil key bucket dari URL logo internal yang kita simpan di database.
 */
export function extractManagedStorageKey(value: unknown): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null

  let path = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname
    } catch {
      return null
    }
  }

  const publicMatch = path.match(/^\/api\/storage\/public\/(.+)$/)
  if (publicMatch?.[1]) return decodeStorageKeyFromPath(publicMatch[1])

  const privateMatch = path.match(/^\/api\/storage\/private\/(.+)$/)
  if (privateMatch?.[1]) return decodeStorageKeyFromPath(privateMatch[1])

  return null
}

/**
 * Mengubah slug route kembali menjadi key S3 asli.
 */
export function decodeStorageKeySegments(segments: string[] | undefined): string {
  return decodeStorageKeyFromPath((segments || []).join('/'))
}

function encodeStorageKeyForPath(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function decodeStorageKeyFromPath(pathValue: string): string {
  return pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

function sanitizeFolderName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^0-9-]/g, '') || 'unknown'
}

function sanitizeFileName(value: string, fallbackBaseName: string): string {
  const trimmed = String(value || '').trim()
  const normalized = trimmed || fallbackBaseName
  const cleaned = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!cleaned) return fallbackBaseName

  if (cleaned.includes('.')) return cleaned
  return `${cleaned}.bin`
}
