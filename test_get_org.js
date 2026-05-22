const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: user } = await supabase.from('auth.users').select('*').eq('email', 'demo@nizam.app').single();
  console.log("User:", user);
  const {data} = await supabase.from('org_members').select('*').eq('user_id', user.id);
  console.log("Org Members:", data);
  const {data: orgs} = await supabase.from('organizations').select('*');
  console.log("Orgs:", orgs.filter(o => data.map(m=>m.org_id).includes(o.id)));
}
check().catch(console.error);
