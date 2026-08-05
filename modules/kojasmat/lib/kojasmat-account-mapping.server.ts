/**
 * Pemetaan akun COA per peran jurnal Kojasmat (kas, simpanan pokok/wajib/
 * sukarela, dana syirkah temporer, piutang pembiayaan, ujrah wakalah,
 * pendapatan admin/proyek, beban proyek, bagi hasil). Dibaca oleh
 * lib/erp-bridge/kojasmat-journals.ts saat memposting jurnal — kalau suatu
 * peran belum dipetakan, jurnal untuk peran itu di-skip non-fatal (transaksi
 * tetap tercatat di modul Kojasmat, cuma belum masuk buku besar).
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import {
  KOJASMAT_ACCOUNT_ROLES,
  type KojasmatAccountRole,
  type KojasmatAccountMapping,
  type KojasmatAccountOption,
} from './kojasmat-account-mapping.shared'

export {
  KOJASMAT_ACCOUNT_ROLES, KOJASMAT_ACCOUNT_ROLE_LABEL,
  type KojasmatAccountRole, type KojasmatAccountMapping, type KojasmatAccountOption,
} from './kojasmat-account-mapping.shared'

function roleColumn(role: KojasmatAccountRole) {
  return `${role}_account_id`
}

export async function getKojasmatAccountMapping(orgId: string): Promise<KojasmatAccountMapping> {
  const { rows } = await queryPostgres<Record<string, string | null>>(
    `SELECT ${KOJASMAT_ACCOUNT_ROLES.map((role) => `${roleColumn(role)}::text`).join(', ')}
     FROM public.kojasmat_account_mapping
     WHERE org_id = $1
     LIMIT 1`,
    [orgId],
  )
  const row = rows[0] || {}
  return Object.fromEntries(
    KOJASMAT_ACCOUNT_ROLES.map((role) => [role, row[roleColumn(role)] ?? null]),
  ) as KojasmatAccountMapping
}

export async function getKojasmatAccountMappingData(orgId: string): Promise<{
  mapping: KojasmatAccountMapping
  accounts: KojasmatAccountOption[]
}> {
  const [mapping, accountRows] = await Promise.all([
    getKojasmatAccountMapping(orgId),
    queryPostgres<KojasmatAccountOption>(
      `SELECT id::text, code, name, type FROM public.accounts
       WHERE org_id = $1 AND is_active = TRUE ORDER BY code ASC`,
      [orgId],
    ),
  ])
  return { mapping, accounts: accountRows.rows }
}

export async function saveKojasmatAccountMapping(
  orgId: string,
  input: Partial<Record<KojasmatAccountRole, string | null>>,
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

  const columns = KOJASMAT_ACCOUNT_ROLES.map(roleColumn)
  const values = KOJASMAT_ACCOUNT_ROLES.map((role) => input[role] ?? null)

  await queryPostgres(
    `INSERT INTO public.kojasmat_account_mapping (org_id, ${columns.join(', ')})
     VALUES ($1, ${columns.map((_, i) => `$${i + 2}::uuid`).join(', ')})
     ON CONFLICT (org_id) DO UPDATE SET
       ${columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ')},
       updated_at = NOW()`,
    [orgId, ...values],
  )
}
