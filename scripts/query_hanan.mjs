import nextEnv from '@next/env';
import pg from 'pg';
nextEnv.loadEnvConfig(process.cwd());

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT o.name, o.owner_email, e.nik, e.first_name, e.last_name, u.login_email, u.login_nik, u.id as internal_id
    FROM organizations o
    LEFT JOIN employees e ON e.org_id = o.id
    LEFT JOIN internal_auth_users u ON u.id = e.user_id OR u.legacy_user_id = e.user_id
    WHERE o.name ILIKE '%Hanan%'
  `);
  console.table(res.rows);
  await client.end();
}
run();
