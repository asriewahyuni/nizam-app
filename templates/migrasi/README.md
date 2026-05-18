# Template Migrasi NIZAM

Folder ini berisi template CSV standar untuk proses migrasi client dari Excel atau aplikasi lain ke NIZAM.

Versi workbook Excel yang siap dibagikan ke client:

1. [NIZAM_Migration_Template.xlsx](./NIZAM_Migration_Template.xlsx)

Gunakan template ini bersama:

1. [PLAYBOOK_MIGRASI_KE_NIZAM.md](../../PLAYBOOK_MIGRASI_KE_NIZAM.md)
2. [CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md](../../CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md)

---

## Aturan Umum

1. Gunakan encoding `UTF-8`.
2. Gunakan satu baris header saja.
3. Jangan ubah nama kolom tanpa persetujuan tim onboarding.
4. Satu file mewakili satu jenis data.
5. Jika data belum ada, kolom boleh dikosongkan, tetapi jangan menghapus header.
6. Gunakan format tanggal `YYYY-MM-DD`.
7. Angka jangan memakai pemisah ribuan.
8. Nilai uang gunakan angka murni, misalnya `15000` bukan `Rp 15.000`.
9. Untuk `TRUE/FALSE`, gunakan huruf kapital konsisten.
10. Pada workbook Excel, baris ke-2 berisi petunjuk pengisian tiap kolom.

---

## Daftar Template

Workbook utama:

1. [NIZAM_Migration_Template.xlsx](./NIZAM_Migration_Template.xlsx)

### Core ERP (wajib untuk semua client)

1. [01_coa_mapping_template.csv](./01_coa_mapping_template.csv) — Mapping CoA lama ke CoA NIZAM
2. [02_customers_template.csv](./02_customers_template.csv) — Master pelanggan
3. [03_suppliers_template.csv](./03_suppliers_template.csv) — Master supplier
4. [04_products_template.csv](./04_products_template.csv) — Master produk + GL mapping
5. [05_warehouses_template.csv](./05_warehouses_template.csv) — Gudang dan lokasi
6. [06_opening_stock_template.csv](./06_opening_stock_template.csv) — Stok awal per produk per gudang
7. [07_opening_ar_template.csv](./07_opening_ar_template.csv) — Piutang outstanding per invoice
8. [08_opening_ap_template.csv](./08_opening_ap_template.csv) — Hutang outstanding per invoice
9. [09_opening_cash_bank_template.csv](./09_opening_cash_bank_template.csv) — Saldo awal kas dan bank
10. [15_opening_balances_gl_template.csv](./15_opening_balances_gl_template.csv) — Saldo awal semua akun GL (neraca pembuka)

### Aset Tetap dan Karyawan

11. [10_fixed_assets_template.csv](./10_fixed_assets_template.csv) — Aset tetap + metode perolehan
12. [12_employees_template.csv](./12_employees_template.csv) — Master karyawan aktif

### Manufaktur

13. [11_bom_template.csv](./11_bom_template.csv) — Bill of Materials

### Modul Vertikal

14. [13_construction_projects_template.csv](./13_construction_projects_template.csv) — Proyek konstruksi aktif (client kontraktor/arsitek)
15. [14_fleet_assets_template.csv](./14_fleet_assets_template.csv) — Armada kendaraan (client rental/fleet)

---

## Catatan Pengisian Penting

### Produk

Kolom `category` wajib memakai salah satu nilai berikut:

1. `Bahan` — bahan baku untuk produksi
2. `Setengah Jadi` — WIP antar proses
3. `Siap Jual` — barang jadi atau trading
4. `Pelengkap` — perlengkapan non-inventori
5. `Layanan` — jasa

Kolom `type` wajib memakai:

1. `INVENTORY` — produk fisik berpengaruh ke stok
2. `SERVICE` — jasa tidak berpengaruh ke stok

Kolom GL mapping (opsional tapi sangat disarankan):

