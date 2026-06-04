import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const parentOrgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65';

  // Cleanup existing child orgs if any
  await queryPostgres("DELETE FROM organizations WHERE name = 'Bintang Marwah Cabang'");

  // Create child org
  const childOrgRes = await queryPostgres(`
    INSERT INTO organizations (name, slug, parent_org_id, settings, is_active)
    VALUES ('Bintang Marwah Cabang', 'bintang-marwah-cabang', $1, '{}'::jsonb, true)
    RETURNING id
  `, [parentOrgId]);
  
  const childOrgId = childOrgRes.rows[0].id;
  console.log(`Created child org: ${childOrgId}`);

  // Find users in parent org
  const membersRes = await queryPostgres(`
    SELECT user_id, role FROM org_members WHERE org_id = $1
  `, [parentOrgId]);

  // Assign them to child org
  for (const member of membersRes.rows) {
    await queryPostgres(`
      INSERT INTO org_members (org_id, user_id, role, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT DO NOTHING
    `, [childOrgId, member.user_id, member.role]);
    console.log(`Assigned user ${member.user_id} with role ${member.role}`);
  }

  // Create a default branch for the child org
  const branchRes = await queryPostgres(`
    INSERT INTO branches (org_id, name, code)
    VALUES ($1, 'Pusat Cabang', 'CAB-001')
    RETURNING id
  `, [childOrgId]);
  const branchId = branchRes.rows[0].id;

  // Enable Fleet Cargo module
  await queryPostgres(`
    INSERT INTO org_module_instances (org_id, module_key, status)
    VALUES ($1, 'Fleet & Rental', 'READY')
    ON CONFLICT (org_id, module_key) DO UPDATE SET status = 'READY'
  `, [childOrgId]);
  console.log(`Enabled fleet module for child org`);

  // Seed default terminals
  await queryPostgres(`
    INSERT INTO fleet_terminals (org_id, branch_id, name, location_name)
    VALUES 
      ($1, $2, 'Terminal Cabang Utama', 'Jakarta'),
      ($1, $2, 'Terminal Cabang Pembantu', 'Bandung')
  `, [childOrgId, branchId]);

  console.log('Successfully created child org and enabled Fleet module.');
  process.exit(0);
}

main().catch(console.error);
