import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputPath = path.join(repoRoot, 'templates', 'migrasi', 'NIZAM_Migration_Template.xlsx')
const publicOutputPath = path.join(repoRoot, 'public', 'templates', 'migrasi', 'NIZAM_Migration_Template.xlsx')

const HEADER_FILL = '0F3B74'
const HEADER_TEXT = 'FFFFFFFF'
const SHEET_TAB = 'D7E7FB'
const NOTE_FILL = 'FFF7DB'
const SAMPLE_FILL = 'F0F7FF'
const BORDER_COLOR = 'D9E2F2'

// ── VERSION MARKER ──
const TEMPLATE_VERSION = 'v2.0'
const TEMPLATE_RELEASE_DATE = new Date().toISOString().split('T')[0] // YYYY-MM-DD
const TEMPLATE_RELEASE_LABEL = `🔥 TERBARU · ${TEMPLATE_VERSION} (${TEMPLATE_RELEASE_DATE})`

const templates = [
  {
    name: 'Petunjuk',
    columns: [
      { header: 'Bagian', key: 'section', width: 28 },
      { header: 'Isi', key: 'content', width: 80 }
    ],
    rows: [
      { section: '🔥 VERSI TEMPLATE', content: TEMPLATE_RELEASE_LABEL },
      { section: '📅 Tanggal Release', content: `${TEMPLATE_RELEASE_DATE} · Update: validasi date, integer parent_code, Indonesian labels` },
      { section: 'Update terbaru', content: '✅ Validasi YYYY-MM-DD untuk join_date & acquisition_date · ✅ Support Bahasa Indonesia untuk tipe akun (Aset, Liabilitas, Ekuitas, Pendapatan, Beban) · ✅ Parent code unik & ter-validasi · ✅ Auto-deteksi format angka & tanggal Excel' },
      { section: 'Tujuan', content: 'Workbook ini dipakai client untuk menyiapkan data migrasi ke NIZAM dalam satu file kerja yang rapi, termasuk Chart of Accounts, master data, dan opening balance.' },
      { section: 'Urutan kerja', content: 'Isi berurutan: coa → customers → suppliers → products → warehouses → opening_stock → opening_ar → opening_ap → opening_cash_bank → opening_balances_gl → fixed_assets → bom → employees. Sheet vertikal (construction_projects, fleet_assets) hanya diisi bila memakai modul tersebut.' },
      { section: 'Baris sampel', content: 'Setiap sheet memiliki baris contoh berwarna biru muda. Hapus atau timpa baris sampel sebelum submit ke tim onboarding.' },
      { section: 'Format tanggal', content: 'Gunakan format YYYY-MM-DD.' },
      { section: 'Format angka', content: 'Gunakan angka murni tanpa pemisah ribuan dan tanpa prefix Rp.' },
      { section: 'TRUE/FALSE', content: 'Gunakan huruf kapital konsisten: TRUE atau FALSE.' },
      { section: 'currency_code', content: 'Isi IDR untuk transaksi Rupiah. Kosongkan jika tidak memakai multi-mata uang. Contoh nilai valid: IDR, USD, SGD, MYR.' },
      { section: 'exchange_rate', content: 'Isi kurs per tanggal cut-off jika currency_code bukan IDR. Contoh: 16200 artinya 1 USD = Rp 16.200. Isi 1 untuk IDR.' },
      { section: 'normal_balance', content: 'DEBIT untuk akun aset dan biaya. CREDIT untuk akun liabilitas, ekuitas, dan pendapatan.' },
      { section: 'opening_amount', content: 'Isi nilai positif saja. Sistem menentukan sisi debit/kredit berdasarkan normal_balance.' },
      { section: 'Persediaan', content: 'Opening stock diisi per produk per gudang. total_value harus sama dengan qty x unit_cost.' },
      { section: 'AR/AP', content: 'Isi per invoice outstanding, bukan total ringkas. Ini penting untuk aging dan penagihan.' },
      { section: 'Produk inventory', content: 'Kolom category wajib: Bahan / Setengah Jadi / Siap Jual / Pelengkap / Layanan. Salah kategori = akun persediaan salah.' },
      { section: 'GL mapping produk', content: 'income_account_code (akun pendapatan), cogs_account_code (akun HPP), asset_account_code (akun persediaan). Isi kode akun CoA NIZAM.' },
      { section: 'opening_balances_gl', content: 'Untuk saldo awal semua akun selain kas/bank. Contoh: modal, laba ditahan, hutang jangka panjang. Semua saldo di sheet ini + opening_cash_bank akan dijurnal otomatis oleh fungsi apply_opening_balances().' },
      { section: 'Aset tetap', content: 'acquisition_method: LUNAS (beli tunai), KREDIT (cicilan), atau SPLIT (sebagian tunai sebagian kredit).' },
      { section: 'Header template', content: 'Jangan ubah urutan atau nama header tanpa koordinasi dengan tim onboarding.' },
      { section: 'Versi CSV', content: 'Versi CSV mentah tetap tersedia di folder templates/migrasi untuk kebutuhan internal.' }
    ]
  },
  {
    name: 'coa',
    columns: [
      { header: 'kode_akun', key: 'kode_akun', width: 18 },
      { header: 'nama_akun', key: 'nama_akun', width: 34 },
      { header: 'kategori_utama', key: 'kategori_utama', width: 20 },
      { header: 'sub_kategori', key: 'sub_kategori', width: 22 },
      { header: 'parent_kode', key: 'parent_kode', width: 18 },
      { header: 'level', key: 'level', width: 10 },
      { header: 'tipe_akun', key: 'tipe_akun', width: 14 },
      { header: 'saldo_normal', key: 'saldo_normal', width: 16 },
      { header: 'arus_kas', key: 'arus_kas', width: 16 },
      { header: 'aktif', key: 'aktif', width: 12 },
      { header: 'deskripsi', key: 'deskripsi', width: 42 }
    ],
    requiredFields: ['kode_akun', 'nama_akun', 'kategori_utama', 'level', 'tipe_akun', 'saldo_normal', 'aktif'],
    booleanFields: ['aktif'],
    numericFields: ['level'],
    enumFields: {
      kategori_utama: ['Aset', 'Liabilitas', 'Ekuitas', 'Pendapatan', 'HPP', 'Beban Operasional', 'Beban Lainnya'],
      tipe_akun: ['HEADER', 'DETAIL'],
      saldo_normal: ['DEBIT', 'CREDIT'],
      arus_kas: ['OPERATING', 'INVESTING', 'FINANCING']
    },
    validations: [
      { columnKey: 'kategori_utama', values: ['Aset', 'Liabilitas', 'Ekuitas', 'Pendapatan', 'HPP', 'Beban Operasional', 'Beban Lainnya'] },
      { columnKey: 'tipe_akun', values: ['HEADER', 'DETAIL'] },
      { columnKey: 'saldo_normal', values: ['DEBIT', 'CREDIT'] },
      { columnKey: 'arus_kas', values: ['OPERATING', 'INVESTING', 'FINANCING'] },
      { columnKey: 'aktif', values: ['TRUE', 'FALSE'] }
    ]
  },
  {
    name: 'coa_sample',
    columns: [
      { header: 'kode_akun', key: 'kode_akun', width: 18 },
      { header: 'nama_akun', key: 'nama_akun', width: 34 },
      { header: 'kategori_utama', key: 'kategori_utama', width: 20 },
      { header: 'sub_kategori', key: 'sub_kategori', width: 22 },
      { header: 'parent_kode', key: 'parent_kode', width: 18 },
      { header: 'level', key: 'level', width: 10 },
      { header: 'tipe_akun', key: 'tipe_akun', width: 14 },
      { header: 'saldo_normal', key: 'saldo_normal', width: 16 },
      { header: 'arus_kas', key: 'arus_kas', width: 16 },
      { header: 'aktif', key: 'aktif', width: 12 },
      { header: 'deskripsi', key: 'deskripsi', width: 42 }
    ],
    rows: [
      { kode_akun: '1000', nama_akun: 'Aset', kategori_utama: 'Aset', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok besar akun aset.' },
      { kode_akun: '1100', nama_akun: 'Aset Lancar', kategori_utama: 'Aset', sub_kategori: 'Aset Lancar', parent_kode: '1000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Kelompok kas, bank, piutang, dan persediaan.' },
      { kode_akun: '1101', nama_akun: 'Kas Utama', kategori_utama: 'Aset', sub_kategori: 'Kas & Bank', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Saldo kas utama perusahaan.' },
      { kode_akun: '1102', nama_akun: 'Kas Kecil', kategori_utama: 'Aset', sub_kategori: 'Kas & Bank', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Petty cash untuk keperluan operasional harian.' },
      { kode_akun: '1111', nama_akun: 'Bank BCA - Rek 1234567890', kategori_utama: 'Aset', sub_kategori: 'Kas & Bank', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Rekening bank operasional utama.' },
      { kode_akun: '1112', nama_akun: 'Bank Mandiri - Rek 9876543210', kategori_utama: 'Aset', sub_kategori: 'Kas & Bank', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Rekening bank cabang Surabaya.' },
      { kode_akun: '1201', nama_akun: 'Piutang Usaha', kategori_utama: 'Aset', sub_kategori: 'Piutang', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Tagihan penjualan customer yang belum dibayar.' },
      { kode_akun: '1301', nama_akun: 'Persediaan Barang Dagangan', kategori_utama: 'Aset', sub_kategori: 'Persediaan', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Barang siap jual / trading.' },
      { kode_akun: '1302', nama_akun: 'Persediaan Bahan Baku', kategori_utama: 'Aset', sub_kategori: 'Persediaan', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Bahan baku untuk produksi.' },
      { kode_akun: '1303', nama_akun: 'Persediaan Barang Jadi', kategori_utama: 'Aset', sub_kategori: 'Persediaan', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Produk hasil proses produksi siap jual.' },
      { kode_akun: '1304', nama_akun: 'Perlengkapan', kategori_utama: 'Aset', sub_kategori: 'Persediaan', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Kemasan dan perlengkapan non-inventori utama.' },
      { kode_akun: '1500', nama_akun: 'Aset Tetap', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Kelompok aset tetap perusahaan.' },
      { kode_akun: '1502', nama_akun: 'Kendaraan', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Nilai perolehan kendaraan operasional.' },
      { kode_akun: '1503', nama_akun: 'Mesin', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Nilai perolehan mesin produksi.' },
      { kode_akun: '1504', nama_akun: 'Peralatan Kantor', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Laptop, printer, AC, dan peralatan kantor lain.' },
      { kode_akun: '1602', nama_akun: 'Akumulasi Penyusutan Kendaraan', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Akun kontra akumulasi penyusutan kendaraan.' },
      { kode_akun: '1603', nama_akun: 'Akumulasi Penyusutan Mesin', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Akun kontra akumulasi penyusutan mesin.' },
      { kode_akun: '2000', nama_akun: 'Liabilitas', kategori_utama: 'Liabilitas', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok besar akun kewajiban.' },
      { kode_akun: '2100', nama_akun: 'Liabilitas Jangka Pendek', kategori_utama: 'Liabilitas', sub_kategori: 'Liabilitas Jangka Pendek', parent_kode: '2000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Kelompok hutang operasional dan pajak jangka pendek.' },
      { kode_akun: '2101', nama_akun: 'Hutang Usaha', kategori_utama: 'Liabilitas', sub_kategori: 'Hutang Supplier', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Tagihan supplier yang belum dibayar.' },
      { kode_akun: '2102', nama_akun: 'Hutang Pajak PPN', kategori_utama: 'Liabilitas', sub_kategori: 'Pajak', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'PPN keluaran yang harus disetor.' },
      { kode_akun: '2103', nama_akun: 'Hutang PPh 21', kategori_utama: 'Liabilitas', sub_kategori: 'Pajak', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'PPh 21 karyawan yang belum disetor.' },
      { kode_akun: '2200', nama_akun: 'Liabilitas Jangka Panjang', kategori_utama: 'Liabilitas', sub_kategori: 'Liabilitas Jangka Panjang', parent_kode: '2000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Kelompok pinjaman dan hutang jangka panjang.' },
      { kode_akun: '2201', nama_akun: 'Hutang Bank Jangka Panjang', kategori_utama: 'Liabilitas', sub_kategori: 'Liabilitas Jangka Panjang', parent_kode: '2200', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Sisa pokok pinjaman bank.' },
      { kode_akun: '2301', nama_akun: 'Pendapatan Diterima Dimuka', kategori_utama: 'Liabilitas', sub_kategori: 'Liabilitas Lain', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'DP atau pembayaran di muka dari customer.' },
      { kode_akun: '3000', nama_akun: 'Ekuitas', kategori_utama: 'Ekuitas', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok akun ekuitas pemilik.' },
      { kode_akun: '3101', nama_akun: 'Modal Disetor', kategori_utama: 'Ekuitas', sub_kategori: 'Modal', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Setoran modal awal atau tambahan modal.' },
      { kode_akun: '3201', nama_akun: 'Laba Ditahan', kategori_utama: 'Ekuitas', sub_kategori: 'Saldo Laba', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Akumulasi laba tahun-tahun sebelumnya.' },
      { kode_akun: '3202', nama_akun: 'Laba Berjalan', kategori_utama: 'Ekuitas', sub_kategori: 'Saldo Laba', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Laba atau rugi tahun berjalan.' },
      { kode_akun: '4000', nama_akun: 'Pendapatan', kategori_utama: 'Pendapatan', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok akun pendapatan usaha.' },
      { kode_akun: '4101', nama_akun: 'Penjualan Produk', kategori_utama: 'Pendapatan', sub_kategori: 'Penjualan', parent_kode: '4000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Pendapatan utama dari penjualan barang.' },
      { kode_akun: '4102', nama_akun: 'Pendapatan Jasa Kirim', kategori_utama: 'Pendapatan', sub_kategori: 'Penjualan', parent_kode: '4000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Pendapatan dari jasa pengiriman.' },
      { kode_akun: '5000', nama_akun: 'HPP', kategori_utama: 'HPP', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok beban pokok penjualan.' },
      { kode_akun: '5101', nama_akun: 'HPP Penjualan', kategori_utama: 'HPP', sub_kategori: 'HPP', parent_kode: '5000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Biaya pokok barang yang terjual.' },
      { kode_akun: '5200', nama_akun: 'HPP Bahan Baku', kategori_utama: 'HPP', sub_kategori: 'HPP', parent_kode: '5000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'HPP untuk produk hasil produksi.' },
      { kode_akun: '6000', nama_akun: 'Beban Operasional', kategori_utama: 'Beban Operasional', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok beban operasional usaha.' },
      { kode_akun: '6101', nama_akun: 'Beban Gaji', kategori_utama: 'Beban Operasional', sub_kategori: 'SDM', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Gaji dan tunjangan karyawan.' },
      { kode_akun: '6102', nama_akun: 'Beban Sewa Kantor', kategori_utama: 'Beban Operasional', sub_kategori: 'Sewa', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Sewa gudang, kantor, atau tempat usaha.' },
      { kode_akun: '6103', nama_akun: 'Beban Listrik & Internet', kategori_utama: 'Beban Operasional', sub_kategori: 'Utilitas', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Listrik, air, internet, dan utilitas lain.' },
      { kode_akun: '6104', nama_akun: 'Beban Logistik Pengiriman', kategori_utama: 'Beban Operasional', sub_kategori: 'Distribusi', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Biaya ekspedisi dan pengiriman ke customer.' },
      { kode_akun: '6105', nama_akun: 'Beban Penyusutan', kategori_utama: 'Beban Operasional', sub_kategori: 'Penyusutan', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Beban penyusutan aset tetap.' }
    ]
  },
  {
    name: 'coa_referensi',
    columns: [
      { header: 'Referensi', key: 'reference', width: 30 },
      { header: 'Isi', key: 'content', width: 86 }
    ],
    rows: [
      { reference: 'kategori_utama: Aset', content: 'Akan dipetakan ke tipe akun ASSET.' },
      { reference: 'kategori_utama: Liabilitas', content: 'Akan dipetakan ke tipe akun LIABILITY.' },
      { reference: 'kategori_utama: Ekuitas', content: 'Akan dipetakan ke tipe akun EQUITY.' },
      { reference: 'kategori_utama: Pendapatan', content: 'Akan dipetakan ke tipe akun REVENUE.' },
      { reference: 'kategori_utama: HPP', content: 'Akan dipetakan ke tipe akun EXPENSE.' },
      { reference: 'kategori_utama: Beban Operasional / Beban Lainnya', content: 'Akan dipetakan ke tipe akun EXPENSE.' },
      { reference: 'tipe_akun = HEADER', content: 'Dipakai untuk akun pengelompokan seperti Aset, Liabilitas Jangka Pendek, atau Beban Operasional.' },
      { reference: 'tipe_akun = DETAIL', content: 'Dipakai untuk akun transaksi seperti Kas Utama, Hutang Usaha, Penjualan Produk, atau Beban Gaji.' },
      { reference: 'saldo_normal = DEBIT', content: 'Umumnya dipakai untuk Aset, HPP, dan Beban.' },
      { reference: 'saldo_normal = CREDIT', content: 'Umumnya dipakai untuk Liabilitas, Ekuitas, dan Pendapatan.' },
      { reference: 'level = 1', content: 'Akun root / kelompok paling atas. parent_kode harus kosong.' },
      { reference: 'level = 2 atau lebih', content: 'Akun anak. parent_kode wajib mengarah ke kode akun induk.' },
      { reference: 'arus_kas = OPERATING', content: 'Untuk akun yang berhubungan dengan operasional harian.' },
      { reference: 'arus_kas = INVESTING', content: 'Untuk akun yang berhubungan dengan pembelian atau pelepasan aset tetap/investasi.' },
      { reference: 'arus_kas = FINANCING', content: 'Untuk akun modal, pinjaman, dan aktivitas pendanaan lain.' },
      { reference: 'aktif = TRUE/FALSE', content: 'TRUE berarti akun dipakai saat go-live.' },
      { reference: 'Kesalahan yang harus dihindari', content: 'Jangan gunakan kode akun duplikat, jangan isi parent_kode yang sama dengan kode_akun, dan jangan mengubah arti akun inti tanpa persetujuan finance lead.' }
    ]
  },
  {
    name: 'coa_mapping',
    columns: [
      { header: 'legacy_account_code', key: 'legacy_account_code', width: 24 },
      { header: 'legacy_account_name', key: 'legacy_account_name', width: 32 },
      { header: 'nizam_account_code', key: 'nizam_account_code', width: 22 },
      { header: 'nizam_account_name', key: 'nizam_account_name', width: 32 },
      { header: 'notes', key: 'notes', width: 32 }
    ],
    sampleRows: [
      { legacy_account_code: '1-1001', legacy_account_name: 'Kas', nizam_account_code: '1101', nizam_account_name: 'Kas Utama', notes: '' },
      { legacy_account_code: '1-1002', legacy_account_name: 'Bank BCA', nizam_account_code: '1111', nizam_account_name: 'Bank BCA - Rek 1234567890', notes: '' },
      { legacy_account_code: '1-2001', legacy_account_name: 'Piutang Usaha', nizam_account_code: '1201', nizam_account_name: 'Piutang Usaha', notes: '' },
      { legacy_account_code: '1-3001', legacy_account_name: 'Persediaan Barang', nizam_account_code: '1301', nizam_account_name: 'Persediaan Barang Dagangan', notes: '' },
      { legacy_account_code: '2-1001', legacy_account_name: 'Hutang Usaha', nizam_account_code: '2101', nizam_account_name: 'Hutang Usaha', notes: '' },
      { legacy_account_code: '3-1001', legacy_account_name: 'Modal Disetor', nizam_account_code: '3101', nizam_account_name: 'Modal Disetor', notes: '' },
      { legacy_account_code: '3-2001', legacy_account_name: 'Laba Ditahan', nizam_account_code: '3201', nizam_account_name: 'Laba Ditahan', notes: '' },
      { legacy_account_code: '4-1001', legacy_account_name: 'Pendapatan Penjualan', nizam_account_code: '4101', nizam_account_name: 'Penjualan Produk', notes: '' },
      { legacy_account_code: '5-1001', legacy_account_name: 'HPP', nizam_account_code: '5101', nizam_account_name: 'HPP Penjualan', notes: '' },
      { legacy_account_code: '6-1001', legacy_account_name: 'Beban Gaji', nizam_account_code: '6101', nizam_account_name: 'Beban Gaji', notes: '' },
    ]
  },
  {
    name: 'customers',
    columns: [
      { header: 'customer_code', key: 'customer_code', width: 18 },
      { header: 'customer_name', key: 'customer_name', width: 32 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'city', key: 'city', width: 18 },
      { header: 'payment_term_days', key: 'payment_term_days', width: 18 },
      { header: 'npwp', key: 'npwp', width: 22 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['customer_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ],
    sampleRows: [
      { customer_code: 'CUST-001', customer_name: 'PT Maju Bersama', phone: '02112345678', email: 'finance@majubersama.co.id', address: 'Jl. Sudirman No. 12, Lantai 5', city: 'Jakarta', payment_term_days: 30, npwp: '01.234.567.8-901.000', is_active: 'TRUE', notes: 'Pelanggan utama - bayar rutin' },
      { customer_code: 'CUST-002', customer_name: 'CV Sejahtera Mandiri', phone: '02298765432', email: 'info@sejahteramandiri.com', address: 'Jl. Gatot Subroto No. 88', city: 'Surabaya', payment_term_days: 14, npwp: '', is_active: 'TRUE', notes: '' },
      { customer_code: 'CUST-003', customer_name: 'Toko Berkah Jaya', phone: '081234567890', email: 'berkahjaya@gmail.com', address: 'Jl. Pasar Baru No. 5', city: 'Bandung', payment_term_days: 7, npwp: '', is_active: 'TRUE', notes: 'Bayar tunai' },
      { customer_code: 'CUST-004', customer_name: 'UD Nusantara Trading', phone: '02187654321', email: 'nusantara@email.com', address: 'Jl. Raya Industri No. 33', city: 'Semarang', payment_term_days: 45, npwp: '02.345.678.9-012.000', is_active: 'TRUE', notes: '' },
    ]
  },
  {
    name: 'suppliers',
    columns: [
      { header: 'supplier_code', key: 'supplier_code', width: 18 },
      { header: 'supplier_name', key: 'supplier_name', width: 32 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'city', key: 'city', width: 18 },
      { header: 'payment_term_days', key: 'payment_term_days', width: 18 },
      { header: 'npwp', key: 'npwp', width: 22 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['supplier_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ],
    sampleRows: [
      { supplier_code: 'SUP-001', supplier_name: 'PT Bahan Prima Nusantara', phone: '02145678901', email: 'purchase@bahanprima.co.id', address: 'Jl. Industri Raya No. 100', city: 'Jakarta', payment_term_days: 30, npwp: '03.456.789.0-123.000', is_active: 'TRUE', notes: 'Supplier bahan baku utama' },
      { supplier_code: 'SUP-002', supplier_name: 'UD Logistik Andalan', phone: '02234567890', email: 'logistik@andalan.com', address: 'Jl. Pelabuhan No. 22', city: 'Surabaya', payment_term_days: 14, npwp: '', is_active: 'TRUE', notes: '' },
      { supplier_code: 'SUP-003', supplier_name: 'PT Indo Packaging', phone: '02187651234', email: 'indent@indopack.co.id', address: 'Kawasan Industri MM2100 Blok A-5', city: 'Bekasi', payment_term_days: 45, npwp: '04.567.890.1-234.000', is_active: 'TRUE', notes: 'Supplier kemasan' },
      { supplier_code: 'SUP-004', supplier_name: 'Importir Global Trade Ltd', phone: '02167890123', email: 'import@globaltrade.co.id', address: 'Jl. TB Simatupang No. 45', city: 'Jakarta', payment_term_days: 60, npwp: '05.678.901.2-345.000', is_active: 'TRUE', notes: 'Import bahan khusus - multi currency USD' },
    ]
  },
  {
    name: 'products',
    columns: [
      { header: 'sku', key: 'sku', width: 18 },
      { header: 'product_name', key: 'product_name', width: 32 },
      { header: 'type', key: 'type', width: 16 },
      { header: 'category', key: 'category', width: 18 },
      { header: 'unit', key: 'unit', width: 14 },
      { header: 'purchase_price', key: 'purchase_price', width: 16 },
      { header: 'selling_price', key: 'selling_price', width: 16 },
      { header: 'warehouse_default', key: 'warehouse_default', width: 22 },
      { header: 'income_account_code', key: 'income_account_code', width: 20 },
      { header: 'cogs_account_code', key: 'cogs_account_code', width: 20 },
      { header: 'asset_account_code', key: 'asset_account_code', width: 20 },
      { header: 'currency_code', key: 'currency_code', width: 16 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['sku', 'product_name', 'type'],
    booleanFields: ['is_active'],
    numericFields: ['purchase_price', 'selling_price'],
    enumFields: {
      type: ['INVENTORY', 'SERVICE'],
      category: ['Bahan', 'Setengah Jadi', 'Siap Jual', 'Pelengkap', 'Layanan']
    },
    validations: [
      { columnKey: 'type', values: ['INVENTORY', 'SERVICE'] },
      { columnKey: 'category', values: ['Bahan', 'Setengah Jadi', 'Siap Jual', 'Pelengkap', 'Layanan'] },
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ],
    sampleRows: [
      { sku: 'BRG-001', product_name: 'Beras Premium 5kg', type: 'INVENTORY', category: 'Siap Jual', unit: 'KG', purchase_price: 55000, selling_price: 75000, warehouse_default: 'Gudang Utama', income_account_code: '4101', cogs_account_code: '5101', asset_account_code: '1301', currency_code: 'IDR', is_active: 'TRUE', notes: '' },
      { sku: 'BRG-002', product_name: 'Minyak Goreng 1L', type: 'INVENTORY', category: 'Siap Jual', unit: 'BOTOL', purchase_price: 14000, selling_price: 18500, warehouse_default: 'Gudang Utama', income_account_code: '4101', cogs_account_code: '5101', asset_account_code: '1301', currency_code: 'IDR', is_active: 'TRUE', notes: '' },
      { sku: 'BHN-001', product_name: 'Tepung Terigu', type: 'INVENTORY', category: 'Bahan', unit: 'KG', purchase_price: 9000, selling_price: 0, warehouse_default: 'Gudang Bahan', income_account_code: '', cogs_account_code: '5200', asset_account_code: '1302', currency_code: 'IDR', is_active: 'TRUE', notes: 'Bahan baku produksi - tidak dijual' },
      { sku: 'PRD-001', product_name: 'Roti Tawar Standar 400g', type: 'INVENTORY', category: 'Siap Jual', unit: 'LOYANG', purchase_price: 8000, selling_price: 12500, warehouse_default: 'Gudang Produk Jadi', income_account_code: '4101', cogs_account_code: '5200', asset_account_code: '1303', currency_code: 'IDR', is_active: 'TRUE', notes: 'Produk hasil produksi' },
      { sku: 'PKG-001', product_name: 'Plastik Kemasan 1kg', type: 'INVENTORY', category: 'Pelengkap', unit: 'LEMBAR', purchase_price: 500, selling_price: 0, warehouse_default: 'Gudang Bahan', income_account_code: '', cogs_account_code: '', asset_account_code: '1304', currency_code: 'IDR', is_active: 'TRUE', notes: '' },
      { sku: 'SVC-001', product_name: 'Ongkos Kirim', type: 'SERVICE', category: 'Layanan', unit: 'LAYANAN', purchase_price: 0, selling_price: 25000, warehouse_default: '', income_account_code: '4102', cogs_account_code: '', asset_account_code: '', currency_code: 'IDR', is_active: 'TRUE', notes: 'Jasa - tidak berpengaruh ke stok' },
    ]
  },
  {
    name: 'warehouses',
    columns: [
      { header: 'warehouse_code', key: 'warehouse_code', width: 18 },
      { header: 'warehouse_name', key: 'warehouse_name', width: 30 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['warehouse_name'],
    booleanFields: ['is_active'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ],
    sampleRows: [
      { warehouse_code: 'GDG-001', warehouse_name: 'Gudang Utama', branch_name: 'Pusat', address: 'Jl. Industri No. 10, Cakung, Jakarta Timur', is_active: 'TRUE', notes: 'Gudang barang jadi dan dagangan' },
      { warehouse_code: 'GDG-002', warehouse_name: 'Gudang Bahan', branch_name: 'Pusat', address: 'Jl. Industri No. 10, Cakung, Jakarta Timur', is_active: 'TRUE', notes: 'Khusus bahan baku produksi' },
      { warehouse_code: 'GDG-003', warehouse_name: 'Gudang Produk Jadi', branch_name: 'Pusat', address: 'Jl. Industri No. 12, Cakung, Jakarta Timur', is_active: 'TRUE', notes: 'Output produksi' },
      { warehouse_code: 'GDG-004', warehouse_name: 'Gudang Cabang Surabaya', branch_name: 'Surabaya', address: 'Jl. Raya Margomulyo No. 35, Surabaya', is_active: 'TRUE', notes: '' },
    ]
  },
  {
    name: 'opening_stock',
    columns: [
      { header: 'sku', key: 'sku', width: 18 },
      { header: 'product_name', key: 'product_name', width: 32 },
      { header: 'warehouse_name', key: 'warehouse_name', width: 24 },
      { header: 'qty', key: 'qty', width: 14 },
      { header: 'unit_cost', key: 'unit_cost', width: 16 },
      { header: 'total_value', key: 'total_value', width: 16 },
      { header: 'batch_number', key: 'batch_number', width: 18 },
      { header: 'bin_name', key: 'bin_name', width: 18 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['sku', 'warehouse_name', 'qty'],
    numericFields: ['qty', 'unit_cost', 'total_value'],
    sampleRows: [
      { sku: 'BRG-001', product_name: 'Beras Premium 5kg', warehouse_name: 'Gudang Utama', qty: 500, unit_cost: 55000, total_value: 27500000, batch_number: '', bin_name: 'R-A1', notes: '' },
      { sku: 'BRG-002', product_name: 'Minyak Goreng 1L', warehouse_name: 'Gudang Utama', qty: 200, unit_cost: 14000, total_value: 2800000, batch_number: '', bin_name: 'R-A2', notes: '' },
      { sku: 'BHN-001', product_name: 'Tepung Terigu', warehouse_name: 'Gudang Bahan', qty: 1000, unit_cost: 9000, total_value: 9000000, batch_number: 'BATCH-2026-03', bin_name: '', notes: '' },
      { sku: 'BHN-002', product_name: 'Ragi Instant', warehouse_name: 'Gudang Bahan', qty: 500, unit_cost: 2500, total_value: 1250000, batch_number: 'BATCH-2026-03', bin_name: '', notes: '' },
      { sku: 'PRD-001', product_name: 'Roti Tawar Standar 400g', warehouse_name: 'Gudang Produk Jadi', qty: 150, unit_cost: 8000, total_value: 1200000, batch_number: '', bin_name: '', notes: '' },
      { sku: 'BRG-001', product_name: 'Beras Premium 5kg', warehouse_name: 'Gudang Cabang Surabaya', qty: 200, unit_cost: 55000, total_value: 11000000, batch_number: '', bin_name: '', notes: 'Stok cabang Surabaya' },
    ]
  },
  {
    name: 'opening_ar',
    columns: [
      { header: 'customer_name', key: 'customer_name', width: 32 },
      { header: 'invoice_number', key: 'invoice_number', width: 20 },
      { header: 'invoice_date', key: 'invoice_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 20 },
      { header: 'currency_code', key: 'currency_code', width: 16 },
      { header: 'exchange_rate', key: 'exchange_rate', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['customer_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount', 'exchange_rate'],
    dateFields: ['invoice_date', 'due_date'],
    sampleRows: [
      { customer_name: 'PT Maju Bersama', invoice_number: 'INV-2026-0312', invoice_date: '2026-03-15', due_date: '2026-04-15', outstanding_amount: 5750000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: '' },
      { customer_name: 'PT Maju Bersama', invoice_number: 'INV-2026-0389', invoice_date: '2026-04-01', due_date: '2026-05-01', outstanding_amount: 3200000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: 'Invoice kedua belum jatuh tempo' },
      { customer_name: 'CV Sejahtera Mandiri', invoice_number: 'INV-2026-0401', invoice_date: '2026-04-10', due_date: '2026-04-25', outstanding_amount: 1875000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Surabaya', notes: '' },
      { customer_name: 'UD Nusantara Trading', invoice_number: 'INV-2026-0421', invoice_date: '2026-04-20', due_date: '2026-05-20', outstanding_amount: 9500000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: 'Pembayaran sebagian sudah masuk' },
    ]
  },
  {
    name: 'opening_ap',
    columns: [
      { header: 'supplier_name', key: 'supplier_name', width: 32 },
      { header: 'bill_number', key: 'bill_number', width: 20 },
      { header: 'bill_date', key: 'bill_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 20 },
      { header: 'currency_code', key: 'currency_code', width: 16 },
      { header: 'exchange_rate', key: 'exchange_rate', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['supplier_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount', 'exchange_rate'],
    dateFields: ['bill_date', 'due_date'],
    sampleRows: [
      { supplier_name: 'PT Bahan Prima Nusantara', bill_number: 'PO-2026-0211', bill_date: '2026-03-20', due_date: '2026-04-20', outstanding_amount: 12000000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: '' },
      { supplier_name: 'PT Bahan Prima Nusantara', bill_number: 'PO-2026-0278', bill_date: '2026-04-15', due_date: '2026-05-15', outstanding_amount: 8500000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: 'Pembelian terakhir sebelum cut-off' },
      { supplier_name: 'UD Logistik Andalan', bill_number: 'PO-2026-0290', bill_date: '2026-04-22', due_date: '2026-05-06', outstanding_amount: 3750000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: '' },
      { supplier_name: 'Importir Global Trade Ltd', bill_number: 'PO-2026-0055', bill_date: '2026-03-01', due_date: '2026-06-01', outstanding_amount: 1500, currency_code: 'USD', exchange_rate: 16200, branch_name: 'Pusat', notes: 'Invoice USD - kurs per cut-off 30 Apr 2026' },
    ]
  },
  {
    name: 'opening_cash_bank',
    columns: [
      { header: 'account_code', key: 'account_code', width: 18 },
      { header: 'account_name', key: 'account_name', width: 30 },
      { header: 'account_type', key: 'account_type', width: 14 },
      { header: 'normal_balance', key: 'normal_balance', width: 16 },
      { header: 'opening_amount', key: 'opening_amount', width: 18 },
      { header: 'currency_code', key: 'currency_code', width: 16 },
      { header: 'exchange_rate', key: 'exchange_rate', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['account_name', 'account_type', 'opening_amount'],
    numericFields: ['opening_amount', 'exchange_rate'],
    enumFields: {
      account_type: ['KAS', 'BANK'],
      normal_balance: ['DEBIT', 'CREDIT']
    },
    validations: [
      { columnKey: 'account_type', values: ['KAS', 'BANK'] },
      { columnKey: 'normal_balance', values: ['DEBIT', 'CREDIT'] }
    ],
    sampleRows: [
      { account_code: '1101', account_name: 'Kas Besar', account_type: 'KAS', normal_balance: 'DEBIT', opening_amount: 5000000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: 'Hasil hitung fisik per 30 Apr 2026' },
      { account_code: '1102', account_name: 'Kas Kecil', account_type: 'KAS', normal_balance: 'DEBIT', opening_amount: 1500000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: '' },
      { account_code: '1111', account_name: 'Bank BCA - Rek 1234567890', account_type: 'BANK', normal_balance: 'DEBIT', opening_amount: 85000000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: 'Saldo per rekening koran 30 Apr 2026' },
      { account_code: '1112', account_name: 'Bank Mandiri - Rek 9876543210', account_type: 'BANK', normal_balance: 'DEBIT', opening_amount: 30000000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Pusat', notes: '' },
      { account_code: '1113', account_name: 'Bank BRI - Rek 5678901234', account_type: 'BANK', normal_balance: 'DEBIT', opening_amount: 12500000, currency_code: 'IDR', exchange_rate: 1, branch_name: 'Surabaya', notes: 'Rekening cabang Surabaya' },
      { account_code: '1114', account_name: 'Rekening USD - Citibank', account_type: 'BANK', normal_balance: 'DEBIT', opening_amount: 5000, currency_code: 'USD', exchange_rate: 16200, branch_name: 'Pusat', notes: 'Saldo USD per cut-off - sistem konversi ke IDR otomatis' },
    ]
  },
  {
    name: 'opening_balances_gl',
    columns: [
      { header: 'account_code', key: 'account_code', width: 18 },
      { header: 'account_name', key: 'account_name', width: 34 },
      { header: 'normal_balance', key: 'normal_balance', width: 16 },
      { header: 'opening_amount', key: 'opening_amount', width: 18 },
      { header: 'notes', key: 'notes', width: 40 }
    ],
    requiredFields: ['account_code', 'opening_amount'],
    numericFields: ['opening_amount'],
    enumFields: {
      normal_balance: ['DEBIT', 'CREDIT']
    },
    validations: [
      { columnKey: 'normal_balance', values: ['DEBIT', 'CREDIT'] }
    ],
    sampleRows: [
      { account_code: '3101', account_name: 'Modal Disetor', normal_balance: 'CREDIT', opening_amount: 500000000, notes: 'Modal awal pemegang saham' },
      { account_code: '3201', account_name: 'Laba Ditahan', normal_balance: 'CREDIT', opening_amount: 45750000, notes: 'Akumulasi laba s.d. 31 Desember 2025' },
      { account_code: '3202', account_name: 'Laba Berjalan', normal_balance: 'CREDIT', opening_amount: 12500000, notes: 'Laba Jan-Apr 2026 sebelum cut-off' },
      { account_code: '2101', account_name: 'Hutang Usaha', normal_balance: 'CREDIT', opening_amount: 30500000, notes: 'Total hutang dagang - detail di sheet opening_ap' },
      { account_code: '2102', account_name: 'Hutang Pajak PPN', normal_balance: 'CREDIT', opening_amount: 4500000, notes: 'PPN keluaran bulan April 2026' },
      { account_code: '2103', account_name: 'Hutang PPh 21', normal_balance: 'CREDIT', opening_amount: 2750000, notes: 'PPh karyawan April 2026 belum disetor' },
      { account_code: '2201', account_name: 'Hutang Bank - KMK', normal_balance: 'CREDIT', opening_amount: 120000000, notes: 'Kredit modal kerja sisa pokok' },
      { account_code: '2301', account_name: 'Pendapatan Diterima Dimuka', normal_balance: 'CREDIT', opening_amount: 8000000, notes: 'DP dari pelanggan yang belum dikirim' },
      { account_code: '1201', account_name: 'Piutang Usaha', normal_balance: 'DEBIT', opening_amount: 20945000, notes: 'Total piutang - detail di sheet opening_ar' },
      { account_code: '1301', account_name: 'Persediaan Barang Dagangan', normal_balance: 'DEBIT', opening_amount: 41700000, notes: 'Nilai stok barang - detail di sheet opening_stock' },
      { account_code: '1302', account_name: 'Persediaan Bahan Baku', normal_balance: 'DEBIT', opening_amount: 10250000, notes: 'Nilai bahan baku - detail di sheet opening_stock' },
    ]
  },
  {
    name: 'fixed_assets',
    columns: [
      { header: 'asset_code', key: 'asset_code', width: 16 },
      { header: 'asset_name', key: 'asset_name', width: 32 },
      { header: 'category', key: 'category', width: 20 },
      { header: 'acquisition_date', key: 'acquisition_date', width: 18 },
      { header: 'acquisition_cost', key: 'acquisition_cost', width: 18 },
      { header: 'acquisition_method', key: 'acquisition_method', width: 20 },
      { header: 'accumulated_depreciation', key: 'accumulated_depreciation', width: 24 },
      { header: 'useful_life_months', key: 'useful_life_months', width: 20 },
      { header: 'residual_value', key: 'residual_value', width: 16 },
      { header: 'asset_account_code', key: 'asset_account_code', width: 20 },
      { header: 'depreciation_account_code', key: 'depreciation_account_code', width: 24 },
      { header: 'branch_name', key: 'branch_name', width: 20 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['asset_name', 'acquisition_cost'],
    numericFields: ['acquisition_cost', 'accumulated_depreciation', 'useful_life_months', 'residual_value'],
    dateFields: ['acquisition_date'],
    enumFields: {
      acquisition_method: ['LUNAS', 'KREDIT', 'SPLIT']
    },
    validations: [
      { columnKey: 'acquisition_method', values: ['LUNAS', 'KREDIT', 'SPLIT'] }
    ],
    sampleRows: [
      { asset_code: 'FA-001', asset_name: 'Toyota Avanza - B 1234 ABC', category: 'Kendaraan', acquisition_date: '2022-01-15', acquisition_cost: 250000000, acquisition_method: 'LUNAS', accumulated_depreciation: 62500000, useful_life_months: 60, residual_value: 25000000, asset_account_code: '1502', depreciation_account_code: '1602', branch_name: 'Pusat', notes: 'Mobil operasional' },
      { asset_code: 'FA-002', asset_name: 'Honda Vario - B 5678 DEF', category: 'Kendaraan', acquisition_date: '2023-06-01', acquisition_cost: 25000000, acquisition_method: 'LUNAS', accumulated_depreciation: 5000000, useful_life_months: 60, residual_value: 2500000, asset_account_code: '1502', depreciation_account_code: '1602', branch_name: 'Surabaya', notes: 'Motor kurir cabang' },
      { asset_code: 'FA-003', asset_name: 'Mesin Press Hidraulik', category: 'Mesin', acquisition_date: '2020-06-01', acquisition_cost: 150000000, acquisition_method: 'KREDIT', accumulated_depreciation: 75000000, useful_life_months: 120, residual_value: 10000000, asset_account_code: '1503', depreciation_account_code: '1603', branch_name: 'Pusat', notes: 'Masih cicilan - sisa 3 tahun' },
      { asset_code: 'FA-004', asset_name: 'Laptop Dell - 3 unit', category: 'Peralatan Kantor', acquisition_date: '2023-09-01', acquisition_cost: 45000000, acquisition_method: 'LUNAS', accumulated_depreciation: 15000000, useful_life_months: 48, residual_value: 4500000, asset_account_code: '1504', depreciation_account_code: '1604', branch_name: 'Pusat', notes: '' },
    ]
  },
  {
    name: 'bom',
    columns: [
      { header: 'bom_code', key: 'bom_code', width: 18 },
      { header: 'output_sku', key: 'output_sku', width: 18 },
      { header: 'output_name', key: 'output_name', width: 28 },
      { header: 'output_qty', key: 'output_qty', width: 14 },
      { header: 'component_sku', key: 'component_sku', width: 18 },
      { header: 'component_name', key: 'component_name', width: 28 },
      { header: 'component_qty', key: 'component_qty', width: 16 },
      { header: 'component_unit', key: 'component_unit', width: 16 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['output_sku', 'component_sku', 'component_qty'],
    numericFields: ['output_qty', 'component_qty'],
    sampleRows: [
      { bom_code: 'BOM-001', output_sku: 'PRD-001', output_name: 'Roti Tawar Standar 400g', output_qty: 20, component_sku: 'BHN-001', component_name: 'Tepung Terigu', component_qty: 1, component_unit: 'KG', notes: 'Per batch 20 loyang' },
      { bom_code: 'BOM-001', output_sku: 'PRD-001', output_name: 'Roti Tawar Standar 400g', output_qty: 20, component_sku: 'BHN-002', component_name: 'Ragi Instant', component_qty: 2, component_unit: 'SACHET', notes: '' },
      { bom_code: 'BOM-001', output_sku: 'PRD-001', output_name: 'Roti Tawar Standar 400g', output_qty: 20, component_sku: 'PKG-001', component_name: 'Plastik Kemasan 1kg', component_qty: 20, component_unit: 'LEMBAR', notes: 'Satu kemasan per loyang' },
      { bom_code: 'BOM-002', output_sku: 'PRD-002', output_name: 'Roti Manis Isi Coklat', output_qty: 50, component_sku: 'BHN-001', component_name: 'Tepung Terigu', component_qty: 0.8, component_unit: 'KG', notes: 'Per batch 50 pcs' },
      { bom_code: 'BOM-002', output_sku: 'PRD-002', output_name: 'Roti Manis Isi Coklat', output_qty: 50, component_sku: 'BHN-002', component_name: 'Ragi Instant', component_qty: 1, component_unit: 'SACHET', notes: '' },
    ]
  },
  {
    name: 'employees',
    columns: [
      { header: 'employee_code', key: 'employee_code', width: 18 },
      { header: 'employee_name', key: 'employee_name', width: 28 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'department', key: 'department', width: 20 },
      { header: 'position', key: 'position', width: 22 },
      { header: 'join_date', key: 'join_date', width: 16 },
      { header: 'employment_status', key: 'employment_status', width: 20 },
      { header: 'basic_salary', key: 'basic_salary', width: 16 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['employee_name'],
    booleanFields: ['is_active'],
    numericFields: ['basic_salary'],
    dateFields: ['join_date'],
    enumFields: {
      employment_status: ['PERMANENT', 'CONTRACT', 'INTERN', 'FREELANCE']
    },
    validations: [
      { columnKey: 'employment_status', values: ['PERMANENT', 'CONTRACT', 'INTERN', 'FREELANCE'] },
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ],
    sampleRows: [
      { employee_code: 'EMP-001', employee_name: 'Budi Santoso', email: 'budi.santoso@perusahaan.com', phone: '081234567890', department: 'Operasional', position: 'Manager Operasional', join_date: '2019-03-01', employment_status: 'PERMANENT', basic_salary: 8000000, is_active: 'TRUE', notes: '' },
      { employee_code: 'EMP-002', employee_name: 'Siti Rahayu', email: 'siti.rahayu@perusahaan.com', phone: '082345678901', department: 'Keuangan', position: 'Staff Akuntansi', join_date: '2021-07-15', employment_status: 'PERMANENT', basic_salary: 5500000, is_active: 'TRUE', notes: '' },
      { employee_code: 'EMP-003', employee_name: 'Dedi Kurniawan', email: 'dedi.k@perusahaan.com', phone: '083456789012', department: 'Gudang', position: 'Kepala Gudang', join_date: '2020-01-20', employment_status: 'PERMANENT', basic_salary: 6200000, is_active: 'TRUE', notes: '' },
      { employee_code: 'EMP-004', employee_name: 'Rina Wulandari', email: 'rina.w@perusahaan.com', phone: '084567890123', department: 'Sales', position: 'Sales Executive', join_date: '2022-05-10', employment_status: 'PERMANENT', basic_salary: 4800000, is_active: 'TRUE', notes: 'Target komisi terpisah' },
      { employee_code: 'EMP-005', employee_name: 'Mega Lestari', email: 'mega.l@perusahaan.com', phone: '085678901234', department: 'HRD', position: 'Staff HR', join_date: '2023-08-01', employment_status: 'CONTRACT', basic_salary: 4000000, is_active: 'TRUE', notes: 'Kontrak 1 tahun - habis Agustus 2026' },
    ]
  },
  {
    name: 'construction_projects',
    columns: [
      { header: 'project_code', key: 'project_code', width: 18 },
      { header: 'project_name', key: 'project_name', width: 36 },
      { header: 'project_type', key: 'project_type', width: 18 },
      { header: 'client_name', key: 'client_name', width: 28 },
      { header: 'site_address', key: 'site_address', width: 36 },
      { header: 'contract_value', key: 'contract_value', width: 18 },
      { header: 'estimated_cost', key: 'estimated_cost', width: 18 },
      { header: 'start_date', key: 'start_date', width: 16 },
      { header: 'target_end_date', key: 'target_end_date', width: 18 },
      { header: 'project_status', key: 'project_status', width: 18 },
      { header: 'branch_name', key: 'branch_name', width: 20 },
      { header: 'notes', key: 'notes', width: 36 }
    ],
    requiredFields: ['project_code', 'project_name', 'project_type'],
    numericFields: ['contract_value', 'estimated_cost'],
    dateFields: ['start_date', 'target_end_date'],
    enumFields: {
      project_type: ['ARCHITECT', 'CONTRACTOR', 'DESIGN_BUILD', 'INTERIOR', 'CONSULTING'],
      project_status: ['PLANNING', 'TENDER', 'DESIGN', 'EXECUTION', 'HANDOVER', 'COMPLETED']
    },
    validations: [
      { columnKey: 'project_type', values: ['ARCHITECT', 'CONTRACTOR', 'DESIGN_BUILD', 'INTERIOR', 'CONSULTING'] },
      { columnKey: 'project_status', values: ['PLANNING', 'TENDER', 'DESIGN', 'EXECUTION', 'HANDOVER', 'COMPLETED'] }
    ],
    sampleRows: [
      { project_code: 'PRJ-2025-001', project_name: 'Pembangunan Gedung Kantor PT ABC 6 Lantai', project_type: 'CONTRACTOR', client_name: 'PT ABC Indonesia', site_address: 'Jl. Sudirman No. 45, Jakarta Selatan', contract_value: 2500000000, estimated_cost: 1800000000, start_date: '2025-06-01', target_end_date: '2026-08-31', project_status: 'EXECUTION', branch_name: 'Pusat', notes: 'Progres 62% per cut-off' },
      { project_code: 'PRJ-2025-002', project_name: 'Renovasi Interior Showroom Mewah', project_type: 'INTERIOR', client_name: 'CV Showroom Jaya', site_address: 'Jl. Gatot Subroto No. 22, Jakarta', contract_value: 350000000, estimated_cost: 250000000, start_date: '2026-03-01', target_end_date: '2026-06-30', project_status: 'EXECUTION', branch_name: 'Pusat', notes: 'Progres 35% per cut-off' },
      { project_code: 'PRJ-2026-001', project_name: 'Desain Arsitektur Villa Pantai', project_type: 'ARCHITECT', client_name: 'Bpk Hendra Wijaya', site_address: 'Jl. Pantai Indah No. 10, Bali', contract_value: 180000000, estimated_cost: 90000000, start_date: '2026-04-01', target_end_date: '2026-07-31', project_status: 'DESIGN', branch_name: 'Bali', notes: 'Masih tahap desain' },
    ]
  },
  {
    name: 'fleet_assets',
    columns: [
      { header: 'plate_number', key: 'plate_number', width: 18 },
      { header: 'brand', key: 'brand', width: 16 },
      { header: 'model', key: 'model', width: 22 },
      { header: 'fleet_type', key: 'fleet_type', width: 18 },
      { header: 'year', key: 'year', width: 12 },
      { header: 'color', key: 'color', width: 14 },
      { header: 'odometer', key: 'odometer', width: 14 },
      { header: 'daily_rate', key: 'daily_rate', width: 16 },
      { header: 'status', key: 'status', width: 18 },
      { header: 'asset_account_code', key: 'asset_account_code', width: 20 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['plate_number', 'model', 'fleet_type'],
    numericFields: ['year', 'odometer', 'daily_rate'],
    enumFields: {
      fleet_type: ['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS', 'HEAVY_EQUIPMENT', 'OTHER'],
      status: ['AVAILABLE', 'BOOKED', 'IN_MAINTENANCE', 'OUT_OF_SERVICE']
    },
    validations: [
      { columnKey: 'fleet_type', values: ['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS', 'HEAVY_EQUIPMENT', 'OTHER'] },
      { columnKey: 'status', values: ['AVAILABLE', 'BOOKED', 'IN_MAINTENANCE', 'OUT_OF_SERVICE'] }
    ],
    sampleRows: [
      { plate_number: 'B 1234 ABC', brand: 'Toyota', model: 'Avanza 1.3 G', fleet_type: 'CAR', year: 2021, color: 'Putih', odometer: 45000, daily_rate: 450000, status: 'AVAILABLE', asset_account_code: '1502', notes: '' },
      { plate_number: 'B 5678 DEF', brand: 'Toyota', model: 'Innova Reborn 2.0 V', fleet_type: 'CAR', year: 2022, color: 'Hitam', odometer: 32000, daily_rate: 600000, status: 'AVAILABLE', asset_account_code: '1502', notes: '' },
      { plate_number: 'B 9101 GHI', brand: 'Honda', model: 'Vario 125', fleet_type: 'MOTORCYCLE', year: 2023, color: 'Merah', odometer: 18000, daily_rate: 120000, status: 'AVAILABLE', asset_account_code: '1502', notes: 'Kurir harian' },
      { plate_number: 'B 2345 JKL', brand: 'Mitsubishi', model: 'Colt Diesel FE 71', fleet_type: 'TRUCK', year: 2019, color: 'Kuning', odometer: 120000, daily_rate: 800000, status: 'AVAILABLE', asset_account_code: '1503', notes: 'Angkut barang max 4 ton' },
      { plate_number: 'B 6789 MNO', brand: 'Daihatsu', model: 'Gran Max Pick Up', fleet_type: 'CAR', year: 2020, color: 'Putih', odometer: 78000, daily_rate: 350000, status: 'IN_MAINTENANCE', asset_account_code: '1502', notes: 'Servis rutin - kembali 5 Mei 2026' },
    ]
  }
]

function styleHeader(row) {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } }
    }
  })
}

function styleNotes(sheet) {
  const noteRow = sheet.getRow(2)
  noteRow.height = 42
  noteRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NOTE_FILL }
    }
    cell.font = { italic: true, color: { argb: '6B5B00' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } }
    }
  })
}

function styleSampleRow(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SAMPLE_FILL }
    }
    cell.font = { color: { argb: '1A3A6B' }, italic: true }
    cell.border = {
      bottom: { style: 'hair', color: { argb: BORDER_COLOR } }
    }
    cell.alignment = { vertical: 'top' }
  })
}

function addValidation(sheet, columnIndex, values) {
  for (let row = 3; row <= 500; row += 1) {
    sheet.getCell(row, columnIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Nilai tidak valid',
      error: `Pilih salah satu: ${values.join(', ')}`
    }
  }
}

function buildColumnHint(template, column) {
  const hints = []
  const requiredFields = template.requiredFields || []
  const numericFields = template.numericFields || []
  const booleanFields = template.booleanFields || []
  const dateFields = template.dateFields || []
  const enumFields = template.enumFields || {}

  hints.push(requiredFields.includes(column.key) ? 'Wajib' : 'Opsional')

  if (numericFields.includes(column.key)) {
    hints.push('angka')
    hints.push('tanpa Rp/titik ribuan')
  } else if (booleanFields.includes(column.key)) {
    hints.push('TRUE/FALSE')
  } else if (dateFields.includes(column.key)) {
    hints.push('YYYY-MM-DD')
  } else if (enumFields[column.key]) {
    hints.push(`pilih: ${enumFields[column.key].join('/')}`)
  } else if (column.key === 'currency_code') {
    hints.push('IDR/USD/SGD dll. Kosongkan jika tidak multi-currency')
  } else if (column.key === 'exchange_rate') {
    hints.push('kurs per cut-off. Isi 1 untuk IDR')
  } else if (column.key === 'normal_balance') {
    hints.push('DEBIT atau CREDIT')
  } else if (column.key === 'opening_amount') {
    hints.push('nilai positif dalam mata uang asli')
  } else if (column.key === 'income_account_code') {
    hints.push('kode akun pendapatan - mis: 4101')
  } else if (column.key === 'cogs_account_code') {
    hints.push('kode akun HPP - mis: 5101')
  } else if (column.key === 'asset_account_code') {
    hints.push('kode akun persediaan/aset - mis: 1301')
  } else if (column.key === 'depreciation_account_code') {
    hints.push('kode akun akum. penyusutan - mis: 1602')
  } else if (column.key === 'kode_akun') {
    hints.push('kode akun unik')
  } else if (column.key === 'nama_akun') {
    hints.push('nama akun final')
  } else if (column.key === 'sub_kategori') {
    hints.push('grup atau klasifikasi')
  } else if (column.key === 'parent_kode') {
    hints.push('kosongkan untuk root')
  } else if (column.key === 'level') {
    hints.push('1 untuk root')
  } else if (column.key === 'deskripsi') {
    hints.push('fungsi akun')
  } else if (column.key === 'aktif') {
    hints.push('TRUE/FALSE')
  } else if (column.key === 'sku' || column.key.endsWith('_sku')) {
    hints.push('kode produk unik')
  } else if (column.key.endsWith('_number')) {
    hints.push('nomor referensi')
  } else if (column.key === 'email') {
    hints.push('format email')
  } else if (column.key === 'phone') {
    hints.push('nomor telepon')
  } else if (column.key === 'npwp') {
    hints.push('nomor NPWP')
  } else if (column.key === 'unit' || column.key.endsWith('_unit')) {
    hints.push('satuan, mis: Pcs/Kg/Ekor')
  } else if (column.key === 'notes') {
    hints.push('catatan tambahan')
  } else if (column.key.endsWith('_code')) {
    hints.push('kode unik')
  } else if (column.key.endsWith('_name')) {
    hints.push('nama sesuai sumber')
  } else {
    hints.push('isi sesuai sumber')
  }

  return hints.join(' · ')
}

function addTemplateSheet(workbook, template) {
  const sheet = workbook.addWorksheet(template.name, {
    properties: { tabColor: { argb: SHEET_TAB } },
    views: [{ state: 'frozen', ySplit: 2 }]
  })

  sheet.columns = template.columns.map((column) => ({
    key: column.key,
    width: column.width,
  }))
  sheet.addRow(template.columns.map((column) => column.header))
  styleHeader(sheet.getRow(1))

  const noteValues = template.columns.map((column) => buildColumnHint(template, column))
  sheet.addRow(noteValues)
  styleNotes(sheet)

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: template.columns.length }
  }

  // Rows tetap (Petunjuk, coa_sample, coa_referensi)
  if (template.rows) {
    for (const row of template.rows) {
      const addedRow = sheet.addRow(row)
      addedRow.eachCell((cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: BORDER_COLOR } } }
        cell.alignment = { vertical: 'top', wrapText: true }
      })
    }
  }

  // Baris sampel berwarna biru muda
  if (template.sampleRows) {
    for (const row of template.sampleRows) {
      const addedRow = sheet.addRow(row)
      styleSampleRow(addedRow)
    }
  }

  if (template.validations) {
    for (const validation of template.validations) {
      const columnIndex = template.columns.findIndex((column) => column.key === validation.columnKey) + 1
      if (columnIndex > 0) {
        addValidation(sheet, columnIndex, validation.values)
      }
    }
  }

  // Style baris kosong berikutnya (baris data klien)
  sheet.eachRow((row, rowNumber) => {
    const firstDataRow = (template.rows?.length || 0) + (template.sampleRows?.length || 0) + 3
    if (rowNumber <= firstDataRow - 1) return
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: BORDER_COLOR } } }
      cell.alignment = { vertical: 'top' }
    })
  })
}

async function main() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NIZAM'
  workbook.company = 'NIZAM'
  workbook.subject = 'Template Migrasi Client'
  workbook.title = 'NIZAM Migration Template'
  workbook.created = new Date()
  workbook.modified = new Date()

  for (const template of templates) {
    addTemplateSheet(workbook, template)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  await mkdir(path.dirname(outputPath), { recursive: true })
  await mkdir(path.dirname(publicOutputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(buffer))
  await writeFile(publicOutputPath, Buffer.from(buffer))
  console.log(`✓ Workbook dibuat: ${outputPath}`)
  console.log(`✓ Copy public:     ${publicOutputPath}`)
  console.log(`  Sheet: ${workbook.worksheets.map(s => s.name).join(', ')}`)
}

await main()
