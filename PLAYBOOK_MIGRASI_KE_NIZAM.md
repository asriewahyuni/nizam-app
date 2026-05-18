# Playbook Migrasi Ke NIZAM

Dokumen ini dipakai saat ada user yang pindah dari Excel atau aplikasi lain ke NIZAM.

Tujuan utamanya:

1. Menentukan cara migrasi yang aman.
2. Menentukan data apa saja yang wajib diminta.
3. Menentukan urutan setup agar saldo awal, stok, piutang, hutang, dan laporan tidak kacau.

---

## Prinsip Utama

### 1. Buat periode fiskal dulu

Periode fiskal sebaiknya disiapkan sebelum input saldo awal dan transaksi berjalan.

Kenapa:

1. Budget membaca status periode fiskal.
2. Laporan laba ditahan vs laba berjalan membaca periode yang sudah ditutup.
3. Lock transaksi bergantung pada periode fiskal.

Aturan praktis:

1. Buat periode aktif yang sedang dipakai sekarang.
2. Biarkan periode aktif tetap terbuka.
3. Jika hanya membawa saldo awal, periode sebelum tanggal cut-off boleh dibuat lalu ditutup.
4. Jangan tutup periode sebelum rekonsiliasi final selesai.

### 2. Default terbaik adalah migrasi saldo awal, bukan histori penuh

Untuk mayoritas user pindahan:

1. Bawa master data.
2. Bawa saldo awal.
3. Bawa dokumen outstanding yang masih hidup.
4. Mulai transaksi baru di NIZAM sejak tanggal cut-off.

Histori penuh hanya dilakukan jika memang ada kebutuhan audit, pajak, atau operasional yang menuntut.

### 3. Tentukan tanggal cut-off yang jelas

Tanggal cut-off adalah tanggal resmi mulai pakai NIZAM.

Contoh:

1. `30 April 2026` adalah hari terakhir pencatatan di sistem lama.
2. `1 Mei 2026` adalah hari pertama transaksi berjalan di NIZAM.

Semua saldo pembuka di NIZAM harus konsisten dengan posisi akhir per cut-off tersebut.

---

## Pilihan Strategi Migrasi

### Opsi A: Saldo Awal + Outstanding

Ini opsi default yang paling aman.

Yang dibawa:

1. Master pelanggan.
2. Master supplier.
3. Master produk.
4. Master gudang dan lokasi utama.
5. Saldo kas/bank.
6. Stok awal dan nilai persediaan.
7. Piutang outstanding.
8. Hutang outstanding.
9. Aset tetap dan akumulasi penyusutan, jika dipakai.
10. Modal awal / laba ditahan pembuka.

Kapan dipakai:

1. User sebelumnya pakai Excel.
2. Data histori berantakan.
3. User ingin go-live cepat.
4. User hanya butuh posisi awal yang akurat.

### Opsi B: Migrasi Histori Penuh

Yang dibawa:

1. Transaksi penjualan lama.
2. Transaksi pembelian lama.
3. Pembayaran lama.
4. Jurnal lama.
5. Mutasi stok lama.
6. Payroll, aset, dan modul lain jika memang diperlukan.

Kapan dipakai:

1. Ada tuntutan audit.
2. Ada kewajiban melanjutkan histori detail.
3. Sistem lama datanya cukup bersih dan bisa dipetakan.

Catatan:

Migrasi histori penuh jauh lebih mahal, lebih lama, dan lebih berisiko.

---

## Data Yang Wajib Diminta Dari Client

Minimal minta file berikut dari user lama:

1. Neraca terakhir per tanggal cut-off.
2. Laba rugi tahun berjalan sampai tanggal cut-off.
3. Daftar kas dan bank beserta saldo.
4. Daftar piutang per invoice atau per pelanggan.
5. Daftar hutang per invoice atau per supplier.
6. Daftar stok per produk per gudang.
7. Nilai persediaan per produk jika ada.
8. Daftar pelanggan.
9. Daftar supplier.
10. Daftar produk dan satuan.
11. Daftar aset tetap, nilai perolehan, dan akumulasi penyusutan.
12. Daftar akun/CoA lama jika user berasal dari app lain.

