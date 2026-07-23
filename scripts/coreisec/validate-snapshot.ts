/**
 * Validasi snapshot tanpa database: checksum, jumlah, duplikasi, urutan, dan
 * seluruh referensi antar-entity.
 */
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import {
  canonicalJson,
  isRecord,
  parseEnvelope,
  parseManifest,
  type CoreisecEntityType,
  type MigrationEnvelope,
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

function requiredReference(
  envelope: MigrationEnvelope,
  payloadField: string,
  targetType: CoreisecEntityType,
) {
  const value = String(envelope.payload[payloadField] || '').trim()
  return value ? { targetType, externalId: value, payloadField } : null
}

function references(envelope: MigrationEnvelope) {
  const list: Array<{
    targetType: CoreisecEntityType
    externalId: string
    payloadField: string
  } | null> = []
  if (envelope.entityType === 'section') {
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
  } else if (envelope.entityType === 'lesson') {
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
    if (envelope.payload.sectionExternalId) {
      list.push(requiredReference(envelope, 'sectionExternalId', 'section'))
    }
  } else if (envelope.entityType === 'lesson_asset') {
    list.push(requiredReference(envelope, 'lessonExternalId', 'lesson'))
  } else if (envelope.entityType === 'quiz' || envelope.entityType === 'assignment') {
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
    if (envelope.payload.lessonExternalId) {
      list.push(requiredReference(envelope, 'lessonExternalId', 'lesson'))
    }
  } else if (envelope.entityType === 'question') {
    list.push(requiredReference(envelope, 'quizExternalId', 'quiz'))
  } else if (envelope.entityType === 'product_course') {
    list.push(requiredReference(envelope, 'productExternalId', 'product'))
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
  } else if (envelope.entityType === 'enrollment') {
    list.push(requiredReference(envelope, 'userExternalId', 'user'))
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
    if (envelope.payload.batchExternalId) {
      list.push(requiredReference(envelope, 'batchExternalId', 'batch'))
    }
  } else if (envelope.entityType === 'progress') {
    list.push(requiredReference(envelope, 'enrollmentExternalId', 'enrollment'))
    list.push(requiredReference(envelope, 'lessonExternalId', 'lesson'))
  } else if (envelope.entityType === 'subscription') {
    list.push(requiredReference(envelope, 'userExternalId', 'user'))
    list.push(requiredReference(envelope, 'productExternalId', 'product'))
  } else if (envelope.entityType === 'affiliate') {
    list.push(requiredReference(envelope, 'userExternalId', 'user'))
  } else if (envelope.entityType === 'order_archive' && envelope.payload.userExternalId) {
    list.push(requiredReference(envelope, 'userExternalId', 'user'))
  } else if (envelope.entityType === 'commission') {
    list.push(requiredReference(envelope, 'affiliateExternalId', 'affiliate'))
  } else if (envelope.entityType === 'certificate') {
    list.push(requiredReference(envelope, 'userExternalId', 'user'))
    list.push(requiredReference(envelope, 'courseExternalId', 'course'))
    if (envelope.payload.enrollmentExternalId) {
      list.push(requiredReference(envelope, 'enrollmentExternalId', 'enrollment'))
    }
  }
  return list.filter((item): item is NonNullable<typeof item> => Boolean(item))
}

async function main() {
  const sourceDir = resolve(argValue('source-dir'))
  if (!argValue('source-dir')) throw new Error('Gunakan --source-dir <folder>.')
  const manifest = parseManifest(
    JSON.parse(readFileSync(resolve(sourceDir, 'manifest.json'), 'utf8')),
  )
  const seen = new Map<CoreisecEntityType, Set<string>>()
  const counts = new Map<CoreisecEntityType, number>()
  const aggregates = new Map<CoreisecEntityType, ReturnType<typeof createHash>>()
  const unresolved: string[] = []
  let activeUserCount = 0
  let deletedUserReferenceCount = 0
  let publishedProductCount = 0
  let draftProductCount = 0
  let archivedProductCount = 0
  let lineNumber = 0
  const input = createInterface({
    input: createReadStream(resolve(sourceDir, 'entities.ndjson'), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const rawLine of input) {
    lineNumber += 1
    if (!rawLine.trim()) continue
    const envelope = parseEnvelope(JSON.parse(rawLine))
    if (envelope.entityType === 'user') {
      if (envelope.payload.sourceDeleted === true) deletedUserReferenceCount += 1
      else activeUserCount += 1
    } else if (envelope.entityType === 'product') {
      const source = isRecord(envelope.payload.sourceSnapshot)
        ? envelope.payload.sourceSnapshot
        : {}
      if (source.postStatus === 'trash') archivedProductCount += 1
      else if (envelope.payload.published === true) publishedProductCount += 1
      else draftProductCount += 1
    }
    const expected = sha256(canonicalJson(envelope.payload))
    if (expected !== envelope.checksum) {
      throw new Error(`Checksum baris ${lineNumber} tidak cocok.`)
    }
    if (!seen.has(envelope.entityType)) seen.set(envelope.entityType, new Set())
    if (seen.get(envelope.entityType)!.has(envelope.externalId)) {
      throw new Error(`Duplikat ${envelope.entityType}:${envelope.externalId}.`)
    }
    for (const reference of references(envelope)) {
      if (!seen.get(reference.targetType)?.has(reference.externalId)) {
        unresolved.push(
          `${envelope.entityType}:${envelope.externalId}.${reference.payloadField}`
          + ` -> ${reference.targetType}:${reference.externalId}`,
        )
      }
    }
    seen.get(envelope.entityType)!.add(envelope.externalId)
    counts.set(envelope.entityType, (counts.get(envelope.entityType) || 0) + 1)
    if (!aggregates.has(envelope.entityType)) {
      aggregates.set(envelope.entityType, createHash('sha256'))
    }
    aggregates.get(envelope.entityType)!.update(
      `${envelope.externalId}:${envelope.checksum}\n`,
    )
  }
  if (unresolved.length > 0) {
    throw new Error(
      `${unresolved.length} referensi belum tersedia/urutannya salah:\n`
      + unresolved.slice(0, 30).join('\n'),
    )
  }
  for (const [entityType, count] of Object.entries(manifest.counts)) {
    if (count !== (counts.get(entityType as CoreisecEntityType) || 0)) {
      throw new Error(`Jumlah ${entityType} berbeda dari manifest.`)
    }
  }
  for (const [entityType, hash] of aggregates) {
    const actual = hash.digest('hex')
    if (actual !== manifest.aggregateChecksums[entityType]) {
      throw new Error(`Checksum agregat ${entityType} berbeda.`)
    }
  }
  const lockedBaseline = {
    course: 74,
    lesson: 774,
    lesson_asset: 1118,
    progress: 731,
    order_archive: 2228,
    subscription: 197,
    coupon: 73,
    commission: 259,
    media: 650,
  } satisfies Partial<Record<CoreisecEntityType, number>>
  const baselineVariance = Object.entries(lockedBaseline)
    .filter(([entityType, expected]) => counts.get(entityType as CoreisecEntityType) !== expected)
    .map(([entityType, expected]) => ({
      entityType,
      expected,
      actual: counts.get(entityType as CoreisecEntityType) || 0,
    }))
  if (activeUserCount !== 1266) {
    baselineVariance.push({
      entityType: 'active_user',
      expected: 1266,
      actual: activeUserCount,
    })
  }
  if (publishedProductCount !== 148) {
    baselineVariance.push({
      entityType: 'published_product',
      expected: 148,
      actual: publishedProductCount,
    })
  }
  console.log(JSON.stringify({
    snapshotId: manifest.snapshotId,
    lineCount: lineNumber,
    counts: Object.fromEntries(counts),
    unresolvedReferences: 0,
    duplicateExternalIds: 0,
    sourcePopulation: {
      activeUsers: activeUserCount,
      deletedUserReferences: deletedUserReferenceCount,
      publishedProducts: publishedProductCount,
      draftProducts: draftProductCount,
      archivedProducts: archivedProductCount,
    },
    baselineVariance,
    result: baselineVariance.length === 0 ? 'LULUS' : 'LULUS_DENGAN_VARIANSI',
  }, null, 2))
  if (baselineVariance.length > 0) process.exitCode = 2
}

main().catch((error: unknown) => {
  console.error(`[coreisec:validate] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
