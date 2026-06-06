import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway' });

const ORG = 'cb9a1111-26b5-4cb2-b54e-859ffd64c435';
const BRANCH = '096cffe9-50f7-495c-812b-b2741e69d59b';
const USER = 'eadb8e40-a0e0-473f-bf1e-d03d39731ebd'; // legacy_user_id (for org_members, contacts, employees, journals)
const AUTH_USER = '8d053947-12ce-4da6-82bc-7c4738d10226'; // internal_auth_users.id (for FKs to internal_auth_users)

// Account IDs
const ACC = {
  KAS: '81268b64-705d-4f94-9c2e-818858b67b02',
  BANK: 'a20d297b-363d-4033-a41a-49e9884037d3',
  PIUTANG: 'deed2230-d7c9-4122-b7d2-7c6d92aabafb',
  KENDARAAN: '57b00bef-f47d-4131-83b5-18f0bed3b355',
  HUTANG_USAHA: '620cdcad-bfdd-4276-94df-8be878a5d578',
  HUTANG_GAJI: '6b25afdb-6b67-4b8e-ad18-d5127dc93398',
  MODAL: 'f916f5ff-2ca9-4245-8e43-27255cb96166',
  PENDAPATAN: 'e226d30d-ce5e-4d90-9019-8cd4b473e170',
  GAJI: 'd8b758ca-e8ff-416d-80d6-ee6113c2b481',
  TRANSPORT: 'de0a9708-f8d6-4613-92ef-3b2fe548c16c',
  PEMELIHARAAN: '73d3d54c-ac18-4f9e-a97b-bf2bc4909429',
  ASURANSI: '07c55639-9c81-4209-b4a5-0182b00fd933',
  PENYUSUTAN: 'b3659d9f-9006-4493-8795-ad5acde74866',
  OPS_ARMADA: '4c36d02c-cb99-419f-a2b7-e8e94e77442e',
  SERVIS: '55e7c1d8-e121-4f47-90c7-74741a56757a',
  BBM: '08c642bb-cd2c-45b5-98a4-495c44954269',
};

