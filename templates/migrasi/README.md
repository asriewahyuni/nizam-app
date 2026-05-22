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

Versi CSV per sheet:

1. [01_coa_mapping_template.csv](./01_coa_mapping_template.csv)
2. [02_customers_template.csv](./02_customers_template.csv)
3. [03_suppliers_template.csv](./03_suppliers_template.csv)
4. [04_products_template.csv](./04_products_template.csv)
5. [05_warehouses_template.csv](./05_warehouses_template.csv)
6. [06_opening_stock_template.csv](./06_opening_stock_template.csv)
7. [07_opening_ar_template.csv](./07_opening_ar_template.csv)
8. [08_opening_ap_template.csv](./08_opening_ap_template.csv)
9. [09_opening_cash_bank_template.csv](./09_opening_cash_bank_template.csv)
10. [10_fixed_assets_template.csv](./10_fixed_assets_template.csv)
11. [11_bom_template.csv](./11_bom_template.csv)
12. [12_employees_template.csv](./12_employees_template.csv)

---

## Catatan Pengisian Penting

### Produk

Kolom `category` sebaiknya memakai salah satu nilai berikut:

1. `Bahan`
2. `Setengah Jadi`
3. `Siap Jual`
4. `Pelengkap`
5. `Layanan`

Kolom `type` sebaiknya memakai:

1. `INVENTORY`
2. `SERVICE`

### Opening Stock

Setiap baris harus mewakili:

1. satu produk
2. satu gudang
3. satu qty
4. satu nilai per unit

`total_value` idealnya sama dengan `qty x unit_cost`.

### Opening AR Dan AP

Kalau memungkinkan, isi per invoice outstanding, bukan hanya total per customer atau supplier. Ini lebih aman untuk aging dan penagihan.

### BoM

Satu produk output bisa punya banyak baris komponen. Setiap baris di template BoM mewakili satu komponen bahan.

---

## Catatan Penggunaan

1. Gunakan file `.xlsx` saat dibagikan ke client karena lebih nyaman diisi.
2. Gunakan file `.csv` bila tim perlu review cepat di Git atau memproses impor secara terpisah per jenis data.
