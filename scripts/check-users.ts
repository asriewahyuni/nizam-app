import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const users = await queryPostgres(`SELECT id, login_email, display_name FROM internal_auth_users`);
  console.log('Users:', users.rows);
  process.exit(0);
}
main().catch(console.error);
