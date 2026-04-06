import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  // Let's deliberately cause the error to see what PostgRest hints
  const { data, error } = await supabase.from('employees').select('*, branches(*)').limit(1)
  console.log('Error:', error)
}

run()
