import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query(`SELECT * FROM internal_auth_users WHERE email = 'yanto@gmail.com'`);
    console.log("User:", res.rows[0]);
    
    if (!res.rows[0]) {
      console.log("User not found!");
      return;
    }

    const orgMemberRes = await pool.query(`SELECT * FROM org_members WHERE user_id = $1`, [res.rows[0].id]);
    console.log("Org Member:", orgMemberRes.rows);
  } finally {
    await pool.end();
  }
}
run();
