import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function reload() {
  const { data, error } = await supabase.rpc('reload_schema_cache', {}).catch(() => ({}));
  console.log("RPC Method tried");
  
  // Or just a raw fetch if they have postgres running locally
}
reload();