Kalau user manufaktur, tambah:

1. Daftar bahan baku.
2. Daftar setengah jadi.
3. Daftar barang jadi.
4. Struktur BoM aktif.
5. Work order yang masih berjalan, jika ada.

Kalau user HRIS/payroll, tambah:

1. Daftar karyawan aktif.
2. Gaji pokok dan komponen tetap.
3. Hutang payroll jika masih ada.

---

## Template Sheet Yang Disarankan

Gunakan template CSV resmi di [templates/migrasi/](./templates/migrasi/). Kalau user masih pakai Excel, bagikan file [NIZAM_Migration_Template.xlsx](./templates/migrasi/NIZAM_Migration_Template.xlsx).

Sheet wajib untuk semua client:

1. `01_coa_mapping` — mapping CoA lama ke CoA NIZAM
2. `02_customers` — master pelanggan
3. `03_suppliers` — master supplier
4. `04_products` — master produk dengan kolom GL mapping
5. `05_warehouses` — gudang
6. `06_opening_stock` — stok awal per produk per gudang
7. `07_opening_ar` — piutang outstanding per invoice
8. `08_opening_ap` — hutang outstanding per invoice
9. `09_opening_cash_bank` — saldo kas dan bank
10. `15_opening_balances_gl` — saldo awal akun GL lain (modal, laba ditahan, dll)

Sheet tambahan sesuai modul:

11. `10_fixed_assets` — aset tetap dengan metode perolehan
12. `11_bom` — Bill of Materials (manufaktur)
13. `12_employees` — karyawan aktif (HRIS)
14. `13_construction_projects` — proyek konstruksi berjalan (modul Construction)
15. `14_fleet_assets` — armada kendaraan (modul Fleet)

Kolom penting yang sering terlewat:

### `products`

1. `sku` — kode produk unik
2. `product_name` — nama produk
3. `type` — `INVENTORY` atau `SERVICE`
4. `category` — `Bahan`, `Setengah Jadi`, `Siap Jual`, `Pelengkap`, `Layanan`
5. `unit` — satuan
6. `purchase_price` — harga beli default
7. `selling_price` — harga jual default
8. `warehouse_default` — gudang default
9. `income_account_code` — akun pendapatan (opsional, kuat disarankan)
10. `cogs_account_code` — akun HPP (opsional, kuat disarankan)
11. `asset_account_code` — akun persediaan (opsional, kuat disarankan)

### `opening_ar` dan `opening_ap`

1. `customer_name` / `supplier_name`
2. `invoice_number` / `bill_number`
3. `invoice_date` / `bill_date`
4. `due_date`
5. `outstanding_amount`
6. `currency_code` — default `IDR`, isi jika ada mata uang asing
7. `exchange_rate` — kurs pada tanggal cut-off jika bukan IDR

### `opening_balances_gl`

Untuk semua akun selain kas/bank:

1. `account_code`
2. `account_name`
3. `normal_balance` — `DEBIT` atau `CREDIT`
4. `opening_amount` — nilai positif

Semua saldo awal dari template 09 dan 15 akan dijurnal otomatis oleh sistem melalui fungsi `apply_opening_balances()`. Pastikan total debit = total kredit sebelum apply.

---

## Urutan Migrasi Yang Aman

### Tahap 1: Persiapan

1. Tentukan organisasi, cabang, gudang, dan user inti.
2. Tentukan tanggal cut-off.
3. Tentukan strategi migrasi:
   `saldo awal` atau `histori penuh`.
4. Tentukan apakah semua modul dipakai atau hanya sebagian.

### Tahap 2: Setup Dasar

1. Buat organisasi.
2. Buat cabang/unit.
3. Buat gudang.
4. Buat periode fiskal.
5. Aktifkan role user yang terlibat.

### Tahap 3: Mapping CoA

1. Cocokkan akun lama ke CoA NIZAM.
2. Pastikan akun penting tersedia:
   `kas`, `bank`, `piutang`, `hutang`, `persediaan`, `hpp`, `penjualan`, `beban`, `modal`, `laba ditahan`.
