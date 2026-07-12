/**
 * generate-po-bus-template.mjs
 * Generate template Excel untuk pengisian data awal PO Bus Bintang Marwah
 * Jalankan: node scripts/generate-po-bus-template.mjs
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.utils.book_new()

// ─── Helper: buat sheet dengan header berformat ───────────────────────────────

function makeSheet(headers, examples) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])

  // Lebar kolom otomatis
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 20) }))

  // Style header (bold) — xlsx-js tidak support rich style tanpa Pro,
  // tapi kita bisa pakai comment sebagai petunjuk
  return ws
}

// ─── 1. ARMADA BUS ────────────────────────────────────────────────────────────

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
  'Harga Beli (Rp)',
  'Tanggal Beli (YYYY-MM-DD)',
  'Odometer Saat Ini (km)',
  'Catatan',
]

const armadaContoh = [
  ['L 1234 AB', 'Hino', 'RK8 R260', 2020, 44, 'Patas', 'J08E-123456', 'MJEHK8JK8L0012345', 'Putih', 850000000, '2020-03-15', 125000, ''],
  ['L 5678 CD', 'Mercedes-Benz', 'OH 1626', 2019, 50, 'Executive', 'OM906LA-456789', 'WDB9340321L123456', 'Hitam', 920000000, '2019-07-01', 210000, 'Unit cadangan'],
]

const wsArmada = makeSheet(armadaHeaders, armadaContoh)
XLSX.utils.book_append_sheet(wb, wsArmada, '1. Armada Bus')

// ─── 2. KREW BUS ─────────────────────────────────────────────────────────────

const krewHeaders = [
  'Nama Lengkap *',
  'Jabatan * (DRIVER / KERNET / CADANGAN)',
  'No. HP',
  'NIK (KTP)',
  'No. SIM',
  'Tanggal Kadaluarsa SIM (YYYY-MM-DD)',
  'Golongan Darah',
  'Tanggal Bergabung (YYYY-MM-DD)',
  'Catatan',
]

const krewContoh = [
  ['Ahmad Suprapto', 'DRIVER', '08123456789', '3578012345678901', 'B12345678', '2027-05-20', 'O', '2018-01-15', ''],
  ['Budi Santoso', 'KERNET', '08987654321', '3578019876543210', '', '', 'A', '2020-06-01', ''],
  ['Cahyo Wibowo', 'DRIVER', '08111222333', '3578011122334455', 'B98765432', '2026-11-30', 'B', '2021-03-10', 'Driver cadangan'],
]

const wsKrew = makeSheet(krewHeaders, krewContoh)
XLSX.utils.book_append_sheet(wb, wsKrew, '2. Kru Bus')

// ─── 3. RUTE ─────────────────────────────────────────────────────────────────

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

const wsRute = makeSheet(ruteHeaders, ruteContoh)
XLSX.utils.book_append_sheet(wb, wsRute, '3. Rute')

// ─── 4. POOL & AGEN ──────────────────────────────────────────────────────────

const poolHeaders = [
  'Kode Pool *',
  'Nama Pool/Agen *',
  'Tipe * (POOL_SENDIRI / AGEN_RESMI / SUB_AGEN)',
  'Nama Pemilik',
  'Nama PIC / Koordinator',
  'No. HP',
  'WhatsApp',
  'Email',
  'Alamat',
  'Kota',
  'Provinsi',
  '% Komisi per Tiket',
  'Saldo Deposit Awal (Rp)',
  'Limit Kredit (Rp)',
  'Nama Bank',
  'No. Rekening',
  'Nama Pemilik Rekening',
  'Catatan',
]

const poolContoh = [
  ['SBY-MAIN', 'Pool Utama Surabaya', 'POOL_SENDIRI', 'PT Bintang Marwah', 'Pak Hendra', '0811111111', '0811111111', 'info@bintangmarwah.com', 'Jl. Raya Kenjeran No. 10', 'Surabaya', 'Jawa Timur', 0, 0, 0, 'BCA', '1234567890', 'PT Bintang Marwah', 'Pool kantor pusat'],
  ['MLG-001', 'Agen Malang Kota', 'AGEN_RESMI', 'Bapak Slamet', 'Slamet', '0822222222', '0822222222', '', 'Jl. Ijen No. 5', 'Malang', 'Jawa Timur', 5, 2000000, 0, 'BRI', '0987654321', 'Slamet', ''],
  ['BWI-001', 'Agen Banyuwangi', 'AGEN_RESMI', 'Ibu Ratih', 'Ratih', '0833333333', '0833333333', '', 'Jl. PB Sudirman No. 22', 'Banyuwangi', 'Jawa Timur', 5, 1500000, 0, 'Mandiri', '1122334455', 'Ratih', ''],
]

const wsPool = makeSheet(poolHeaders, poolContoh)
XLSX.utils.book_append_sheet(wb, wsPool, '4. Pool & Agen')

// ─── 5. MEKANIK ──────────────────────────────────────────────────────────────

const mekanikHeaders = [
  'Nama Lengkap *',
  'No. HP',
  'Spesialisasi',
  'Catatan',
]

const mekanikContoh = [
  ['Dwi Hartono', '0844444444', 'Mesin & Transmisi', ''],
  ['Eko Prasetyo', '0855555555', 'Bodi & Kelistrikan', ''],
]

const wsMekanik = makeSheet(mekanikHeaders, mekanikContoh)
XLSX.utils.book_append_sheet(wb, wsMekanik, '5. Mekanik')

// ─── 6. CHECKPOINT / TERMINAL ────────────────────────────────────────────────

const checkpointHeaders = [
  'Nama Checkpoint/Terminal *',
  'Kota',
  'Tipe (TERMINAL / REST_AREA / POOL / LAINNYA)',
  'Catatan',
]

const checkpointContoh = [
  ['Terminal Bungurasih', 'Surabaya', 'TERMINAL', 'Terminal utama Surabaya'],
  ['Rest Area Km 57', 'Pasuruan', 'REST_AREA', ''],
  ['Terminal Arjosari', 'Malang', 'TERMINAL', 'Terminal utama Malang'],
  ['Pool Banyuwangi', 'Banyuwangi', 'POOL', ''],
]

const wsCheckpoint = makeSheet(checkpointHeaders, checkpointContoh)
XLSX.utils.book_append_sheet(wb, wsCheckpoint, '6. Checkpoint')

// ─── 7. PETUNJUK PENGISIAN ───────────────────────────────────────────────────

const petunjukData = [
  ['PETUNJUK PENGISIAN TEMPLATE DATA PO BUS — BINTANG MARWAH'],
  [''],
  ['URUTAN PENGISIAN (isi sesuai urutan ini agar referensi antar sheet tidak error):'],
  ['  1. Armada Bus       → Data kendaraan yang dimiliki'],
  ['  2. Kru Bus          → Driver & kernet yang aktif'],
  ['  3. Rute             → Rute perjalanan yang dioperasikan'],
  ['  4. Pool & Agen      → Pool sendiri + agen penjual tiket'],
  ['  5. Mekanik          → Teknisi di workshop'],
  ['  6. Checkpoint       → Terminal & rest area yang disinggahi'],
  [''],
  ['KETENTUAN:'],
  ['  • Kolom bertanda * wajib diisi'],
  ['  • Baris contoh (berwarna abu-abu) boleh dihapus'],
  ['  • Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
  ['  • Harga dalam Rupiah tanpa titik/koma (contoh: 85000 bukan 85.000)'],
  ['  • Jabatan kru: DRIVER / KERNET / CADANGAN'],
  ['  • Tipe pool: POOL_SENDIRI / AGEN_RESMI / SUB_AGEN'],
  ['  • Tipe checkpoint: TERMINAL / REST_AREA / POOL / LAINNYA'],
  [''],
  ['PRIORITAS MINIMAL UNTUK GO-LIVE:'],
  ['  ✓ Sheet 1 (Armada)  — minimal: plat, merek, kapasitas'],
  ['  ✓ Sheet 2 (Kru)     — minimal: nama + jabatan driver aktif'],
  ['  ✓ Sheet 3 (Rute)    — minimal: asal, tujuan, harga'],
  ['  Sheet 4-6 bisa diisi bertahap setelah operasional berjalan'],
  [''],
  ['Kirim file yang sudah diisi ke tim Nizam ERP untuk proses import.'],
]

const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData)
wsPetunjuk['!cols'] = [{ wch: 80 }]
XLSX.utils.book_append_sheet(wb, wsPetunjuk, '0. Petunjuk')

// ─── Pindahkan sheet Petunjuk ke posisi pertama ───────────────────────────────
// xlsx tidak support reorder langsung, nama sheet tetap urut sesuai ditambah

// ─── Simpan file ─────────────────────────────────────────────────────────────

const outputPath = 'docs/Template_Data_PO_Bus_Bintang_Marwah.xlsx'
XLSX.writeFile(wb, outputPath)
console.log(`✓ Template berhasil dibuat: ${outputPath}`)
console.log(`  Sheet: Petunjuk, Armada Bus, Kru Bus, Rute, Pool & Agen, Mekanik, Checkpoint`)
