const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const payload = {
    name: 'TestPackage',
    price: 1000,
    billing: 'Bulan',
    is_active: true,
    modules: ['Dashboard', 'Akun (CoA)'],
    duration_days: 30,
    max_orgs: 1,
    max_warehouses: 1,
  };

  const { data, error } = await supabase.from('saas_packages').upsert([payload], { onConflict: 'name' });
  console.log("Upsert with array:", error?.message || 'Success');

  const payload2 = {
    name: 'TestPackage2',
    price: 1000,
    billing: 'Bulan',
    is_active: true,
    modules: JSON.stringify(['Dashboard', 'Akun (CoA)']),
    duration_days: 30,
    max_orgs: 1,
    max_warehouses: 1,
  };

  const { data: d2, error: e2 } = await supabase.from('saas_packages').upsert([payload2], { onConflict: 'name' });
  console.log("Upsert with JSON.stringify:", e2?.message || 'Success');
}

run();
