const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('sales').select('status').not('status', 'in', '("DRAFT","VOIDED")').limit(3);
  console.log('sales with ("DRAFT","VOIDED"):', data, error);
  const { data: d2, error: e2 } = await supabase.from('sales').select('status').not('status', 'in', '(DRAFT,VOIDED)').limit(3);
  console.log('sales with (DRAFT,VOIDED):', d2, e2);
  const { data: d3, error: e3 } = await supabase.from('sales').select('status').limit(3);
  console.log('sales without filter:', d3, e3);
  process.exit(0);
}
run();
