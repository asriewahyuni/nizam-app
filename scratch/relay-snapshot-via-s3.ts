import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { readFileSync } from 'node:fs'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  return ''
}

async function main() {
  const endpoint = readEnv('RAILWAY_STORAGE_ENDPOINT')
  const region = readEnv('RAILWAY_STORAGE_REGION') || 'auto'
  const bucket = readEnv('RAILWAY_STORAGE_BUCKET')
  const accessKeyId = readEnv('RAILWAY_STORAGE_ACCESS_KEY_ID')
  const secretAccessKey = readEnv('RAILWAY_STORAGE_SECRET_ACCESS_KEY')
  const forcePathStyle = readEnv('RAILWAY_STORAGE_FORCE_PATH_STYLE') === 'true'

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Konfigurasi Railway Storage tidak lengkap.')
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  })

  const files = [
    { local: 'output/coreisec/coreisec-2026-07-27T04-57-40-453Z/manifest.json', key: 'coreisec-migration-tmp/manifest.json' },
    { local: 'output/coreisec/coreisec-2026-07-27T04-57-40-453Z/entities.ndjson', key: 'coreisec-migration-tmp/entities.ndjson' },
  ]

  const urls: Record<string, string> = {}
  for (const file of files) {
    const body = readFileSync(file.local)
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: file.key, Body: body }))
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: file.key }), { expiresIn: 3600 })
    urls[file.key] = url
    console.error(`Uploaded ${file.local} -> ${file.key} (${body.length} bytes)`)
  }

  console.log(JSON.stringify(urls, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
