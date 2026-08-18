// scripts/seed-klinik-demo.mjs
// Seed data dummy lengkap untuk organisasi "KlinikPratama" (org demo Klinik
// Pratama) — dari fondasi ERP yang masih kosong (CoA, karyawan, gudang)
// sampai alur operasional klinik penuh (pasien -> antrian -> rekam medis ->
// resep/dispensing -> kasir -> jurnal) supaya integrasi ke ERP core benar-benar
// terlihat, bukan cuma skema kosong.
//
// Idempoten sebagian: aman dijalankan ulang untuk menambah transaksi baru,
// tapi TIDAK menghapus data lama. Kalau ingin reset total, hapus manual dulu
// baris-baris klinik_* untuk ORG_ID di bawah.

import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const output = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    output[key] = value
  }
  return output
}

function loadEnv() {
  const cwd = process.cwd()
  return { ...readEnvFile(path.join(cwd, '.env')), ...readEnvFile(path.join(cwd, '.env.local')), ...process.env }
}

const env = loadEnv()
const DB_URL = env.RAILWAY_DATABASE_URL || env.DATABASE_URL
if (!DB_URL) {
  console.error('Tidak ada DATABASE_URL/RAILWAY_DATABASE_URL di environment.')
  process.exit(1)
}

const ORG_ID = '1e3da069-0c1b-4670-924c-cc8fd9ed3d1b' // Organisasi "KlinikPratama"
const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Replika ringkas createJournalEntry() (modules/accounting/actions/journal.actions.ts)
 *  untuk dipakai di luar konteks request Next.js (skrip seed tidak punya sesi
 *  auth). Validasi balance + resolve period_id + generate entry_number persis
 *  pola yang sama, supaya jurnal yang dihasilkan terlihat identik dengan yang
 *  dibuat lewat aplikasi sungguhan. */
async function insertJournalEntry({ orgId, branchId, entryDate, description, referenceType, referenceId, lines }) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Jurnal tidak balance: debit ${totalDebit} != credit ${totalCredit} (${description})`)
  }

  const period = await client.query(
    `SELECT id FROM fiscal_periods WHERE org_id = $1 AND start_date <= $2::date AND end_date >= $2::date AND is_closed = false LIMIT 1`,
    [orgId, entryDate],
  )
  const periodId = period.rows[0]?.id || null

  const year = entryDate.slice(0, 4)
  const last = await client.query(
    `SELECT entry_number FROM journal_entries WHERE org_id = $1 AND entry_number ~ ('^JE-' || $2 || '-[0-9]+$') ORDER BY entry_number DESC LIMIT 1`,
    [orgId, year],
  )
  const lastNum = last.rows[0] ? parseInt(last.rows[0].entry_number.split('-').pop(), 10) : 0
  const entryNumber = `JE-${year}-${String(lastNum + 1).padStart(6, '0')}`

  const entry = await client.query(
    `INSERT INTO journal_entries (org_id, branch_id, entry_number, entry_date, description, reference_type, reference_id, status, is_auto, period_id)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7, 'POSTED', true, $8)
     RETURNING id::text`,
    [orgId, branchId, entryNumber, entryDate, description, referenceType, referenceId, periodId],
  )
  const entryId = entry.rows[0].id

  for (const line of lines) {
    await client.query(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo) VALUES ($1, $2, $3, $4, $5)`,
      [entryId, line.account_id, line.debit || 0, line.credit || 0, line.memo || description],
    )
  }
  return entryId
}

