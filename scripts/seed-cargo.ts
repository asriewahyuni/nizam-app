import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const email = 'budi.santoso.demo@kliknizam.app';
  
  // Find User in internal_auth_users
  const authUsers = await queryPostgres('SELECT id FROM internal_auth_users WHERE login_email = $1', [email]);
  let userId;
  if (authUsers.rows.length === 0) {
    console.log('User bob@executive.id not found in internal_auth_users, creating...');
    const newAuthUser = await queryPostgres(`
      INSERT INTO internal_auth_users (login_email, password_hash, display_name, user_type)
      VALUES ($1, 'dummy_hash', 'Bob Executive', 'owner')
      RETURNING id
    `, [email]);
    userId = newAuthUser.rows[0].id;
  } else {
    userId = authUsers.rows[0].id;
  }
  console.log('User ID:', userId);

  // Ensure user exists in auth.users just to bypass FK constraints
  try {
    await queryPostgres(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, email]);
  } catch(e) {
    // maybe auth schema doesn't exist, try public.users
    try {
       await queryPostgres(`INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, email]);
    } catch(err) {
       console.log('Warning: could not insert into auth.users or users', err.message);
    }
  }

  // Find Org
  let memberships = await queryPostgres('SELECT org_id, role FROM org_members WHERE user_id = $1', [userId]);
  let orgId = memberships.rows.length > 0 ? memberships.rows[0].org_id : null;
  
  if (!orgId) {
    // If no org, create one
    const newOrg = await queryPostgres(`
      INSERT INTO organizations (name, slug, is_active)
      VALUES ('Bob Executive Org', 'bob-org', true)
      RETURNING id
    `);
    orgId = newOrg.rows[0].id;
    
    // Assign user to org
    await queryPostgres(`
      INSERT INTO org_members (org_id, user_id, role, is_active)
      VALUES ($1, $2, 'owner', true)
    `, [orgId, userId]);
    console.log(`Created and assigned Bob to new Org ID: ${orgId}`);
  } else {
    console.log('Org ID:', orgId);
  }

  // Get Branch or create one
  let branchId = null;
  const branches = await queryPostgres('SELECT id FROM branches WHERE org_id = $1 LIMIT 1', [orgId]);
  if (branches.rows.length > 0) {
    branchId = branches.rows[0].id;
  } else {
    const newBranch = await queryPostgres(`
      INSERT INTO branches (org_id, name, type)
      VALUES ($1, 'Pusat Operasional', 'headquarter')
      RETURNING id
    `, [orgId]);
    branchId = newBranch.rows[0].id;
  }
  
  // Install Fleet module for org if not installed
  try {
    await queryPostgres(`
      INSERT INTO org_module_instances (org_id, module_key, is_active)
      VALUES ($1, 'fleet', true)
      ON CONFLICT (org_id, module_key) DO UPDATE SET is_active = true
    `, [orgId]);
  } catch (e) {
    console.log('Could not insert into org_module_instances, might not exist', e.message);
  }

  // Seed Terminals
  const terminals = await queryPostgres(`
    INSERT INTO fleet_terminals (org_id, branch_id, name, location_name)
    VALUES 
      ($1, $2, 'Terminal Poris', 'Tangerang'),
      ($1, $2, 'Terminal Giwangan', 'Yogyakarta')
    RETURNING id
  `, [orgId, branchId]);
  
  const terminalOrigin = terminals.rows[0].id;
  const terminalDest = terminals.rows[1].id;

  // Seed Asset
  const assets = await queryPostgres(`
    INSERT INTO fleet_assets (org_id, branch_id, type, model, plate_number, capacity, status)
    VALUES ($1, $2, 'BUS', 'Mercedes-Benz OH 1626', 'B 7777 XX', 40, 'AVAILABLE')
    RETURNING id
  `, [orgId, branchId]);
  const assetId = assets.rows[0].id;

  // Seed Route
  const routes = await queryPostgres(`
    INSERT INTO fleet_routes (org_id, branch_id, name, origin, destination, base_price)
    VALUES ($1, $2, 'Tangerang - Jogja VIP', 'Tangerang', 'Yogyakarta', 250000)
    RETURNING id
  `, [orgId, branchId]);
  const routeId = routes.rows[0].id;

  // Seed Schedule
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const schedules = await queryPostgres(`
    INSERT INTO fleet_schedules (org_id, branch_id, asset_id, route_id, departure_time, status)
    VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')
    RETURNING id
  `, [orgId, branchId, assetId, routeId, tomorrow.toISOString()]);
  const scheduleId = schedules.rows[0].id;

  // Clear existing cargo to avoid duplicate AWB
  await queryPostgres(`DELETE FROM fleet_cargo_shipments WHERE org_id = $1`, [orgId]);

  // Seed Cargo
  await queryPostgres(`
    INSERT INTO fleet_cargo_shipments (org_id, branch_id, tracking_number, sender_name, sender_phone, receiver_name, receiver_phone, origin_terminal_id, destination_terminal_id, item_description, weight_kg, volume_m3, shipping_cost, handling_fee, grand_total, payment_status, schedule_id, status)
    VALUES 
      ($1, $2, 'AWB-20260604-1111', 'Agus Pengirim', '08111', 'Budi Penerima', '08222', $3, $4, 'Dokumen Penting', 1.5, 0, 17500, 0, 17500, 'PAID', $5, 'MANIFESTED'),
      ($1, $2, 'AWB-20260604-2222', 'Citra Pengirim', '08333', 'Dina Penerima', '08444', $3, $4, 'Pakaian', 5.0, 0, 35000, 0, 35000, 'UNPAID', null, 'DRAFT'),
      ($1, $2, 'AWB-20260604-3333', 'Eko Pengirim', '08555', 'Fani Penerima', '08666', $3, $4, 'Makanan Kering', 2.0, 0, 20000, 0, 20000, 'PAID', $5, 'ARRIVED')
  `, [orgId, branchId, terminalOrigin, terminalDest, scheduleId]);

  console.log('Seed success!');
  process.exit(0);
}

main().catch(console.error);
