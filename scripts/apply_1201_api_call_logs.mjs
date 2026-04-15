import fs from 'fs';
import pg from 'pg';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Tidak ada DATABASE_URL ditemukan di .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('✅ Terhubung ke PostgreSQL...');

  const sql = fs.readFileSync('supabase/migrations/1201_api_call_logs.sql', 'utf8');
  await client.query(sql);

  console.log('✅ Migration 1201_api_call_logs.sql berhasil dijalankan!');
  console.log('   Tabel baru: api_call_logs');

  await client.end();
}

run().catch(e => {
  console.error('❌ Migration gagal:', e.message);
  process.exit(1);
});
