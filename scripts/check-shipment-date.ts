import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const result = await queryPostgres(`
    SELECT tracking_number, updated_at FROM fleet_cargo_shipments 
    WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  `);
  console.log('Shipments Date:', result.rows);
  
  process.exit(0);
}
main().catch(console.error);
