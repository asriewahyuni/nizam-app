import { config } from 'dotenv';
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function test() {
  const orgId = '6daf5e57-118c-4414-a0bc-35c5e346876f';
  // Simulate the main query
  const sql = `SELECT * FROM public."fleet_cargo_shipments" WHERE "org_id" = $1 ORDER BY "created_at" DESC`;
  const result = await queryPostgres(sql, [orgId]);
  let rows = result.rows;
  
  // Simulate the relation resolution for 'origin'
  const foreignIds = Array.from(new Set(rows.map(r => r.origin_terminal_id).filter(Boolean)));
  
  const relSql = `SELECT id, name, location_name FROM public."fleet_terminals" WHERE id = ANY($1::uuid[])`;
  const relResult = await queryPostgres(relSql, [foreignIds]);
  const relById = new Map(relResult.rows.map(r => [String(r.id), r]));
  
  rows = rows.map(r => ({
    ...r,
    origin: relById.get(String(r.origin_terminal_id)) ?? null
  }));

  console.log(JSON.stringify(rows[0], null, 2));
}
test().catch(console.error);
