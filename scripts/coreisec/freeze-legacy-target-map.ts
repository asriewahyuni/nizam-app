/**
 * Mengunci pemetaan 4 course dan 125 lesson LearnPress yang sudah pernah
 * dipindahkan ke Nizam. Course dipetakan dengan UUID target yang disetujui;
 * lesson dipasangkan satu kali lewat slug warisan unik di dalam course itu,
 * lalu seluruh impor berikutnya memakai external ID, bukan judul.
 */
import { createReadStream, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { closePostgresPool, connectPostgresClient } from '../../lib/db/postgres'
import { parseEnvelope, parseManifest, type MigrationEnvelope } from './migration-types'

const SOURCE_SYSTEM = 'WORDPRESS_COREISEC'
const TARGET_ORG_ID = '475a4db7-b5c9-45f7-8282-31f72abb45ad'
const LOCKED_COURSE_TARGETS: Readonly<Record<string, string>> = {
  '87': '8d9ddc2f-ee0d-41cd-9685-9a32c1912fdf',
  '604': '68e6a146-c3f7-4147-930c-483ec3292ebf',
  '903': '8c7f3395-8cc7-430b-8a1f-3f68316aa120',
  '1393': 'e3377dba-ac0f-4b12-9c4e-06cbe4c5b041',
}

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function normalizedSlug(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

async function readLockedEntities(sourceDir: string) {
  const courses = new Map<string, MigrationEnvelope>()
  const lessons: MigrationEnvelope[] = []
  const input = createInterface({
    input: createReadStream(resolve(sourceDir, 'entities.ndjson'), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const rawLine of input) {
    if (!rawLine.trim()) continue
    const envelope = parseEnvelope(JSON.parse(rawLine))
    if (envelope.entityType === 'course' && LOCKED_COURSE_TARGETS[envelope.externalId]) {
      courses.set(envelope.externalId, envelope)
    } else if (
      envelope.entityType === 'lesson'
      && LOCKED_COURSE_TARGETS[String(envelope.payload.courseExternalId || '')]
    ) {
      lessons.push(envelope)
    }
  }
  if (courses.size !== 4 || lessons.length !== 125) {
    throw new Error(
      `Kontrak LearnPress berubah: ditemukan ${courses.size}/4 course dan `
      + `${lessons.length}/125 lesson.`,
    )
  }
  return { courses, lessons }
}

async function main() {
  const sourceDirValue = argValue('source-dir')
  if (!sourceDirValue) throw new Error('Gunakan --source-dir <folder snapshot>.')
  const sourceDir = resolve(sourceDirValue)
  const manifest = parseManifest(
    JSON.parse(readFileSync(resolve(sourceDir, 'manifest.json'), 'utf8')),
  )
  const apply = process.argv.includes('--apply')
  const source = await readLockedEntities(sourceDir)
  const client = await connectPostgresClient()

  try {
    await client.query('BEGIN')
    const targetCourses = await client.query<{
      id: string
      slug: string
      title: string
    }>(
      `SELECT id::text, slug, title
       FROM public.learning_courses
       WHERE org_id = $1::uuid
         AND id = ANY($2::uuid[])
       FOR UPDATE`,
      [TARGET_ORG_ID, Object.values(LOCKED_COURSE_TARGETS)],
    )
    if (targetCourses.rows.length !== 4) {
      throw new Error(`Target course lama hanya ditemukan ${targetCourses.rows.length}/4.`)
    }
    const targetCourseById = new Map(targetCourses.rows.map((row) => [row.id, row]))
    for (const [externalId, targetId] of Object.entries(LOCKED_COURSE_TARGETS)) {
      const sourceCourse = source.courses.get(externalId)!
      const targetCourse = targetCourseById.get(targetId)
      if (!targetCourse || targetCourse.slug !== normalizedSlug(sourceCourse.payload.slug)) {
        throw new Error(`UUID target course ${externalId} tidak lagi cocok dengan slug sumber.`)
      }
    }

    const targetLessons = await client.query<{
      id: string
      course_id: string
      slug: string
    }>(
      `SELECT id::text, course_id::text, slug
       FROM public.learning_lessons
       WHERE org_id = $1::uuid
         AND course_id = ANY($2::uuid[])
       FOR UPDATE`,
      [TARGET_ORG_ID, Object.values(LOCKED_COURSE_TARGETS)],
    )
    const lessonByCourseAndSlug = new Map<string, string[]>()
    for (const row of targetLessons.rows) {
      const key = `${row.course_id}:${normalizedSlug(row.slug)}`
      const ids = lessonByCourseAndSlug.get(key) || []
      ids.push(row.id)
      lessonByCourseAndSlug.set(key, ids)
    }

    const lessonTargets = new Map<string, string>()
    const usedTargetLessons = new Set<string>()
    for (const sourceLesson of source.lessons) {
      const sourceCourseId = String(sourceLesson.payload.courseExternalId)
      const targetCourseId = LOCKED_COURSE_TARGETS[sourceCourseId]
      const key = `${targetCourseId}:${normalizedSlug(sourceLesson.payload.slug)}`
      const candidates = lessonByCourseAndSlug.get(key) || []
      if (candidates.length !== 1) {
        throw new Error(
          `Lesson ${sourceLesson.externalId} memiliki ${candidates.length} `
          + `target untuk slug ${String(sourceLesson.payload.slug)}.`,
        )
      }
      if (usedTargetLessons.has(candidates[0])) {
        throw new Error(`Target lesson ${candidates[0]} dipakai lebih dari satu external ID.`)
      }
      usedTargetLessons.add(candidates[0])
      lessonTargets.set(sourceLesson.externalId, candidates[0])
    }
    if (lessonTargets.size !== 125 || usedTargetLessons.size !== 125) {
      throw new Error('Pemetaan lesson tidak satu-banding-satu.')
    }

    const mappings = [
      ...Array.from(source.courses.values()).map((envelope) => ({
        envelope,
        targetTable: 'learning_courses',
        targetId: LOCKED_COURSE_TARGETS[envelope.externalId],
        basis: 'LOCKED_TARGET_UUID',
      })),
      ...source.lessons.map((envelope) => ({
        envelope,
        targetTable: 'learning_lessons',
        targetId: lessonTargets.get(envelope.externalId)!,
        basis: 'LOCKED_COURSE_UUID_AND_UNIQUE_LEGACY_SLUG',
      })),
    ]

    for (const mapping of mappings) {
      const existing = await client.query<{ target_id: string }>(
        `SELECT target_id::text
         FROM public.migration_entity_map
         WHERE org_id = $1::uuid
           AND source_system = $2
           AND entity_type = $3
           AND external_id = $4
         FOR UPDATE`,
        [
          TARGET_ORG_ID,
          SOURCE_SYSTEM,
          mapping.envelope.entityType,
          mapping.envelope.externalId,
        ],
      )
      if (existing.rows[0] && existing.rows[0].target_id !== mapping.targetId) {
        throw new Error(
          `Mapping ${mapping.envelope.entityType}:${mapping.envelope.externalId} `
          + 'sudah menunjuk target berbeda.',
        )
      }
      await client.query(
        `INSERT INTO public.migration_entity_map (
           org_id, source_system, entity_type, external_id, target_table,
           target_id, source_checksum, source_updated_at, metadata
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6::uuid, NULL, $7::timestamptz, $8::jsonb
         )
         ON CONFLICT (org_id, source_system, entity_type, external_id) DO UPDATE SET
           target_table = EXCLUDED.target_table,
           target_id = EXCLUDED.target_id,
           source_updated_at = EXCLUDED.source_updated_at,
           metadata = EXCLUDED.metadata`,
        [
          TARGET_ORG_ID,
          SOURCE_SYSTEM,
          mapping.envelope.entityType,
          mapping.envelope.externalId,
          mapping.targetTable,
          mapping.targetId,
          mapping.envelope.updatedAt,
          JSON.stringify({
            reconciliationBasis: mapping.basis,
            snapshotId: manifest.snapshotId,
            frozenAt: new Date().toISOString(),
          }),
        ],
      )
    }

    if (apply) await client.query('COMMIT')
    else await client.query('ROLLBACK')
    console.log(JSON.stringify({
      mode: apply ? 'APPLY' : 'DRY_RUN',
      snapshotId: manifest.snapshotId,
      coursesLocked: source.courses.size,
      lessonsLocked: lessonTargets.size,
      titleMatchingUsed: false,
      result: 'LULUS',
    }, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await closePostgresPool()
  }
}

main().catch((error: unknown) => {
  console.error(
    `[coreisec:mapping] ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
})
