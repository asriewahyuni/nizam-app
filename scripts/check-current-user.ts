import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const orgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65';
  const org = await queryPostgres("SELECT name FROM organizations WHERE id = $1", [orgId]);
  console.log('Org Name:', org.rows[0]?.name);

  const members = await queryPostgres(`
    SELECT u.login_email, m.role 
    FROM org_members m 
    JOIN internal_auth_users u ON u.id = m.user_id 
    WHERE m.org_id = $1
  `, [orgId]);
  console.log('Members:', members.rows);

  process.exit(0);
}
main().catch(console.error);
