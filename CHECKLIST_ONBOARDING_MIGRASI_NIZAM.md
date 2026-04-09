# Checklist Onboarding Migrasi NIZAM

Dokumen ini adalah turunan operasional dari [PLAYBOOK_MIGRASI_KE_NIZAM.md](./PLAYBOOK_MIGRASI_KE_NIZAM.md).

Tujuannya:

1. Menyamakan langkah kerja tim onboarding.
2. Mencegah data client masuk setengah bersih.
3. Memastikan go-live hanya dilakukan setelah angka pembuka benar.

---

## Cara Pakai

Checklist ini dipakai internal tim NIZAM.

Aturan main:

1. Satu client harus punya satu PIC onboarding.
2. Semua item wajib diberi status:
   `Belum`, `Proses`, `Selesai`, atau `Blocked`.
3. Jangan lanjut ke tahap berikutnya jika gate tahap sebelumnya belum lolos.
4. Semua angka pembuka harus bisa ditelusuri ke file sumber client.

---

## Ringkasan Client

Isi bagian ini di awal proyek:

1. Nama client:
2. PIC client:
3. PIC NIZAM:
4. Tanggal kick-off:
5. Tanggal cut-off:
6. Target go-live:
7. Sumber data lama:
   `Excel`, `aplikasi lain`, atau `campuran`
8. Strategi migrasi:
   `saldo awal + outstanding` atau `histori penuh`
9. Modul yang dipakai:
10. Cabang yang aktif:
11. Gudang yang aktif:

---

## Tahap 1: Discovery Dan Scoping

Checklist:

1. Tujuan migrasi client sudah dipahami.
2. Tanggal cut-off sudah disepakati.
3. Modul yang dipakai saat go-live sudah disepakati.
4. Disepakati apakah yang dibawa hanya saldo awal atau histori penuh.
5. Disepakati apakah AR/AP dibawa per saldo atau per invoice.
6. Disepakati apakah stok dibawa per gudang.
7. Risiko khusus client sudah dicatat.

Output wajib:

1. Scope migrasi final.
2. Tanggal cut-off final.
3. Daftar data yang harus dikirim client.

Gate lanjut:

1. Client setuju tanggal cut-off.
2. Client setuju scope migrasi.

---

## Tahap 2: Pengumpulan Data

Checklist:

1. Neraca per cut-off sudah diterima.
2. Laba rugi tahun berjalan sudah diterima.
3. Daftar kas dan bank sudah diterima.
4. Daftar piutang sudah diterima.
5. Daftar hutang sudah diterima.
6. Daftar stok per produk per gudang sudah diterima.
7. Nilai persediaan per produk sudah diterima atau metode nilainya sudah jelas.
8. Master customer sudah diterima.
9. Master supplier sudah diterima.
10. Master produk sudah diterima.
11. Daftar CoA lama sudah diterima jika ada.
12. File tambahan manufaktur sudah diterima jika client manufaktur.
13. File tambahan payroll sudah diterima jika client memakai HRIS/payroll.

Output wajib:

1. Folder data client lengkap.
2. Versi file yang dipakai sudah dibekukan.

Gate lanjut:

1. Tidak ada file kritikal yang masih kosong.
2. PIC client menyatakan file terakhir sudah final.

---

## Tahap 3: Data Cleansing Dan Mapping

Checklist:

1. Nama customer duplikat sudah dibersihkan.
2. Nama supplier duplikat sudah dibersihkan.
3. SKU kosong atau ganda sudah dibereskan.
4. Satuan sudah distandarkan.
5. Kategori produk sudah dipetakan benar:
   `Bahan`, `Setengah Jadi`, `Siap Jual`, `Pelengkap`, `Layanan`
6. Mapping CoA lama ke CoA NIZAM sudah selesai.
7. Gudang dan cabang sudah dipetakan.
8. Akun persediaan segmented sudah dicek:
   `1301`, `1302`, `1303`, `1304`
9. Piutang dan hutang yang dibawa detail invoice sudah ditandai jelas.
10. Outlier data sudah dibahas dengan client.

Output wajib:

1. File bersih final.
2. File mapping final.

Gate lanjut:

1. Tidak ada SKU ganda aktif.
2. Tidak ada kategori produk yang ambigu.
3. Tidak ada akun penting yang belum dipetakan.

---

## Tahap 4: Setup Sistem NIZAM

Checklist:

1. Organisasi sudah dibuat.
2. Cabang sudah dibuat.
3. Gudang sudah dibuat.
4. User inti sudah dibuat.
5. Role user inti sudah benar.
6. Periode fiskal sudah dibuat.
7. Periode aktif dipastikan masih terbuka.
8. CoA penting sudah tersedia.
9. Akun persediaan segmented sudah tersedia.
10. Pengaturan dasar org sudah dicek.

