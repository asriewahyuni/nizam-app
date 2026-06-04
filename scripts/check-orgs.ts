import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const users = await queryPostgres("SELECT id FROM internal_auth_users WHERE login_email = 'bob@executive.id'");
  if (users.rows.length === 0) return console.log('Bob not found in .env DB');
  const userId = users.rows[0].id;
  
  const memberships = await queryPostgres(`
    SELECT m.org_id, o.name, m.role 
    FROM org_members m 
    JOIN organizations o ON o.id = m.org_id 
    WHERE m.user_id = $1
  `, [userId]);
  console.log('Bob Orgs:', memberships.rows);

  process.exit(0);
}
main().catch(console.error);