function uuid() {
  return crypto.randomUUID();
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rndItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function dateOffset(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('=== Mulai seeding PO Bintang Marwah ===\n');

    // ─── 1. BANK ACCOUNT ─────────────────────────────────────────────────────
    const bankId1 = uuid();
    const bankId2 = uuid();
    const ACC_BANK_PAYROLL = 'dd22acce-8bc0-4784-b847-23cdfd971dab';
    await client.query(`
      INSERT INTO bank_accounts (id, org_id, branch_id, account_id, bank_name, account_number, account_holder, currency, is_active)
      VALUES
        ($1, $2, $3, $4, 'Bank BCA', '8870012345', 'PO BINTANG MARWAH', 'IDR', true),
        ($5, $2, $3, $6, 'Bank Mandiri', '1400099876', 'PO BINTANG MARWAH', 'IDR', true)
    `, [bankId1, ORG, BRANCH, ACC.BANK, bankId2, ACC_BANK_PAYROLL]);
    console.log('✓ Bank accounts (2)');

    // ─── 2. FISCAL PERIODS (Jan–Jun 2026) ────────────────────────────────────
    const fiscalIds = [];
    const months = [
      ['Januari 2026', '2026-01-01', '2026-01-31'],
      ['Februari 2026', '2026-02-01', '2026-02-28'],
      ['Maret 2026', '2026-03-01', '2026-03-31'],
      ['April 2026', '2026-04-01', '2026-04-30'],
      ['Mei 2026', '2026-05-01', '2026-05-31'],
      ['Juni 2026', '2026-06-01', '2026-06-30'],
    ];
    for (const [name, start, end] of months) {
      const fid = uuid();
      fiscalIds.push(fid);
      await client.query(`
        INSERT INTO fiscal_periods (id, org_id, name, start_date, end_date, is_closed)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [fid, ORG, name, start, end, false]);
    }
    console.log('✓ Fiscal periods (6)');

    // ─── 3. CONTACTS ─────────────────────────────────────────────────────────
    const contactIds = [];
    const contactData = [
      ['PT Pertamina Lubricants', 'vendor', 'info@pertamina-lub.co.id', '0218765432', 'Jl. Yos Sudarso No.32, Jakarta Utara'],
      ['CV Mitra Ban Jaya', 'vendor', 'mitrabanjaya@gmail.com', '031-8523001', 'Jl. Raya Waru No.15, Sidoarjo'],
      ['UD Sukses Spare Parts', 'vendor', 'sukses.spare@yahoo.com', '0341-556789', 'Jl. S. Parman No.88, Malang'],
      ['Asuransi Jasindo', 'vendor', 'jasindo@jasindo.co.id', '021-6346666', 'Jl. Letjen Suprapto No.2, Jakarta'],
      ['Terminal Purabaya', 'customer', null, '031-8665785', 'Jl. Bungurasih, Sidoarjo'],
      ['Sari Travel Surabaya', 'customer', 'saritravel@gmail.com', '081334556789', 'Jl. Diponegoro No.77, Surabaya'],
      ['Agen Tiket Jogja Indah', 'customer', null, '082145678901', 'Jl. Malioboro No.55, Yogyakarta'],
      ['Agen Tiket Solo Raya', 'customer', null, '085234567890', 'Jl. Slamet Riyadi No.123, Solo'],
    ];
    for (const [name, type, email, phone, address] of contactData) {
      const cid = uuid();
      contactIds.push(cid);
      await client.query(`
        INSERT INTO contacts (id, org_id, name, type, email, phone, address, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      `, [cid, ORG, name, type, email, phone, address, USER]);
    }
    console.log(`✓ Contacts (${contactData.length})`);

    // ─── 4. EMPLOYEES ────────────────────────────────────────────────────────
    const empIds = [];
    const empData = [
      ['EMP001', 'Ahmad', 'Fauzi', 'Manajer Operasional', 'Operasional', '2023-01-15', 8500000],
      ['EMP002', 'Dewi', 'Rahayu', 'Administrasi Keuangan', 'Keuangan', '2023-03-01', 5000000],
      ['EMP003', 'Rizki', 'Pratama', 'Staf Ticketing', 'Operasional', '2023-05-10', 3800000],
      ['EMP004', 'Siti', 'Aminah', 'Staf Administrasi', 'Administrasi', '2024-01-02', 3500000],
      ['EMP005', 'Budi', 'Santoso', 'Kepala Pool', 'Operasional', '2022-07-20', 6000000],
      ['EMP006', 'Nurul', 'Hidayah', 'Customer Service', 'Pelayanan', '2024-03-15', 3600000],
      ['EMP007', 'Hendra', 'Wijaya', 'Koordinator Armada', 'Operasional', '2022-11-01', 7000000],
      ['EMP008', 'Lestari', 'Ningrum', 'Staf Keuangan', 'Keuangan', '2023-08-01', 4200000],
      ['EMP009', 'Agus', 'Setiawan', 'Security', 'Umum', '2023-09-01', 3200000],
      ['EMP010', 'Fitri', 'Wulandari', 'Staf HR', 'HR', '2024-06-01', 4000000],
    ];
    for (const [nik, first, last, title, dept, join, salary] of empData) {
      const eid = uuid();
      empIds.push(eid);
      await client.query(`
        INSERT INTO employees (id, org_id, branch_id, nik, first_name, last_name, job_title, department, join_date, employment_status, basic_salary, gender)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'FULL_TIME', $10, 'male')
      `, [eid, ORG, BRANCH, nik, first, last, title, dept, join, salary]);

    }
    console.log(`✓ Employees (${empData.length})`);

    // ─── 5. BUS CREW ─────────────────────────────────────────────────────────
    const crewIds = [];
    const crewData = [
      ['Jumadi Hartono', 'driver', '081234500001', '3578010101700001', 'SIM B2 - 78001', '2026-08-15', 'O'],
      ['Slamet Riyanto', 'driver', '081234500002', '3578010101700002', 'SIM B2 - 78002', '2027-03-20', 'A'],
      ['Wahyu Nugroho', 'driver', '081234500003', '3578010101700003', 'SIM B2 - 78003', '2026-11-10', 'B'],
      ['Guntur Prasetyo', 'driver', '081234500004', '3578010101700004', 'SIM B2 - 78004', '2027-05-18', 'O'],
      ['Bambang Sugito', 'driver', '081234500005', '3578010101700005', 'SIM B2 - 78005', '2026-09-25', 'AB'],
      ['Eko Wibowo', 'driver', '081234500006', '3578010101700006', 'SIM B2 - 78006', '2027-01-07', 'A'],
      ['Tri Handoko', 'driver', '081234500007', '3578010101700007', 'SIM B2 - 78007', '2026-12-14', 'O'],
      ['Doni Setiabudi', 'driver', '081234500008', '3578010101700008', 'SIM B2 - 78008', '2027-07-30', 'B'],
      ['Rudi Santoso', 'helper', '081234500009', '3578010101700009', null, null, 'O'],
      ['Andi Kurniawan', 'helper', '081234500010', '3578010101700010', null, null, 'A'],
      ['Yusuf Hidayat', 'helper', '081234500011', '3578010101700011', null, null, 'O'],
      ['Fajar Maulana', 'helper', '081234500012', '3578010101700012', null, null, 'B'],
      ['Heri Susanto', 'helper', '081234500013', '3578010101700013', null, null, 'AB'],
      ['Sigit Purnomo', 'helper', '081234500014', '3578010101700014', null, null, 'O'],
    ];
    for (const [name, role, phone, nik, lic, licexp, blood] of crewData) {
      const cid = uuid();
      crewIds.push(cid);
      await client.query(`
        INSERT INTO bus_crew (id, org_id, branch_id, name, role, phone, nik, license_number, license_expiry, blood_type, join_date, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      `, [cid, ORG, BRANCH, name, role, phone, nik, lic, licexp, blood, '2022-01-01']);
    }
    console.log(`✓ Bus crew (${crewData.length})`);

    // ─── 6. BUS MECHANICS ────────────────────────────────────────────────────
    const mechIds = [];
    const mechData = [
      ['Surya Darma', '081355000001', 'Mesin & Transmisi'],
      ['Imam Wahyudi', '081355000002', 'Kelistrikan & AC'],
      ['Totok Hariyanto', '081355000003', 'Kaki-kaki & Suspensi'],
      ['Panut Sulistyo', '081355000004', 'Body & Las'],
    ];
    for (const [name, phone, spec] of mechData) {
      const mid = uuid();
      mechIds.push(mid);
      await client.query(`
        INSERT INTO bus_mechanics (id, org_id, branch_id, name, phone, specialization, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
      `, [mid, ORG, BRANCH, name, phone, spec]);
    }
    console.log(`✓ Bus mechanics (${mechData.length})`);

    // ─── 7. BUS CHECKPOINTS ──────────────────────────────────────────────────
    const cpIds = [];
    const cpData = [
      ['Terminal Purabaya', 'Bungurasih, Sidoarjo', '-7.3567,112.7340'],
      ['Terminal Osowilangun', 'Osowilangun, Surabaya', '-7.2344,112.6526'],
      ['Terminal Giwangan', 'Giwangan, Yogyakarta', '-7.8321,110.3879'],
      ['Terminal Tirtonadi', 'Tirtonadi, Solo', '-7.5574,110.8133'],
      ['Terminal Lebak Bulus', 'Lebak Bulus, Jakarta', '-6.2888,106.7747'],
      ['Terminal Arjosari', 'Arjosari, Malang', '-7.9501,112.6484'],
      ['Terminal Mengwi', 'Mengwi, Bali', '-8.5597,115.1792'],
      ['Rest Area KM 57 Cipularang', 'Purwakarta', '-6.5611,107.4432'],
      ['Rest Area Gringsing', 'Batang, Jawa Tengah', '-6.9877,110.0213'],
      ['Terminal Bungurasih Patas', 'Sidoarjo', '-7.3570,112.7338'],
    ];
    for (const [name, loc, gps] of cpData) {
      const cid = uuid();
      cpIds.push(cid);
      await client.query(`
        INSERT INTO bus_checkpoints (id, org_id, branch_id, name, location_name, gps_coords, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
      `, [cid, ORG, BRANCH, name, loc, gps]);
    }
    console.log(`✓ Bus checkpoints (${cpData.length})`);

    // ─── 8. BUS POOLS ────────────────────────────────────────────────────────
    const poolIds = [];
    const poolData = [
      ['POOL-SBY', 'Pool Surabaya Purabaya', 'pool', 'H. Mahmud Tohir', 'Pak Mahmud', '081233001122', '081233001122', 'pool.purabaya@gmail.com', 'Jl. Bungurasih Timur No.5, Sidoarjo', 'Sidoarjo', 'Jawa Timur', 5, 50000000, 25000000, 'Bank BRI', '0356-01-012345-56-7', 'H. MAHMUD TOHIR'],
      ['POOL-JOG', 'Pool Yogyakarta Giwangan', 'pool', 'Sugiyono Hartanto', 'Pak Sugi', '081244002233', '081244002233', 'pool.giwangan@gmail.com', 'Jl. Imogiri Timur KM2, Yogyakarta', 'Yogyakarta', 'DI Yogyakarta', 5, 30000000, 20000000, 'Bank BNI', '0088-0112-2345-678', 'SUGIYONO HARTANTO'],
      ['POOL-JKT', 'Pool Jakarta Lebak Bulus', 'pool', 'Hendra Gunawan', 'Pak Hendra', '081255003344', '081255003344', 'pool.lebakbulus@gmail.com', 'Jl. RS Fatmawati No.11, Jakarta Selatan', 'Jakarta Selatan', 'DKI Jakarta', 4, 40000000, 30000000, 'Bank Mandiri', '1190009876543', 'HENDRA GUNAWAN'],
      ['POOL-MLG', 'Pool Malang Arjosari', 'pool', 'Saiful Anwar', 'Pak Saiful', '081266004455', '081266004455', 'pool.arjosari@gmail.com', 'Jl. Raden Intan No.3, Malang', 'Malang', 'Jawa Timur', 5, 20000000, 15000000, 'Bank BCA', '0371-1234-5678', 'SAIFUL ANWAR'],
    ];
    for (const [code, name, type, owner, pic, phone, wa, email, addr, city, prov, comm, dep, cred, bank, accno, accname] of poolData) {
      const pid = uuid();
      poolIds.push(pid);
      await client.query(`
        INSERT INTO bus_pools (id, org_id, branch_id, code, name, pool_type, owner_name, pic_name, phone, whatsapp, email, address, city, province, commission_pct, deposit_balance, credit_limit, bank_name, bank_account, bank_account_name, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,true)
      `, [pid, ORG, BRANCH, code, name, type, owner, pic, phone, wa, email, addr, city, prov, comm, dep, cred, bank, accno, accname]);
    }
    console.log(`✓ Bus pools (${poolData.length})`);

    // Pool top-ups
    const topupData = [
      [poolIds[0], 10000000, 'transfer', 'TF-20260110-001'],
      [poolIds[0], 15000000, 'transfer', 'TF-20260201-001'],
      [poolIds[1], 5000000, 'transfer', 'TF-20260115-002'],
      [poolIds[1], 8000000, 'cash', 'CASH-20260210-001'],
      [poolIds[2], 12000000, 'transfer', 'TF-20260120-003'],
      [poolIds[3], 5000000, 'transfer', 'TF-20260125-004'],
      [poolIds[3], 7000000, 'transfer', 'TF-20260305-004'],
      [poolIds[0], 20000000, 'transfer', 'TF-20260401-001'],
    ];
    for (const [pid, amt, method, ref] of topupData) {
      await client.query(`
        INSERT INTO bus_pool_top_ups (id, org_id, pool_id, amount, payment_method, reference_no, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [uuid(), ORG, pid, amt, method, ref, AUTH_USER]);
    }
    console.log(`✓ Pool top-ups (${topupData.length})`);

    // ─── 9. BUS AGENTS ───────────────────────────────────────────────────────
    const agentIds = [];
    const agentData = [
      ['Sari Travel Surabaya', '081334556789', 'saritravel@gmail.com', 'Jl. Diponegoro No.77, Surabaya', 'Surabaya', 3, poolIds[0]],
      ['Tiket Express Bungurasih', '081345678901', null, 'Jl. Bungurasih No.12, Sidoarjo', 'Sidoarjo', 3, poolIds[0]],
      ['Agen Tiket Jogja Indah', '082145678901', null, 'Jl. Malioboro No.55, Yogyakarta', 'Yogyakarta', 4, poolIds[1]],
      ['Wisata Solo Mandiri', '082256789012', 'wsm@gmail.com', 'Jl. Slamet Riyadi No.33, Solo', 'Solo', 3, poolIds[1]],
      ['Tiket Lebak Bulus', '083367890123', null, 'Kios 15 Terminal Lebak Bulus, Jakarta', 'Jakarta Selatan', 3, poolIds[2]],
      ['Agen Malang Raya', '083478901234', 'agenmalang@gmail.com', 'Jl. Ahmad Yani No.44, Malang', 'Malang', 4, poolIds[3]],
    ];
    for (const [name, phone, email, address, city, comm, pid] of agentData) {
      const aid = uuid();
      agentIds.push(aid);
      await client.query(`
        INSERT INTO bus_agents (id, org_id, branch_id, name, phone, email, address, city, commission_pct, pool_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      `, [aid, ORG, BRANCH, name, phone, email, address, city, comm, pid]);
    }
    console.log(`✓ Bus agents (${agentData.length})`);

    // ─── 10. BUS UNITS ───────────────────────────────────────────────────────
    const busIds = [];
    const busData = [
      ['L 7001 KA', 'Mercedes Benz', 'OH 1521', 2021, 50, 'Double Decker', 'MBZ-ENG-001', 'MBZ-CHS-001', 'Putih', 'active', 145000, 850000000, '2021-03-15'],
      ['L 7002 KB', 'Mercedes Benz', 'OH 1526', 2022, 50, 'Double Decker', 'MBZ-ENG-002', 'MBZ-CHS-002', 'Putih', 'active', 98000, 920000000, '2022-01-20'],
      ['L 7003 KC', 'Hino', 'RK8 JSNAL', 2020, 45, 'Super High Deck', 'HINO-ENG-003', 'HINO-CHS-003', 'Putih Biru', 'active', 202000, 680000000, '2020-06-10'],
      ['L 7004 KD', 'Hino', 'RK8 JSNAL', 2021, 45, 'Super High Deck', 'HINO-ENG-004', 'HINO-CHS-004', 'Putih Biru', 'active', 177000, 680000000, '2021-08-05'],
      ['W 9001 NG', 'Scania', 'K360 IB', 2022, 48, 'High Deck', 'SCN-ENG-005', 'SCN-CHS-005', 'Putih', 'active', 87000, 1100000000, '2022-09-12'],
      ['W 9002 NE', 'Scania', 'K360 IB', 2023, 48, 'High Deck', 'SCN-ENG-006', 'SCN-CHS-006', 'Putih', 'active', 45000, 1150000000, '2023-02-28'],
      ['AE 4001 FA', 'Isuzu', 'LV423R1', 2020, 40, 'Medium', 'ISZ-ENG-007', 'ISZ-CHS-007', 'Silver', 'active', 230000, 520000000, '2020-03-01'],
      ['AE 4002 FB', 'Isuzu', 'LV423R1', 2021, 40, 'Medium', 'ISZ-ENG-008', 'ISZ-CHS-008', 'Silver', 'active', 195000, 540000000, '2021-05-19'],
      ['L 7005 KF', 'Mercedes Benz', 'OH 1521', 2019, 50, 'Double Decker', 'MBZ-ENG-009', 'MBZ-CHS-009', 'Putih', 'in_service', 285000, 780000000, '2019-11-30'],
      ['S 5001 HB', 'Hino', 'RK8 JSNAL', 2023, 45, 'Super High Deck', 'HINO-ENG-010', 'HINO-CHS-010', 'Putih Merah', 'active', 28000, 720000000, '2023-07-07'],
    ];
    for (const [plate, brand, model, year, cap, body, eng, chs, color, status, odo, price, pdate] of busData) {
      const bid = uuid();
      busIds.push(bid);
      await client.query(`
        INSERT INTO bus_units (id, org_id, branch_id, plate_number, brand, model, year, capacity, body_type, engine_number, chassis_number, color, status, odometer, purchase_price, purchase_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `, [bid, ORG, BRANCH, plate, brand, model, year, cap, body, eng, chs, color, status, odo, price, pdate]);
    }
    console.log(`✓ Bus units (${busData.length})`);

    // ─── 11. BUS ROUTES ──────────────────────────────────────────────────────
    const routeIds = [];
    const routeData = [
      ['Surabaya - Jakarta (Patas AC)', 'Terminal Purabaya, Surabaya', 'Terminal Lebak Bulus, Jakarta', 790, 14, 185000],
      ['Surabaya - Yogyakarta (Patas AC)', 'Terminal Purabaya, Surabaya', 'Terminal Giwangan, Yogyakarta', 310, 6, 120000],
      ['Surabaya - Solo (Patas AC)', 'Terminal Purabaya, Surabaya', 'Terminal Tirtonadi, Solo', 260, 5, 100000],
      ['Malang - Jakarta (Patas AC)', 'Terminal Arjosari, Malang', 'Terminal Lebak Bulus, Jakarta', 840, 15, 200000],
      ['Malang - Bali (Patas AC)', 'Terminal Arjosari, Malang', 'Terminal Mengwi, Bali', 200, 6, 150000],
      ['Surabaya - Semarang (Reguler)', 'Terminal Purabaya, Surabaya', 'Terminal Terboyo, Semarang', 340, 7, 85000],
    ];
    for (const [name, origin, dest, km, hours, price] of routeData) {
      const rid = uuid();
      routeIds.push(rid);
      await client.query(`
        INSERT INTO bus_routes (id, org_id, branch_id, name, origin, destination, distance_km, duration_hours, base_price, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
      `, [rid, ORG, BRANCH, name, origin, dest, km, hours, price]);
    }
    console.log(`✓ Bus routes (${routeData.length})`);

    // ─── 12. BUS SCHEDULES ───────────────────────────────────────────────────
    const scheduleIds = [];
    const activeBuses = busIds.filter((_, i) => busData[i][7] !== 'in_service'); // exclude in_service
    const drivers = crewIds.slice(0, 8);
    const helpers = crewIds.slice(8, 14);

    // Generate 60 schedules across Jan–Jun 2026
    const schedDates = [];
    for (let month = 0; month < 6; month++) {
      for (let day = 1; day <= 28; day += 4) {
        schedDates.push({ month: month + 1, day });
      }
    }

    let schedCount = 0;
    for (let i = 0; i < schedDates.length && i < 70; i++) {
      const { month, day } = schedDates[i];
      const routeIdx = i % routeIds.length;
      const busIdx = i % activeBuses.length;
      const driverIdx = i % drivers.length;
      const helperIdx = i % helpers.length;
      const route = routeData[routeIdx];
      const depHour = [7, 8, 14, 15, 19, 20][i % 6];
      const depDate = `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(depHour).padStart(2,'0')}:00:00+07:00`;
      const arrivalMs = new Date(depDate).getTime() + route[4] * 3600000;
      const arrDate = new Date(arrivalMs).toISOString();
      const today = new Date('2026-06-06');
      const dep = new Date(depDate);
      let status = 'completed';
      if (dep > today) status = 'scheduled';
      else if (dep > new Date(today.getTime() - 86400000)) status = 'in_progress';

      const sid = uuid();
      scheduleIds.push({ id: sid, routeIdx, busIdx: activeBuses[busIdx] });
      await client.query(`
        INSERT INTO bus_schedules (id, org_id, branch_id, route_id, bus_id, driver_id, helper_id, departure_time, arrival_time, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [sid, ORG, BRANCH, routeIds[routeIdx], activeBuses[busIdx], drivers[driverIdx], helpers[helperIdx], depDate, arrDate, status]);
      schedCount++;
    }
    console.log(`✓ Bus schedules (${schedCount})`);

    // ─── 13. BUS TICKETS ─────────────────────────────────────────────────────
    const passengerNames = [
      'Budi Prasetyo','Siti Rahayu','Ahmad Fauzan','Dewi Lestari','Hendra Gunawan',
      'Nurul Aisyah','Rizki Kurniawan','Fitri Handayani','Agus Salim','Lina Marlina',
      'Doni Setiawan','Rini Susanti','Wahyu Hidayat','Ayu Permata','Joko Widodo',
      'Rina Hastuti','Teguh Santoso','Maya Indah','Yanto Subagyo','Sri Wahyuni',
      'Eko Prasetyo','Tutik Rahayu','Bambang Sutrisno','Endah Setiani','Farhan Maulana',
      'Laila Nur','Subhan Arif','Wening Astuti','Ferdi Irawan','Nana Supriatna',
    ];

    let ticketCount = 0;
    const completedSchedules = scheduleIds.filter((_, i) => {
      const { month } = schedDates[i] || {};
      return month && month <= 5; // Jan-May completed
    }).slice(0, 50);

    for (const sched of completedSchedules) {
      const route = routeData[sched.routeIdx];
      const basePrice = route[5];
      const seatCount = rndInt(20, 40);
      for (let s = 0; s < seatCount; s++) {
        const seat = `${String.fromCharCode(65 + Math.floor(s / 4))}${(s % 4) + 1}`;
        const pName = rndItem(passengerNames);
        const pPhone = `08${rndInt(10,99)}${rndInt(10000000,99999999)}`;
        const price = basePrice + rndInt(-15000, 25000);
        const agentId = Math.random() > 0.4 ? rndItem(agentIds) : null;
        const status = Math.random() > 0.05 ? 'confirmed' : 'cancelled';
        const poolId = agentId ? rndItem(poolIds) : null;
        await client.query(`
          INSERT INTO bus_tickets (id, org_id, branch_id, schedule_id, agent_id, pool_id, passenger_name, passenger_phone, seat_number, price, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `, [uuid(), ORG, BRANCH, sched.id, agentId, poolId, pName, pPhone, seat, price, status]);
        ticketCount++;
      }
    }
    console.log(`✓ Bus tickets (~${ticketCount})`);

    // ─── 14. BUS SERVICE RECORDS ─────────────────────────────────────────────
    const serviceTypes = ['routine', 'corrective', 'preventive'];
    const serviceDescs = [
      ['Ganti Oli Mesin + Filter', 'routine', 1800000, 5000],
      ['Tune Up Mesin', 'preventive', 2500000, 3000],
      ['Ganti Kampas Rem Depan-Belakang', 'corrective', 4200000, 2000],
      ['Servis AC - Freon + Kompresor', 'corrective', 3500000, 0],
      ['Ganti Fan Belt + V-Belt', 'preventive', 1200000, 2500],
      ['Overhaul Mesin Minor', 'corrective', 12000000, 0],
      ['Ganti Aki + Cek Kelistrikan', 'preventive', 2800000, 1000],
      ['Balancing & Spooring Roda', 'routine', 600000, 2000],
      ['Ganti Shock Absorber', 'corrective', 5500000, 0],
      ['Perawatan Berkala 30.000 km', 'routine', 3800000, 30000],
    ];

    let serviceCount = 0;
    for (let i = 0; i < busIds.length; i++) {
      const numServices = rndInt(1, 3);
      for (let j = 0; j < numServices; j++) {
        const sd = rndItem(serviceDescs);
        const daysAgo = rndInt(10, 150);
        const sdate = pastDate(daysAgo);
        const odo = busData[i][10] - rndInt(5000, 50000); // index 10 = odometer
        await client.query(`
          INSERT INTO bus_service_records (id, org_id, branch_id, bus_id, service_date, description, maintenance_type, cost, odometer_at, technician_name, next_service_km, next_service_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [uuid(), ORG, BRANCH, busIds[i], sdate, sd[0], sd[1], sd[2], odo, rndItem(mechData)[0], odo + sd[3] + 5000, dateOffset(sdate, 90)]);
        serviceCount++;
      }
    }
    console.log(`✓ Bus service records (~${serviceCount})`);

    // ─── 15. BUS TIRE RECORDS ────────────────────────────────────────────────
    const tireBrands = ['Bridgestone', 'Michelin', 'Goodyear', 'Dunlop', 'GT Radial'];
    const tirePositions = ['DP-KI', 'DP-KA', 'BLK-KI-L', 'BLK-KI-D', 'BLK-KA-L', 'BLK-KA-D'];
    let tireCount = 0;
    for (const bid of busIds) {
      for (const pos of tirePositions.slice(0, rndInt(4, 6))) {
        const daysAgo = rndInt(30, 365);
        await client.query(`
          INSERT INTO bus_tire_records (id, org_id, branch_id, bus_id, position, brand, size, installed_at, odometer_at, mileage_limit_km)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [uuid(), ORG, BRANCH, bid, pos, rndItem(tireBrands), '11.00-20', pastDate(daysAgo), rndInt(100000, 250000), 80000]);
        tireCount++;
      }
    }
    console.log(`✓ Bus tire records (~${tireCount})`);

    // ─── 16. BUS EMERGENCY CALLS ─────────────────────────────────────────────
    const emergencyData = [
      [busIds[2], 'Rudi Santoso', 'breakdown', 'Mesin overheat di Tol Kanci KM 220', '-6.8991,108.6123', mechIds[0], 'resolved', pastDate(45)],
      [busIds[6], 'Andi Kurniawan', 'flat_tire', 'Ban kempes di jalur Pantura, Tuban', '-6.8982,112.0502', mechIds[2], 'resolved', pastDate(28)],
      [busIds[4], 'Yusuf Hidayat', 'accident', 'Kecelakaan ringan di Rest Area Gringsing', '-6.9877,110.0213', mechIds[0], 'resolved', pastDate(15)],
    ];
    for (const [bid, reporter, type, desc, gps, mech, status, calltime] of emergencyData) {
      await client.query(`
        INSERT INTO bus_emergency_calls (id, org_id, branch_id, bus_id, reporter_name, call_time, location_description, location_gps, issue_type, description, assigned_mechanic_id, status, resolved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [uuid(), ORG, BRANCH, bid, reporter, calltime+'T14:30:00Z', desc, gps, type, desc, mech, status, dateOffset(calltime, 1)+'T08:00:00Z']);
    }
    console.log(`✓ Bus emergency calls (${emergencyData.length})`);

    // ─── 17. JOURNAL ENTRIES ─────────────────────────────────────────────────
    // Modal awal
    const jeModal = uuid();
    await client.query(`
      INSERT INTO journal_entries (id, org_id, branch_id, entry_number, entry_date, description, reference_type, status, is_auto, created_by, posted_at)
      VALUES ($1,$2,$3,'JE-2026-0001','2026-01-01','Setoran Modal Awal PO Bintang Marwah','MANUAL','POSTED',false,$4,'2026-01-01T08:00:00Z')
    `, [jeModal, ORG, BRANCH, USER]);
    await client.query(`INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES ($1,$2,$3,2500000000,0,'Modal awal operasional'), ($4,$5,$6,0,2500000000,'Setoran modal pemilik')`, [uuid(), jeModal, ACC.BANK, uuid(), jeModal, ACC.MODAL]);

    // Pendapatan tiket per bulan (Jan-Mei)
    const monthRevenues = [185000000, 210000000, 195000000, 220000000, 235000000];
    const monthLabels = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    for (let m = 0; m < 5; m++) {
      const je = uuid();
      const edate = `${monthLabels[m]}-28`;
      const rev = monthRevenues[m];
      await client.query(`
        INSERT INTO journal_entries (id, org_id, branch_id, entry_number, entry_date, description, reference_type, status, is_auto, created_by, posted_at)
        VALUES ($1,$2,$3,$4,$5,$6,'MANUAL','POSTED',false,$7,$8)
      `, [je, ORG, BRANCH, `JE-2026-REV-${String(m+1).padStart(2,'0')}`, edate, `Pendapatan Tiket ${['Januari','Februari','Maret','April','Mei'][m]} 2026`, USER, edate+'T17:00:00Z']);
      await client.query(`INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES ($1,$2,$3,$4,0,'Penerimaan kas tiket'), ($5,$6,$7,0,$8,'Pendapatan penjualan tiket')`, [uuid(), je, ACC.BANK, rev, uuid(), je, ACC.PENDAPATAN, rev]);
    }

    // Beban BBM & Tol per bulan
    const monthFuel = [68000000, 72000000, 70000000, 75000000, 78000000];
    for (let m = 0; m < 5; m++) {
      const je = uuid();
      const edate = `${monthLabels[m]}-25`;
      const cost = monthFuel[m];
      await client.query(`
        INSERT INTO journal_entries (id, org_id, branch_id, entry_number, entry_date, description, reference_type, status, is_auto, created_by, posted_at)
        VALUES ($1,$2,$3,$4,$5,$6,'MANUAL','POSTED',false,$7,$8)
      `, [je, ORG, BRANCH, `JE-2026-BBM-${String(m+1).padStart(2,'0')}`, edate, `Beban BBM & Tol ${['Januari','Februari','Maret','April','Mei'][m]} 2026`, USER, edate+'T17:00:00Z']);
      await client.query(`INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES ($1,$2,$3,$4,0,'Biaya BBM dan tol'), ($5,$6,$7,0,$8,'Pengeluaran bank')`, [uuid(), je, ACC.BBM, cost, uuid(), je, ACC.BANK, cost]);
    }

    // Gaji karyawan per bulan
    const monthSalary = [52000000, 52000000, 52000000, 52000000, 52000000];
    for (let m = 0; m < 5; m++) {
      const je = uuid();
      const edate = `${monthLabels[m]}-27`;
      const cost = monthSalary[m];
      await client.query(`
        INSERT INTO journal_entries (id, org_id, branch_id, entry_number, entry_date, description, reference_type, status, is_auto, created_by, posted_at)
        VALUES ($1,$2,$3,$4,$5,$6,'MANUAL','POSTED',false,$7,$8)
      `, [je, ORG, BRANCH, `JE-2026-GAJI-${String(m+1).padStart(2,'0')}`, edate, `Beban Gaji ${['Januari','Februari','Maret','April','Mei'][m]} 2026`, USER, edate+'T17:00:00Z']);
      await client.query(`INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES ($1,$2,$3,$4,0,'Gaji karyawan dan crew'), ($5,$6,$7,0,$8,'Transfer gaji')`, [uuid(), je, ACC.GAJI, cost, uuid(), je, ACC.BANK, cost]);
    }

    // Biaya servis & pemeliharaan per bulan
    const monthService = [18500000, 22000000, 15000000, 28000000, 19500000];
    for (let m = 0; m < 5; m++) {
      const je = uuid();
      const edate = `${monthLabels[m]}-20`;
      const cost = monthService[m];
      await client.query(`
        INSERT INTO journal_entries (id, org_id, branch_id, entry_number, entry_date, description, reference_type, status, is_auto, created_by, posted_at)
        VALUES ($1,$2,$3,$4,$5,$6,'MANUAL','POSTED',false,$7,$8)
      `, [je, ORG, BRANCH, `JE-2026-SVC-${String(m+1).padStart(2,'0')}`, edate, `Biaya Servis Armada ${['Januari','Februari','Maret','April','Mei'][m]} 2026`, USER, edate+'T17:00:00Z']);
      await client.query(`INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo) VALUES ($1,$2,$3,$4,0,'Perawatan dan servis kendaraan'), ($5,$6,$7,0,$8,'Pembayaran servis')`, [uuid(), je, ACC.SERVIS, cost, uuid(), je, ACC.BANK, cost]);
    }

    console.log('✓ Journal entries (modal + 20 entri operasional)');

    // ─── 18. POOL SETTLEMENTS ────────────────────────────────────────────────
    const settlementData = [
      [poolIds[0], '2026-01-01', '2026-01-31', 180, 28000000, 5, 1400000, 'transfer', 'STL-20260205-001', 'paid'],
      [poolIds[1], '2026-01-01', '2026-01-31', 95, 12000000, 5, 600000, 'transfer', 'STL-20260207-002', 'paid'],
      [poolIds[0], '2026-02-01', '2026-02-28', 195, 31000000, 5, 1550000, 'transfer', 'STL-20260305-001', 'paid'],
      [poolIds[2], '2026-01-01', '2026-02-28', 140, 22000000, 4, 880000, 'transfer', 'STL-20260310-003', 'paid'],
      [poolIds[3], '2026-03-01', '2026-03-31', 80, 9500000, 5, 475000, 'cash', 'STL-20260405-004', 'paid'],
    ];
    for (const [pid, pstart, pend, tickets, rev, comm, commAmt, method, ref, status] of settlementData) {
      await client.query(`
        INSERT INTO bus_pool_settlements (id, org_id, pool_id, period_start, period_end, total_tickets, total_revenue, commission_pct, commission_amount, payment_method, reference_no, status, paid_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [uuid(), ORG, pid, pstart, pend, tickets, rev, comm, commAmt, method, ref, status, pend+'T10:00:00Z']);
    }
    console.log(`✓ Pool settlements (${settlementData.length})`);

    await client.query('COMMIT');
    console.log('\n=== SEEDING SELESAI ===');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR - ROLLBACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