3. Untuk inventori segmented, pastikan minimal:
   `1301`, `1302`, `1303`, `1304`.

### Tahap 4: Master Data

1. Import pelanggan.
2. Import supplier.
3. Import produk.
4. Rapikan kategori produk:
   `Bahan`, `Setengah Jadi`, `Siap Jual`, `Pelengkap`, `Layanan`.
5. Jika manufaktur, input BoM.

### Tahap 5: Saldo Awal

1. Input saldo kas dan bank via template `09_opening_cash_bank`.
2. Input saldo awal akun GL lain via template `15_opening_balances_gl` (modal, laba ditahan, dll).
3. Input stok awal per produk per gudang via template `06_opening_stock`.
4. Input piutang outstanding per invoice via template `07_opening_ar`.
5. Input hutang outstanding per invoice via template `08_opening_ap`.
6. Input aset tetap jika dipakai via template `10_fixed_assets`.
7. Setelah semua saldo awal diinput, jalankan fungsi `apply_opening_balances()` dari menu pengaturan NIZAM.
8. Sistem akan otomatis membuat jurnal pembuka `OPENING_BALANCE` — verifikasi total debit = total kredit.

### Tahap 6: Validasi

Wajib cocokkan:

1. Total kas/bank.
2. Total piutang.
3. Total hutang.
4. Total persediaan.
5. Total aset tetap.
6. Total ekuitas / laba ditahan pembuka.
7. Neraca harus balance.

### Tahap 7: Go-Live

1. User mulai input transaksi baru di NIZAM.
2. Periode sebelum cut-off bisa ditutup setelah rekonsiliasi selesai.
3. Pantau minggu pertama go-live secara ketat.

---

## Aturan Khusus Untuk Persediaan

Ini penting agar neraca tidak kacau:

1. Produk bahan mentah harus dikategorikan `Bahan`.
2. Produk antar-proses harus dikategorikan `Setengah Jadi`.
3. Produk siap jual hasil produksi harus dikategorikan `Siap Jual`.
4. Barang reseller/trading murni boleh tetap di akun persediaan dagangan umum.

Kalau kategori produk salah, maka:

1. akun persediaan bisa salah,
2. HPP bisa lari,
3. neraca per segmen stok bisa menyesatkan.

---

## Aturan Khusus Untuk Piutang Dan Hutang

Pilih salah satu pendekatan:

### Pendekatan Ringkas

1. Bawa total saldo per customer atau supplier.
2. Lebih cepat.
3. Cocok untuk user kecil.

### Pendekatan Detail

1. Bawa per invoice outstanding.
2. Lebih bagus untuk aging, penagihan, dan jatuh tempo.
3. Cocok untuk user yang sudah punya histori invoice rapi.

Default yang lebih baik:

`per invoice outstanding`, jika datanya tersedia.

---

## Aturan Khusus Untuk User Multi-Mata Uang

Jika client punya transaksi dalam mata uang asing (USD, SGD, MYR, dll):

1. Aktifkan fitur multi-currency di pengaturan organisasi NIZAM.
2. Daftarkan mata uang yang dipakai di `org_allowed_currencies`.
3. Isi kurs pada tanggal cut-off di `exchange_rates`.
4. Pada template `07_opening_ar` dan `08_opening_ap`, isi kolom `currency_code` dan `exchange_rate`.
5. Saldo awal piutang/hutang valas akan dikonversi ke IDR menggunakan kurs cut-off.

Catatan:

1. `exchange_rate` di template berarti 1 unit mata uang asing = berapa IDR.
2. Contoh: `currency_code = USD`, `exchange_rate = 16000` artinya 1 USD = Rp 16.000.
3. `opening_amount` di template tetap diisi dalam mata uang asli (bukan IDR).

---

## Aturan Khusus Untuk Client Konstruksi

Jika client pakai modul Construction:

1. Minta daftar proyek yang masih berjalan saat cut-off.
2. Isi template `13_construction_projects`.
3. Kolom `project_type`: `ARCHITECT`, `CONTRACTOR`, `DESIGN_BUILD`, `INTERIOR`, atau `CONSULTING`.
4. Kolom `project_status` saat migrasi: biasanya `EXECUTION` atau `PLANNING`.
5. `contract_value` adalah nilai kontrak total, bukan yang sudah dibayar.
6. `estimated_cost` adalah perkiraan biaya total proyek.
7. Setelah proyek masuk, input progres dan penagihan berjalan dari tanggal cut-off.

