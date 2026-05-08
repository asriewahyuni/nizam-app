import pg from 'pg';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.RAILWAY_DATABASE_URL;

async function check() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('--- Sales Order ---');
  const saleRes = await client.query("SELECT id, org_id, sale_number, status FROM sales WHERE sale_number = 'SO-2026-000002'");
  console.table(saleRes.rows);

  if (saleRes.rows.length > 0) {
    const saleId = saleRes.rows[0].id;
    const orgId = saleRes.rows[0].org_id;

    console.log('\n--- Linked Journal Entries ---');
    const journalRes = await client.query(
      "SELECT id, entry_number, entry_date, description, status, reference_type, reference_id FROM journal_entries WHERE reference_id = $1 AND reference_type = 'SALE'",
      [saleId]
    );
    console.table(journalRes.rows);

    console.log('\n--- Linked Stock Movements ---');
    const stockRes = await client.query(
      "SELECT id, product_id, quantity, reference_type, reference_id, created_at FROM stock_movements WHERE reference_id = $1 AND reference_type = 'SALE'",
      [saleId]
    );
    console.table(stockRes.rows);
  }

  await client.end();
}

check().catch(console.error);
