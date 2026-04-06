import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: orgs } = await supabase.from('organizations').select('id, name').ilike('name', '%Nizam%App%')
  const orgId = orgs[0].id

  console.log('Org ID:', orgId)

  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, nik, first_name, org_id, branch_id', { count: 'exact' })
    .eq('org_id', orgId)

  console.log('Error:', error)
  console.log('Employees in this org:', employees)

  const { data: b } = await supabase.from('branches').select('id, name').eq('org_id', orgId)
  console.log('Branches in this org:', b)
}

run()
