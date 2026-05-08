import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  try {
    const { data } = await client.query(`SELECT addon_prices FROM saas_packages LIMIT 1`);
    if (data && data.length > 0) {
      const prices = data[0].addon_prices || {};
      prices['Multi-Entity (PT/CV)'] = 199000;
      delete prices['Multi-Entitas (Holding)'];
      await client.query(`UPDATE saas_packages SET addon_prices = $1::jsonb`, [JSON.stringify(prices)]);
      console.log('Fixed addon price key');
    }
  } catch (e) {
    console.error(e.message);
  }
  await client.end();
}
test();
