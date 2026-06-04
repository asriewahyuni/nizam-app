import { queryPostgres } from '../lib/db/postgres.js';
import crypto from 'crypto';

async function main() {
  const email = 'bob@executive.id';
  
  // Find User
  const users = await queryPostgres('SELECT id FROM internal_auth_users WHERE email = $1', [email]);
  if (users.length === 0) {
    console.log('User not found.');
    return;
  }
  const userId = users[0].id;
  console.log('User ID:', userId);

  // Find Org
  const memberships = await queryPostgres('SELECT org_id, role_id FROM organization_members WHERE user_id = $1', [userId]);
  if (memberships.length === 0) {
    console.log('User has no organization.');
    return;
  }
  const orgId = memberships[0].org_id;
  console.log('Org ID:', orgId);

  // Get Branch
  let branchId = null;
  const branches = await queryPostgres('SELECT id FROM branches WHERE org_id = $1 LIMIT 1', [orgId]);
  if (branches.length > 0) branchId = branches[0].id;
  
  // Seed Terminals
  const terminals = await queryPostgres(`
    INSERT INTO fleet_terminals (org_id, branch_id, name, code, city)
    VALUES 
      ($1, $2, 'Terminal Poris', 'PORIS', 'Tangerang'),
      ($1, $2, 'Terminal Giwangan', 'GIW', 'Yogyakarta')
    RETURNING id
  `, [orgId, branchId]);
  
  const terminalOrigin = terminals[0].id;
  const terminalDest = terminals[1].id;

  // Seed Asset
  const assets = await queryPostgres(`
    INSERT INTO fleet_assets (org_id, branch_id, type, model, plate_number, capacity, status)
    VALUES ($1, $2, 'BUS', 'Mercedes-Benz OH 1626', 'B 7777 XX', 40, 'AVAILABLE')
    RETURNING id
  `, [orgId, branchId]);
  const assetId = assets[0].id;

  // Seed Route
  const routes = await queryPostgres(`
    INSERT INTO fleet_routes (org_id, branch_id, name, origin, destination, base_price)
    VALUES ($1, $2, 'Tangerang - Jogja VIP', 'Tangerang', 'Yogyakarta', 250000)
    RETURNING id
  `, [orgId, branchId]);
  const routeId = routes[0].id;

  // Seed Schedule
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const schedules = await queryPostgres(`
    INSERT INTO fleet_schedules (org_id, branch_id, asset_id, route_id, departure_time, status)
    VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')
    RETURNING id
  `, [orgId, branchId, assetId, routeId, tomorrow.toISOString()]);
  const scheduleId = schedules[0].id;

  // Seed Cargo
  await queryPostgres(`
    INSERT INTO fleet_cargo_shipments (org_id, branch_id, tracking_number, sender_name, sender_phone, receiver_name, receiver_phone, origin_terminal_id, destination_terminal_id, item_description, weight_kg, volume_m3, shipping_cost, handling_fee, grand_total, payment_status, schedule_id, status)
    VALUES 
      ($1, $2, 'AWB-20260604-1111', 'Agus Pengirim', '08111', 'Budi Penerima', '08222', $3, $4, 'Dokumen Penting', 1.5, 0, 17500, 0, 17500, 'PAID', $5, 'MANIFESTED'),
      ($1, $2, 'AWB-20260604-2222', 'Citra Pengirim', '08333', 'Dina Penerima', '08444', $3, $4, 'Pakaian', 5.0, 0, 35000, 0, 35000, 'UNPAID', null, 'DRAFT'),
      ($1, $2, 'AWB-20260604-3333', 'Eko Pengirim', '08555', 'Fani Penerima', '08666', $3, $4, 'Makanan Kering', 2.0, 0, 20000, 0, 20000, 'PAID', $5, 'ARRIVED')
  `, [orgId, branchId, terminalOrigin, terminalDest, scheduleId]);

  console.log('Seed success!');
}

main().catch(console.error);
