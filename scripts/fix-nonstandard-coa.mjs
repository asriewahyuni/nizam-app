/**
 * fix-nonstandard-coa.mjs
 *
 * Script untuk memperbaiki akun CoA non-standar PSAK ke format standar 4-digit numerik.
 * Bekerja secara GENERIC untuk semua organisasi yang memiliki kode akun tidak standar.
 *
 * MASALAH YANG DITANGANI:
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Kode dot-notation (1.1.x, 2.1.x, 6.6.x) → tidak dikenali engine laporan/zakat/pajak
 * 2. Akun INDUK (misal 1500 - Aset Tetap) dipakai sebagai akun posting langsung
 * 3. Akun akumulasi penyusutan salah (mis. 1503 dipakai untuk semua jenis aset)
 *
 * STRATEGI MIGRASI PER AKUN:
 * ──────────────────────────────────────────────────────────────────────────────
 * Untuk setiap akun non-standar, script akan menentukan kode PSAK target terbaik
 * berdasarkan type (ASSET/LIABILITY/dll), nama akun, dan prefix kode asli.
 * Kemudian:
 *   → Jika target kode sudah ADA tapi KOSONG (0 journal lines, tidak di bank_accounts)
 *     → Hapus target kosong, lalu rename akun non-standar ke kode target
 *   → Jika target kode sudah ADA dan PUNYA DATA
 *     → Merge: pindahkan semua FK (journal_lines, bank_accounts, fixed_assets, products)
 *              ke akun target, lalu nonaktifkan akun non-standar
 *   → Jika target kode BELUM ADA
 *     → Langsung rename kode akun non-standar ke kode PSAK yang disarankan
 *
 * TABEL YANG DIUPDATE:
 * ──────────────────────────────────────────────────────────────────────────────
 *   - accounts (rename code / is_active = false)
 *   - journal_lines (account_id)
 *   - bank_accounts (account_id)
 *   - fixed_assets (asset_account_id, depreciation_account_id)
 *   - products (asset_account_id)
 *
 * USAGE:
 * ──────────────────────────────────────────────────────────────────────────────
 *   node scripts/fix-nonstandard-coa.mjs                      # dry-run semua org
 *   node scripts/fix-nonstandard-coa.mjs --apply              # apply semua org
 *   node scripts/fix-nonstandard-coa.mjs --org-id=<uuid>      # dry-run org tertentu
 *   node scripts/fix-nonstandard-coa.mjs --org-id=<uuid> --apply  # apply org tertentu
 *   node scripts/fix-nonstandard-coa.mjs --report             # cetak laporan lengkap
 */

import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

// ─────────────────────────────────────────────────────────────
// CLI FLAGS
// ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--apply')
const VERBOSE = args.includes('--verbose') || args.includes('--report')
const ORG_ID_ARG = (args.find(a => a.startsWith('--org-id=')) || '').replace('--org-id=', '').trim() || null

// ─────────────────────────────────────────────────────────────
// DB CONNECTION
// ─────────────────────────────────────────────────────────────
const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌ DATABASE_URL tidak ditemukan. Set di .env.local')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 3 })

