require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
const { createHmac } = require('crypto');

function hashSessionToken(token) {
  const secret = process.env.INTERNAL_AUTH_SESSION_SECRET;
  if (!secret) throw new Error('INTERNAL_AUTH_SESSION_SECRET is not set');
  return createHmac('sha256', secret).update(token).digest('hex');
}

const token = "DUrznIdkAnvhL_qMHiT929YYx2ng_AD2JQB3PCM4yoI";
const tokenHash = hashSessionToken(token);
console.log("Token Hash:", tokenHash);

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
pool.query("SELECT * FROM internal_auth_sessions WHERE token_hash = $1", [tokenHash]).then(res => {
  console.log("Session in DB:", res.rows[0]);
  pool.end();
}).catch(console.error);
