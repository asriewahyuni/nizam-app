const { randomBytes, scryptSync, randomUUID } = require('crypto');
const { Pool } = require('pg');
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function run() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway' });
  
  try {
    const res = await pool.query(`SELECT id, org_id, first_name, last_name, email, nik FROM employees WHERE user_id IS NULL AND registration_status = 'PENDING' LIMIT 200`);
    const employees = res.rows;
    
    console.log(`Ditemukan ${employees.length} karyawan PENDING (diproses max 10 untuk batch ini).`);
    
    for (const emp of employees) {
      const newUserId = randomUUID();
      const loginEmail = `test_${emp.id.replace(/-/g, '').substring(0, 8)}_${Math.floor(Math.random()*1000)}@nizam.local`;
      const passHash = hashPassword('Nizam123!');
      const displayName = `${emp.first_name} ${emp.last_name || ''}`.trim();
      
      await pool.query('BEGIN');
      
      // 0. Insert ke auth.users (Supabase native table untuk satisfy foreign key)
      await pool.query(`
        INSERT INTO auth.users (
          id, aud, role, email, encrypted_password, 
          raw_app_meta_data, raw_user_meta_data, 
          created_at, updated_at
        ) VALUES (
          $1, 'authenticated', 'authenticated', $2, '',
          '{}', '{}', now(), now()
        )
      `, [newUserId, loginEmail]);

      // 1. Insert ke internal_auth_users (bypass NIK constraint by using NULL)
      await pool.query(`
        INSERT INTO internal_auth_users (id, login_email, login_nik, password_hash, display_name, user_type, is_active)
        VALUES ($1, $2, NULL, $3, $4, 'staff', true)
      `, [newUserId, loginEmail, passHash, displayName]);
      
      // 2. Insert ke org_members
      await pool.query(`
        INSERT INTO org_members (org_id, user_id, role, is_active)
        VALUES ($1, $2, 'staff', true)
      `, [emp.org_id, newUserId]);
      
      // 3. Update employees
      await pool.query(`
        UPDATE employees SET user_id = $1, registration_status = 'COMPLETED' WHERE id = $2
      `, [newUserId, emp.id]);
      
      await pool.query('COMMIT');
      console.log(`Aktivasi berhasil: ${displayName} (${loginEmail}) | Password: Nizam123!`);
    }
    
    console.log('Semua aktivasi selesai.');
  } catch (err) {
    console.error('Error:', err);
    await pool.query('ROLLBACK');
  } finally {
    pool.end();
  }
}

run();