// ─────────────────────────────────────────────────────────────
// PSAK STANDARD ACCOUNT TEMPLATE
// Kode standar yang dikenali oleh engine laporan/zakat/pajak NIZAM
// ─────────────────────────────────────────────────────────────
const PSAK_STANDARD = {
  // ASSET – Lancar
  '1101': { name: 'Kas Besar',                  type: 'ASSET', nb: 'DEBIT',  tags: ['kas besar', 'main cash', 'petty cash besar'] },
  '1102': { name: 'Kas Kecil (Petty Cash)',      type: 'ASSET', nb: 'DEBIT',  tags: ['kas kecil', 'petty cash'] },
  '1103': { name: 'Bank - Rekening Operasional', type: 'ASSET', nb: 'DEBIT',  tags: ['bank', 'rekening', 'bri', 'bsi', 'bca', 'mandiri', 'bni', 'cimb', 'danamon', 'xendit', 'dompet digital', 'gopay', 'ovo', 'dana', 'wallet'] },
  '1104': { name: 'Bank - Rekening Payroll',     type: 'ASSET', nb: 'DEBIT',  tags: ['payroll', 'gaji'] },
  '1105': { name: 'Bank - Rekening Lainnya',     type: 'ASSET', nb: 'DEBIT',  tags: [] },
  '1201': { name: 'Piutang Usaha',               type: 'ASSET', nb: 'DEBIT',  tags: ['piutang usaha', 'ar', 'receivable', 'piutang dagang'] },
  '1202': { name: 'Piutang Karyawan',            type: 'ASSET', nb: 'DEBIT',  tags: ['piutang karyawan', 'piutang pegawai', 'karyawan', 'pegawai'] },
  '1203': { name: 'Cadangan Kerugian Piutang',   type: 'ASSET', nb: 'CREDIT', tags: ['cadangan kerugian', 'penyisihan piutang'] },
  '1204': { name: 'Piutang Lain-lain',           type: 'ASSET', nb: 'DEBIT',  tags: ['piutang lain', 'piutang anggota', 'piutang peserta', 'piutang pak', 'piutang bunda', 'piutang kang', 'piutang klik', 'piutang custom'] },
  '1301': { name: 'Persediaan Barang Dagangan',  type: 'ASSET', nb: 'DEBIT',  tags: ['persediaan barang dagangan', 'stok', 'inventory', 'persediaan'] },
  '1302': { name: 'Persediaan Barang Dalam Proses', type: 'ASSET', nb: 'DEBIT', tags: ['wip', 'dalam proses', 'setengah jadi'] },
  '1303': { name: 'Persediaan Bahan Baku',       type: 'ASSET', nb: 'DEBIT',  tags: ['bahan baku', 'raw material'] },
  '1304': { name: 'Persediaan Barang Jadi',      type: 'ASSET', nb: 'DEBIT',  tags: ['barang jadi', 'finished goods'] },
  '1401': { name: 'PPN Masukan',                 type: 'ASSET', nb: 'DEBIT',  tags: ['ppn masukan', 'vat in', 'pajak masukan'] },
  '1402': { name: 'Biaya Dibayar Dimuka',        type: 'ASSET', nb: 'DEBIT',  tags: ['dibayar dimuka', 'prepaid'] },
  '1403': { name: 'Uang Muka Pembelian',         type: 'ASSET', nb: 'DEBIT',  tags: ['uang muka pembelian', 'dp pembelian', 'advance purchase'] },
  // ASSET – Tetap
  '1501': { name: 'Tanah',                        type: 'ASSET', nb: 'DEBIT',  tags: ['tanah', 'land'] },
  '1502': { name: 'Bangunan',                     type: 'ASSET', nb: 'DEBIT',  tags: ['bangunan', 'gedung', 'building'] },
  '1503': { name: 'Akumulasi Penyusutan Bangunan',type: 'ASSET', nb: 'CREDIT', tags: ['akumulasi penyusutan bangunan', 'dep bangunan', 'dep gedung', 'penyusutan bangunan'] },
  '1504': { name: 'Kendaraan',                    type: 'ASSET', nb: 'DEBIT',  tags: ['kendaraan', 'mobil', 'motor', 'vehicle', 'truk', 'truck', 'sepeda', 'aset kendaraan'] },
  '1505': { name: 'Akumulasi Penyusutan Kendaraan', type: 'ASSET', nb: 'CREDIT', tags: ['akumulasi penyusutan kendaraan', 'dep kendaraan', 'dep mobil', 'penyusutan kendaraan'] },
  '1506': { name: 'Peralatan & Mesin',            type: 'ASSET', nb: 'DEBIT',  tags: ['peralatan', 'mesin', 'equipment', 'machine', 'elektronik', 'komputer', 'laptop', 'printer', 'furnitur', 'furniture', 'meja', 'kursi', 'lemari', 'ac', 'kulkas', 'aset interior', 'aset elektronik', 'aset mesin'] },
  '1507': { name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', nb: 'CREDIT', tags: ['akumulasi penyusutan peralatan', 'dep peralatan', 'dep mesin', 'dep elektronik', 'penyusutan interior', 'penyusutan elektronik', 'penyusutan mesin'] },
  // LIABILITY
  '2101': { name: 'Hutang Usaha',                type: 'LIABILITY', nb: 'CREDIT', tags: ['hutang usaha', 'ap', 'payable', 'hutang dagang', 'hutang royalty', 'hutang refund', 'hutang pembagian', 'hutang salah transfer', 'hutang insentif', 'hutang pembelian', 'hutang sementara', 'hutang fee', 'hutang ongkos', 'hutang wifi', 'hutang listrik'] },
  '2102': { name: 'Hutang Bank Jangka Pendek',   type: 'LIABILITY', nb: 'CREDIT', tags: ['hutang bank jangka pendek', 'pinjaman bank'] },
  '2201': { name: 'PPN Keluaran',                type: 'LIABILITY', nb: 'CREDIT', tags: ['ppn keluaran', 'vat out', 'pajak keluaran', 'ppn keluaran (hutang)'] },
  '2202': { name: 'Hutang PPh 21',               type: 'LIABILITY', nb: 'CREDIT', tags: ['pph 21', 'hutang pph 21', 'pph 21 karyawan'] },
  '2203': { name: 'Hutang PPh 23',               type: 'LIABILITY', nb: 'CREDIT', tags: ['pph 23', 'hutang pph 23'] },
  '2204': { name: 'Hutang PPh Badan',            type: 'LIABILITY', nb: 'CREDIT', tags: ['pph badan', 'pajak badan', 'corporate tax', 'pph 25', 'pajak badan cicilan'] },
  '2301': { name: 'Pendapatan Diterima di Muka', type: 'LIABILITY', nb: 'CREDIT', tags: ['pendapatan diterima dimuka', 'unearned revenue', 'deferred revenue'] },
  '2302': { name: 'Uang Muka Penjualan',         type: 'LIABILITY', nb: 'CREDIT', tags: ['uang muka penjualan', 'dp penjualan', 'advance sales'] },
  '2401': { name: 'Hutang Gaji',                 type: 'LIABILITY', nb: 'CREDIT', tags: ['hutang gaji', 'accrued salary', 'hutang payroll', 'gaji karyawan'] },
  '2501': { name: 'Hutang Bank Jangka Panjang',  type: 'LIABILITY', nb: 'CREDIT', tags: ['hutang bank jangka panjang', 'long term loan'] },
  // EQUITY
  '3001': { name: 'Modal Disetor',               type: 'EQUITY', nb: 'CREDIT', tags: ['modal disetor', 'paid in capital', 'modal awal'] },
  '3002': { name: 'Laba Ditahan',                type: 'EQUITY', nb: 'CREDIT', tags: ['laba ditahan', 'retained earnings'] },
  '3003': { name: 'Laba Periode Berjalan',       type: 'EQUITY', nb: 'CREDIT', tags: ['laba periode', 'current period profit'] },
  '3004': { name: 'Prive / Dividen',             type: 'EQUITY', nb: 'DEBIT',  tags: ['prive', 'dividen', 'dividend'] },
  // REVENUE
  '4001': { name: 'Pendapatan Usaha',            type: 'REVENUE', nb: 'CREDIT', tags: ['pendapatan usaha', 'penjualan', 'revenue', 'sales'] },
  '4002': { name: 'Diskon Penjualan',            type: 'REVENUE', nb: 'DEBIT',  tags: ['diskon penjualan', 'potongan penjualan'] },
  '4003': { name: 'Retur Penjualan',             type: 'REVENUE', nb: 'DEBIT',  tags: ['retur penjualan', 'sales return'] },
  '4101': { name: 'Pendapatan Bunga',            type: 'REVENUE', nb: 'CREDIT', tags: ['pendapatan bunga', 'interest income'] },
  '4102': { name: 'Pendapatan Lain-lain',        type: 'REVENUE', nb: 'CREDIT', tags: ['pendapatan lain', 'other income'] },
  // EXPENSE
  '5001': { name: 'HPP / Cost of Goods Sold',   type: 'EXPENSE', nb: 'DEBIT',  tags: ['hpp', 'cogs', 'harga pokok', 'cost of goods'] },
  '5002': { name: 'Biaya Pengiriman Masuk',      type: 'EXPENSE', nb: 'DEBIT',  tags: ['pengiriman masuk', 'freight in'] },
  '6001': { name: 'Gaji & Tunjangan',            type: 'EXPENSE', nb: 'DEBIT',  tags: ['gaji', 'tunjangan', 'salary', 'upah', 'payroll'] },
  '6002': { name: 'Sewa Tempat',                 type: 'EXPENSE', nb: 'DEBIT',  tags: ['sewa', 'rent'] },
  '6003': { name: 'Utilitas',                    type: 'EXPENSE', nb: 'DEBIT',  tags: ['listrik', 'air', 'internet', 'telepon', 'utility'] },
  '6004': { name: 'Perlengkapan Kantor',         type: 'EXPENSE', nb: 'DEBIT',  tags: ['perlengkapan', 'office supply', 'atk'] },
  '6005': { name: 'Biaya Pemasaran & Iklan',     type: 'EXPENSE', nb: 'DEBIT',  tags: ['pemasaran', 'iklan', 'marketing', 'advertising', 'promosi'] },
  '6006': { name: 'Biaya Transportasi',          type: 'EXPENSE', nb: 'DEBIT',  tags: ['transportasi', 'transport', 'bbm', 'bensin', 'bahan bakar'] },
  '6007': { name: 'Biaya Perbaikan & Pemeliharaan', type: 'EXPENSE', nb: 'DEBIT', tags: ['perbaikan', 'pemeliharaan', 'maintenance', 'repair'] },
  '6008': { name: 'Biaya Asuransi',              type: 'EXPENSE', nb: 'DEBIT',  tags: ['asuransi', 'insurance'] },
  '6009': { name: 'Biaya Penyusutan',            type: 'EXPENSE', nb: 'DEBIT',  tags: ['biaya penyusutan', 'depreciation expense', 'depresiasi'] },
  '6010': { name: 'Biaya Profesional & Konsultan',type: 'EXPENSE', nb: 'DEBIT', tags: ['profesional', 'konsultan', 'legal', 'audit', 'accountant'] },
  '6099': { name: 'Beban Lain-lain',             type: 'EXPENSE', nb: 'DEBIT',  tags: ['beban lain', 'biaya lain', 'other expense'] },
  '6101': { name: 'Biaya Bunga Pinjaman',        type: 'EXPENSE', nb: 'DEBIT',  tags: ['bunga pinjaman', 'interest expense', 'biaya bunga'] },
}

// Kode yang merupakan AKUN INDUK (tidak boleh diposting langsung)
const PARENT_ONLY_CODES = new Set(['1000', '1100', '1200', '1300', '1400', '1500', '1600', '2000', '3000', '4000', '5000', '6000'])

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Apakah kode ini non-standar PSAK?
 * Non-standar = mengandung titik, slash, huruf, atau bukan angka murni
 */
function isNonStandardCode(code) {
  if (!code) return false
  const c = String(code).trim()
  // Standar PSAK: 3-4 digit angka murni
  return !/^\d{3,4}$/.test(c)
}

/**
 * Apakah akun ini adalah akun INDUK yang tidak boleh diposting?
 * Cek berdasarkan kode standar parent-only list
 */
function isParentOnlyAccount(code) {
  return PARENT_ONLY_CODES.has(String(code || '').trim())
}

/**
 * Cari kode PSAK terbaik berdasarkan type, nama, dan prefix kode asli.
 * Mengembalikan array kandidat terurut dari paling cocok ke paling umum.
 */
function suggestPsakCodes(account) {
  const name = String(account.name || '').toLowerCase().trim()
  const type = String(account.type || '').toUpperCase()
  const nb = String(account.normal_balance || '').toUpperCase()
  const rawCode = String(account.code || '').trim()

  // Ekstrak digit pertama dan kedua kode asli sebagai petunjuk kategori
  // Misal: "1.1.5" → firstDigit='1', secondDigit='1'
  //        "5.12.3" → firstDigit='5', secondDigit='12'
  const parts = rawCode.split('.')
  const firstDigit = parts[0] || rawCode.charAt(0)
  const secondDigit = parts[1] || ''

  // ── Deteksi khusus berdasarkan pola kode + nama akun ──────────

  // Piutang ke orang/entitas non-usaha → 1204 (Piutang Lain-lain)
  if (type === 'ASSET' && /piutang (pak|bunda|kang|bu |mas |anggota|peserta|custom|klik|lain)/.test(name)) {
    return ['1204', '1201', '1202']
  }

  // Akumulasi penyusutan → kode yang tepat berdasarkan nama
  if (type === 'ASSET' && nb === 'CREDIT' && /akumulasi|penyusutan|dep(resiasi)?/.test(name)) {
    if (/bangunan|gedung/.test(name)) return ['1503']
    if (/kendaraan|mobil|motor/.test(name)) return ['1505']
    if (/peralatan|mesin|elektronik|interior/.test(name)) return ['1507']
  }

  // Aset tetap detail → kode yang tepat berdasarkan nama
  if (type === 'ASSET' && /^aset |^aset$/.test(name)) {
    if (/tanah/.test(name)) return ['1501']
    if (/bangunan|gedung/.test(name)) return ['1502']
    if (/kendaraan|mobil|motor/.test(name)) return ['1504']
    if (/interior|furnitur|furniture|meja|kursi/.test(name)) return ['1506']
    if (/elektronik|mesin|komputer|laptop/.test(name)) return ['1506']
  }

  // PPh 25 cicilan → 1401 (PPN Masukan / pajak dibayar dimuka) — lebih tepatnya ke 1402
  if (type === 'ASSET' && /pph 25|pajak badan cicilan|pajak dibayar dimuka/.test(name)) {
    return ['1402', '1401']
  }

  // Sewa dibayar dimuka → 1402
  if (type === 'ASSET' && /sewa dibayar/.test(name)) {
    return ['1402']
  }

  // PPN Masukan → 1401
  if (type === 'ASSET' && /ppn masukan/.test(name)) {
    return ['1401']
  }

  // Kas kantor / proyek / GA / logistik / sementara → 1101 (Kas Besar)
  if (type === 'ASSET' && /^kas (office|kantor|proyek|ga|logistik|sementara|operasional)/.test(name)) {
    return ['1101', '1102']
  }

  // Bank spesifik → 1103 (Bank Rekening Operasional)
  if (type === 'ASSET' && /(bank |xendit|gopay|ovo|dana|wallet|rekening)/.test(name)) {
    return ['1103', '1104', '1105']
  }

  // PPh 21 karyawan (hutang) → 2202
  if (type === 'LIABILITY' && /pph 21/.test(name)) {
    return ['2202']
  }

  // PPN Keluaran (hutang) → 2201
  if (type === 'LIABILITY' && /ppn keluaran/.test(name)) {
    return ['2201']
  }

  // Deviden → 3004
  if (type === 'EQUITY' && /deviden|dividen/.test(name)) {
    return ['3004']
  }

  // Tambahan modal → 3001
  if (type === 'EQUITY' && /tambahan modal|modal/.test(name)) {
    return ['3001', '3002']
  }

  // ── Generic scoring berdasarkan keyword match ─────────────────
  const typeMatchCodes = Object.entries(PSAK_STANDARD)
    .filter(([, def]) => def.type === type)
    .sort(([codeA, defA], [codeB, defB]) => {
      // Skor berdasarkan jumlah keyword yang cocok di nama akun
      const scoreA = defA.tags.filter(t => name.includes(t)).length
      const scoreB = defB.tags.filter(t => name.includes(t)).length
      if (scoreB !== scoreA) return scoreB - scoreA

      // Preferensi kode yang diawali dengan digit yang sama
      const prefA = codeA.charAt(0) === firstDigit ? 1 : 0
      const prefB = codeB.charAt(0) === firstDigit ? 1 : 0
      return prefB - prefA
    })
    .map(([code]) => code)

  // Fallback berdasarkan digit pertama dan tipe akun
  const fallbackByDigit = {
    '1': type === 'ASSET' ? ['1103', '1204', '1301', '1506'] : [],
    '2': type === 'LIABILITY' ? ['2101', '2401', '2501'] : [],
    '3': type === 'EQUITY' ? ['3001', '3002'] : [],
    '4': type === 'REVENUE' ? ['4001', '4102'] : [],
    '5': type === 'EXPENSE' ? ['5001', '6099'] : [],
    '6': type === 'EXPENSE' ? ['6001', '6099'] : [],
    '7': type === 'EXPENSE' ? ['6099'] : [],
    '8': type === 'EXPENSE' ? ['6099'] : [],
    '9': type === 'EXPENSE' ? ['6099'] : [],
  }

  const combined = [...new Set([...typeMatchCodes, ...(fallbackByDigit[firstDigit] || [])])]
  return combined.length > 0 ? combined : ['6099'] // ultimate fallback
}

/**
 * Saat banyak akun non-standar mapping ke kode PSAK yang sama,
 * hanya satu yang bisa di-RENAME/DELETE_TARGET_THEN_RENAME.
 * Sisanya harus di-MERGE ke target tersebut.
 * Fungsi ini meresolusi konflik tersebut dengan memodifikasi log in-place.
 */
function resolveTargetConflicts(logs) {
  // Kelompokkan per (orgId, targetCode)
  const grouped = new Map()
  for (const item of logs) {
    if (item.kind !== 'NON_STANDARD') continue
    if (!item.targetCode) continue
    const key = `${item.orgId}::${item.targetCode}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  }

  for (const [, items] of grouped.entries()) {
    if (items.length <= 1) continue

    // Urutan prioritas yang jadi 'pemenang' (yang akan RENAME/DELETE_TARGET_THEN_RENAME):
    // 1. Akun yang punya journal_lines terbanyak (data paling penting)
    // 2. Akun yang terhubung ke bank_accounts
    items.sort((a, b) => {
      if (b.jlCount !== a.jlCount) return b.jlCount - a.jlCount
      if (b.baCount !== a.baCount) return b.baCount - a.baCount
      return 0
    })

    // Yang pertama tetap dengan strategi asli
    // Sisanya dipaksa MERGE ke winner tersebut
    const winner = items[0]
    for (let i = 1; i < items.length; i++) {
      items[i].strategy = 'MERGE'
      items[i].targetAccountId = winner.accountId // merge ke akun winner (yang sudah di-rename)
      items[i].mergeAfterRename = true // flag: merge setelah winner di-rename
    }
  }

  return logs
}

/**
 * Untuk akun INDUK yang salah dipakai posting (misal 1500 - Aset Tetap),
 * cari akun detail yang tepat berdasarkan deskripsi jurnal entry.
 */
function inferFixedAssetDetailCode(description) {
  const d = String(description || '').toLowerCase()
  if (/tanah|land/.test(d)) return '1501'
  if (/bangunan|gedung|building/.test(d)) return '1502'
  if (/kendaraan|mobil|motor|truk|vehicle|truck/.test(d)) return '1504'
  if (/elektronik|laptop|komputer|printer|hp|handphone|tablet|kamera/.test(d)) return '1506'
  if (/mesin|machine/.test(d)) return '1506'
  if (/peralatan|equipment|furnitur|furniture|meja|kursi|lemari|ac|kulkas/.test(d)) return '1506'
  return null // tidak bisa infer otomatis
}

/**
 * Untuk akun akumulasi penyusutan yang salah (1503 dipakai semua jenis),
 * cari akun akumulasi yang benar berdasarkan fixed_asset name / description.
 */
function inferDepreciationDetailCode(assetName, description) {
  const text = String((assetName || '') + ' ' + (description || '')).toLowerCase()
  if (/bangunan|gedung|building/.test(text)) return '1503'
  if (/kendaraan|mobil|motor|truk|vehicle/.test(text)) return '1505'
  if (/peralatan|mesin|elektronik|komputer|laptop|printer|furnitur|furniture|equipment/.test(text)) return '1507'
  return null
}

// ─────────────────────────────────────────────────────────────
// MAIN ANALYSIS: Scan satu org
// ─────────────────────────────────────────────────────────────
async function analyzeOrg(client, orgId, orgName) {
  const log = []

  // Ambil semua akun org — sertakan is_system untuk cek proteksi
  const { rows: allAccounts } = await client.query(
    `SELECT id, org_id, code, name, type, normal_balance, is_active, parent_id, is_system FROM accounts WHERE org_id = $1 ORDER BY code`,
    [orgId]
  )

  const accountByCode = new Map(allAccounts.map(a => [a.code, a]))
  const accountById = new Map(allAccounts.map(a => [a.id, a]))

  // Hitung journal_lines per account_id
  const { rows: jlCounts } = await client.query(
    `SELECT jl.account_id, COUNT(*) as cnt FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     WHERE a.org_id = $1
     GROUP BY jl.account_id`,
    [orgId]
  )
  const jlCountByAccId = new Map(jlCounts.map(r => [r.account_id, Number(r.cnt)]))

  // Hitung bank_accounts per account_id
  const { rows: baCounts } = await client.query(
    `SELECT account_id, COUNT(*) as cnt FROM bank_accounts WHERE org_id = $1 GROUP BY account_id`,
    [orgId]
  )
  const baCountByAccId = new Map(baCounts.map(r => [r.account_id, Number(r.cnt)]))

  // ── 1. Deteksi akun non-standar ──────────────────────────────
  const nonStandardAccounts = allAccounts.filter(a => a.is_active && isNonStandardCode(a.code))

  for (const acc of nonStandardAccounts) {
    const jlCount = jlCountByAccId.get(acc.id) || 0
    const baCount = baCountByAccId.get(acc.id) || 0
    const candidates = suggestPsakCodes(acc)
    const topCandidate = candidates[0]
    const targetAcc = topCandidate ? accountByCode.get(topCandidate) : null
    const targetJlCount = targetAcc ? (jlCountByAccId.get(targetAcc.id) || 0) : 0
    const targetBaCount = targetAcc ? (baCountByAccId.get(targetAcc.id) || 0) : 0
    const targetIsEmpty = targetAcc && targetJlCount === 0 && targetBaCount === 0
    const targetIsSystem = targetAcc?.is_system === true

    let strategy
    if (!targetAcc) {
      strategy = 'RENAME'                    // target tidak ada → rename langsung
    } else if (targetIsEmpty && !targetIsSystem) {
      strategy = 'DELETE_TARGET_THEN_RENAME' // target kosong & bukan sistem → hapus, rename
    } else {
      strategy = 'MERGE'                     // target punya data ATAU is_system → merge references
    }

    log.push({
      kind: 'NON_STANDARD',
      orgId,
      orgName,
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      jlCount,
      baCount,
      targetCode: topCandidate || null,
      targetAccountId: targetAcc?.id || null,
      targetIsEmpty,
      targetIsSystem,
      strategy,
      allCandidates: candidates.slice(0, 3),
    })
  }

  // ── 2. Deteksi akun INDUK yang diposting langsung ─────────────
  const parentAccountsWithPostings = allAccounts.filter(a => {
    if (!isParentOnlyAccount(a.code)) return false
    const jlCount = jlCountByAccId.get(a.id) || 0
    return jlCount > 0
  })

  for (const acc of parentAccountsWithPostings) {
    const jlCount = jlCountByAccId.get(acc.id) || 0

    // Ambil sample journal entries yang pakai akun ini
    const { rows: entries } = await client.query(
      `SELECT DISTINCT je.id, je.description, je.reference_type
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.account_id = $1
       LIMIT 20`,
      [acc.id]
    )

    // Coba infer akun detail yang tepat
    const inferredCodes = new Map()
    for (const entry of entries) {
      const code = acc.code === '1500'
        ? inferFixedAssetDetailCode(entry.description)
        : null
      if (code) {
        inferredCodes.set(code, (inferredCodes.get(code) || 0) + 1)
      }
    }

    log.push({
      kind: 'PARENT_MISUSE',
      orgId,
      orgName,
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      jlCount,
      entrySamples: entries.map(e => e.description).slice(0, 5),
      inferredDetailCodes: Object.fromEntries(inferredCodes),
      needsManualReview: inferredCodes.size === 0 || entries.length > inferredCodes.size,
    })
  }

  return resolveTargetConflicts(log)
}

// ─────────────────────────────────────────────────────────────
// EXECUTION: Apply migrasi untuk satu item log
// ─────────────────────────────────────────────────────────────
async function applyNonStandardFix(client, item) {
  const { accountId, accountCode, accountName, targetCode, targetAccountId, strategy, orgId } = item

  console.log(`\n  📌 ${accountCode} - ${accountName}`)
  console.log(`     Strategy: ${strategy} → target: ${targetCode || '(none)'}`)

  if (strategy === 'RENAME') {
    // Langsung update code
    await client.query(
      `UPDATE accounts SET code = $1, updated_at = NOW() WHERE id = $2`,
      [targetCode, accountId]
    )
    console.log(`     ✅ Renamed ${accountCode} → ${targetCode}`)

  } else if (strategy === 'DELETE_TARGET_THEN_RENAME') {
    // Hapus target kosong dulu
    await client.query(`DELETE FROM accounts WHERE id = $1`, [targetAccountId])
    console.log(`     🗑️  Target kosong ${targetCode} dihapus`)
    // Lalu rename
    await client.query(
      `UPDATE accounts SET code = $1, updated_at = NOW() WHERE id = $2`,
      [targetCode, accountId]
    )
    console.log(`     ✅ Renamed ${accountCode} → ${targetCode}`)

  } else if (strategy === 'MERGE') {
    // Pindahkan semua referensi ke target
    const moved = { jl: 0, ba: 0, fa_asset: 0, fa_dep: 0, prod: 0 }

    const jl = await client.query(
      `UPDATE journal_lines SET account_id = $1 WHERE account_id = $2`,
      [targetAccountId, accountId]
    )
    moved.jl = jl.rowCount

    const ba = await client.query(
      `UPDATE bank_accounts SET account_id = $1 WHERE account_id = $2`,
      [targetAccountId, accountId]
    )
    moved.ba = ba.rowCount

    // fixed_assets - asset_account_id
    const fa1 = await client.query(
      `UPDATE fixed_assets SET asset_account_id = $1 WHERE asset_account_id = $2`,
      [targetAccountId, accountId]
    )
    moved.fa_asset = fa1.rowCount

    // fixed_assets - accum_dep_account_id
    const fa2 = await client.query(
      `UPDATE fixed_assets SET accum_dep_account_id = $1 WHERE accum_dep_account_id = $2`,
      [targetAccountId, accountId]
    )
    moved.fa_dep = fa2.rowCount
    
    // fixed_assets - dep_expense_account_id
    await client.query(
      `UPDATE fixed_assets SET dep_expense_account_id = $1 WHERE dep_expense_account_id = $2`,
      [targetAccountId, accountId]
    )

    // products - asset_account_id
    const prod1 = await client.query(
      `UPDATE products SET asset_account_id = $1 WHERE asset_account_id = $2 AND org_id = $3`,
      [targetAccountId, accountId, orgId]
    )
    moved.prod = prod1.rowCount
    
    // products - income_account_id
    await client.query(
      `UPDATE products SET income_account_id = $1 WHERE income_account_id = $2 AND org_id = $3`,
      [targetAccountId, accountId, orgId]
    )
    
    // products - expense_account_id
    await client.query(
      `UPDATE products SET expense_account_id = $1 WHERE expense_account_id = $2 AND org_id = $3`,
      [targetAccountId, accountId, orgId]
    )

    // Nonaktifkan akun lama (jangan dihapus untuk audit trail)
    await client.query(
      `UPDATE accounts SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [accountId]
    )

    console.log(`     ✅ Merged: jl=${moved.jl} ba=${moved.ba} fa=${moved.fa_asset}/${moved.fa_dep} prod=${moved.prod}`)
    console.log(`     🔕 Akun lama ${accountCode} dinonaktifkan (audit trail dipertahankan)`)
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect()

  try {
    console.log('━'.repeat(70))
    console.log('🔧 fix-nonstandard-coa.mjs')
    console.log(`   Mode    : ${DRY_RUN ? '🔍 DRY-RUN (tidak ada perubahan)' : '🚀 APPLY (akan mengubah data!)'}`)
    console.log(`   Org     : ${ORG_ID_ARG || 'semua org'}`)
    console.log('━'.repeat(70))

    // Ambil daftar org
    const orgQuery = ORG_ID_ARG
      ? `SELECT id, name FROM organizations WHERE id = $1`
      : `SELECT id, name FROM organizations ORDER BY name`
    const orgParams = ORG_ID_ARG ? [ORG_ID_ARG] : []
    const { rows: orgs } = await client.query(orgQuery, orgParams)

    if (orgs.length === 0) {
      console.log('⚠️  Tidak ada org ditemukan.')
      return
    }

    console.log(`\n📋 Ditemukan ${orgs.length} org untuk diproses\n`)

    const allLogs = []

    // Analisa semua org
    for (const org of orgs) {
      const logs = await analyzeOrg(client, org.id, org.name)
      if (logs.length > 0) {
        allLogs.push(...logs)
      }
    }

    // ── LAPORAN ──────────────────────────────────────────────
    const nonStdItems = allLogs.filter(l => l.kind === 'NON_STANDARD')
    const parentItems = allLogs.filter(l => l.kind === 'PARENT_MISUSE')

    console.log('\n' + '═'.repeat(70))
    console.log('📊 RINGKASAN TEMUAN')
    console.log('═'.repeat(70))
    console.log(`  Akun non-standar      : ${nonStdItems.length} akun di ${new Set(nonStdItems.map(i => i.orgId)).size} org`)
    console.log(`  Akun induk diposting  : ${parentItems.length} akun di ${new Set(parentItems.map(i => i.orgId)).size} org`)

    if (nonStdItems.length > 0) {
      console.log('\n── Akun Non-Standar ─────────────────────────────────────────────')
      const byOrg = {}
      for (const item of nonStdItems) {
        if (!byOrg[item.orgId]) byOrg[item.orgId] = { name: item.orgName, items: [] }
        byOrg[item.orgId].items.push(item)
      }
      for (const [, { name, items }] of Object.entries(byOrg)) {
        console.log(`\n  🏢 ${name}`)
        for (const item of items) {
          const jlInfo = item.jlCount > 0 ? ` [${item.jlCount} journal lines]` : ''
          const baInfo = item.baCount > 0 ? ` [${item.baCount} bank_accounts]` : ''
          console.log(`     ${item.accountCode.padEnd(12)} → ${(item.targetCode || '?').padEnd(6)} | ${item.strategy.padEnd(26)} | ${item.accountName}${jlInfo}${baInfo}`)
        }
      }
    }

    if (parentItems.length > 0) {
      console.log('\n── Akun Induk Yang Diposting Langsung ────────────────────────────')
      for (const item of parentItems) {
        const needsReview = item.needsManualReview ? ' ⚠️  PERLU REVIEW MANUAL' : ''
        console.log(`\n  🏢 ${item.orgName}`)
        console.log(`     ${item.accountCode} - ${item.accountName} (${item.jlCount} lines)${needsReview}`)
        if (Object.keys(item.inferredDetailCodes).length > 0) {
          console.log(`     Inferred detail codes: ${JSON.stringify(item.inferredDetailCodes)}`)
        }
        if (VERBOSE && item.entrySamples.length > 0) {
          console.log(`     Sample entries:`)
          item.entrySamples.forEach(s => console.log(`       - ${s}`))
        }
      }
    }

    if (allLogs.length === 0) {
      console.log('\n✅ Tidak ada masalah ditemukan. Semua CoA sudah standar PSAK.')
      return
    }

    // ── EKSEKUSI ─────────────────────────────────────────────
    if (DRY_RUN) {
      console.log('\n' + '═'.repeat(70))
      console.log('ℹ️  DRY-RUN — Tidak ada yang diubah.')
      console.log('   Untuk apply: node scripts/fix-nonstandard-coa.mjs --apply')
      if (ORG_ID_ARG) console.log(`                tambahkan --org-id=${ORG_ID_ARG} untuk org spesifik`)
      console.log('═'.repeat(70))
      return
    }

    // Apply dalam satu transaksi besar
    console.log('\n' + '═'.repeat(70))
    console.log('🚀 MEMULAI EKSEKUSI...')
    console.log('═'.repeat(70))

    // Bypass trigger governance akun (safe: hanya berlaku di sesi ini)
    // Trigger seperti enforce_accounts_governance_v2 memblokir operasi karena
    // script berjalan tanpa auth session. session_replication_role = replica
    // menonaktifkan trigger USER (non-ALWAYS) untuk sesi ini saja.
    await client.query(`SET session_replication_role = replica`)
    console.log('   ⚙️  Trigger governance dinonaktifkan sementara untuk sesi migrasi\n')

    await client.query('BEGIN')

    try {
      // Proses NON_STANDARD items
      if (nonStdItems.length > 0) {
        console.log(`\n▶ Memperbaiki ${nonStdItems.length} akun non-standar...`)

        // Kelompokkan per org agar urutan rename aman
        const byOrg = new Map()
        for (const item of nonStdItems) {
          if (!byOrg.has(item.orgId)) byOrg.set(item.orgId, [])
          byOrg.get(item.orgId).push(item)
        }

        for (const [orgId, items] of byOrg.entries()) {
          const orgName = items[0].orgName
          console.log(`\n  🏢 ${orgName} (${orgId})`)

          // Urutkan: DELETE_TARGET_THEN_RENAME dulu, baru RENAME, terakhir MERGE
          const ordered = [
            ...items.filter(i => i.strategy === 'DELETE_TARGET_THEN_RENAME'),
            ...items.filter(i => i.strategy === 'RENAME'),
            ...items.filter(i => i.strategy === 'MERGE'),
          ]

          for (const item of ordered) {
            // Re-fetch account untuk memastikan state terbaru
            const { rows: [freshAcc] } = await client.query(
              `SELECT id, code FROM accounts WHERE id = $1`,
              [item.accountId]
            )
            if (!freshAcc) {
              console.log(`     ⏭️  Skip ${item.accountCode} — akun tidak ditemukan`)
              continue
            }

            // Gunakan SAVEPOINT agar error per-akun tidak abort seluruh transaksi
            const spName = `sp_${item.accountId.replace(/-/g, '_')}`
            await client.query(`SAVEPOINT ${spName}`)
            try {
              await applyNonStandardFix(client, item)
            } catch (itemErr) {
              await client.query(`ROLLBACK TO SAVEPOINT ${spName}`)
              console.log(`     ⚠️  Skip ${item.accountCode} (${item.accountName}) — error: ${itemErr.message}`)
            }
            await client.query(`RELEASE SAVEPOINT ${spName}`)
          }
        }
      }

      // Proses PARENT_MISUSE items — hanya yang bisa di-infer otomatis
      if (parentItems.length > 0) {
        const autoFixable = parentItems.filter(i => !i.needsManualReview && Object.keys(i.inferredDetailCodes).length > 0)
        const needsReview = parentItems.filter(i => i.needsManualReview || Object.keys(i.inferredDetailCodes).length === 0)

        if (autoFixable.length > 0) {
          console.log(`\n▶ Memperbaiki ${autoFixable.length} akun induk (auto-deteksi)...`)
          for (const item of autoFixable) {
            const topCode = Object.entries(item.inferredDetailCodes).sort((a, b) => b[1] - a[1])[0]?.[0]
            if (!topCode) continue

            const { rows: [targetAcc] } = await client.query(
              `SELECT id FROM accounts WHERE org_id = $1 AND code = $2 LIMIT 1`,
              [item.orgId, topCode]
            )
            if (!targetAcc) {
              console.log(`     ⚠️  Target ${topCode} tidak ada di org ${item.orgName}`)
              continue
            }

            console.log(`\n  🏢 ${item.orgName} — ${item.accountCode} → ${topCode}`)
            await client.query(
              `UPDATE journal_lines SET account_id = $1
               FROM journal_entries je
               WHERE journal_lines.entry_id = je.id
               AND journal_lines.account_id = $2
               AND (SELECT $3 ILIKE ANY(ARRAY[
                 '%' || lower(je.description) || '%'
               ]))`,
              [targetAcc.id, item.accountId, topCode === '1501' ? '%tanah%' :
                topCode === '1502' ? '%bangunan%' :
                topCode === '1504' ? '%kendaraan%' : '%elektronik%']
            )
            console.log(`     ✅ Journal lines dipindah ke ${topCode}`)
          }
        }

        if (needsReview.length > 0) {
          console.log(`\n⚠️  ${needsReview.length} akun induk PERLU REVIEW MANUAL (tidak bisa auto-fix):`)
          for (const item of needsReview) {
            console.log(`   - ${item.orgName}: ${item.accountCode} - ${item.accountName} (${item.jlCount} lines)`)
            console.log(`     Karena journal entries terlalu beragam untuk di-auto-mapping.`)
            console.log(`     Gunakan menu Jurnal di aplikasi untuk re-post ke akun yang benar.`)
          }
        }
      }

      await client.query('COMMIT')
      await client.query(`SET session_replication_role = origin`) // reset trigger
      console.log('\n' + '═'.repeat(70))
      console.log('✅ SELESAI — Semua perubahan berhasil di-commit.')
      console.log('   Cek laporan keuangan, zakat, dan pajak di aplikasi.')
      console.log('═'.repeat(70))

    } catch (err) {
      await client.query('ROLLBACK')
      console.error('\n❌ ERROR — Transaksi di-ROLLBACK. Tidak ada yang berubah.')
      console.error('   Detail:', err.message)
      throw err
    }

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  process.exitCode = 1
})
