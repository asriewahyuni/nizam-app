import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const result = await queryPostgres(`
    SELECT * FROM roles WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  `);
  console.log('Roles:', JSON.stringify(result.rows, null, 2));
  
  process.exit(0);
}
main().catch(console.error);
