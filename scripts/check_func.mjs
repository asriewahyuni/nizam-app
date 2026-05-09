import pkg from 'pg'
const { Client } = pkg
const dbUrl = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

async function check() {
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const res = await client.query(`
      SELECT proname, pg_get_function_arguments(oid) as args
      FROM pg_proc 
      WHERE proname = 'inject_lms_coa'
    `)
    console.log(res.rows)
  } finally {
    await client.end()
  }
}
check()
