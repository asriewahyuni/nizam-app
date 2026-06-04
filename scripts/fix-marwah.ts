import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const childOrgId = '1f9f748e-b728-4ad2-a02b-ada0fd65268f';
  const trueParentId = '1fa61ebe-ef1e-4eda-aad3-203ee437f222';

  // Update parent_org_id
  await queryPostgres("UPDATE organizations SET parent_org_id = $1 WHERE id = $2", [trueParentId, childOrgId]);
  
  // Also rename it to 'Kargo Bintang Marwah' or something? The user asked 'buat akun child dibawah Bintang Marwah ya, dengan mengaktifkan fitur ini'
  // I will rename it to 'Bintang Marwah Kargo'
  await queryPostgres("UPDATE organizations SET name = 'Bintang Marwah Kargo', slug = 'bintang-marwah-kargo' WHERE id = $1", [childOrgId]);

  // Find users in true parent
  const parentUsers = await queryPostgres("SELECT user_id, role FROM org_members WHERE org_id = $1", [trueParentId]);
  
  // Assign parent users to child org
  for (const member of parentUsers.rows) {
    await queryPostgres(`
      INSERT INTO org_members (org_id, user_id, role, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT DO NOTHING
    `, [childOrgId, member.user_id, member.role]);
  }

  console.log('Fixed child org and attached to BINTANG MARWAH AMAZING GROUP.');
  process.exit(0);
}

main().catch(console.error);
