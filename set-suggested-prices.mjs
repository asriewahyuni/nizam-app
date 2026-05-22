import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const suggestedCorePrices = {
  'Sales': 149000,
  'Finance': 199000,
  'Accounting': 299000,
  'Inventory': 149000,
  'Manufacturing': 299000,
  'HRIS': 249000,
  'CRM': 149000,
  'Point of Sale': 149000,
  'Purchasing': 149000
};

const suggestedOperationalPrices = {
  'Fleet & Rental': 249000,
  'Job Order (Jasa)': 199000,
  'Project & Construction': 299000,
  'Syirkah': 149000,
  'LMS': 249000
};

const suggestedAddonPrices = {
  'Warehouse': 99000,
  'Multi-Entitas (Holding)': 199000, // or whatever the name is
  'Integrasi API': 249000,
  'Sales Page': 149000,
  'Quick Bill': 49000,
  'Fleet Maintenance Pack': 149000,
  'Package Tracking': 149000,
  'Sales AR Cockpit': 99000,
  'Sales AR Seat Pack': 69000
};

async function test() {
  await client.connect();
  try {
    const { data, error } = await client.query(`
      UPDATE saas_packages 
      SET 
        core_prices = $1::jsonb,
        operational_prices = $2::jsonb,
        addon_prices = $3::jsonb
    `, [
      JSON.stringify(suggestedCorePrices), 
      JSON.stringify(suggestedOperationalPrices), 
      JSON.stringify(suggestedAddonPrices)
    ]);
    console.log('Successfully updated suggested prices in the database!');
  } catch (e) {
    console.error(e.message);
  }
  await client.end();
}
test();
