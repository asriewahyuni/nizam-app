/**
 * Menjalankan exporter PHP read-only melalui SSH STDIN dan membangun snapshot
 * manifest + NDJSON dengan checksum kanonis.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import {
  canonicalJson,
  isCoreisecEntityType,
  isRecord,
  type CoreisecEntityType,
  type CoreisecManifest,
} from './migration-types'

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function main() {
  const host = argValue('ssh') || 'ubuntu@43.133.147.191'
  const wordpressRoot = argValue('wordpress-root') || '/var/www/coreisec.id'
  if (!/^[-a-z0-9_.]+@[-a-z0-9_.]+$/i.test(host)) throw new Error('Target SSH tidak valid.')
  if (!/^\/[a-z0-9_./-]+$/i.test(wordpressRoot)) throw new Error('Root WordPress tidak valid.')
  const snapshotId = argValue('snapshot-id')
    || `coreisec-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = resolve(argValue('output-dir') || `output/coreisec/${snapshotId}`)
  await mkdir(outputDir, { recursive: true })
  const partialPath = resolve(outputDir, 'entities.ndjson.partial')
  const entityPath = resolve(outputDir, 'entities.ndjson')
  await writeFile(partialPath, '', { flag: 'wx' })
  const exporterPath = resolve('scripts/coreisec/wordpress-export.php')
  const exporter = await readFile(exporterPath)
  const remoteCommand = `cd ${wordpressRoot} && sudo -u www-data php`
  const child = spawn('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=20',
    '-o', 'ServerAliveCountMax=6',
    host,
    remoteCommand,
  ], { stdio: ['pipe', 'pipe', 'pipe'] })
  const exitPromise = new Promise<number>((resolveCode) => {
    child.on('close', (code) => resolveCode(code ?? 1))
  })
  child.stdin.end(exporter)

  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += String(chunk).slice(0, 20_000) })
  const counts: Partial<Record<CoreisecEntityType, number>> = {}
  const aggregate = new Map<CoreisecEntityType, ReturnType<typeof createHash>>()
  const lines: string[] = []
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity })
  for await (const rawLine of reader) {
    const line = rawLine.trim()
    if (!line) continue
    const source = JSON.parse(line) as unknown
    if (!isRecord(source) || !isCoreisecEntityType(source.entityType)) {
      throw new Error(`Output exporter tidak dikenal: ${line.slice(0, 160)}`)
    }
    const externalId = String(source.externalId || '').trim()
    if (!externalId || !isRecord(source.payload)) {
      throw new Error(`Entity exporter tidak lengkap: ${line.slice(0, 160)}`)
    }
    const checksum = sha256(canonicalJson(source.payload))
    const envelope = {
      entityType: source.entityType,
      externalId,
      updatedAt: source.updatedAt == null ? null : String(source.updatedAt),
      checksum,
      payload: source.payload,
    }
    lines.push(`${JSON.stringify(envelope)}\n`)
    counts[source.entityType] = (counts[source.entityType] || 0) + 1
    if (!aggregate.has(source.entityType)) aggregate.set(source.entityType, createHash('sha256'))
    aggregate.get(source.entityType)!.update(`${externalId}:${checksum}\n`)
    if (lines.length >= 250) {
      await writeFile(partialPath, lines.join(''), { flag: 'a' })
      lines.length = 0
    }
  }
  if (lines.length > 0) await writeFile(partialPath, lines.join(''), { flag: 'a' })
  const exitCode = await exitPromise
  if (exitCode !== 0) {
    throw new Error(`Exporter remote gagal (${exitCode}): ${stderr.slice(0, 2_000)}`)
  }
  await rename(partialPath, entityPath)
  const aggregateChecksums: Partial<Record<CoreisecEntityType, string>> = {}
  for (const [entityType, hash] of aggregate) aggregateChecksums[entityType] = hash.digest('hex')
  const manifest: CoreisecManifest = {
    schemaVersion: 1,
    sourceSystem: 'WORDPRESS_COREISEC',
    snapshotId,
    exportedAt: new Date().toISOString(),
    sourceUrl: `ssh://${host}${wordpressRoot}`,
    counts,
    aggregateChecksums,
    target: {
      orgId: argValue('org-id') || undefined,
      storeId: argValue('store-id') || undefined,
    },
  }
  await writeFile(
    resolve(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  )
  console.log(JSON.stringify({
    snapshotId,
    outputDir,
    entityFile: basename(entityPath),
    counts,
    remoteFilesChanged: false,
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error(`[coreisec:export] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
