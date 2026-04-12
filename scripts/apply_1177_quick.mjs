import fs from 'fs';
import pg from 'pg';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DB URL found in env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }});
async function run() {
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/1177_internal_password_resets.sql', 'utf8');
  await client.query(sql);
  console.log('Migration 1177 success!');
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
