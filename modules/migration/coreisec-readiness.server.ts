/**
 * Rekonsiliasi dan gerbang go-live Coreisec. Modul ini hanya membaca keadaan
 * database/environment dan tidak pernah mengubah data.
 */
import { queryPostgres } from '@/lib/db/postgres'

const TARGET_TABLES = new Set([
  'internal_auth_users',
  'learning_courses',
  'learning_course_sections',
  'learning_lessons',
  'learning_lesson_assets',
  'learning_instructor_profiles',
  'learning_course_instructors',
  'lms_course_batches',
  'lms_batch_sessions',
  'learning_enrollments',
  'learning_lesson_progress',
  'learning_quizzes',
  'learning_questions',
  'learning_assignments',
  'store_products',
  'product_variants',
  'commerce_product_courses',
  'commerce_order_bumps',
  'commerce_access_packages',
  'commerce_memberships',
  'commerce_historical_order_archives',
  'commerce_subscriptions',
  'commerce_coupons',
  'commerce_affiliate_profiles',
  'commerce_affiliate_rules',
  'commerce_affiliate_commissions',
  'lms_certificates',
  'cms_content_entries',
  'cms_redirects',
  'migration_media_assets',
])

type RunRow = {
  id: string
  source_snapshot_id: string
  status: string
  baseline_counts: Record<string, number>
  result_counts: Record<string, {
    seen?: number
    applied?: number
    skipped?: number
    conflicts?: number
  }>
  completed_at: string | null
}

export type ReadinessCheck = {
  key: string
  label: string
  passed: boolean
  blocking: boolean
  detail: string
}

export type EntityReconciliation = {
  entityType: string
  expected: number | null
  mapped: number
  targetFound: number
  missingTarget: number
  passed: boolean
}

export type CoreisecReadiness = {
  ready: boolean
  generatedAt: string
  applyRun: RunRow | null
  rehearsalRuns: RunRow[]
  checks: ReadinessCheck[]
  entities: EntityReconciliation[]
  counts: {
    openConflicts: number
    bridgePending: number
    bridgeConflicts: number
    mediaPending: number
    mediaConflicts: number
  }
}

function envReady(names: string[]) {
  return names.every((name) => String(process.env[name] || '').trim().length > 0)
}