Output wajib:

1. Lingkungan client siap diisi data.

Gate lanjut:

1. PIC bisa login.
2. Struktur dasar org sudah benar.

---

## Tahap 5: Input Master Data

Checklist:

1. Customer sudah masuk.
2. Supplier sudah masuk.
3. Produk sudah masuk.
4. Gudang sudah masuk bila ada lebih dari satu.
5. Kategori produk sudah dicek ulang setelah import.
6. Satuan produk sudah dicek.
7. Harga beli dan harga jual default sudah dicek.
8. Asset account produk inventory sudah sesuai kategori.
9. Jika manufaktur, BoM aktif sudah masuk.
10. Jika HRIS, karyawan aktif sudah masuk.

Output wajib:

1. Master data final untuk saldo awal.

Gate lanjut:

1. Tidak ada master kritikal yang masih hilang.
2. Produk persediaan sudah lolos pengecekan kategori.

---

## Tahap 6: Input Saldo Awal

Checklist:

1. Saldo kas dan bank sudah masuk.
2. Opening stock sudah masuk per produk per gudang.
3. Nilai persediaan sudah sesuai file final.
4. Piutang opening sudah masuk.
5. Hutang opening sudah masuk.
6. Fixed assets sudah masuk jika dipakai.
7. Jurnal pembuka sudah balance.
8. Laba ditahan atau modal pembuka sudah sesuai.
9. Akun pembuka tidak parkir di akun sementara yang salah.

Output wajib:

1. Neraca pembuka versi NIZAM.

Gate lanjut:

1. Total aset = total liabilitas + ekuitas.
2. Semua saldo pembuka cocok dengan sumber client.

---

## Tahap 7: Rekonsiliasi

Checklist:

1. Kas dan bank cocok.
2. Piutang cocok.
3. Hutang cocok.
4. Persediaan cocok qty.
5. Persediaan cocok nilai.
6. Aset tetap cocok jika dipakai.
7. Laba ditahan pembuka cocok.
8. Tidak ada stok minus.
9. Tidak ada akun persediaan salah klasifikasi.
10. Tidak ada jurnal auto-posting yang masuk akun keliru.

Output wajib:

1. Berita acara rekonsiliasi internal.

Gate lanjut:

1. Semua selisih material sudah nol atau sudah disetujui tertulis.

---

## Tahap 8: UAT Dan Pelatihan

Checklist:

1. User inti sudah dilatih.
2. Skenario pembelian sudah dites.
3. Skenario penjualan sudah dites.
4. Skenario kas/bank sudah dites.
5. Skenario inventori sudah dites.
6. Jika manufaktur, skenario produksi sudah dites.
7. Laporan utama sudah dicek bersama client.
8. PIC client menyetujui hasil UAT.

Output wajib:

1. Persetujuan go-live.

Gate lanjut:

1. PIC client menyatakan siap go-live.

---

## Tahap 9: Go-Live

Checklist:

1. Tanggal go-live dikonfirmasi ulang.
2. Semua user inti sudah aktif.
3. File migrasi final sudah diarsipkan.
4. Backup posisi sebelum go-live sudah ada bila diperlukan.
5. Client tahu transaksi apa yang pertama kali harus diinput di NIZAM.
6. Periode lama belum ditutup sebelum monitoring awal selesai.

Output wajib:

1. Go-live resmi berjalan.

---

## Tahap 10: Monitoring Minggu Pertama

Checklist:

1. Tidak ada stok minus.
2. Tidak ada akun persediaan yang lari ke akun salah.
3. Tidak ada saldo AR/AP yang janggal.
4. Kas/bank harian wajar.
5. Jurnal otomatis berjalan normal.
6. Neraca dan laba rugi masuk akal.
7. Isu kritikal minggu pertama sudah ditangani.

Output wajib:

1. Ringkasan stabilisasi minggu pertama.

---

## Red Flags

Kalau salah satu ini terjadi, tahan go-live:

1. Neraca pembuka belum balance.
2. Stok qty dan nilai tidak nyambung.
3. Produk inventory belum punya kategori yang benar.
4. Piutang atau hutang masih berupa angka total tanpa penjelasan yang memadai.
5. Client masih terus mengubah file sumber setelah finalisasi.
6. UAT belum selesai tetapi client ingin langsung live.

---

## Dokumen Pendamping

Gunakan bersama dokumen berikut:

1. [PLAYBOOK_MIGRASI_KE_NIZAM.md](./PLAYBOOK_MIGRASI_KE_NIZAM.md)
2. [templates/migrasi/README.md](./templates/migrasi/README.md)
