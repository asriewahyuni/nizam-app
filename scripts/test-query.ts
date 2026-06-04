import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

// Mock the dependencies of postgres-client.ts so we can run it here
jest = require('jest-mock');
jest.mock('../lib/auth/internal-auth.server', () => ({
  getInternalAuthSession: () => ({ user: { id: 'dummy' } })
}));

import { createClient } from '../lib/supabase/server';

async function main() {
  const supabase = createClient();
  const orgId = '6daf5e57-118c-4414-a0bc-35c5e346876f';
  const { data, error } = await supabase
    .from('fleet_cargo_shipments')
    .select(`
      *,
      origin:fleet_terminals!origin_terminal_id(id, name, location_name),
      destination:fleet_terminals!destination_terminal_id(id, name, location_name),
      schedule:fleet_schedules(id, departure_time, route_id)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));

  process.exit(0);
}
main().catch(console.error);
