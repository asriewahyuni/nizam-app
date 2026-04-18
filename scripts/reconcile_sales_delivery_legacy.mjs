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
      'Usage: node scripts/reconcile_sales_delivery_legacy.mjs [options]',
      '',
      'Required:',
      '  --org-id <uuid>             Organization ID',
      '  --sale-id <uuid>            Sales ID',
      '  --sale-number <text>        Alternative to --sale-id',
      '',
      'Optional:',
      '  --apply                     Apply reconciliation when checks are safe',
      '  --warehouse-id <uuid>       Stamp warehouse_id when applying and sales row is still empty',
      '  --help                      Show this help',
      '',
      'What this script does:',
      '  - Audit sales row, linked SALE journal, and SALE stock movements',
      '  - Detect legacy mismatch: journal already exists but sales.status is not FINISHED',
      '  - With --apply, mark sales as FINISHED only when the state is safe',
    ].join('\n')
  )
}

function parseArgs(argv) {
  const args = {
    orgId: '',
    saleId: '',
    saleNumber: '',
    warehouseId: '',
    apply: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim()
    if (!token) continue

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (token === '--apply') {
      args.apply = true
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

    if (token === '--sale-id') {
      args.saleId = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--sale-id=')) {
      args.saleId = token.slice('--sale-id='.length).trim()
      continue
    }

    if (token === '--sale-number') {
      args.saleNumber = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--sale-number=')) {
      args.saleNumber = token.slice('--sale-number='.length).trim()
      continue
    }

    if (token === '--warehouse-id') {
      args.warehouseId = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }

    if (token.startsWith('--warehouse-id=')) {
      args.warehouseId = token.slice('--warehouse-id='.length).trim()
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

function buildSaleLookup(args) {
  if (!args.orgId) {
    throw new Error('Parameter --org-id wajib diisi.')
  }

  if (!args.saleId && !args.saleNumber) {
    throw new Error('Isi salah satu: --sale-id atau --sale-number.')
  }

  if (args.saleId) {
    return {
      clause: 's.id = $2::uuid',
      value: args.saleId,
      label: `sale_id=${args.saleId}`,
    }
  }

  return {
    clause: 's.sale_number = $2::text',
    value: args.saleNumber,
    label: `sale_number=${args.saleNumber}`,
  }
}

function printSection(title, value) {
  console.log(`\n=== ${title} ===`)
  if (Array.isArray(value)) {
    console.table(value)
    return
  }
  console.dir(value, { depth: null })
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

  const lookup = buildSaleLookup(args)
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL...')
  console.log(`🔎 Audit target: org_id=${args.orgId}, ${lookup.label}`)

  const saleResult = await client.query(
    `
      SELECT
        s.id,
        s.org_id,
        s.branch_id,
        s.sale_number,
        s.status,
        s.payment_status,
        s.warehouse_id,
        s.shariah_mode,
        s.updated_at
      FROM public.sales s
      WHERE s.org_id = $1::uuid
        AND ${lookup.clause}
      LIMIT 1
    `,
    [args.orgId, lookup.value]
  )

  if (saleResult.rowCount !== 1) {
    throw new Error('Sales tidak ditemukan untuk parameter yang diberikan.')
  }

  const sale = saleResult.rows[0]
  const saleId = String(sale.id)

  const [journalResult, stockResult, inventoryResult] = await Promise.all([
    client.query(
      `
        SELECT
          je.id,
          je.status,
          je.entry_date,
          je.entry_number,
          je.description,
          je.created_at,
          COUNT(jl.id)::int AS line_count
        FROM public.journal_entries je
        LEFT JOIN public.journal_lines jl
          ON jl.entry_id = je.id
        WHERE je.org_id = $1::uuid
          AND je.reference_type = 'SALE'
          AND je.reference_id = $2::uuid
        GROUP BY je.id
        ORDER BY je.created_at DESC, je.id DESC
      `,
      [args.orgId, saleId]
    ),
    client.query(
      `
        SELECT
          COUNT(*)::int AS movement_count,
          COALESCE(SUM(ABS(quantity)), 0)::numeric AS absolute_quantity_total,
          MIN(created_at) AS first_movement_at,
          MAX(created_at) AS last_movement_at
        FROM public.stock_movements
        WHERE org_id = $1::uuid
          AND reference_type = 'SALE'
          AND reference_id = $2::uuid
      `,
      [args.orgId, saleId]
    ),
    client.query(
      `
        SELECT COUNT(*)::int AS inventory_item_count
        FROM public.sales_items si
        JOIN public.products p ON p.id = si.product_id
        WHERE si.org_id = $1::uuid
          AND si.sale_id = $2::uuid
          AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
      `,
      [args.orgId, saleId]
    ),
  ])

  const journals = journalResult.rows
  const nonVoidedJournals = journals.filter((row) => String(row.status || '').toUpperCase() !== 'VOIDED')
  const stockSummary = stockResult.rows[0] || {
    movement_count: 0,
    absolute_quantity_total: 0,
    first_movement_at: null,
    last_movement_at: null,
  }
  const inventoryItemCount = Number(inventoryResult.rows[0]?.inventory_item_count || 0)
  const hasInventoryItems = inventoryItemCount > 0
  const hasStockMovements = Number(stockSummary.movement_count || 0) > 0
  const canApply =
    String(sale.status || '').toUpperCase() !== 'FINISHED' &&
    String(sale.status || '').toUpperCase() !== 'VOIDED' &&
    nonVoidedJournals.length === 1 &&
    (
      !hasInventoryItems ||
      hasStockMovements
    )

  printSection('Sales', sale)
  printSection('SALE Journals', journals)
  printSection('SALE Stock Movements', stockSummary)
  printSection('Audit Summary', {
    inventoryItemCount,
    hasInventoryItems,
    hasStockMovements,
    nonVoidedJournalCount: nonVoidedJournals.length,
    canApply,
    recommendedAction: canApply
      ? 'Safe to reconcile: mark sales.status as FINISHED.'
      : 'Do not auto-reconcile yet. Inspect missing stock movement or conflicting journal state first.',
  })

  if (!args.apply) {
    console.log('\nℹ️  Dry-run selesai. Tambahkan --apply untuk menjalankan rekonsiliasi bila aman.')
    await client.end()
    return
  }

  if (!canApply) {
    throw new Error('Kondisi belum aman untuk auto-reconcile. Jalankan tanpa --apply untuk audit detail.')
  }

  const updateResult = await client.query(
    `
      UPDATE public.sales
      SET status = 'FINISHED',
          warehouse_id = COALESCE(warehouse_id, NULLIF($3::text, '')::uuid),
          updated_at = NOW()
      WHERE id = $1::uuid
        AND org_id = $2::uuid
      RETURNING id, sale_number, status, warehouse_id, updated_at
    `,
    [saleId, args.orgId, args.warehouseId]
  )

  printSection('Applied Update', updateResult.rows[0] || null)
  console.log('\n✅ Rekonsiliasi selesai.')
  await client.end()
}

run().catch((error) => {
  console.error(`❌ ${String(error?.message || error)}`)
  process.exit(1)
})
