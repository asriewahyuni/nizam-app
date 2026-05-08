import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function test() {
  await client.connect();
  try {
    await client.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT '{}';`);
    console.log('Added enabled_modules column.');
  } catch (e) {
    console.error(e.message);
  }
  await client.end();
}
test();
