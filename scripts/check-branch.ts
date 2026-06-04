import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const result = await queryPostgres(`
    SELECT * FROM branches WHERE name = 'Unit Utama'
  `);
  console.log('Unit Utama:', result.rows);
  
  process.exit(0);
}
main().catch(console.error);
