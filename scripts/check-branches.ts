import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const orgId = '6daf5e57-118c-4414-a0bc-35c5e346876f';
  const branches = await queryPostgres("SELECT id, name FROM branches WHERE org_id = $1", [orgId]);
  console.log('Branches:', branches.rows);

  const shipments = await queryPostgres("SELECT tracking_number, branch_id FROM fleet_cargo_shipments WHERE org_id = $1", [orgId]);
  console.log('Shipments:', shipments.rows);

  process.exit(0);
}
main().catch(console.error);
