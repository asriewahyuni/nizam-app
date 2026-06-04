import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const branches = await queryPostgres("SELECT column_name FROM information_schema.columns WHERE table_name = 'branches'");
  console.log('branches columns:', branches.rows);

  const orgs = await queryPostgres("SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations'");
  console.log('orgs columns:', orgs.rows);

  const modules = await queryPostgres("SELECT * FROM org_module_instances WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'");
  console.log('Bintang Marwah modules:', modules.rows);

  process.exit(0);
}

main().catch(console.error);
