/**
 * Importer snapshot Coreisec yang dry-run, resumable, idempoten, dan mencatat
 * konflik. Format sumber: manifest.json + entities.ndjson.
 */
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { connectPostgresClient, closePostgresPool } from '../../lib/db/postgres'
import {
  COREISEC_ENTITY_TYPES,
  canonicalJson,
  parseEnvelope,
  parseManifest,
  type CoreisecEntityType,
  type MigrationEnvelope,
} from './migration-types'
import {
  getExistingChecksum,
  importEnvelope,
  upsertEntityMapping,
  type ImportContext,
} from './import-handlers'

type CliOptions = {
  sourceDir: string
  orgId: string
  storeId: string
  mode: 'DRY_RUN' | 'APPLY' | 'DELTA'
  failFast: boolean
}

type ImportCounts = Record<CoreisecEntityType, {
  seen: number
  applied: number
  skipped: number
  conflicts: number
}>

function argValue(name: string) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function parseOptions(): CliOptions {
  const sourceDir = argValue('source-dir')
  const orgId = argValue('org-id')
  const storeId = argValue('store-id')
  if (!sourceDir || !orgId || !storeId) {
    throw new Error(
      'Gunakan --source-dir <folder> --org-id <uuid> --store-id <uuid>. '
      + 'Tambahkan --apply atau --delta hanya setelah dry-run lulus.',
    )
  }
  return {
    sourceDir: resolve(sourceDir),
    orgId,
    storeId,
    mode: process.argv.includes('--delta')
      ? 'DELTA'
      : process.argv.includes('--apply')
        ? 'APPLY'
        : 'DRY_RUN',
    failFast: process.argv.includes('--fail-fast'),
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function emptyCounts(): ImportCounts {
  return Object.fromEntries(
    COREISEC_ENTITY_TYPES.map((entityType) => [
      entityType,
      { seen: 0, applied: 0, skipped: 0, conflicts: 0 },
    ]),
  ) as ImportCounts
}

async function assertTarget(options: CliOptions, client: Awaited<ReturnType<typeof connectPostgresClient>>) {
  const result = await client.query<{ org_id: string; store_id: string }>(
    `SELECT o.id::text AS org_id, s.id::text AS store_id
     FROM public.organizations o
     JOIN public.stores s ON s.org_id = o.id
     WHERE o.id = $1::uuid
       AND s.id = $2::uuid
       AND o.is_active = TRUE
       AND s.is_active = TRUE`,
    [options.orgId, options.storeId],
  )
  if (!result.rows[0]) {
    throw new Error('Organisasi/toko target tidak ditemukan atau tidak aktif.')
  }
}

async function createOrResumeRun(
  options: CliOptions,
  manifest: ReturnType<typeof parseManifest>,
  client: Awaited<ReturnType<typeof connectPostgresClient>>,
) {
  if (options.mode === 'DRY_RUN') return randomUUID()
  const result = await client.query<{ id: string }>(
    `INSERT INTO public.migration_runs (
       org_id, source_system, source_snapshot_id, mode, status,
       baseline_counts, started_at
     ) VALUES (
       $1::uuid, $2, $3, $4, 'RUNNING', $5::jsonb, NOW()
     )
     ON CONFLICT (org_id, source_system, source_snapshot_id, mode) DO UPDATE
     SET
       status = 'RUNNING',
       baseline_counts = EXCLUDED.baseline_counts,
       error_message = NULL,
       started_at = COALESCE(public.migration_runs.started_at, NOW()),
       completed_at = NULL,
       updated_at = NOW()
     RETURNING id::text`,
    [
      options.orgId,
      manifest.sourceSystem,
      manifest.snapshotId,
      options.mode,
      JSON.stringify(manifest.counts),
    ],
  )
  return result.rows[0].id
}

async function archivePayload(context: ImportContext, envelope: MigrationEnvelope) {
  await context.client.query(
    `INSERT INTO public.migration_source_payloads (
       org_id, run_id, source_system, entity_type, external_id, payload,
       payload_sha256, source_updated_at
     ) VALUES (
       $1::uuid, $2::uuid, 'WORDPRESS_COREISEC', $3, $4, $5::jsonb, $6,
       $7::timestamptz
     )
     ON CONFLICT (run_id, entity_type, external_id) DO UPDATE
     SET
       payload = EXCLUDED.payload,
       payload_sha256 = EXCLUDED.payload_sha256,
       source_updated_at = EXCLUDED.source_updated_at,
       received_at = NOW()`,
    [
      context.orgId,
      context.runId,
      envelope.entityType,
      envelope.externalId,
      JSON.stringify(envelope.payload),
      envelope.checksum,
      envelope.updatedAt,
    ],
  )
}

async function recordConflict(
  context: ImportContext,
  envelope: MigrationEnvelope,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error)
  await context.client.query(
    `INSERT INTO public.migration_conflicts (
       org_id, run_id, entity_type, external_id, conflict_type, severity,
       source_value, target_value, resolution, resolved_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, 'IMPORT_ERROR', 'ERROR',
       $5::jsonb, $6::jsonb, NULL, NULL
     )
     ON CONFLICT (run_id, entity_type, external_id, conflict_type) DO UPDATE
     SET
       source_value = EXCLUDED.source_value,
       target_value = EXCLUDED.target_value,
       resolution = NULL,
       resolved_at = NULL,
       created_at = NOW()`,
    [
      context.orgId,
      context.runId,
      envelope.entityType,
      envelope.externalId,
      JSON.stringify(envelope.payload),
      JSON.stringify({ error: message }),
    ],
  )
}

async function clearConflict(context: ImportContext, envelope: MigrationEnvelope) {
  await context.client.query(
    `UPDATE public.migration_conflicts
     SET resolution = 'Berhasil pada percobaan ulang', resolved_at = NOW()
     WHERE run_id = $1::uuid
       AND entity_type = $2
       AND external_id = $3
       AND conflict_type = 'IMPORT_ERROR'
       AND resolved_at IS NULL`,
    [context.runId, envelope.entityType, envelope.externalId],
  )
}

async function updateCheckpoint(
  context: ImportContext,
  lineNumber: number,
  envelope: MigrationEnvelope,
  counts: ImportCounts,
) {
  await context.client.query(
    `UPDATE public.migration_runs
     SET
       result_counts = $2::jsonb,
       last_checkpoint = $3::jsonb,
       updated_at = NOW()
     WHERE id = $1::uuid`,
    [
      context.runId,
      JSON.stringify(counts),
      JSON.stringify({
        lineNumber,
        entityType: envelope.entityType,
        externalId: envelope.externalId,
        checksum: envelope.checksum,
      }),
    ],
  )
}

async function processEnvelope(
  context: ImportContext,
  envelope: MigrationEnvelope,
  lineNumber: number,
  counts: ImportCounts,
  useSavepoint: boolean,
) {
  const counter = counts[envelope.entityType]
  counter.seen += 1
  const expectedChecksum = sha256(canonicalJson(envelope.payload))
  if (expectedChecksum !== envelope.checksum.toLowerCase()) {
    throw new Error(
      `Checksum ${envelope.entityType}:${envelope.externalId} tidak cocok. `
      + `Diharapkan ${expectedChecksum}, diterima ${envelope.checksum}.`,
    )
  }

  if (useSavepoint) await context.client.query('SAVEPOINT coreisec_entity')
  try {
    await archivePayload(context, envelope)
    const existingChecksum = await getExistingChecksum(context, envelope)
    if (existingChecksum === envelope.checksum) {
      counter.skipped += 1
    } else {
      const result = await importEnvelope(context, envelope)
      await upsertEntityMapping(context, envelope, result)
      counter.applied += 1
    }
    await clearConflict(context, envelope)
    if (context.runId && !useSavepoint) {
      await updateCheckpoint(context, lineNumber, envelope, counts)
    }
    if (useSavepoint) await context.client.query('RELEASE SAVEPOINT coreisec_entity')
  } catch (error) {
    if (useSavepoint) {
      await context.client.query('ROLLBACK TO SAVEPOINT coreisec_entity')
      await context.client.query('RELEASE SAVEPOINT coreisec_entity')
      await recordConflict(context, envelope, error)
    }
    throw error
  }
}

async function persistChecksums(
  context: ImportContext,
  manifest: ReturnType<typeof parseManifest>,
  aggregateChecksums: Map<CoreisecEntityType, ReturnType<typeof createHash>>,
  counts: ImportCounts,
) {
  for (const [entityType, expected] of Object.entries(manifest.aggregateChecksums)) {
    if (!expected) continue
    const actual = aggregateChecksums.get(entityType as CoreisecEntityType)?.digest('hex')
      || sha256('')
    const count = counts[entityType as CoreisecEntityType].seen
    if (actual !== expected.toLowerCase()) {
      throw new Error(
        `Checksum agregat ${entityType} berbeda: sumber ${expected}, hasil baca ${actual}.`,
      )
    }
    await context.client.query(
      `INSERT INTO public.migration_checksums (
         org_id, run_id, entity_type, side, record_count, aggregate_checksum, details
       ) VALUES ($1::uuid, $2::uuid, $3, 'SOURCE', $4, $5, '{}'::jsonb)
       ON CONFLICT (run_id, entity_type, side) DO UPDATE
       SET record_count = EXCLUDED.record_count,
           aggregate_checksum = EXCLUDED.aggregate_checksum`,
      [context.orgId, context.runId, entityType, count, actual],
    )
    await context.client.query(
      `INSERT INTO public.migration_checksums (
         org_id, run_id, entity_type, side, record_count, aggregate_checksum, details
       ) VALUES ($1::uuid, $2::uuid, $3, 'TARGET', $4, $5, $6::jsonb)
       ON CONFLICT (run_id, entity_type, side) DO UPDATE
       SET record_count = EXCLUDED.record_count,
           aggregate_checksum = EXCLUDED.aggregate_checksum,
           details = EXCLUDED.details`,
      [
        context.orgId,
        context.runId,
        entityType,
        count - counts[entityType as CoreisecEntityType].conflicts,
        actual,
        JSON.stringify({ basedOnEntityMap: true }),
      ],
    )
  }
}

async function persistDryRunAudit(input: {
  client: Awaited<ReturnType<typeof connectPostgresClient>>
  runId: string
  options: CliOptions
  manifest: ReturnType<typeof parseManifest>
  counts: ImportCounts
  status: 'SUCCEEDED' | 'FAILED'
  errorMessage?: string | null
}) {
  const rehearsalId = [
    input.manifest.snapshotId,
    'rehearsal',
    new Date().toISOString(),
    input.runId,
  ].join(':')
  await input.client.query(
    `INSERT INTO public.migration_runs (
       id, org_id, source_system, source_snapshot_id, mode, status,
       baseline_counts, result_counts, last_checkpoint, started_at,
       completed_at, error_message
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, 'DRY_RUN', $5, $6::jsonb, $7::jsonb,
       $8::jsonb, NOW(), NOW(), $9
     )`,
    [
      input.runId,
      input.options.orgId,
      input.manifest.sourceSystem,
      rehearsalId,
      input.status,
      JSON.stringify(input.manifest.counts),
      JSON.stringify(input.counts),
      JSON.stringify({
        originalSnapshotId: input.manifest.snapshotId,
        aggregateChecksums: input.manifest.aggregateChecksums,
      }),
      input.errorMessage || null,
    ],
  )
}

async function main() {
  const options = parseOptions()
  const manifestPath = resolve(options.sourceDir, 'manifest.json')
  const entityPath = resolve(options.sourceDir, 'entities.ndjson')
  const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  if (manifest.target?.orgId && manifest.target.orgId !== options.orgId) {
    throw new Error('orgId CLI berbeda dengan orgId yang dikunci pada manifest.')
  }
  if (manifest.target?.storeId && manifest.target.storeId !== options.storeId) {
    throw new Error('storeId CLI berbeda dengan storeId yang dikunci pada manifest.')
  }

  const client = await connectPostgresClient()
  client.on('error', (error) => {
    console.error(`[coreisec:import] koneksi database terputus: ${error instanceof Error ? error.message : String(error)}`)
  })
  const counts = emptyCounts()
  const aggregateChecksums = new Map<CoreisecEntityType, ReturnType<typeof createHash>>()
  let runId = ''
  let lineNumber = 0
  let fatalError: Error | null = null

  try {
    await assertTarget(options, client)
    runId = await createOrResumeRun(options, manifest, client)
    const context: ImportContext = {
      client,
      orgId: options.orgId,
      storeId: options.storeId,
      runId,
    }

    if (options.mode === 'DRY_RUN') {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO public.migration_runs (
           id, org_id, source_system, source_snapshot_id, mode, status,
           baseline_counts, started_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, 'DRY_RUN', 'RUNNING', $5::jsonb, NOW())`,
        [
          runId,
          options.orgId,
          manifest.sourceSystem,
          `${manifest.snapshotId}:ephemeral:${runId}`,
          JSON.stringify(manifest.counts),
        ],
      )
    }

    const input = createInterface({
      input: createReadStream(entityPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })

    for await (const rawLine of input) {
      lineNumber += 1
      const line = rawLine.trim()
      if (!line) continue
      let envelope: MigrationEnvelope
      try {
        envelope = parseEnvelope(JSON.parse(line))
      } catch (error) {
        throw new Error(
          `Baris ${lineNumber} tidak valid: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      let aggregate = aggregateChecksums.get(envelope.entityType)
      if (!aggregate) {
        aggregate = createHash('sha256')
        aggregateChecksums.set(envelope.entityType, aggregate)
      }
      aggregate.update(`${envelope.externalId}:${envelope.checksum}\n`)

      if (options.mode !== 'DRY_RUN') await client.query('BEGIN')
      try {
        await processEnvelope(
          context,
          envelope,
          lineNumber,
          counts,
          options.mode === 'DRY_RUN',
        )
        if (options.mode !== 'DRY_RUN') await client.query('COMMIT')
      } catch (error) {
        counts[envelope.entityType].conflicts += 1
        if (options.mode !== 'DRY_RUN') {
          await client.query('ROLLBACK')
          await client.query('BEGIN')
          await recordConflict(context, envelope, error)
          await updateCheckpoint(context, lineNumber, envelope, counts)
          await client.query('COMMIT')
        }
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[konflik] baris=${lineNumber} ${envelope.entityType}:${envelope.externalId} ${message}`)
        if (options.failFast) throw error
      }
    }

    for (const [entityType, expectedCount] of Object.entries(manifest.counts)) {
      if (expectedCount == null) continue
      const actualCount = counts[entityType as CoreisecEntityType].seen
      if (actualCount !== expectedCount) {
        throw new Error(
          `Jumlah ${entityType} berbeda: manifest ${expectedCount}, snapshot ${actualCount}.`,
        )
      }
    }

    await persistChecksums(context, manifest, aggregateChecksums, counts)
    const totalConflicts = Object.values(counts)
      .reduce((total, value) => total + value.conflicts, 0)
    if (totalConflicts > 0) {
      throw new Error(`${totalConflicts} konflik migrasi belum diselesaikan.`)
    }

    if (options.mode === 'DRY_RUN') {
      await client.query('ROLLBACK')
      await persistDryRunAudit({
        client,
        runId,
        options,
        manifest,
        counts,
        status: 'SUCCEEDED',
      })
    } else {
      await client.query(
        `UPDATE public.migration_runs
         SET status = 'SUCCEEDED', result_counts = $2::jsonb,
             completed_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [runId, JSON.stringify(counts)],
      )
    }

    console.log(JSON.stringify({
      mode: options.mode,
      runId: options.mode === 'DRY_RUN' ? null : runId,
      snapshotId: manifest.snapshotId,
      counts,
      result: 'LULUS',
    }, null, 2))
  } catch (error) {
    fatalError = error instanceof Error ? error : new Error(String(error))
    try {
      if (options.mode === 'DRY_RUN') {
        await client.query('ROLLBACK')
        if (runId) {
          await persistDryRunAudit({
            client,
            runId,
            options,
            manifest,
            counts,
            status: 'FAILED',
            errorMessage: fatalError.message,
          })
        }
      }
      else if (runId) {
        await client.query(
          `UPDATE public.migration_runs
           SET status = 'FAILED', result_counts = $2::jsonb,
               error_message = $3, completed_at = NOW(), updated_at = NOW()
           WHERE id = $1::uuid`,
          [runId, JSON.stringify(counts), fatalError.message],
        )
      }
    } catch {
      // Error utama tetap lebih penting daripada error pencatatan status.
    }
  } finally {
    client.release()
    await closePostgresPool()
  }

  if (fatalError) throw fatalError
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[coreisec:import] ${message}`)
  process.exitCode = 1
})
