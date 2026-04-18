import process from 'node:process'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

function printHelp() {
  console.log(
    [
      'Usage: node scripts/audit_sales_delivery_legacy_candidates.mjs [options]',
      '',
      'Optional:',
      '  --org-id <uuid>       Filter one organization',
      '  --limit <number>      Limit rows (default: 50)',
      '  --help                Show this help',
      '',
      'Lists sales that are not FINISHED but already have at least one',
      'non-voided SALE journal. Includes stock movement counts so we can',
      'see which rows are safe to reconcile immediately.',
    ].join('\n')
  )
}

function parseArgs(argv) {
  const args = {
    orgId: '',
    limit: 50,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim()
    if (!token) continue

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (token === '--org-id') {
      args.orgId = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--org-id=')) {
      args.orgId = token.slice('--org-id='.length).trim()
      continue
    }

    if (token === '--limit') {
      args.limit = Number.parseInt(String(argv[index + 1] || '').trim(), 10) || 50
      index += 1
      continue
    }

    if (token.startsWith('--limit=')) {
      args.limit = Number.parseInt(token.slice('--limit='.length).trim(), 10) || 50
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

async function run() {
  if (!dbUrl) {
    throw new Error('Tidak ada DATABASE_URL ditemukan di environment lokal.')
  }

  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  const whereClauses = [`s.status <> 'FINISHED'`]
  const values = []

  if (args.orgId) {
    values.push(args.orgId)
    whereClauses.push(`s.org_id = $${values.length}::uuid`)
  }

  values.push(args.limit)
  const limitPlaceholder = `$${values.length}::int`

  const result = await client.query(
    `
      SELECT
        s.org_id::text AS org_id,
        s.id::text AS sale_id,
        s.sale_number,
        s.status AS sale_status,
        s.payment_status,
        s.branch_id::text AS branch_id,
        s.warehouse_id::text AS warehouse_id,
        s.updated_at,
        COUNT(DISTINCT je.id)::int AS total_sale_journal_count,
        COUNT(DISTINCT CASE WHEN je.status <> 'VOIDED' THEN je.id END)::int AS active_sale_journal_count,
        COUNT(DISTINCT CASE WHEN je.status = 'VOIDED' THEN je.id END)::int AS voided_sale_journal_count,
        COUNT(DISTINCT sm.id)::int AS sale_stock_movement_count,
        COUNT(DISTINCT CASE WHEN COALESCE(p.type, 'INVENTORY') = 'INVENTORY' THEN si.id END)::int AS inventory_item_count
      FROM public.sales s
      LEFT JOIN public.journal_entries je
        ON je.org_id = s.org_id
       AND je.reference_type = 'SALE'
       AND je.reference_id = s.id
      LEFT JOIN public.stock_movements sm
        ON sm.org_id = s.org_id
       AND sm.reference_type = 'SALE'
       AND sm.reference_id = s.id
      LEFT JOIN public.sales_items si
        ON si.org_id = s.org_id
       AND si.sale_id = s.id
      LEFT JOIN public.products p
        ON p.id = si.product_id
      WHERE ${whereClauses.join('\n        AND ')}
      GROUP BY s.org_id, s.id, s.sale_number, s.status, s.payment_status, s.branch_id, s.warehouse_id, s.updated_at
      HAVING COUNT(DISTINCT je.id) > 0
      ORDER BY s.updated_at DESC NULLS LAST
      LIMIT ${limitPlaceholder}
    `,
    values
  )

  const rows = result.rows.map((row) => ({
    ...row,
    safe_to_reconcile:
      String(row.sale_status || '').toUpperCase() !== 'VOIDED'
      && Number(row.active_sale_journal_count || 0) > 0
      && (
        Number(row.inventory_item_count || 0) === 0
        || Number(row.sale_stock_movement_count || 0) > 0
      ),
  }))

  if (!rows.length) {
    console.log('✅ Tidak ada kandidat sales legacy yang belum FINISHED tetapi sudah punya jurnal SALE aktif.')
  } else {
    console.table(rows)
  }

  await client.end()
}

run().catch((error) => {
  console.error(`❌ ${String(error?.message || error)}`)
  process.exit(1)
})
