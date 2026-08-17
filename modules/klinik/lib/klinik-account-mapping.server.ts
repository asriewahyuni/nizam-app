/**
 * Pemetaan akun COA per peran jurnal Klinik Pratama (kas, pendapatan
 * konsultasi/tindakan/obat, HPP obat, persediaan obat, piutang BPJS, kerugian
 * obat kadaluarsa). Dibaca oleh lib/erp-bridge/klinik-journals.ts saat
 * memposting jurnal — kalau suatu peran belum dipetakan, jurnal untuk peran
 * itu di-skip non-fatal (transaksi tetap tercatat di modul Klinik, cuma
 * belum masuk buku besar).
 *
 * Beda dari kojasmat_account_mapping: satu org boleh punya mapping per-cabang
 * (branch_id terisi) di atas mapping default org-level (branch_id NULL) —
 * grup klinik multi-cabang lazimnya punya akun kas berbeda per cabang.
 * getKlinikAccountMapping() mencari baris spesifik cabang dulu, fallback ke
 * baris default org-level kalau belum ada.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import {
  KLINIK_ACCOUNT_ROLES,
  type KlinikAccountRole,
  type KlinikAccountMapping,
  type KlinikAccountOption,
} from './klinik-account-mapping.shared'

export {
  KLINIK_ACCOUNT_ROLES, KLINIK_ACCOUNT_ROLE_LABEL,
  type KlinikAccountRole, type KlinikAccountMapping, type KlinikAccountOption,
} from './klinik-account-mapping.shared'

const DEFAULT_BRANCH_KEY = '00000000-0000-0000-0000-000000000000'

function roleColumn(role: KlinikAccountRole) {
  return `${role}_account_id`
}

function mapRow(row: Record<string, string | null> | undefined): KlinikAccountMapping {
  const safeRow = row || {}
  return Object.fromEntries(
    KLINIK_ACCOUNT_ROLES.map((role) => [role, safeRow[roleColumn(role)] ?? null]),
  ) as KlinikAccountMapping
}

export async function getKlinikAccountMapping(
  orgId: string,
  branchId?: string | null,
): Promise<KlinikAccountMapping> {
  const cols = KLINIK_ACCOUNT_ROLES.map((role) => `${roleColumn(role)}::text`).join(', ')

  if (branchId) {
    const { rows } = await queryPostgres<Record<string, string | null>>(
      `SELECT ${cols} FROM public.klinik_account_mapping
       WHERE org_id = $1 AND branch_id = $2::uuid
       LIMIT 1`,
      [orgId, branchId],
    )
    if (rows[0]) return mapRow(rows[0])
  }

  const { rows } = await queryPostgres<Record<string, string | null>>(
    `SELECT ${cols} FROM public.klinik_account_mapping
     WHERE org_id = $1 AND branch_id IS NULL
     LIMIT 1`,
    [orgId],
  )
  return mapRow(rows[0])
}

export async function getKlinikAccountMappingData(orgId: string, branchId?: string | null): Promise<{
  mapping: KlinikAccountMapping
  accounts: KlinikAccountOption[]
}> {
  const [mapping, accountRows] = await Promise.all([
    getKlinikAccountMapping(orgId, branchId),
    queryPostgres<KlinikAccountOption>(
      `SELECT id::text, code, name, type FROM public.accounts
       WHERE org_id = $1 AND is_active = TRUE ORDER BY code ASC`,
      [orgId],
    ),
  ])
  return { mapping, accounts: accountRows.rows }
}

export async function saveKlinikAccountMapping(
  orgId: string,
  branchId: string | null,
  input: Partial<Record<KlinikAccountRole, string | null>>,
): Promise<void> {
  const accountIds = Object.values(input).filter((value): value is string => Boolean(value))
  if (accountIds.length > 0) {
    const { rows } = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.accounts WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, accountIds],
    )
    const validIds = new Set(rows.map((row) => row.id))
    const invalid = accountIds.find((id) => !validIds.has(id))
    if (invalid) throw new Error('Salah satu akun COA yang dipilih tidak valid untuk organisasi ini.')
  }

  const columns = KLINIK_ACCOUNT_ROLES.map(roleColumn)
  const values = KLINIK_ACCOUNT_ROLES.map((role) => input[role] ?? null)

  // branch_id NULL harus diperlakukan sebagai satu nilai tunggal ('default
  // org-level') untuk keperluan konflik — Postgres default menganggap tiap
  // NULL "distinct", jadi konflik di-resolve lewat index ekspresi COALESCE
  // yang sama dengan uq_klinik_account_mapping_scope.
  await queryPostgres(
    `INSERT INTO public.klinik_account_mapping (org_id, branch_id, ${columns.join(', ')})
     VALUES ($1, $2::uuid, ${columns.map((_, i) => `$${i + 3}::uuid`).join(', ')})
     ON CONFLICT (org_id, COALESCE(branch_id, '${DEFAULT_BRANCH_KEY}'::uuid)) DO UPDATE SET
       ${columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ')},
       updated_at = NOW()`,
    [orgId, branchId, ...values],
  )
}
