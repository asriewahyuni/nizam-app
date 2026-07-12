/**
 * generate-po-bus-template.mjs
 * Generate template Excel untuk migrasi data awal PO Bus Bintang Marwah.
 * Kolom & enum di setiap sheet dijaga 1:1 dengan skema tabel aktual:
 *   bus_units, bus_crew, bus_routes, bus_checkpoints, bus_mechanics,
 *   bus_pools, bus_agents, bus_schedules, bus_tickets,
 *   bus_service_records, bus_tire_records, bus_emergency_calls
 * (lihat supabase/migrations/1319-1322_*.sql)
 * Jalankan: node scripts/generate-po-bus-template.mjs
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.utils.book_new()

function makeSheet(headers, examples) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(String(h).length + 4, 20) }))
  return ws
}

// ─── 1. ARMADA BUS (bus_units) ────────────────────────────────────────────────

const armadaHeaders = [
  'Nomor Plat *',
  'Merek *',
  'Model *',
  'Tahun',
  'Kapasitas Kursi',
  'Tipe Bodi',
  'Nomor Mesin',
  'Nomor Rangka',
  'Warna',
  'Status (TERSEDIA/BEROPERASI/SERVIS/TIDAK_AKTIF)',
  'Harga Beli (Rp)',
  'Tanggal Beli (YYYY-MM-DD)',
  'Odometer Saat Ini (km)',
  'Catatan',
]

const armadaContoh = [
  ['L 1234 AB', 'Hino', 'RK8 R260', 2020, 44, 'Patas', 'J08E-123456', 'MJEHK8JK8L0012345', 'Putih', 'BEROPERASI', 850000000, '2020-03-15', 125000, ''],
  ['L 5678 CD', 'Mercedes-Benz', 'OH 1626', 2019, 50, 'Executive', 'OM906LA-456789', 'WDB9340321L123456', 'Hitam', 'TERSEDIA', 920000000, '2019-07-01', 210000, 'Unit cadangan'],
]

XLSX.utils.book_append_sheet(wb, makeSheet(armadaHeaders, armadaContoh), '1. Armada Bus')

// ─── 2. KRU BUS (bus_crew) ─────────────────────────────────────────────────────

const krewHeaders = [
  'Nama Lengkap *',
  'Jabatan * (DRIVER/CO_DRIVER/KERNET/KONDEKTUR)',
  'No. HP',
  'NIK (KTP)',
  'No. SIM',
  'Tanggal Kadaluarsa SIM (YYYY-MM-DD)',
  'Golongan Darah',
  'Tanggal Bergabung (YYYY-MM-DD)',
  'Aktif? (YA/TIDAK)',
  'Catatan',
]

const krewContoh = [
  ['Ahmad Suprapto', 'DRIVER', '08123456789', '3578012345678901', 'B12345678', '2027-05-20', 'O', '2018-01-15', 'YA', ''],
  ['Budi Santoso', 'KERNET', '08987654321', '3578019876543210', '', '', 'A', '2020-06-01', 'YA', ''],
  ['Cahyo Wibowo', 'CO_DRIVER', '08111222333', '3578011122334455', 'B98765432', '2026-11-30', 'B', '2021-03-10', 'YA', 'Driver cadangan'],
]

XLSX.utils.book_append_sheet(wb, makeSheet(krewHeaders, krewContoh), '2. Kru Bus')

// ─── 3. RUTE (bus_routes) ──────────────────────────────────────────────────────

const ruteHeaders = [
  'Nama Rute *',
  'Kota Asal *',
  'Kota Tujuan *',
  'Jarak (km)',
  'Estimasi Durasi (jam)',
  'Harga Dasar Tiket (Rp) *',
  'Aktif? (YA/TIDAK)',
]

const ruteContoh = [
  ['Surabaya - Malang', 'Surabaya', 'Malang', 90, 2.5, 35000, 'YA'],
  ['Surabaya - Banyuwangi', 'Surabaya', 'Banyuwangi', 280, 7, 85000, 'YA'],
  ['Malang - Jakarta', 'Malang', 'Jakarta', 780, 14, 250000, 'YA'],
  ['Surabaya - Denpasar', 'Surabaya', 'Denpasar', 380, 9, 150000, 'YA'],
]

XLSX.utils.book_append_sheet(wb, makeSheet(ruteHeaders, ruteContoh), '3. Rute')

// ─── 4. CHECKPOINT / TERMINAL (bus_checkpoints) ────────────────────────────────
// Catatan: tabel bus_checkpoints TIDAK punya kolom "tipe" — hanya nama, lokasi, GPS.

const checkpointHeaders = [
  'Nama Checkpoint/Terminal *',
  'Nama Lokasi (detail)',
  'Koordinat GPS (lat,lng)',
  'Aktif? (YA/TIDAK)',
]

const checkpointContoh = [
  ['Terminal Bungurasih', 'Terminal Purabaya, Surabaya', '-7.349, 112.715', 'YA'],
  ['Rest Area Km 57', 'Tol Surabaya-Malang Km 57', '', 'YA'],
  ['Terminal Arjosari', 'Terminal Arjosari, Malang', '-7.943, 112.639', 'YA'],
]

XLSX.utils.book_append_sheet(wb, makeSheet(checkpointHeaders, checkpointContoh), '4. Checkpoint')

// ─── 5. MEKANIK (bus_mechanics) ────────────────────────────────────────────────

const mekanikHeaders = [
  'Nama Lengkap *',
  'No. HP',
  'Spesialisasi',
  'Aktif? (YA/TIDAK)',
  'Catatan',
]

const mekanikContoh = [
  ['Dwi Hartono', '0844444444', 'Mesin & Transmisi', 'YA', ''],
  ['Eko Prasetyo', '0855555555', 'Bodi & Kelistrikan', 'YA', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(mekanikHeaders, mekanikContoh), '5. Mekanik')

// ─── 6. POOL (bus_pools) ────────────────────────────────────────────────────────
// Pool = kantor/titik milik PO sendiri atau agen resmi yang menyimpan saldo deposit.

const poolHeaders = [
  'Kode Pool *',
  'Nama Pool *',
  'Tipe * (POOL_UTAMA/AGEN_RESMI/SUB_AGEN)',
  'Nama Pemilik',
  'Nama PIC/Koordinator',
  'No. HP',
  'WhatsApp',
  'Email',
  'Alamat',
  'Kota',
  'Provinsi',
  'Koordinat GPS (lat,lng)',
  '% Komisi per Tiket',
  'Saldo Deposit Awal (Rp)',
  'Limit Kredit (Rp)',
  'Nama Bank',
  'No. Rekening',
  'Nama Pemilik Rekening',
  'Aktif? (YA/TIDAK)',
  'Catatan',
]

const poolContoh = [
  ['SBY-MAIN', 'Pool Utama Surabaya', 'POOL_UTAMA', 'PT Bintang Marwah', 'Pak Hendra', '0811111111', '0811111111', 'info@bintangmarwah.com', 'Jl. Raya Kenjeran No. 10', 'Surabaya', 'Jawa Timur', '', 0, 0, 0, 'BCA', '1234567890', 'PT Bintang Marwah', 'YA', 'Pool kantor pusat'],
  ['MLG-001', 'Agen Malang Kota', 'AGEN_RESMI', 'Bapak Slamet', 'Slamet', '0822222222', '0822222222', '', 'Jl. Ijen No. 5', 'Malang', 'Jawa Timur', '', 5, 2000000, 0, 'BRI', '0987654321', 'Slamet', 'YA', ''],
  ['BWI-001', 'Agen Banyuwangi', 'AGEN_RESMI', 'Ibu Ratih', 'Ratih', '0833333333', '0833333333', '', 'Jl. PB Sudirman No. 22', 'Banyuwangi', 'Jawa Timur', '', 5, 1500000, 0, 'Mandiri', '1122334455', 'Ratih', 'YA', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(poolHeaders, poolContoh), '6. Pool')

// ─── 7. AGEN (bus_agents) ──────────────────────────────────────────────────────
// Agen = perorangan/kanal penjual tiket, terpisah dari Pool. "Kode Pool Induk"
// bersifat opsional — isi jika agen ini beroperasi di bawah salah satu Pool di sheet 6.

const agenHeaders = [
  'Nama Agen *',
  'No. HP',
  'Email',
  'Alamat',
  'Kota',
  '% Komisi per Tiket',
  'Kode Pool Induk (opsional, lihat sheet 6)',
  'Aktif? (YA/TIDAK)',
  'Catatan',
]

const agenContoh = [
  ['Toko Tiket Pak Joko', '0866666666', '', 'Jl. Diponegoro No. 8', 'Malang', 5, 'MLG-001', 'YA', ''],
  ['Warung Tiket Bu Siti', '0877777777', '', 'Jl. Merdeka No. 3', 'Banyuwangi', 5, 'BWI-001', 'YA', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(agenHeaders, agenContoh), '7. Agen')

// ─── 8. JADWAL (bus_schedules) — opsional, untuk migrasi jadwal berjalan ───────

const jadwalHeaders = [
  'Nama Rute * (lihat sheet 3)',
  'Nomor Plat Bus * (lihat sheet 1)',
  'Nama Driver (lihat sheet 2)',
  'Nama Kernet (lihat sheet 2)',
  'Waktu Berangkat * (YYYY-MM-DD HH:MM)',
  'Waktu Tiba (YYYY-MM-DD HH:MM)',
  'Status (TERJADWAL/BERANGKAT/TIBA/BATAL)',
  'Catatan',
]

const jadwalContoh = [
  ['Surabaya - Malang', 'L 1234 AB', 'Ahmad Suprapto', 'Budi Santoso', '2026-07-15 08:00', '2026-07-15 10:30', 'TERJADWAL', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(jadwalHeaders, jadwalContoh), '8. Jadwal (opsional)')

// ─── 9. TIKET (bus_tickets) — opsional, untuk migrasi tiket yang sudah terjual ─

const tiketHeaders = [
  'Nama Rute * (lihat sheet 3)',
  'Waktu Berangkat Jadwal * (YYYY-MM-DD HH:MM, cocokkan ke sheet 8)',
  'Nama Agen/Pool Penjual (opsional)',
  'Nama Penumpang *',
  'No. HP Penumpang',
  'Nomor Kursi *',
  'Harga (Rp) *',
  'Status (DIPESAN/DIBAYAR/DIGUNAKAN/BATAL)',
  'Catatan',
]

const tiketContoh = [
  ['Surabaya - Malang', '2026-07-15 08:00', 'Agen Malang Kota', 'Dewi Anggraini', '08199988877', '12A', 35000, 'DIBAYAR', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(tiketHeaders, tiketContoh), '9. Tiket (opsional)')

// ─── 10. SERVIS (bus_service_records) — opsional, riwayat servis lama ─────────

const servisHeaders = [
  'Nomor Plat Bus * (lihat sheet 1)',
  'Tanggal Servis * (YYYY-MM-DD)',
  'Deskripsi Pekerjaan *',
  'Tipe (ROUTINE/CORRECTIVE/PREVENTIVE/EMERGENCY)',
  'Biaya (Rp)',
  'Odometer Saat Servis (km)',
  'Nama Teknisi',
  'Servis Berikutnya Pada (km)',
  'Servis Berikutnya Tanggal (YYYY-MM-DD)',
  'Catatan',
]

const servisContoh = [
  ['L 1234 AB', '2026-05-10', 'Ganti oli mesin & filter', 'ROUTINE', 850000, 120000, 'Dwi Hartono', 130000, '2026-08-10', ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(servisHeaders, servisContoh), '10. Servis (opsional)')

// ─── 11. BAN (bus_tire_records) — opsional, riwayat ban terpasang ─────────────

const banHeaders = [
  'Nomor Plat Bus * (lihat sheet 1)',
  'Posisi * (FL/FR/RL/RR/RLL/RLT/RLI/RRL/RRT/RRI/SPARE)',
  'Merek',
  'Ukuran',
  'Tanggal Pasang (YYYY-MM-DD)',
  'Odometer Saat Pasang (km)',
  'Batas Umur (km)',
  'Catatan',
]

const banContoh = [
  ['L 1234 AB', 'FL', 'Bridgestone', '295/80 R22.5', '2026-02-01', 118000, 80000, ''],
]

XLSX.utils.book_append_sheet(wb, makeSheet(banHeaders, banContoh), '11. Ban (opsional)')

// ─── 12. EMERGENCY CALL (bus_emergency_calls) — opsional, riwayat insiden ─────

const emergencyHeaders = [
  'Nomor Plat Bus (lihat sheet 1, boleh kosong)',
  'Nama Pelapor *',
  'Waktu Panggilan (YYYY-MM-DD HH:MM)',
  'Deskripsi Lokasi',
  'Koordinat GPS (lat,lng)',
  'Jenis Masalah (MOGOK/KECELAKAAN/BAN_BOCOR/OVERHEAT/LAINNYA)',
  'Deskripsi',
  'Nama Mekanik yang Ditugaskan (lihat sheet 5)',
  'Status (BUKA/DALAM_PROSES/SELESAI)',
  'Waktu Selesai (YYYY-MM-DD HH:MM)',
  'Catatan Penyelesaian',
]

const emergencyContoh = [
  ['L 5678 CD', 'Pak Slamet (Driver)', '2026-06-20 14:30', 'Tol Surabaya-Malang Km 45', '', 'BAN_BOCOR', 'Ban belakang kanan bocor', 'Dwi Hartono', 'SELESAI', '2026-06-20 16:00', 'Ban diganti di lokasi'],
]

XLSX.utils.book_append_sheet(wb, makeSheet(emergencyHeaders, emergencyContoh), '12. Emergency (opsional)')

// ─── 0. PETUNJUK PENGISIAN ─────────────────────────────────────────────────────

const petunjukData = [
  ['PETUNJUK PENGISIAN TEMPLATE DATA PO BUS — BINTANG MARWAH (NIZAMNEW)'],
  [''],
  ['DATA WAJIB UNTUK GO-LIVE (isi lebih dulu, sesuai urutan sheet):'],
  ['  1. Armada Bus       → Data kendaraan yang dimiliki'],
  ['  2. Kru Bus          → Driver & kernet yang aktif'],
  ['  3. Rute             → Rute perjalanan yang dioperasikan'],
  ['  4. Checkpoint       → Terminal & rest area yang disinggahi'],
  ['  5. Mekanik          → Teknisi workshop'],
  ['  6. Pool             → Kantor pool milik sendiri / agen resmi (yang punya saldo deposit)'],
  ['  7. Agen             → Penjual tiket perorangan, boleh terafiliasi ke Pool di sheet 6'],
  [''],
  ['DATA OPSIONAL (riwayat/histori — isi jika ingin membawa data lama ke sistem baru):'],
  ['  8. Jadwal    → Jadwal keberangkatan yang sedang/sudah berjalan'],
  ['  9. Tiket     → Tiket yang sudah terjual (harus merujuk ke baris di sheet Jadwal)'],
  ['  10. Servis   → Riwayat servis kendaraan'],
  ['  11. Ban      → Riwayat ban terpasang per unit'],
  ['  12. Emergency → Riwayat panggilan darurat/mogok'],
  [''],
  ['KETENTUAN UMUM:'],
  ['  • Kolom bertanda * wajib diisi'],
  ['  • Baris contoh (berwarna abu-abu) boleh dihapus'],
  ['  • Format tanggal: YYYY-MM-DD, format tanggal+jam: YYYY-MM-DD HH:MM'],
  ['  • Harga dalam Rupiah tanpa titik/koma (contoh: 85000 bukan 85.000)'],
  ['  • Kolom "Nama X (lihat sheet Y)" merujuk ke data yang HARUS SUDAH ADA di sheet tersebut'],
  ['    — pastikan ejaan nama plat/rute/kru/mekanik/pool sama persis antar sheet'],
  [''],
  ['PERBAIKAN DARI TEMPLATE SEBELUMNYA:'],
  ['  • Sheet Pool & Agen dipisah — keduanya adalah tabel berbeda di database'],
  ['    (Pool = bus_pools, Agen = bus_agents), tidak bisa digabung satu sheet'],
  ['  • Enum Jabatan Kru diperbaiki: DRIVER/CO_DRIVER/KERNET/KONDEKTUR'],
  ['    ("CADANGAN" bukan nilai yang valid di database)'],
  ['  • Enum Tipe Pool diperbaiki: POOL_UTAMA/AGEN_RESMI/SUB_AGEN'],
  ['    ("POOL_SENDIRI" bukan nilai yang valid di database)'],
  ['  • Kolom "Tipe" di Checkpoint dihapus — tabel bus_checkpoints tidak punya kolom ini'],
  ['  • Ditambahkan sheet Jadwal, Tiket, Servis, Ban, Emergency untuk migrasi data histori'],
  [''],
  ['Kirim file yang sudah diisi ke tim Nizam ERP untuk proses import.'],
]

const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData)
wsPetunjuk['!cols'] = [{ wch: 90 }]
XLSX.utils.book_append_sheet(wb, wsPetunjuk, '0. Petunjuk')

// ─── Simpan file ────────────────────────────────────────────────────────────────

const outputPath = 'docs/Template_Data_PO_Bus_NIZAMNEW.xlsx'
XLSX.writeFile(wb, outputPath)
console.log(`✓ Template berhasil dibuat: ${outputPath}`)
console.log(`  Sheet: Petunjuk, Armada, Kru, Rute, Checkpoint, Mekanik, Pool, Agen, Jadwal, Tiket, Servis, Ban, Emergency`)
