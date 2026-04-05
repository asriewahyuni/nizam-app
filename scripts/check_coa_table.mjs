import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('Missing env vars'); process.exit(1) }

const sb = createClient(url, key)

async function main() {
  // 1. Check table via PostgREST
  const { data, error, count } = await sb
    .from('coa_account_requests')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.log('PostgREST ERROR:', error.message, '|', error.code)
  } else {
    console.log('PostgREST OK — row count:', count)
  }

  // 2. Check via information_schema (admin client bypasses PostgREST cache)
  const { data: d2, error: e2 } = await sb
    .from('information_schema.tables' )
    .select('table_name')
    .eq('table_schema', 'public')
    .ilike('table_name', 'coa%')

  if (e2) {
    console.log('info_schema check error:', e2.message)
  } else {
    console.log('info_schema tables matching coa%:', JSON.stringify(d2))
  }

  // 3. Try notify reload
  console.log('\nAttempting NOTIFY pgrst reload...')
  const { error: e3 } = await sb.rpc('notify_pgrst_reload')
  if (e3) {
    console.log('notify RPC not available:', e3.message)
    console.log('Please run manually in SQL editor: NOTIFY pgrst, \'reload schema\';')
  } else {
    console.log('Schema reload triggered successfully')
  }
}

main().catch(console.error)
