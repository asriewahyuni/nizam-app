const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
async function check() {
  const { rows: anggota } = await pool.query("SELECT id, nama, kode_anggota, user_id FROM kojasmat_anggota WHERE kode_anggota IN ('KJM-001', 'KJM-002')");
  console.log("Anggota records:", anggota);
  
  const { rows: users } = await pool.query("SELECT id, email, raw_user_meta_data FROM internal_auth_users WHERE email LIKE '%@%' LIMIT 10");
  console.log("\nUsers in DB:");
  users.forEach(u => {
    console.log(`- ${u.email} (ID: ${u.id}) (Meta: ${JSON.stringify(u.raw_user_meta_data)})`);
  });
  pool.end();
}
check().catch(console.error);
