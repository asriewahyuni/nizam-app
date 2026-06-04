import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const result = await queryPostgres(`
    SELECT * FROM org_members 
    WHERE user_id = '24df61b4-f765-4378-b2da-1328fb63c65f'
  `);
  console.log('Bob Memberships:', result.rows);
  
  const budiResult = await queryPostgres(`
    SELECT * FROM org_members 
    WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  `);
  console.log('Nizam App Memberships:', budiResult.rows.map(r => r.user_id));
  
  process.exit(0);
}
main().catch(console.error);
