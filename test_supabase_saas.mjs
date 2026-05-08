import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

async function run() {
  const { createClient } = await import('@supabase/supabase-js')
  // We need to use service_role because saas_invoices might have RLS? Actually we use postgres
  // Let's test the exact supabase query
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  const { data: invoices, error } = await supabase
    .from('saas_invoices')
    .select(`
      id,
      org_id,
      invoice_number,
      created_at,
      amount,
      status,
      reseller_id,
      organization:org_id(name),
      reseller:reseller_id!inner(
        id,
        org_id,
        name,
        reseller_type,
        company_name,
        contact_person,
        commission_type,
        commission_value
      )
    `)
    .not('reseller_id', 'is', null)
    .not('invoice_number', 'ilike', 'QUOTE-%')
    .eq('reseller.org_id', 'f4455b6f-c7fc-4164-9732-a906bcce5e65')

  console.log('Error:', error)
  console.log('Invoices via supabase:', invoices)
}
run()
