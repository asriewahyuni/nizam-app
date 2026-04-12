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
    SET password_hash = $1 
    WHERE login_email IN ('info.hananbogarasa@gmail.com', 'sindrawati503@gmail.com')
  `, [newHash]);
  console.log('Password forcibly updated!');
  await client.end();
}
run();
