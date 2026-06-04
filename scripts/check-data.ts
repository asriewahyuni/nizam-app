import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const users = await queryPostgres("SELECT id FROM internal_auth_users WHERE login_email = 'bob@executive.id'");
  if (users.rows.length === 0) return console.log('Bob not found in .env DB');
  const userId = users.rows[0].id;
  
  const memberships = await queryPostgres("SELECT org_id FROM org_members WHERE user_id = $1", [userId]);
  if (memberships.rows.length === 0) return console.log('Bob has no org in .env DB');
  const orgId = memberships.rows[0].org_id;
  
  const shipments = await queryPostgres("SELECT id, tracking_number, status, branch_id FROM fleet_cargo_shipments WHERE org_id = $1", [orgId]);
  console.log('Shipments in .env DB:', shipments.rows);

  process.exit(0);
}
main().catch(console.error);
