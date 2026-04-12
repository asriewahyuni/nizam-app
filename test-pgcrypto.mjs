import { Client } from 'pg'
const client = new Client({ connectionString: 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway' })
await client.connect()
const { rows } = await client.query(`SELECT extensions.crypt('test', extensions.gen_salt('bf'))`)
console.log(rows)
await client.end()
