import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { queryPostgres } from '../lib/db/postgres';

async function main() {
  const orgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'; // NIZAM APP
  const branchId = '3ccc960a-b430-49aa-93f1-9970f7e65618'; // Their active branch
  
  // Create Demo Terminals
  const terminals = await queryPostgres(`
    INSERT INTO fleet_terminals (org_id, branch_id, name, location_name)
    VALUES 
      ($1, $2, 'Terminal Poris', 'Tangerang'),
      ($1, $2, 'Terminal Giwangan', 'Yogyakarta')
    RETURNING id
  `, [orgId, branchId]);
  
  const termTangerangId = terminals.rows[0].id;
  const termJogjaId = terminals.rows[1].id;

  // Create Demo Routes
  const routes = await queryPostgres(`
    INSERT INTO fleet_routes (org_id, origin_terminal_id, destination_terminal_id, distance_km, estimated_duration_minutes)
    VALUES ($1, $2, $3, 550, 600)
    RETURNING id
  `, [orgId, termTangerangId, termJogjaId]);

  // Create Demo Buses
  const buses = await queryPostgres(`
    INSERT INTO fleet_buses (org_id, plate_number, status, capacity_seats, capacity_cargo_kg)
    VALUES ($1, 'B 1234 NIZ', 'AVAILABLE', 40, 2000)
    RETURNING id
  `, [orgId]);

  // Create Demo Drivers
  const drivers = await queryPostgres(`
    INSERT INTO fleet_drivers (org_id, name, license_number, status)
    VALUES ($1, 'Pak Sopir Demo', 'SIM-12345', 'AVAILABLE')
    RETURNING id
  `, [orgId]);

  // Create Schedule
  const schedules = await queryPostgres(`
    INSERT INTO fleet_schedules (org_id, route_id, bus_id, driver_id, departure_time, arrival_time)
    VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '9 hours')
    RETURNING id
  `, [orgId, routes.rows[0].id, buses.rows[0].id, drivers.rows[0].id]);

  // Seed Cargo
  await queryPostgres(`
    INSERT INTO fleet_cargo_shipments (org_id, branch_id, tracking_number, sender_name, sender_phone, receiver_name, receiver_phone, origin_terminal_id, destination_terminal_id, item_description, weight_kg, shipping_cost, payment_status, schedule_id, status)
    VALUES 
      ($1, $2, 'AWB-NIZAM-1111', 'Agus Pengirim', '08111', 'Budi Penerima', '08222', $3, $4, 'Dokumen Penting', 1.5, 17500, 'PAID', $5, 'MANIFESTED'),
      ($1, $2, 'AWB-NIZAM-2222', 'Citra Pengirim', '08333', 'Deni Penerima', '08444', $3, $4, 'Suku Cadang', 5.0, 45000, 'UNPAID', $5, 'DRAFT'),
      ($1, $2, 'AWB-NIZAM-3333', 'Eka Pengirim', '08555', 'Fajar Penerima', '08666', $3, $4, 'Makanan Kering', 2.0, 20000, 'PAID', $5, 'ARRIVED')
  `, [orgId, branchId, termTangerangId, termJogjaId, schedules.rows[0].id]);

  console.log('Successfully seeded data to NIZAM APP org');
  process.exit(0);
}

main().catch(console.error);
