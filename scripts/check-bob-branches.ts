import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const result = await queryPostgres(`
    SELECT * FROM org_member_units 
    WHERE org_member_id = 'c10589af-b4b8-4c32-abff-c433e6422dc0'
  `);
  console.log('Bob Branch Assignments:', result.rows);
  
  process.exit(0);
}
main().catch(console.error);