- `income_account_code` — akun pendapatan saat produk dijual (biasanya `4xxx`)
- `cogs_account_code` — akun HPP saat produk terjual (biasanya `5xxx`)
- `asset_account_code` — akun persediaan di neraca (biasanya `1301`-`1304`)

Kolom `currency_code` — isi `IDR` untuk transaksi Rupiah. Kosongkan jika tidak pakai multi-mata uang.

### Opening Stock

Setiap baris mewakili satu produk di satu gudang.

`total_value` harus sama dengan `qty x unit_cost`.

### Opening AR dan AP

Isi per invoice outstanding, bukan hanya total per customer/supplier. Ini lebih aman untuk aging, penagihan, dan jatuh tempo.

Kolom `currency_code` — isi jika ada piutang/hutang dalam mata uang asing. Default `IDR`.

Kolom `exchange_rate` — isi kurs pada tanggal cut-off jika `currency_code` bukan `IDR`.

### Opening Cash Bank (09)

Template ini khusus untuk saldo kas dan bank.

Kolom `account_type` isi dengan `KAS` atau `BANK`.

Kolom `normal_balance` isi dengan `DEBIT` (untuk kas/bank aktif) atau `CREDIT` (jarang).

Kolom `opening_amount` isi nilai positif saja. Gunakan tanda minus untuk saldo kredit abnormal.

### Opening Balances GL (15)

Template ini untuk saldo awal semua akun yang belum tercakup di template 09 (kas/bank).

Contoh penggunaan: modal, laba ditahan, hutang jangka panjang, akun perantara.

Kolom `normal_balance`:
- `DEBIT` — untuk akun aset dan biaya
- `CREDIT` — untuk akun liabilitas, ekuitas, dan pendapatan

Kolom `opening_amount` — isi nilai positif. Sistem akan menentukan sisi debit/kredit berdasarkan `normal_balance`.

Semua baris di template 09 dan 15 akan digabungkan menjadi satu jurnal pembuka `OPENING_BALANCE` di NIZAM.

### Aset Tetap

Kolom `acquisition_method` isi salah satu:
- `LUNAS` — dibeli tunai
- `KREDIT` — dibeli secara kredit/cicilan
- `SPLIT` — sebagian tunai sebagian kredit

Kolom `asset_account_code` — kode akun aset tetap di CoA NIZAM (biasanya `1500`-an).

Kolom `depreciation_account_code` — kode akun akumulasi penyusutan (biasanya `1600`-an).

### BoM

Satu produk output bisa punya banyak baris komponen. Setiap baris mewakili satu komponen bahan.

### Construction Projects

Dipakai untuk client yang sudah punya proyek berjalan saat migrasi.

Kolom `project_type` isi salah satu: `ARCHITECT`, `CONTRACTOR`, `DESIGN_BUILD`, `INTERIOR`, `CONSULTING`.

Kolom `project_status` isi salah satu: `PLANNING`, `TENDER`, `DESIGN`, `EXECUTION`, `HANDOVER`.

### Fleet Assets

Dipakai untuk client rental kendaraan atau fleet management.

Kolom `fleet_type` isi salah satu: `CAR`, `MOTORCYCLE`, `TRUCK`, `BUS`, `HEAVY_EQUIPMENT`, `OTHER`.

Kolom `status` isi salah satu: `AVAILABLE`, `BOOKED`, `IN_MAINTENANCE`, `OUT_OF_SERVICE`.

---

## Catatan Penggunaan

1. Gunakan file `.xlsx` saat dibagikan ke client karena lebih nyaman diisi.
2. Gunakan file `.csv` bila tim perlu review cepat di Git atau memproses impor secara terpisah per jenis data.
3. Template vertikal (13, 14) hanya dipakai bila client memang menggunakan modul tersebut.
4. Template 15 dipakai melengkapi template 09 — pastikan tidak ada akun yang diinput dobel di kedua template.
