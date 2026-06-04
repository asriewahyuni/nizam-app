import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const schema = await queryPostgres(`
    SELECT column_name, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'branches' AND column_name = 'is_active'
  `);
  console.log(schema.rows);

  const bobBranch = await queryPostgres(`
    SELECT is_active FROM branches WHERE id = 'dc72406d-45f7-4cfe-9140-aa7371600aa7'
  `);
  console.log(bobBranch.rows);
  
  process.exit(0);
}
main().catch(console.error);
