import nextEnv from '@next/env';
import pg from 'pg';
import crypto from 'crypto';

nextEnv.loadEnvConfig(process.cwd());

function hashPasswordWithScrypt(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }});

async function run() {
  await client.connect();
  const newHash = hashPasswordWithScrypt('Hanan2026!');
  await client.query(`
    UPDATE internal_auth_users 
    SET password_hash = $1, login_nik = 'EMP04260001'
    WHERE id = '9e29d396-f9dd-4a2a-909b-669142615aaf'
  `, [newHash]);
  console.log('Sindrawati NIK and password updated!');
  await client.end();
}
run();
