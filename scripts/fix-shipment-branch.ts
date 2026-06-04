import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  await queryPostgres(`
    UPDATE fleet_cargo_shipments 
    SET branch_id = '3ccc960a-b430-49aa-93f1-9970f7e65618' 
    WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  `);
  console.log('Fixed branch IDs for shipments');
  process.exit(0);
}
main().catch(console.error);
