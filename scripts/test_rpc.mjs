import pkg from 'pg'
const { Client } = pkg
const dbUrl = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

async function testRpc() {
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const orgId = 'c0a80121-0000-0000-0000-000000000000' // dummy uuid
    // Test append_enabled_module
    try {
      await client.query('SELECT * FROM public."append_enabled_module"(p_org_id => $1, p_module_key => $2)', [orgId, 'lms'])
      console.log('append_enabled_module SUCCESS')
    } catch (e) {
      console.log('append_enabled_module ERROR:', e.message)
    }

    // Test inject_lms_coa
    try {
      await client.query('SELECT * FROM public."inject_lms_coa"(p_org_id => $1)', [orgId])
      console.log('inject_lms_coa SUCCESS')
    } catch (e) {
      console.log('inject_lms_coa ERROR:', e.message)
    }
  } finally {
    await client.end()
  }
}
testRpc()
