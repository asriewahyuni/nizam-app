import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const orgs = await queryPostgres("SELECT id, name, parent_org_id FROM organizations WHERE name ILIKE '%Marwah%'");
  console.log(orgs.rows);
  process.exit(0);
}

main().catch(console.error);
