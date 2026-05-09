import fs from 'fs'
import pkg from 'pg'
const { Client } = pkg

const dbUrl = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

async function applySql(filename) {
  const sql = fs.readFileSync(filename, 'utf8')
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`Successfully applied ${filename}`)
  } catch (err) {
    console.error(`Failed to apply ${filename}:`, err.message)
  } finally {
    await client.end()
  }
}

async function main() {
  await applySql('supabase/migrations/1253_inject_lms_coa.sql')
  await applySql('supabase/migrations/1254_marketplace_deactivate_and_module_pricing.sql')
}

main()
