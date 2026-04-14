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
  console.log('✅ Terhubung ke Railway PostgreSQL...');

  const sql = fs.readFileSync('supabase/migrations/1200_open_api.sql', 'utf8');
  
  // Jalankan per statement untuk output yang lebih jelas
  await client.query(sql);
  
  console.log('✅ Migration 1200_open_api.sql berhasil dijalankan!');
  console.log('   Tabel baru: api_keys, api_configurations, api_rate_limit_log, api_webhook_deliveries');
  
  await client.end();
}

run().catch(e => {
  console.error('❌ Migration gagal:', e.message);
  process.exit(1);
});
