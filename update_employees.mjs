import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Missing env variables')
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', '%Nizam%App%')
  console.log('Orgs found:', orgs)
  
  if (!orgs || orgs.length === 0) return

  const orgId = orgs[0].id

  const { data: branches, error: branchErr } = await supabase
    .from('branches')
    .select('id, name, is_main')
    .eq('org_id', orgId)
    .order('is_main', { ascending: false })

  console.log('Branches found:', branches)

  if (!branches || branches.length === 0) return

  // Assume the first one is the main, or filter by is_main
  const mainBranch = branches.find(b => b.is_main) || branches[0]
  console.log('Target branch ID:', mainBranch.id)

  const employeeIds = ['NIZ04260001', 'NIZ04260002', 'NIZ04260003', 'NIZ04260004']
  
  const { data: updated, error: updateErr } = await supabase
    .from('employees')
    .update({ branch_id: mainBranch.id })
    .in('employee_id', employeeIds)
    .eq('org_id', orgId)
    .select('id, employee_id, first_name, branch_id')

  if (updateErr) {
    console.error('Update error:', updateErr)
  } else {
    console.log('Updated employees:', updated)
  }
}

run()