async function main() {
  await client.connect()
  console.log('Terhubung ke database. Mulai seeding org KlinikPratama...\n')

  const { rows: branchRows } = await client.query(`SELECT id::text FROM branches WHERE org_id = $1 AND code = 'MAIN' LIMIT 1`, [ORG_ID])
  const branchId = branchRows[0]?.id
  if (!branchId) throw new Error('Branch "Unit Utama" (MAIN) tidak ditemukan untuk org ini.')
  console.log(`✓ Branch: ${branchId}`)

  // ── 1. CHART OF ACCOUNTS ────────────────────────────────────────────────────
  const accountDefs = [
    { code: '1101', name: 'Kas', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '1150', name: 'Piutang BPJS', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '1310', name: 'Persediaan Obat', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '4101', name: 'Pendapatan Konsultasi', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '4102', name: 'Pendapatan Tindakan', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '4103', name: 'Pendapatan Obat', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '5101', name: 'HPP Obat', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '5102', name: 'Kerugian Obat Kadaluarsa', type: 'EXPENSE', normal_balance: 'DEBIT' },
  ]
  const accountIds = {}
  for (const def of accountDefs) {
    const { rows } = await client.query(
      `INSERT INTO accounts (org_id, code, name, type, normal_balance, managed_branch_id, is_system, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, false, true)
       ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id::text`,
      [ORG_ID, def.code, def.name, def.type, def.normal_balance, branchId],
    )
    accountIds[def.code] = rows[0].id
  }
  console.log(`✓ Chart of Accounts: ${accountDefs.length} akun`)

  // ── 2. FISCAL PERIOD ─────────────────────────────────────────────────────────
  const year = new Date().getFullYear()
  await client.query(
    `INSERT INTO fiscal_periods (org_id, name, start_date, end_date, is_closed)
     SELECT $1, $2, $3::date, $4::date, false
     WHERE NOT EXISTS (SELECT 1 FROM fiscal_periods WHERE org_id = $1 AND name = $2)`,
    [ORG_ID, `Tahun ${year}`, `${year}-01-01`, `${year}-12-31`],
  )
  console.log(`✓ Periode fiskal: Tahun ${year}`)

  // ── 3. EMPLOYEES ─────────────────────────────────────────────────────────────
  const employeeDefs = [
    { nik: '3201010101900001', first_name: 'Aisyah', last_name: 'Putri', job_title: 'Dokter Umum' },
    { nik: '3201010101920002', first_name: 'Yusuf', last_name: 'Ramadhan', job_title: 'Perawat' },
    { nik: '3201010101930003', first_name: 'Siti', last_name: 'Nurhaliza', job_title: 'Apoteker' },
  ]
  const employeeIds = {}
  for (const def of employeeDefs) {
    const { rows } = await client.query(
      `INSERT INTO employees (org_id, branch_id, nik, first_name, last_name, job_title, join_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       ON CONFLICT DO NOTHING
       RETURNING id::text`,
      [ORG_ID, branchId, def.nik, def.first_name, def.last_name, def.job_title],
    )
    let empId = rows[0]?.id
    if (!empId) {
      const existing = await client.query(`SELECT id::text FROM employees WHERE org_id = $1 AND nik = $2`, [ORG_ID, def.nik])
      empId = existing.rows[0].id
    }
    employeeIds[def.job_title] = empId
  }
  console.log(`✓ Karyawan: ${employeeDefs.map((d) => `${d.first_name} ${d.last_name} (${d.job_title})`).join(', ')}`)

  // ── 4. WAREHOUSE (APOTEK) ────────────────────────────────────────────────────
  const { rows: whRows } = await client.query(
    `INSERT INTO warehouses (org_id, branch_id, code, name)
     VALUES ($1, $2, 'APT-01', 'Apotek Utama')
     ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id::text`,
    [ORG_ID, branchId],
  )
  const warehouseId = whRows[0].id
  console.log(`✓ Gudang: Apotek Utama (${warehouseId})`)

  // ── 5. KLINIK: POLI ───────────────────────────────────────────────────────────
  const poliDefs = [
    { kode: 'UMUM', nama: 'Poli Umum' },
    { kode: 'GIGI', nama: 'Poli Gigi' },
  ]
  const poliIds = {}
  for (const def of poliDefs) {
    const { rows } = await client.query(
      `INSERT INTO klinik_poli (org_id, branch_id, kode, nama)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (branch_id, kode) DO UPDATE SET nama = EXCLUDED.nama
       RETURNING id::text`,
      [ORG_ID, branchId, def.kode, def.nama],
    )
    poliIds[def.kode] = rows[0].id
  }
  console.log(`✓ Poli: ${poliDefs.map((p) => p.nama).join(', ')}`)

  // ── 6. KLINIK: STAF MEDIS ────────────────────────────────────────────────────
  const { rows: stafRows } = await client.query(
    `INSERT INTO klinik_staf_medis (org_id, employee_id, jenis, str_number, sip_number, spesialisasi, poli_id)
     VALUES
       ($1, $2, 'dokter', 'STR-1234567890', 'SIP-001/DU/2026', 'Dokter Umum', $4),
       ($1, $3, 'perawat', 'STR-0987654321', NULL, NULL, $4)
     ON CONFLICT (employee_id) DO UPDATE SET jenis = EXCLUDED.jenis
     RETURNING id::text, jenis`,
    [ORG_ID, employeeIds['Dokter Umum'], employeeIds['Perawat'], poliIds.UMUM],
  )
  const { rows: apotekerRows } = await client.query(
    `INSERT INTO klinik_staf_medis (org_id, employee_id, jenis, str_number)
     VALUES ($1, $2, 'apoteker', 'STR-1122334455')
     ON CONFLICT (employee_id) DO UPDATE SET jenis = EXCLUDED.jenis
     RETURNING id::text`,
    [ORG_ID, employeeIds['Apoteker']],
  )
  const dokterStafId = stafRows.find((r) => r.jenis === 'dokter').id
  console.log(`✓ Tenaga medis: dr. Aisyah Putri, Yusuf Ramadhan (perawat), Siti Nurhaliza (apoteker)`)

  // ── 7. KLINIK: JADWAL PRAKTIK (dokter, Senin-Jumat 08:00-14:00) ─────────────
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    await client.query(
      `INSERT INTO klinik_jadwal_praktik (org_id, staf_medis_id, branch_id, poli_id, weekday, start_local, end_local)
       SELECT $1, $2, $3, $4, $5, '08:00', '14:00'
       WHERE NOT EXISTS (
         SELECT 1 FROM klinik_jadwal_praktik WHERE staf_medis_id = $2 AND weekday = $5
       )`,
      [ORG_ID, dokterStafId, branchId, poliIds.UMUM, weekday],
    )
  }
  console.log(`✓ Jadwal praktik dokter: Senin-Jumat 08:00-14:00`)

  // ── 8. KLINIK: TARIF LAYANAN ──────────────────────────────────────────────────
  const tarifDefs = [
    { nama: 'Konsultasi Umum', kategori: 'Konsultasi', harga: 25000, poli: 'UMUM' },
    { nama: 'Tindakan Ganti Perban', kategori: 'Tindakan', harga: 50000, poli: 'UMUM' },
    { nama: 'Konsultasi Gigi', kategori: 'Konsultasi', harga: 35000, poli: 'GIGI' },
  ]
  const tarifIds = {}
  for (const def of tarifDefs) {
    const { rows } = await client.query(
      `INSERT INTO klinik_tarif_layanan (org_id, branch_id, poli_id, nama_layanan, kategori, harga)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), nama_layanan)
       DO UPDATE SET harga = EXCLUDED.harga
       RETURNING id::text`,
      [ORG_ID, branchId, poliIds[def.poli], def.nama, def.kategori, def.harga],
    )
    tarifIds[def.nama] = rows[0].id
  }
  console.log(`✓ Tarif layanan: ${tarifDefs.map((t) => t.nama).join(', ')}`)

  // ── 9. PRODUCTS (OBAT) ────────────────────────────────────────────────────────
  const obatDefs = [
    { sku: 'OBT-001', name: 'Paracetamol 500mg', unit: 'Tablet', selling_price: 2000, average_cost: 800 },
    { sku: 'OBT-002', name: 'Amoxicillin 500mg', unit: 'Tablet', selling_price: 3500, average_cost: 1500 },
    { sku: 'OBT-003', name: 'Vitamin C 500mg', unit: 'Tablet', selling_price: 1500, average_cost: 600 },
    { sku: 'OBT-004', name: 'Antasida Doen', unit: 'Tablet', selling_price: 1000, average_cost: 400 },
    { sku: 'OBT-005', name: 'OBH Combi Sirup', unit: 'Botol', selling_price: 15000, average_cost: 8000 },
  ]
  const obatIds = {}
  for (const def of obatDefs) {
    const { rows } = await client.query(
      `INSERT INTO products (org_id, sku, name, type, unit, selling_price, average_cost, purchase_price)
       VALUES ($1, $2, $3, 'INVENTORY', $4, $5, $6, $6)
       ON CONFLICT DO NOTHING
       RETURNING id::text`,
      [ORG_ID, def.sku, def.name, def.unit, def.selling_price, def.average_cost],
    )
    let id = rows[0]?.id
    if (!id) {
      const existing = await client.query(`SELECT id::text FROM products WHERE org_id = $1 AND sku = $2`, [ORG_ID, def.sku])
      id = existing.rows[0].id
    }
    obatIds[def.name] = id
  }
  const obatAvgCost = Object.fromEntries(obatDefs.map((o) => [o.name, o.average_cost]))
  console.log(`✓ Produk obat: ${obatDefs.map((o) => o.name).join(', ')}`)

  // ── 10. PENERIMAAN STOK OBAT (batch + kadaluarsa) ────────────────────────────
  const stockReceipts = [
    { obat: 'Paracetamol 500mg', qty: 200, batch: 'PCT-A01', expiry: addDays(180) },
    { obat: 'Amoxicillin 500mg', qty: 100, batch: 'AMX-A01', expiry: addDays(90) },
    { obat: 'Vitamin C 500mg', qty: 150, batch: 'VTC-A01', expiry: addDays(365) },
    { obat: 'Antasida Doen', qty: 120, batch: 'ANT-A01', expiry: addDays(-15) }, // sudah kadaluarsa — demonstrasi blok FEFO
    { obat: 'Antasida Doen', qty: 80, batch: 'ANT-A02', expiry: addDays(120) },
    { obat: 'OBH Combi Sirup', qty: 40, batch: 'OBH-A01', expiry: addDays(200) },
  ]
  for (const r of stockReceipts) {
    // adjust_inventory_stock menambah kuantitas (delta), bukan upsert ke nilai
    // tetap — jadi skrip ini WAJIB cek dulu supaya aman dijalankan ulang tanpa
    // menggandakan stok kalau run sebelumnya sempat gagal di tengah jalan.
    const existing = await client.query(
      `SELECT id FROM inventory_stocks WHERE org_id = $1 AND product_id = $2 AND warehouse_id = $3 AND batch_number = $4 AND bin_id IS NULL`,
      [ORG_ID, obatIds[r.obat], warehouseId, r.batch],
    )
    if (existing.rows.length > 0) continue

    await client.query(`SELECT adjust_inventory_stock($1, $2, $3, $4, $5, NULL)`, [ORG_ID, obatIds[r.obat], warehouseId, r.qty, r.batch])
    await client.query(
      `UPDATE inventory_stocks SET expiry_date = $4 WHERE org_id = $1 AND product_id = $2 AND warehouse_id = $3 AND batch_number = $5 AND bin_id IS NULL`,
      [ORG_ID, obatIds[r.obat], warehouseId, r.expiry, r.batch],
    )
    // unit_price WAJIB diisi harga pokok sesungguhnya — ada trigger
    // trg_recalculate_average_cost (033_ultimate_security_and_avg_cost.sql)
    // yang menghitung ulang products.average_cost dari SUM(quantity*unit_price)
    // setiap kali baris stock_movements baru masuk. Kalau ini 0, average_cost
    // produk ikut ter-reset ke 0 dan HPP saat dispensing jadi salah (Rp0).
    await client.query(
      `INSERT INTO stock_movements (org_id, branch_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
       VALUES ($1, $2, $3, $4, $5, 'KLINIK_RECEIPT', gen_random_uuid(), $6)`,
      [ORG_ID, branchId, obatIds[r.obat], r.qty, obatAvgCost[r.obat], `Penerimaan awal batch ${r.batch}`],
    )
  }
  console.log(`✓ Stok obat diterima: ${stockReceipts.length} batch (termasuk 1 batch kadaluarsa untuk demo blok FEFO)`)

  function addDays(n) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  // ── 11. KLINIK ACCOUNT MAPPING (org-level) ───────────────────────────────────
  await client.query(
    `INSERT INTO klinik_account_mapping (
       org_id, branch_id, kas_account_id, pendapatan_konsultasi_account_id, pendapatan_tindakan_account_id,
       pendapatan_obat_account_id, hpp_obat_account_id, persediaan_obat_account_id, piutang_bpjs_account_id,
       kerugian_obat_kadaluarsa_account_id
     )
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (org_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
       kas_account_id = EXCLUDED.kas_account_id,
       pendapatan_konsultasi_account_id = EXCLUDED.pendapatan_konsultasi_account_id,
       pendapatan_tindakan_account_id = EXCLUDED.pendapatan_tindakan_account_id,
       pendapatan_obat_account_id = EXCLUDED.pendapatan_obat_account_id,
       hpp_obat_account_id = EXCLUDED.hpp_obat_account_id,
       persediaan_obat_account_id = EXCLUDED.persediaan_obat_account_id,
       piutang_bpjs_account_id = EXCLUDED.piutang_bpjs_account_id,
       kerugian_obat_kadaluarsa_account_id = EXCLUDED.kerugian_obat_kadaluarsa_account_id`,
    [
      ORG_ID, accountIds['1101'], accountIds['4101'], accountIds['4102'],
      accountIds['4103'], accountIds['5101'], accountIds['1310'], accountIds['1150'], accountIds['5102'],
    ],
  )
  console.log(`✓ Pemetaan akun klinik (org-level) tersimpan`)

  // ── 12. PASIEN ────────────────────────────────────────────────────────────────
  const pasienDefs = [
    { nik: '3201011001990001', nama: 'Budi Santoso', tgl_lahir: '1990-01-10', jk: 'L', no_hp: '081234560001', alamat: 'Jl. Merdeka No. 12, Bandung' },
    { nik: '3201011203950002', nama: 'Dewi Lestari', tgl_lahir: '1995-03-12', jk: 'P', no_hp: '081234560002', alamat: 'Jl. Sudirman No. 45, Bandung' },
    { nik: '3201010507880003', nama: 'Rudi Hartono', tgl_lahir: '1988-07-05', jk: 'L', no_hp: '081234560003', alamat: 'Jl. Asia Afrika No. 8, Bandung' },
    { nik: '3201012311920004', nama: 'Siti Aminah', tgl_lahir: '1992-11-23', jk: 'P', no_hp: '081234560004', alamat: 'Jl. Braga No. 20, Bandung' },
    { nik: '3201010209850005', nama: 'Agus Salim', tgl_lahir: '1985-09-02', jk: 'L', no_hp: '081234560005', alamat: 'Jl. Riau No. 33, Bandung' },
    { nik: '3201011412000006', nama: 'Putri Wulandari', tgl_lahir: '2000-12-14', jk: 'P', no_hp: '081234560006', alamat: 'Jl. Dago No. 5, Bandung' },
  ]
  const pasienIds = {}
  for (let i = 0; i < pasienDefs.length; i += 1) {
    const def = pasienDefs[i]
    const noRm = `RM-${String(100 + i).padStart(6, '0')}`
    const { rows } = await client.query(
      `INSERT INTO klinik_pasien (org_id, no_rm, nik, nama, tgl_lahir, jenis_kelamin, no_hp, alamat, registered_branch_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
       ON CONFLICT (org_id, no_rm) DO UPDATE SET nama = EXCLUDED.nama
       RETURNING id::text`,
      [ORG_ID, noRm, def.nik, def.nama, def.tgl_lahir, def.jk, def.no_hp, def.alamat, branchId],
    )
    pasienIds[def.nama] = rows[0].id
  }
  console.log(`✓ Pasien: ${pasienDefs.length} orang`)

  // ── 13. KUNJUNGAN — beragam status untuk demonstrasi alur penuh ─────────────
  const today = todayStr()

  async function nextNoAntrian(poliId) {
    const { rows } = await client.query(
      `SELECT MAX(no_antrian) AS max_no FROM klinik_kunjungan WHERE branch_id = $1 AND poli_id = $2 AND tanggal = $3::date`,
      [branchId, poliId, today],
    )
    return Number(rows[0]?.max_no ?? 0) + 1
  }

  async function createKunjungan({ pasienNama, poliKode, jenisKunjungan = 'umum', keluhan, status = 'MENUNGGU', stafMedisId }) {
    const poliId = poliIds[poliKode]
    const noAntrian = await nextNoAntrian(poliId)
    const { rows } = await client.query(
      `INSERT INTO klinik_kunjungan (org_id, branch_id, pasien_id, poli_id, staf_medis_id, tanggal, no_antrian, jenis_kunjungan, sumber, status, keluhan)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, 'WALK_IN', $9, $10)
       RETURNING id::text, no_antrian`,
      [ORG_ID, branchId, pasienIds[pasienNama], poliId, stafMedisId || null, today, noAntrian, jenisKunjungan, status, keluhan || null],
    )
    return rows[0]
  }

  // 13a. Dua pasien MENUNGGU di Poli Umum
  const k1 = await createKunjungan({ pasienNama: 'Budi Santoso', poliKode: 'UMUM', keluhan: 'Demam dan batuk 2 hari' })
  const k2 = await createKunjungan({ pasienNama: 'Dewi Lestari', poliKode: 'UMUM', jenisKunjungan: 'bpjs', keluhan: 'Kontrol rutin' })

  // 13b. Satu pasien DIPERIKSA — RME draft, resep PENDING (belum dispensing) —
  //      supaya tab Apotek & panel pemeriksaan bisa langsung didemokan interaktif
  const k3 = await createKunjungan({ pasienNama: 'Rudi Hartono', poliKode: 'UMUM', status: 'DIPERIKSA', stafMedisId: dokterStafId, keluhan: 'Sakit kepala dan pusing' })
  const rm3 = await client.query(
    `INSERT INTO klinik_rekam_medis (org_id, kunjungan_id, staf_medis_id, anamnesis, diagnosis_icd10, diagnosis_text, terapi, status)
     VALUES ($1, $2, $3, 'Pasien mengeluh sakit kepala sejak 2 hari, disertai pusing. Tidak ada riwayat trauma.', 'R51', 'Sakit kepala (Cephalgia)', 'Istirahat cukup, hindari stres, kontrol jika belum membaik dalam 3 hari', 'DRAFT')
     RETURNING id::text`,
    [ORG_ID, k3.id, dokterStafId],
  )
  await client.query(`INSERT INTO klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id, after) VALUES ($1, 'CREATED', $2, '{}'::jsonb)`, [rm3.rows[0].id, employeeIds['Dokter Umum']])
  const resep3 = await client.query(
    `INSERT INTO klinik_resep (org_id, branch_id, kunjungan_id, warehouse_id, staf_medis_id) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
    [ORG_ID, branchId, k3.id, warehouseId, dokterStafId],
  )
  await client.query(`INSERT INTO klinik_resep_detail (resep_id, product_id, jumlah, dosis) VALUES ($1, $2, 10, '3x1 tablet setelah makan')`, [resep3.rows[0].id, obatIds['Paracetamol 500mg']])
  console.log(`✓ Kunjungan DIPERIKSA (Rudi Hartono): RME draft + resep PENDING dibuat, siap didemokan (dispensing manual dari tab Apotek)`)

  // 13c. Satu pasien SELESAI penuh (Poli Umum) — RME final, resep DISPENSED
  //      (via RPC asli), tagihan LUNAS (jurnal asli terposting)
  const k4 = await createKunjungan({ pasienNama: 'Siti Aminah', poliKode: 'UMUM', status: 'DIPERIKSA', stafMedisId: dokterStafId, keluhan: 'Batuk pilek' })
  const rm4 = await client.query(
    `INSERT INTO klinik_rekam_medis (org_id, kunjungan_id, staf_medis_id, anamnesis, diagnosis_icd10, diagnosis_text, terapi, status, finalized_at)
     VALUES ($1, $2, $3, 'Batuk pilek sejak 3 hari, tidak demam. Pemeriksaan fisik dalam batas normal.', 'J06.9', 'ISPA (Infeksi Saluran Pernapasan Akut)', 'Obat simptomatik, banyak minum air putih, istirahat', 'FINAL', NOW())
     RETURNING id::text`,
    [ORG_ID, k4.id, dokterStafId],
  )
  await client.query(`INSERT INTO klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id, after) VALUES ($1, 'CREATED', $2, '{}'::jsonb)`, [rm4.rows[0].id, employeeIds['Dokter Umum']])
  await client.query(`INSERT INTO klinik_rekam_medis_history (rekam_medis_id, action, actor_employee_id) VALUES ($1, 'FINALIZED', $2)`, [rm4.rows[0].id, employeeIds['Dokter Umum']])
  await client.query(`UPDATE klinik_kunjungan SET status = 'SELESAI' WHERE id = $1`, [k4.id])

  const resep4 = await client.query(
    `INSERT INTO klinik_resep (org_id, branch_id, kunjungan_id, warehouse_id, staf_medis_id) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
    [ORG_ID, branchId, k4.id, warehouseId, dokterStafId],
  )
  await client.query(`INSERT INTO klinik_resep_detail (resep_id, product_id, jumlah, dosis) VALUES ($1, $2, 6, '2x1 tablet')`, [resep4.rows[0].id, obatIds['Paracetamol 500mg']])
  await client.query(`INSERT INTO klinik_resep_detail (resep_id, product_id, jumlah, dosis) VALUES ($1, $2, 10, '3x1 tablet setelah makan')`, [resep4.rows[0].id, obatIds['Antasida Doen']])
  const dispense4 = await client.query(`SELECT process_klinik_dispensing($1, $2) AS r`, [ORG_ID, resep4.rows[0].id])
  const totalHpp4 = Number(dispense4.rows[0].r.total_hpp || 0)
  if (totalHpp4 > 0) {
    await insertJournalEntry({
      orgId: ORG_ID, branchId, entryDate: today,
      description: `HPP dispensing resep ${resep4.rows[0].id}`, referenceType: 'KLINIK_DISPENSING', referenceId: resep4.rows[0].id,
      lines: [
        { account_id: accountIds['5101'], debit: totalHpp4, credit: 0, memo: 'HPP obat' },
        { account_id: accountIds['1310'], debit: 0, credit: totalHpp4, memo: 'HPP obat' },
      ],
    })
  }

  const tarifKonsultasi = await client.query(`SELECT harga FROM klinik_tarif_layanan WHERE id = $1`, [tarifIds['Konsultasi Umum']])
  const totalLayanan4 = Number(tarifKonsultasi.rows[0].harga)
  const obatRows4 = await client.query(
    `SELECT rd.jumlah, p.selling_price, p.name FROM klinik_resep_detail rd JOIN products p ON p.id = rd.product_id WHERE rd.resep_id = $1`,
    [resep4.rows[0].id],
  )
  const totalObat4 = obatRows4.rows.reduce((s, r) => s + Number(r.jumlah) * Number(r.selling_price), 0)
  const totalTagihan4 = totalLayanan4 + totalObat4
  const tagihan4 = await client.query(
    `INSERT INTO klinik_tagihan (org_id, branch_id, kunjungan_id, pasien_id, total_layanan, total_obat, total_tagihan, metode_bayar, status, tanggal_bayar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'tunai', 'LUNAS', NOW()) RETURNING id::text`,
    [ORG_ID, branchId, k4.id, pasienIds['Siti Aminah'], totalLayanan4, totalObat4, totalTagihan4],
  )
  await client.query(
    `INSERT INTO klinik_tagihan_detail (tagihan_id, jenis, deskripsi, ref_id, qty, harga_satuan, subtotal) VALUES ($1, 'layanan', 'Konsultasi Umum', $2, 1, $3, $3)`,
    [tagihan4.rows[0].id, tarifIds['Konsultasi Umum'], totalLayanan4],
  )
  for (const r of obatRows4.rows) {
    await client.query(
      `INSERT INTO klinik_tagihan_detail (tagihan_id, jenis, deskripsi, qty, harga_satuan, subtotal) VALUES ($1, 'obat', $2, $3, $4, $5)`,
      [tagihan4.rows[0].id, r.name, r.jumlah, r.selling_price, Number(r.jumlah) * Number(r.selling_price)],
    )
  }
  await insertJournalEntry({
    orgId: ORG_ID, branchId, entryDate: today,
    description: `Pembayaran tagihan klinik ${tagihan4.rows[0].id}`, referenceType: 'KLINIK_PEMBAYARAN', referenceId: tagihan4.rows[0].id,
    lines: [
      { account_id: accountIds['1101'], debit: totalTagihan4, credit: 0, memo: 'Pembayaran tunai' },
      { account_id: accountIds['4101'], debit: 0, credit: totalLayanan4, memo: 'Pendapatan konsultasi' },
      { account_id: accountIds['4103'], debit: 0, credit: totalObat4, memo: 'Pendapatan obat' },
    ],
  })
  console.log(`✓ Kunjungan SELESAI (Siti Aminah): RME final, resep dispensed (HPP Rp${totalHpp4.toLocaleString('id-ID')}), tagihan LUNAS Rp${totalTagihan4.toLocaleString('id-ID')} — jurnal terposting`)

  // 13d. Satu pasien SELESAI di Poli Gigi (metode bayar BPJS, demonstrasi piutang)
  const k5 = await createKunjungan({ pasienNama: 'Agus Salim', poliKode: 'GIGI', jenisKunjungan: 'bpjs', status: 'DIPERIKSA', keluhan: 'Sakit gigi geraham' })
  const rm5 = await client.query(
    `INSERT INTO klinik_rekam_medis (org_id, kunjungan_id, anamnesis, diagnosis_text, terapi, status, finalized_at)
     VALUES ($1, $2, 'Nyeri gigi geraham kanan bawah sejak 3 hari.', 'Karies gigi (Pulpitis)', 'Tumpat sementara, rujuk kontrol 1 minggu', 'FINAL', NOW())
     RETURNING id::text`,
    [ORG_ID, k5.id],
  )
  await client.query(`INSERT INTO klinik_rekam_medis_history (rekam_medis_id, action, after) VALUES ($1, 'CREATED', '{}'::jsonb)`, [rm5.rows[0].id])
  await client.query(`INSERT INTO klinik_rekam_medis_history (rekam_medis_id, action) VALUES ($1, 'FINALIZED')`, [rm5.rows[0].id])
  await client.query(`UPDATE klinik_kunjungan SET status = 'SELESAI' WHERE id = $1`, [k5.id])

  const tarifGigi = await client.query(`SELECT harga FROM klinik_tarif_layanan WHERE id = $1`, [tarifIds['Konsultasi Gigi']])
  const totalTagihan5 = Number(tarifGigi.rows[0].harga)
  const tagihan5 = await client.query(
    `INSERT INTO klinik_tagihan (org_id, branch_id, kunjungan_id, pasien_id, total_layanan, total_obat, total_tagihan, metode_bayar, status, tanggal_bayar)
     VALUES ($1, $2, $3, $4, $5, 0, $5, 'bpjs', 'LUNAS', NOW()) RETURNING id::text`,
    [ORG_ID, branchId, k5.id, pasienIds['Agus Salim'], totalTagihan5],
  )
  await client.query(
    `INSERT INTO klinik_tagihan_detail (tagihan_id, jenis, deskripsi, ref_id, qty, harga_satuan, subtotal) VALUES ($1, 'layanan', 'Konsultasi Gigi', $2, 1, $3, $3)`,
    [tagihan5.rows[0].id, tarifIds['Konsultasi Gigi'], totalTagihan5],
  )
  await insertJournalEntry({
    orgId: ORG_ID, branchId, entryDate: today,
    description: `Pembayaran tagihan klinik ${tagihan5.rows[0].id} (BPJS)`, referenceType: 'KLINIK_PEMBAYARAN', referenceId: tagihan5.rows[0].id,
    lines: [
      { account_id: accountIds['1150'], debit: totalTagihan5, credit: 0, memo: 'Piutang BPJS' },
      { account_id: accountIds['4101'], debit: 0, credit: totalTagihan5, memo: 'Pendapatan konsultasi gigi' },
    ],
  })
  console.log(`✓ Kunjungan SELESAI (Agus Salim, Poli Gigi, BPJS): tagihan LUNAS Rp${totalTagihan5.toLocaleString('id-ID')} — piutang BPJS terposting`)

  // 13e. Satu kunjungan BATAL
  const k6 = await createKunjungan({ pasienNama: 'Putri Wulandari', poliKode: 'UMUM', keluhan: 'Cek kesehatan rutin' })
  await client.query(`UPDATE klinik_kunjungan SET status = 'BATAL' WHERE id = $1`, [k6.id])
  console.log(`✓ Kunjungan BATAL (Putri Wulandari) dibuat untuk demonstrasi status`)

  // ── 14. BOOKING ONLINE — 1 slot terkonfirmasi hari ini, belum check-in ──────
  const bookingStart = new Date()
  bookingStart.setHours(bookingStart.getHours() + 2, 0, 0, 0)
  const bookingEnd = new Date(bookingStart.getTime() + 30 * 60000)
  await client.query(
    `INSERT INTO klinik_slot_hold (org_id, branch_id, poli_id, staf_medis_id, starts_at, ends_at, status, pasien_nama, pasien_kontak, keluhan)
     VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', 'Hendra Gunawan', '081234567890', 'Booking online — kontrol tekanan darah')`,
    [ORG_ID, branchId, poliIds.UMUM, dokterStafId, bookingStart.toISOString(), bookingEnd.toISOString()],
  )
  console.log(`✓ Booking online: Hendra Gunawan, jam ${bookingStart.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} hari ini (belum check-in)`)

  console.log('\n─────────────────────────────────────────')
  console.log('Seeding selesai. Ringkasan alur yang bisa didemokan:')
  console.log('  • 2 pasien MENUNGGU di Poli Umum (Budi, Dewi/BPJS)')
  console.log('  • 1 pasien DIPERIKSA dengan RME draft + resep PENDING (Rudi) — coba dispensing dari tab Apotek')
  console.log('  • 1 pasien SELESAI lengkap tunai (Siti) — cek jurnal HPP + pendapatan di Buku Besar')
  console.log('  • 1 pasien SELESAI Poli Gigi via BPJS (Agus) — cek piutang BPJS di neraca')
  console.log('  • 1 kunjungan BATAL (Putri)')
  console.log('  • 1 booking online terkonfirmasi hari ini, belum check-in (Hendra)')
  console.log('  • Stok obat: 6 batch, 1 di antaranya SUDAH KADALUARSA (Antasida Doen batch ANT-A01) — tidak akan pernah ke-dispensing')
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch((e) => { console.error('SEED GAGAL:', e); process.exitCode = 1 })
  .finally(() => client.end())
