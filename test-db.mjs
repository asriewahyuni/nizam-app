import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function test() {
  await client.connect();
  const res = await client.query(`SELECT id, name, enabled_modules FROM organizations LIMIT 5;`);
  console.log(res.rows);
  await client.end();
}
test();