export async function getCoreisecReadiness(orgId: string): Promise<CoreisecReadiness> {
  const [
    applyRunResult,
    rehearsalResult,
    structureResult,
    stateResult,
    mappingResult,
    accountResult,
  ] = await Promise.all([
    queryPostgres<RunRow>(
      `SELECT
         id::text, source_snapshot_id, status, baseline_counts, result_counts,
         completed_at::text
       FROM public.migration_runs
       WHERE org_id = $1::uuid
         AND source_system = 'WORDPRESS_COREISEC'
         AND mode = 'APPLY'
       ORDER BY completed_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [orgId],
    ),
    queryPostgres<RunRow>(
      `SELECT
         id::text, source_snapshot_id, status, baseline_counts, result_counts,
         completed_at::text
       FROM public.migration_runs
       WHERE org_id = $1::uuid
         AND source_system = 'WORDPRESS_COREISEC'
         AND mode = 'DRY_RUN'
       ORDER BY completed_at DESC NULLS LAST, created_at DESC
       LIMIT 2`,
      [orgId],
    ),
    queryPostgres<{
      org_name: string
      parent_name: string | null
      parent_id: string | null
      main_count: number
      program_branch_count: number
      domain_verified: boolean
    }>(
      `SELECT
         organization.name AS org_name,
         parent.name AS parent_name,
         organization.parent_org_id::text AS parent_id,
         (
           SELECT COUNT(*)::int FROM public.branches branch
           WHERE branch.org_id = organization.id
             AND branch.code = 'MAIN'
             AND branch.name = 'Cabang Utama'
             AND branch.is_active = TRUE
         ) AS main_count,
         (
           SELECT COUNT(*)::int FROM public.branches branch
           WHERE branch.org_id = organization.id
             AND branch.code IN ('CORE001', 'CORE002', 'CORE003', 'CORE004')
             AND branch.is_active = TRUE
         ) AS program_branch_count,
         EXISTS (
           SELECT 1 FROM public.organization_domains domain
           WHERE domain.org_id = organization.id
             AND lower(domain.hostname) = 'member.coreisec.id'
             AND domain.purpose = 'MEMBER_PORTAL'
             AND domain.status = 'VERIFIED'
             AND domain.is_primary = TRUE
         ) AS domain_verified
       FROM public.organizations organization
       LEFT JOIN public.organizations parent ON parent.id = organization.parent_org_id
       WHERE organization.id = $1::uuid
       LIMIT 1`,
      [orgId],
    ),
    queryPostgres<{
      open_conflicts: number
      bridge_pending: number
      bridge_conflicts: number
      bridge_processing: number
      media_pending: number
      media_conflicts: number
    }>(
      `SELECT
         (
           SELECT COUNT(*)::int
           FROM public.migration_conflicts conflict
           WHERE conflict.org_id = $1::uuid AND conflict.resolved_at IS NULL
         ) AS open_conflicts,
         (
           SELECT COUNT(*)::int
           FROM public.migration_bridge_events event
           WHERE event.org_id = $1::uuid AND event.status = 'PENDING'
         ) AS bridge_pending,
         (
           SELECT COUNT(*)::int
           FROM public.migration_bridge_events event
           WHERE event.org_id = $1::uuid AND event.status = 'CONFLICT'
         ) AS bridge_conflicts,
         (
           SELECT COUNT(*)::int
           FROM public.migration_bridge_events event
           WHERE event.org_id = $1::uuid AND event.status = 'PROCESSING'
         ) AS bridge_processing,
         (
           SELECT COUNT(*)::int
           FROM public.migration_media_assets media
           WHERE media.org_id = $1::uuid AND media.copy_status IN ('PENDING', 'COPYING')
         ) AS media_pending,
         (
           SELECT COUNT(*)::int
           FROM public.migration_media_assets media
           WHERE media.org_id = $1::uuid AND media.copy_status = 'CONFLICT'
         ) AS media_conflicts`,
      [orgId],
    ),
    queryPostgres<{
      entity_type: string
      target_table: string
      target_ids: string[]
    }>(
      `SELECT
         entity_type, target_table, array_agg(target_id::text ORDER BY external_id) AS target_ids
       FROM public.migration_entity_map
       WHERE org_id = $1::uuid AND source_system = 'WORDPRESS_COREISEC'
       GROUP BY entity_type, target_table`,
      [orgId],
    ),
    queryPostgres<{
      branch_count: number
      configured_count: number
      incomplete_count: number
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM public.branches
          WHERE org_id = $1::uuid AND is_active = TRUE) AS branch_count,
         COUNT(setting.id)::int AS configured_count,
         COUNT(setting.id) FILTER (
           WHERE setting.bank_account_id IS NULL
              OR setting.cash_account_id IS NULL
              OR setting.revenue_account_id IS NULL
              OR setting.affiliate_commission_expense_account_id IS NULL
              OR setting.affiliate_commission_payable_account_id IS NULL
         )::int AS incomplete_count
       FROM public.commerce_branch_account_settings setting
       WHERE setting.org_id = $1::uuid`,
      [orgId],
    ),
  ])

  const applyRun = applyRunResult.rows[0] || null
  const rehearsals = rehearsalResult.rows
  const structure = structureResult.rows[0]
  const state = stateResult.rows[0]
  const account = accountResult.rows[0]
  const mappedCounts = new Map<string, number>()
  const foundCounts = new Map<string, number>()

  for (const group of mappingResult.rows) {
    if (!TARGET_TABLES.has(group.target_table)) {
      mappedCounts.set(
        group.entity_type,
        (mappedCounts.get(group.entity_type) || 0) + group.target_ids.length,
      )
      continue
    }
    const found = await queryPostgres<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.${group.target_table}
       WHERE id = ANY($1::uuid[])`,
      [group.target_ids],
    )
    mappedCounts.set(
      group.entity_type,
      (mappedCounts.get(group.entity_type) || 0) + group.target_ids.length,
    )
    foundCounts.set(
      group.entity_type,
      (foundCounts.get(group.entity_type) || 0) + Number(found.rows[0]?.count || 0),
    )
  }

  const baseline = applyRun?.baseline_counts || {}
  const entityTypes = [...new Set([
    ...Object.keys(baseline),
    ...mappedCounts.keys(),
  ])].sort()
  const entities = entityTypes.map((entityType): EntityReconciliation => {
    const expected = baseline[entityType] == null ? null : Number(baseline[entityType])
    const mapped = mappedCounts.get(entityType) || 0
    const targetFound = foundCounts.get(entityType) || 0
    const missingTarget = Math.max(0, mapped - targetFound)
    return {
      entityType,
      expected,
      mapped,
      targetFound,
      missingTarget,
      passed: missingTarget === 0 && (expected == null || expected === mapped),
    }
  })

  const checks: ReadinessCheck[] = [
    {
      key: 'organization',
      label: 'Struktur organisasi dan Cabang',
      passed: Boolean(
        structure?.parent_id
        && structure.parent_name === 'CORe Group'
        && structure.main_count === 1
        && structure.program_branch_count === 4,
      ),
      blocking: true,
      detail: structure
        ? `Induk: ${structure.parent_name || 'belum ada'}; MAIN: ${structure.main_count}; program: ${structure.program_branch_count}/4.`
        : 'Organisasi target tidak ditemukan.',
    },
    {
      key: 'domain',
      label: 'Domain member terverifikasi',
      passed: Boolean(structure?.domain_verified),
      blocking: true,
      detail: structure?.domain_verified
        ? 'member.coreisec.id aktif sebagai domain utama.'
        : 'member.coreisec.id belum terverifikasi.',
    },
    {
      key: 'apply',
      label: 'Impor penuh terakhir',
      passed: applyRun?.status === 'SUCCEEDED',
      blocking: true,
      detail: applyRun
        ? `${applyRun.source_snapshot_id}: ${applyRun.status}.`
        : 'Belum ada impor APPLY.',
    },
    {
      key: 'rehearsals',
      label: 'Dua rehearsal penuh',
      passed: rehearsals.length >= 2 && rehearsals.every((run) => run.status === 'SUCCEEDED'),
      blocking: true,
      detail: `${rehearsals.filter((run) => run.status === 'SUCCEEDED').length}/2 rehearsal terakhir lulus.`,
    },
    {
      key: 'entities',
      label: 'Jumlah dan target hasil migrasi',
      passed: entities.length > 0 && entities.every((entity) => entity.passed),
      blocking: true,
      detail: `${entities.filter((entity) => entity.passed).length}/${entities.length} jenis data cocok.`,
    },
    {
      key: 'conflicts',
      label: 'Konflik migrasi',
      passed: Number(state?.open_conflicts || 0) === 0,
      blocking: true,
      detail: `${Number(state?.open_conflicts || 0)} konflik terbuka.`,
    },
    {
      key: 'bridge',
      label: 'Antrean sinkronisasi WordPress',
      passed: Number(state?.bridge_pending || 0) === 0
        && Number(state?.bridge_conflicts || 0) === 0
        && Number(state?.bridge_processing || 0) === 0,
      blocking: true,
      detail: `Pending ${Number(state?.bridge_pending || 0)}, konflik ${Number(state?.bridge_conflicts || 0)}, proses ${Number(state?.bridge_processing || 0)}.`,
    },
    {
      key: 'media',
      label: 'Salinan dan checksum media',
      passed: Number(state?.media_pending || 0) === 0
        && Number(state?.media_conflicts || 0) === 0,
      blocking: true,
      detail: `Belum selesai ${Number(state?.media_pending || 0)}, konflik ${Number(state?.media_conflicts || 0)}.`,
    },
    {
      key: 'accounts',
      label: 'Pemetaan akun ERP per Cabang',
      passed: Number(account?.configured_count || 0) === Number(account?.branch_count || 0)
        && Number(account?.incomplete_count || 0) === 0
        && Number(account?.branch_count || 0) > 0,
      blocking: true,
      detail: `${Number(account?.configured_count || 0)}/${Number(account?.branch_count || 0)} Cabang dikonfigurasi; ${Number(account?.incomplete_count || 0)} belum lengkap.`,
    },
    {
      key: 'payments',
      label: 'Provider wajib saat peluncuran',
      passed: envReady([
        'COREISEC_MANUAL_BANK_NAME',
        'COREISEC_MANUAL_BANK_ACCOUNT_NUMBER',
        'COREISEC_MANUAL_BANK_ACCOUNT_HOLDER',
        'COREISEC_MOOTA_BANK_NAME',
        'COREISEC_MOOTA_BANK_ACCOUNT_NUMBER',
        'COREISEC_MOOTA_BANK_ACCOUNT_HOLDER',
        'COREISEC_MOOTA_WEBHOOK_SECRET',
      ]),
      blocking: true,
      detail: 'Transfer manual dan Moota harus memiliki seluruh konfigurasi server.',
    },
    {
      key: 'security',
      label: 'Rahasia webhook, cron, dan sinkronisasi',
      passed: envReady([
        'COREISEC_BRIDGE_SECRET',
        'COREISEC_CRON_SECRET',
        'INTERNAL_AUTH_SESSION_SECRET',
      ]),
      blocking: true,
      detail: 'Rahasia wajib hanya diperiksa keberadaannya; nilainya tidak ditampilkan.',
    },
  ]

  return {
    ready: checks.filter((check) => check.blocking).every((check) => check.passed),
    generatedAt: new Date().toISOString(),
    applyRun,
    rehearsalRuns: rehearsals,
    checks,
    entities,
    counts: {
      openConflicts: Number(state?.open_conflicts || 0),
      bridgePending: Number(state?.bridge_pending || 0),
      bridgeConflicts: Number(state?.bridge_conflicts || 0),
      mediaPending: Number(state?.media_pending || 0),
      mediaConflicts: Number(state?.media_conflicts || 0),
    },
  }
}
