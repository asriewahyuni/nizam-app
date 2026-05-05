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
const BORDER_COLOR = 'D9E2F2'

const templates = [
  {
    name: 'Petunjuk',
    columns: [
      { header: 'Bagian', key: 'section', width: 28 },
      { header: 'Isi', key: 'content', width: 80 }
    ],
    rows: [
      { section: 'Tujuan', content: 'Workbook ini dipakai client untuk menyiapkan data migrasi ke NIZAM dalam satu file kerja yang rapi, termasuk Chart of Accounts, master data, dan opening balance.' },
      { section: 'Urutan kerja', content: 'Disarankan isi dan review mulai dari sheet coa, lalu customers/suppliers/products/warehouses, setelah itu baru opening stock, AR, AP, cash bank, aset tetap, dan BoM/karyawan bila dibutuhkan.' },
      { section: 'Sheet coa', content: 'Sheet coa adalah sheet impor resmi untuk Chart of Accounts. Bagian ini sekarang benar-benar dibaca sistem dan dapat menulis akun ke tabel accounts.' },
      { section: 'Sheet coa_sample', content: 'Sheet coa_sample berisi contoh akun dagang/distribusi yang langsung implementatif. Gunakan sebagai acuan struktur, lalu salin ke sheet coa bila diperlukan.' },
      { section: 'Sheet coa_referensi', content: 'Sheet coa_referensi berisi daftar nilai yang valid dan penjelasan pengisian. Gunakan saat tim finance ragu mengisi kategori_utama, saldo_normal, level, atau arus_kas.' },
      { section: 'kode_akun', content: 'Harus unik per organisasi. Sebaiknya gunakan kode final yang memang akan dipakai jangka panjang di laporan keuangan.' },
      { section: 'nama_akun', content: 'Isi nama akun yang jelas dan mudah dipahami user finance, contoh: Kas Utama, Piutang Usaha, Persediaan Barang Dagang.' },
      { section: 'kategori_utama', content: 'Pilih salah satu nilai resmi: Aset, Liabilitas, Ekuitas, Pendapatan, HPP, Beban Operasional, atau Beban Lainnya. Nilai ini dipakai sistem untuk menentukan tipe akun database.' },
      { section: 'parent_kode & level', content: 'Untuk akun root / paling atas, level diisi 1 dan parent_kode dikosongkan. Untuk akun anak, level wajib lebih besar dari parent dan parent_kode harus berisi kode akun induknya.' },
      { section: 'tipe_akun', content: 'Isi HEADER untuk akun pengelompokan dan DETAIL untuk akun transaksi. Saat ini NIZAM menyimpan semuanya sebagai akun hierarkis, jadi kolom ini dipakai terutama untuk validasi struktur workbook.' },
      { section: 'saldo_normal', content: 'Gunakan DEBIT untuk aset, HPP, dan mayoritas beban. Gunakan CREDIT untuk liabilitas, ekuitas, dan mayoritas pendapatan. Akun kontra seperti retur penjualan bisa menggunakan DEBIT walau masuk kategori pendapatan.' },
      { section: 'arus_kas', content: 'Isi OPERATING, INVESTING, atau FINANCING bila akun perlu dipetakan ke laporan arus kas. Bila tidak relevan, boleh dikosongkan.' },
      { section: 'aktif', content: 'Isi TRUE bila akun aktif dipakai saat go-live. Isi FALSE hanya untuk akun non-sistem yang sengaja disimpan sebagai arsip atau referensi.' },
      { section: 'deskripsi', content: 'Gunakan untuk menjelaskan fungsi akun, misalnya dipakai untuk penjualan retail, hutang supplier utama, atau biaya logistik pengiriman.' },
      { section: 'Format tanggal', content: 'Gunakan format YYYY-MM-DD.' },
      { section: 'Format angka', content: 'Gunakan angka murni tanpa pemisah ribuan dan tanpa prefix Rp.' },
      { section: 'Header template', content: 'Jangan ubah urutan atau nama header tanpa koordinasi dengan tim onboarding, karena validasi migrasi mengikuti header workbook resmi.' },
      { section: 'Persediaan', content: 'Opening stock sebaiknya diisi per produk per gudang.' },
      { section: 'AR/AP', content: 'Kalau memungkinkan isi per invoice outstanding, bukan total ringkas.' },
      { section: 'Produk inventory', content: 'Category yang disarankan: Bahan, Setengah Jadi, Siap Jual, Pelengkap.' },
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
      { kode_akun: '1103', nama_akun: 'Bank Operasional', kategori_utama: 'Aset', sub_kategori: 'Kas & Bank', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Rekening bank untuk aktivitas operasional harian.' },
      { kode_akun: '1201', nama_akun: 'Piutang Usaha', kategori_utama: 'Aset', sub_kategori: 'Piutang', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Tagihan penjualan customer yang belum dibayar.' },
      { kode_akun: '1301', nama_akun: 'Persediaan Barang Dagang', kategori_utama: 'Aset', sub_kategori: 'Persediaan', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Nilai persediaan barang siap jual.' },
      { kode_akun: '1401', nama_akun: 'PPN Masukan', kategori_utama: 'Aset', sub_kategori: 'Pajak', parent_kode: '1100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'PPN pembelian yang dapat dikreditkan.' },
      { kode_akun: '1500', nama_akun: 'Aset Tetap', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Kelompok aset tetap perusahaan.' },
      { kode_akun: '1502', nama_akun: 'Peralatan Operasional', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Peralatan kantor, gudang, dan distribusi.' },
      { kode_akun: '1507', nama_akun: 'Akumulasi Penyusutan Peralatan', kategori_utama: 'Aset', sub_kategori: 'Aset Tetap', parent_kode: '1500', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'INVESTING', aktif: 'TRUE', deskripsi: 'Akun kontra untuk akumulasi penyusutan peralatan.' },
      { kode_akun: '2000', nama_akun: 'Liabilitas', kategori_utama: 'Liabilitas', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok besar akun kewajiban.' },
      { kode_akun: '2100', nama_akun: 'Liabilitas Jangka Pendek', kategori_utama: 'Liabilitas', sub_kategori: 'Liabilitas Jangka Pendek', parent_kode: '2000', level: 2, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Kelompok hutang operasional dan pajak jangka pendek.' },
      { kode_akun: '2101', nama_akun: 'Hutang Usaha', kategori_utama: 'Liabilitas', sub_kategori: 'Hutang Supplier', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Tagihan supplier yang belum dibayar.' },
      { kode_akun: '2201', nama_akun: 'Hutang PPN Keluaran', kategori_utama: 'Liabilitas', sub_kategori: 'Pajak', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'PPN keluaran yang harus disetor.' },
      { kode_akun: '2202', nama_akun: 'Hutang PPh 21', kategori_utama: 'Liabilitas', sub_kategori: 'Pajak', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Kewajiban PPh 21 karyawan.' },
      { kode_akun: '2302', nama_akun: 'Uang Muka Pelanggan', kategori_utama: 'Liabilitas', sub_kategori: 'Pendapatan Diterima Dimuka', parent_kode: '2100', level: 3, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'DP atau pembayaran di muka dari customer.' },
      { kode_akun: '3000', nama_akun: 'Ekuitas', kategori_utama: 'Ekuitas', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok akun ekuitas pemilik.' },
      { kode_akun: '3001', nama_akun: 'Modal Pemilik', kategori_utama: 'Ekuitas', sub_kategori: 'Modal', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Setoran modal awal atau tambahan modal.' },
      { kode_akun: '3002', nama_akun: 'Laba Ditahan', kategori_utama: 'Ekuitas', sub_kategori: 'Saldo Laba', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Akumulasi laba tahun-tahun sebelumnya.' },
      { kode_akun: '3003', nama_akun: 'Laba Tahun Berjalan', kategori_utama: 'Ekuitas', sub_kategori: 'Saldo Laba', parent_kode: '3000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'FINANCING', aktif: 'TRUE', deskripsi: 'Laba atau rugi tahun berjalan.' },
      { kode_akun: '4000', nama_akun: 'Pendapatan', kategori_utama: 'Pendapatan', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'CREDIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok akun pendapatan usaha.' },
      { kode_akun: '4001', nama_akun: 'Penjualan Produk', kategori_utama: 'Pendapatan', sub_kategori: 'Penjualan', parent_kode: '4000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'CREDIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Pendapatan utama dari penjualan barang.' },
      { kode_akun: '4002', nama_akun: 'Diskon Penjualan', kategori_utama: 'Pendapatan', sub_kategori: 'Contra Revenue', parent_kode: '4000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Diskon yang mengurangi pendapatan penjualan.' },
      { kode_akun: '4003', nama_akun: 'Retur Penjualan', kategori_utama: 'Pendapatan', sub_kategori: 'Contra Revenue', parent_kode: '4000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Retur customer yang mengurangi pendapatan.' },
      { kode_akun: '5000', nama_akun: 'HPP', kategori_utama: 'HPP', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok beban pokok penjualan.' },
      { kode_akun: '5001', nama_akun: 'HPP Penjualan', kategori_utama: 'HPP', sub_kategori: 'HPP', parent_kode: '5000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Biaya pokok barang yang terjual.' },
      { kode_akun: '5002', nama_akun: 'Beban Angkut Pembelian', kategori_utama: 'HPP', sub_kategori: 'Biaya Masuk Persediaan', parent_kode: '5000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Biaya freight in atau ongkos kirim pembelian.' },
      { kode_akun: '6000', nama_akun: 'Beban Operasional', kategori_utama: 'Beban Operasional', sub_kategori: 'Root', parent_kode: '', level: 1, tipe_akun: 'HEADER', saldo_normal: 'DEBIT', arus_kas: '', aktif: 'TRUE', deskripsi: 'Kelompok beban operasional usaha.' },
      { kode_akun: '6001', nama_akun: 'Beban Gaji', kategori_utama: 'Beban Operasional', sub_kategori: 'SDM', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Gaji dan tunjangan karyawan.' },
      { kode_akun: '6002', nama_akun: 'Beban Sewa Gudang', kategori_utama: 'Beban Operasional', sub_kategori: 'Sewa', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Sewa gudang, kantor, atau tempat usaha.' },
      { kode_akun: '6003', nama_akun: 'Beban Listrik & Internet', kategori_utama: 'Beban Operasional', sub_kategori: 'Utilitas', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Listrik, air, internet, dan utilitas lain.' },
      { kode_akun: '6006', nama_akun: 'Beban Logistik Pengiriman', kategori_utama: 'Beban Operasional', sub_kategori: 'Distribusi', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Biaya ekspedisi dan pengiriman ke customer.' },
      { kode_akun: '6009', nama_akun: 'Beban Penyusutan', kategori_utama: 'Beban Operasional', sub_kategori: 'Penyusutan', parent_kode: '6000', level: 2, tipe_akun: 'DETAIL', saldo_normal: 'DEBIT', arus_kas: 'OPERATING', aktif: 'TRUE', deskripsi: 'Beban penyusutan aset tetap.' }
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
      { reference: 'arus_kas = OPERATING', content: 'Untuk akun yang berhubungan dengan operasional harian seperti kas operasional, penjualan, piutang, hutang usaha, dan beban rutin.' },
      { reference: 'arus_kas = INVESTING', content: 'Untuk akun yang berhubungan dengan pembelian atau pelepasan aset tetap/investasi.' },
      { reference: 'arus_kas = FINANCING', content: 'Untuk akun modal, pinjaman, dan aktivitas pendanaan lain.' },
      { reference: 'aktif = TRUE/FALSE', content: 'TRUE berarti akun dipakai saat go-live. FALSE sebaiknya hanya untuk akun non-sistem yang memang tidak akan digunakan.' },
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
      { header: 'warehouse_default', key: 'warehouse_default', width: 20 },
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
    requiredFields: ['warehouse_name', 'qty'],
    numericFields: ['qty', 'unit_cost', 'total_value']
  },
  {
    name: 'opening_ar',
    columns: [
      { header: 'customer_name', key: 'customer_name', width: 32 },
      { header: 'invoice_number', key: 'invoice_number', width: 20 },
      { header: 'invoice_date', key: 'invoice_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 18 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['customer_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['invoice_date', 'due_date']
  },
  {
    name: 'opening_ap',
    columns: [
      { header: 'supplier_name', key: 'supplier_name', width: 32 },
      { header: 'bill_number', key: 'bill_number', width: 20 },
      { header: 'bill_date', key: 'bill_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 18 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['supplier_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['bill_date', 'due_date']
  },
  {
    name: 'opening_cash_bank',
    columns: [
      { header: 'account_code', key: 'account_code', width: 18 },
      { header: 'account_name', key: 'account_name', width: 30 },
      { header: 'account_type', key: 'account_type', width: 18 },
      { header: 'balance', key: 'balance', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['account_name', 'account_type', 'balance'],
    numericFields: ['balance'],
    enumFields: {
      account_type: ['CASH', 'BANK']
    },
    validations: [
      { columnKey: 'account_type', values: ['CASH', 'BANK'] }
    ]
  },
  {
    name: 'fixed_assets',
    columns: [
      { header: 'asset_code', key: 'asset_code', width: 18 },
      { header: 'asset_name', key: 'asset_name', width: 32 },
      { header: 'acquisition_date', key: 'acquisition_date', width: 16 },
      { header: 'acquisition_cost', key: 'acquisition_cost', width: 18 },
      { header: 'accumulated_depreciation', key: 'accumulated_depreciation', width: 24 },
      { header: 'useful_life_months', key: 'useful_life_months', width: 20 },
      { header: 'residual_value', key: 'residual_value', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['asset_name', 'acquisition_cost'],
    numericFields: ['acquisition_cost', 'accumulated_depreciation', 'useful_life_months', 'residual_value'],
    dateFields: ['acquisition_date']
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
    numericFields: ['output_qty', 'component_qty']
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
      employment_status: ['Tetap', 'Kontrak', 'Magang', 'Freelance']
    },
    validations: [
      { columnKey: 'employment_status', values: ['Tetap', 'Kontrak', 'Magang', 'Freelance'] },
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
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

  if (template.rows) {
    for (const row of template.rows) {
      sheet.addRow(row)
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

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } }
      }
      cell.alignment = { vertical: 'top' }
    })
  })
}

async function main() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Codex for NIZAM'
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
  console.log(`Workbook created at ${outputPath}`)
  console.log(`Workbook copied to ${publicOutputPath}`)
}

await main()
