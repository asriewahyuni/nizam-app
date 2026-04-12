import nextEnv from '@next/env';
import pg from 'pg';
nextEnv.loadEnvConfig(process.cwd());

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT * FROM internal_auth_users WHERE login_email = 'info.hananbogarasa@gmail.com' OR login_email = 'sindrawati503@gmail.com'
  `);
  console.table(res.rows);
  await client.end();
}
run();