---

## Aturan Khusus Untuk Client Fleet Dan Rental

Jika client pakai modul Fleet:

1. Minta daftar armada kendaraan aktif.
2. Isi template `14_fleet_assets`.
3. Kolom `fleet_type`: `CAR`, `MOTORCYCLE`, `TRUCK`, `BUS`, `HEAVY_EQUIPMENT`, atau `OTHER`.
4. Kolom `odometer` isi posisi saat cut-off.
5. Kolom `daily_rate` isi tarif sewa harian default.
6. Booking yang masih aktif saat cut-off perlu diinput manual setelah armada masuk.

---

## Aturan Khusus Untuk User Dari Excel

Biasanya masalah terbesar user Excel adalah:

1. nama akun tidak konsisten,
2. SKU tidak standar,
3. satuan campur,
4. stok tidak cocok dengan nilai,
5. piutang/hutang hanya berupa rekap tanpa detail invoice.

Yang harus dilakukan:

1. bersihkan master data dulu,
2. standarkan satuan,
3. cek apakah stok qty cocok dengan nilai stok,
4. cek apakah piutang/hutang punya detail lawan transaksi,
5. jangan langsung import file mentah tanpa validasi.

---

## Yang Bisa Dibantu Oleh Tim NIZAM

Secara operasional, kita bisa bantu:

1. menentukan strategi cut-off,
2. mapping CoA lama ke CoA NIZAM,
3. membersihkan master data,
4. menyiapkan template import,
5. membuat script migrasi khusus jika perlu,
6. menyiapkan jurnal saldo awal,
7. rekonsiliasi stok dan nilai persediaan,
8. validasi neraca pembuka,
9. validasi AR/AP opening,
10. mendampingi locking periode lama setelah final.

---

## Checklist Sebelum Go-Live

Semua poin di bawah harus `YA`:

1. Periode fiskal sudah dibuat.
2. Cabang aktif sudah benar.
3. Gudang sudah dibuat.
4. CoA penting sudah tersedia.
5. Kategori produk sudah benar.
6. Stok awal sudah masuk.
7. Nilai persediaan sudah cocok.
8. Piutang opening sudah cocok.
9. Hutang opening sudah cocok.
10. Saldo kas/bank sudah cocok.
11. Neraca pembuka balance.
12. User inti sudah dilatih.

---

## Checklist Setelah Go-Live Minggu Pertama

1. Cek apakah ada stok minus.
2. Cek apakah ada akun persediaan yang salah klasifikasi.
3. Cek apakah jurnal auto-posting masuk ke akun yang benar.
4. Cek aging AR/AP.
5. Cek kas/bank harian.
6. Cek laporan laba rugi dan neraca.
7. Baru setelah itu pertimbangkan menutup periode lama.

---

## Keputusan Default Yang Direkomendasikan

Kalau tidak ada alasan khusus, gunakan default ini:

1. Strategi migrasi: `saldo awal + outstanding`
2. Cut-off: `awal bulan`
3. Piutang/hutang: `per invoice outstanding`
4. Persediaan: `per produk per gudang`
5. Periode: `buat dulu, lalu tutup belakangan`
6. Histori penuh: `hanya jika memang wajib`

---

## Penutup

Migrasi yang baik bukan yang paling cepat, tetapi yang paling terkendali.

Urutan yang disarankan:

1. tentukan cut-off,
2. buat periode,
3. rapikan master data,
4. input saldo awal,
5. rekonsiliasi,
6. baru go-live.

---

## Dokumen Turunan

Untuk operasional harian tim onboarding, gunakan juga:

1. [CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md](./CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md)
2. [templates/migrasi/README.md](./templates/migrasi/README.md)
3. [templates/migrasi/NIZAM_Migration_Template.xlsx](./templates/migrasi/NIZAM_Migration_Template.xlsx)
