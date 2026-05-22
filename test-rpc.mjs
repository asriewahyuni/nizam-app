import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function test() {
  await client.connect();
  try {
    const res = await client.query(`SELECT append_enabled_module((SELECT id FROM organizations LIMIT 1), 'LMS');`);
    console.log('Success append');
    const res2 = await client.query(`SELECT remove_enabled_module((SELECT id FROM organizations LIMIT 1), 'LMS');`);
    console.log('Success remove');
  } catch (e) {
    console.error(e);
  }
  await client.end();
}
test();
