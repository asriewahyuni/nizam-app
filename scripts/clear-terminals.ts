import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const childOrgId = '1f9f748e-b728-4ad2-a02b-ada0fd65268f';

  // Delete all terminals for this org
  const res = await queryPostgres("DELETE FROM fleet_terminals WHERE org_id = $1", [childOrgId]);
  
  console.log(`Deleted ${res.rowCount} terminals for org ${childOrgId}`);
  process.exit(0);
}

main().catch(console.error);
