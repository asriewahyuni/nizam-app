import { Client } from 'pg'
const client = new Client({ connectionString: 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway' })
await client.connect()
const { rows } = await client.query(`
  SELECT id, legacy_user_id, login_nik, password_hash, is_active FROM internal_auth_users WHERE upper(login_nik) = 'NIZ04260001'
`)
console.log('internal_auth_users', rows)

const { rows: legacyRows } = await client.query(`
  SELECT id, email FROM auth.users WHERE id = $1
`, [rows[0]?.legacy_user_id])
console.log('auth.users', legacyRows)

await client.end()
