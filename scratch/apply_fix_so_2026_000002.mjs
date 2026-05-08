import pg from 'pg';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.RAILWAY_DATABASE_URL;

async function applyFix() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('--- Applying Fix for SO-2026-000002 ---');
  
  const journalId = '17a30b82-dd48-4ac5-8d03-ae4720b2f603';
  
  const res = await client.query(
    `UPDATE public.journal_entries 
     SET reference_id = NULL, 
         description = description || ' (Detached for reconciliation)'
     WHERE id = $1 AND status = 'VOIDED'
     RETURNING id, entry_number, status, reference_id, description`,
    [journalId]
  );

  if (res.rowCount === 1) {
    console.log('✅ Success! Journal entry updated:');
    console.table(res.rows);
  } else {
    console.error('❌ Failed to update journal entry. Row not found or status not VOIDED.');
  }

  await client.end();
}

applyFix().catch(console.error);
