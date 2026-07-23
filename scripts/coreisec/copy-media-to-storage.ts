/**
 * Menyalin media WordPress ke object storage secara resumable. Ukuran dan SHA-256
 * diverifikasi sebelum referensi konten diperbarui.
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { connectPostgresClient, closePostgresPool } from '../../lib/db/postgres'

type MediaRow = {
  id: string
  org_id: string
  external_id: string
  source_url: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  expected_checksum_sha256: string | null
  storage_key: string | null
}

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  throw new Error(`Environment ${names.join(' atau ')} wajib diisi.`)
}

function safeFileName(value: string) {
  const clean = value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'media'
}

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}

function allowedSourceUrl(raw: string, allowedHosts: Set<string>) {
  const parsed = new URL(raw)
  if (parsed.protocol !== 'https:' && !process.argv.includes('--allow-http')) {
    throw new Error(`URL media harus HTTPS: ${raw}`)
  }
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Host media tidak diizinkan: ${parsed.hostname}`)
  }
  return parsed
}

async function downloadAndHash(
  url: URL,
  destination: string,
  maximumBytes: number,
) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Nizam-Coreisec-Migrator/1.0' },
  })
  if (!response.ok || !response.body) {
    throw new Error(`Unduh gagal (${response.status}) untuk ${url.pathname}`)
  }
  const announcedLength = Number(response.headers.get('content-length') || 0)
  if (announcedLength > maximumBytes) {
    throw new Error(`Media melebihi batas ${maximumBytes} byte.`)
  }
  let bytes = 0
  const hash = createHash('sha256')
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      if (bytes > maximumBytes) {
        callback(new Error(`Media melebihi batas ${maximumBytes} byte.`))
        return
      }
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  await pipeline(
    Readable.fromWeb(response.body as never),
    meter,
    createWriteStream(destination, { flags: 'wx' }),
  )
  return {
    bytes,
    checksum: hash.digest('hex'),
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || null,
  }
}

async function main() {
  const orgId = argValue('org-id')
  if (!orgId) throw new Error('Gunakan --org-id <uuid>.')
  const limit = Math.max(1, Math.min(Number(argValue('limit') || 100), 1000))
  const maximumBytes = Math.max(
    1024,
    Number(argValue('max-bytes') || 2 * 1024 * 1024 * 1024),
  )
  const sourceBase = new URL(
    argValue('source-url')
      || process.env.COREISEC_BRIDGE_URL
      || 'https://coreisec.id',
  )
  const allowedHosts = new Set([
    sourceBase.hostname.toLowerCase(),
    `www.${sourceBase.hostname.toLowerCase().replace(/^www\./, '')}`,
  ])
  for (const host of String(process.env.COREISEC_MEDIA_ALLOWED_HOSTS || '').split(',')) {
    if (host.trim()) allowedHosts.add(host.trim().toLowerCase())
  }

  const endpoint = requiredEnv('RAILWAY_STORAGE_ENDPOINT', 'ENDPOINT')
  const bucket = requiredEnv('RAILWAY_STORAGE_BUCKET', 'BUCKET')
  const s3 = new S3Client({
    endpoint,
    region: String(process.env.RAILWAY_STORAGE_REGION || process.env.REGION || 'auto'),
    forcePathStyle: ['1', 'true', 'yes'].includes(
      String(process.env.RAILWAY_STORAGE_FORCE_PATH_STYLE || '').toLowerCase(),
    ) || endpoint.includes('storageapi.dev'),
    credentials: {
      accessKeyId: requiredEnv('RAILWAY_STORAGE_ACCESS_KEY_ID', 'ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('RAILWAY_STORAGE_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY'),
    },
  })
  const client = await connectPostgresClient()
  const tempDirectory = await mkdtemp(join(tmpdir(), 'nizam-coreisec-media-'))
  const totals = { selected: 0, copied: 0, skipped: 0, conflicts: 0 }
  try {
    const media = await client.query<MediaRow>(
      `SELECT
         id::text, org_id::text, external_id, source_url, file_name, mime_type,
         file_size_bytes::float8, expected_checksum_sha256, storage_key
       FROM public.migration_media_assets
       WHERE org_id = $1::uuid
         AND (
           copy_status IN ('PENDING', 'CONFLICT')
           OR (copy_status = 'COPYING' AND updated_at < NOW() - INTERVAL '30 minutes')
         )
       ORDER BY external_id
       LIMIT $2`,
      [orgId, limit],
    )
    totals.selected = media.rows.length

    for (const item of media.rows) {
      const sourceUrl = allowedSourceUrl(item.source_url, allowedHosts)
      const sourceName = safeFileName(
        item.file_name || decodeURIComponent(basename(sourceUrl.pathname)),
      )
      const storageKey = item.storage_key
        || `lms-media/${orgId}/wordpress/${item.external_id}/${sourceName}`
      await client.query(
        `UPDATE public.migration_media_assets
         SET copy_status = 'COPYING', storage_key = $2, last_error = NULL,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [item.id, storageKey],
      )
      const tempFile = join(tempDirectory, `${item.id}-${sourceName}`)
      try {
        let existingMatches = false
        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }))
          existingMatches = Boolean(
            head.Metadata?.sha256
            && (!item.expected_checksum_sha256
              || head.Metadata.sha256 === item.expected_checksum_sha256),
          )
        } catch {
          existingMatches = false
        }
        let checksum = item.expected_checksum_sha256
        let bytes = item.file_size_bytes
        if (!existingMatches) {
          const downloaded = await downloadAndHash(sourceUrl, tempFile, maximumBytes)
          checksum = downloaded.checksum
          bytes = downloaded.bytes
          if (
            item.expected_checksum_sha256
            && item.expected_checksum_sha256 !== downloaded.checksum
          ) {
            throw new Error(
              `Checksum berbeda: sumber ${item.expected_checksum_sha256}, `
              + `hasil ${downloaded.checksum}.`,
            )
          }
          if (item.file_size_bytes != null && item.file_size_bytes !== downloaded.bytes) {
            throw new Error(
              `Ukuran berbeda: sumber ${item.file_size_bytes}, hasil ${downloaded.bytes}.`,
            )
          }
          const file = await stat(tempFile)
          await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: createReadStream(tempFile),
            ContentLength: file.size,
            ContentType: item.mime_type || downloaded.contentType || 'application/octet-stream',
            CacheControl: 'private, max-age=300',
            Metadata: { sha256: downloaded.checksum, source: 'wordpress-coreisec' },
          }))
          totals.copied += 1
        } else {
          totals.skipped += 1
        }
        const stablePath = `/api/storage/lms/${encodeKey(storageKey)}`
        await client.query('BEGIN')
        try {
          await client.query(
            `UPDATE public.migration_media_assets SET
               copy_status = 'COPIED', actual_checksum_sha256 = $2,
               file_size_bytes = $3, storage_key = $4,
               last_error = NULL, copied_at = NOW(), updated_at = NOW()
             WHERE id = $1::uuid`,
            [item.id, checksum, bytes, storageKey],
          )
          await client.query(
            `UPDATE public.learning_lesson_assets SET
               storage_key = $3, checksum_sha256 = $4,
               file_size_bytes = COALESCE(file_size_bytes, $5), updated_at = NOW()
             WHERE org_id = $1::uuid
               AND (source_url = $2 OR external_id = $6)
               AND external_source = 'WORDPRESS_COREISEC'`,
            [orgId, item.source_url, storageKey, checksum, bytes, item.external_id],
          )
          await client.query(
            `UPDATE public.learning_lessons
             SET content_html = replace(content_html, $2, $3),
                 content_md = replace(content_md, $2, $3),
                 updated_at = NOW()
             WHERE org_id = $1::uuid
               AND (content_html LIKE '%' || $2 || '%' OR content_md LIKE '%' || $2 || '%')`,
            [orgId, item.source_url, stablePath],
          )
          await client.query(
            `UPDATE public.cms_content_entries
             SET content_html = replace(content_html, $2, $3), updated_at = NOW()
             WHERE org_id = $1::uuid AND content_html LIKE '%' || $2 || '%'`,
            [orgId, item.source_url, stablePath],
          )
          await client.query(
            `INSERT INTO public.cms_redirects (
               org_id, source_path, destination_url, status_code, is_active,
               external_source, external_id
             ) VALUES (
               $1::uuid, $2, $3, 307, TRUE, 'WORDPRESS_COREISEC', $4
             )
             ON CONFLICT (org_id, external_source, external_id)
               WHERE external_source IS NOT NULL AND external_id IS NOT NULL
             DO UPDATE SET
               source_path = EXCLUDED.source_path,
               destination_url = EXCLUDED.destination_url,
               status_code = EXCLUDED.status_code,
               is_active = TRUE, updated_at = NOW()`,
            [orgId, sourceUrl.pathname, stablePath, `media:${item.external_id}`],
          )
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        }
      } catch (error) {
        totals.conflicts += 1
        await client.query(
          `UPDATE public.migration_media_assets SET
             copy_status = 'CONFLICT', last_error = $2, updated_at = NOW()
           WHERE id = $1::uuid`,
          [item.id, error instanceof Error ? error.message : String(error)],
        )
      } finally {
        await rm(tempFile, { force: true })
      }
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
    client.release()
    await closePostgresPool()
    s3.destroy()
  }
  console.log(JSON.stringify(totals, null, 2))
  if (totals.conflicts > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(`[coreisec:media] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
