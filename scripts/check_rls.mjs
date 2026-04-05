import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { query: `
    SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual
    FROM pg_policy pol
    JOIN pg_class t ON pol.polrelid = t.oid
    WHERE t.relname = 'employees';
  `})
  
  if (error) {
    console.error('RPC Error:', error.message)
    // Try directly querying if RPC doesn't work (which we know it didn't)
    // Actually, just install pg and connect using connection string directly
  }
}

run()
