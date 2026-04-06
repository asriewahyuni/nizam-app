# Panduan Lengkap Admin NIZAM SaaS

Panduan ini dibuat untuk admin yang "tidak terlalu teknis". Bahasa dibuat sederhana supaya mudah dipahami.

## Siapa Yang Cocok Pakai Panduan Ini?

- Admin bisnis yang bertugas mengelola aplikasi NIZAM.
- Orang yang baru pertama kali pakai sistem ERP/SaaS.
- Tim yang butuh langkah jelas dari awal sampai selesai.

## Hasil Akhir Yang Akan Kamu Capai

Setelah mengikuti panduan ini, kamu akan bisa:

1. Login dengan benar.
2. Menyiapkan organisasi/perusahaan.
3. Mengatur cabang dan tim user.
4. Menjalankan transaksi harian.
5. Cek laporan.
6. Mengurus billing langganan SaaS.
7. Menutup pekerjaan harian dengan aman.

---

## Peta Perjalanan (Dari Awal Sampai Akhir)

1. Persiapan sebelum login.
2. Login akun.
3. Onboarding (buat organisasi/perusahaan).
4. Kenali Dashboard dan menu.
5. Setup wajib hari pertama.
6. Operasional harian.
7. Cek laporan dan kontrol.
8. Kelola billing SaaS.
9. Penutupan hari + logout.

---

## Tahap 0 - Persiapan Sebelum Login

Siapkan dulu:

- Email aktif (untuk login dan reset password).
- Password yang kamu ingat.
- Nama perusahaan.
- Nama cabang (kalau ada).
- Nama tim/karyawan inti.
- Rekening kas/bank utama.

Tips gampang:

- Buka aplikasi di browser yang stabil (Chrome/Edge terbaru).
- Jangan buka banyak tab yang sama saat input data, supaya tidak bingung.

---

## Tahap 1 - Login

Di halaman login ada 2 tab:

- `Pemilik / Admin Bisnis`
- `Login Karyawan`

Kalau kamu admin pengelola SaaS bisnis, biasanya pakai **Pemilik / Admin Bisnis**.

### 1A) Login Admin Bisnis (Email)

1. Buka halaman `Login`.
2. Pilih tab `Pemilik / Admin Bisnis`.
3. Isi email bisnis.
4. Isi password.
5. Klik `Masuk ke Dashboard`.

Jika lupa password:

1. Klik `Lupa password?`.
2. Isi email.
3. Cek inbox email.
4. Buat password baru.

### 1B) Login via Link Undangan (Kalau Kamu Diundang)

Biasanya dipakai jika owner mengundang admin/staff:

1. Buka link undangan (format biasanya `/join/<token>`).
2. Masukkan NIK (Nomor Induk Karyawan).
3. Buat password baru.
4. Klik aktivasi.
5. Sistem akan masuk ke dashboard otomatis.

---

## Tahap 2 - Onboarding (Pertama Kali Masuk)

Kalau akun sudah login tapi belum punya organisasi, sistem akan menampilkan halaman setup.

Langkahnya:

1. Isi `Nama Perusahaan`.
2. Klik tombol aktivasi (`AKTIFKAN SEKARANG`).
3. Tunggu proses selesai.
4. Otomatis masuk ke dashboard.

Yang dibuat otomatis oleh sistem:

- Organisasi/perusahaan kamu.
- Unit default: `Unit Utama`.
- Struktur awal agar sistem siap dipakai.

---

## Tahap 3 - Kenalan Dengan Dashboard

Begitu masuk dashboard, kenali 3 area utama:

1. **Sidebar kiri**: daftar semua menu modul (Finance, Operasional, HRIS, Laporan, Config, dll).
2. **Header atas**: pilih organisasi aktif dan unit/cabang aktif.
3. **Konten tengah**: ringkasan data + halaman kerja.

Catatan penting:

- Pastikan **unit/cabang aktif** sudah benar sebelum input transaksi.
- Salah pilih cabang = data bisa masuk ke cabang yang tidak tepat.
- Jika muncul `Startup Wizard`, ikuti urutannya dari langkah 1 sampai 5 (Kas/Bank -> Modal Awal -> Stok -> Penjualan -> Laporan).

---

## Tahap 4 - Setup Wajib Hari Pertama (Admin)

Lakukan urutan ini supaya sistem rapi dari awal.

### 4.1 Isi Profil Bisnis

Menu: `Config -> Pengaturan Bisnis`

Isi minimal:

- Nama brand.
- Logo (opsional tapi bagus untuk invoice).
- Hotline/WA.
- Email resmi.
- Alamat perusahaan.

Jika perlu:

- Cek slug bisnis (identitas URL).
- Atur format nomor dokumen (NIK/PO/SO/Invoice).

### 4.2 Buat Cabang/Unit

Menu: `Config -> Cabang`

1. Klik `Tambah Cabang`.
2. Isi nama cabang.
3. Isi kode cabang (contoh: `JKT`, `BDG`).
4. Isi alamat (opsional).
5. Simpan.
6. (Opsional) Atur PIC cabang.

### 4.3 Atur Jabatan & Hak Akses

Menu: `HRIS -> Akses & Jabatan`

Yang dilakukan admin:

1. Cek role bawaan (owner/admin/staff/dll).
2. Buat role baru jika perlu.
3. Nyalakan/matikan permission sesuai tugas.

Prinsip aman:

- Beri akses secukupnya.
- Jangan semua user jadi admin.

### 4.4 Tambah User Tim

Halaman user ada di `settings/users` (pengelolaan anggota + link aktivasi).
Jika belum ada tombol menunya di sidebar, buka langsung URL `/settings/users`.

Alur cepat:

1. Buat `Link Aktivasi`.
2. Pilih role untuk user baru.
3. Atur masa berlaku link.
4. Kirim link ke orang terkait.
5. Setelah join, cek role dan akses unitnya.

### 4.5 Siapkan Kas/Bank

Menu: `Finance -> Kas & Bank`

1. Buat rekening kas/bank yang dipakai bisnis.
2. Hubungkan ke akun akuntansi (CoA) yang benar.
3. Input modal awal supaya saldo awal jelas.

### 4.6 Siapkan Produk/Stok (Jika Jual Barang)

Menu: `Operasional -> Inventori` dan `Gudang (WMS)`

1. Tambah produk.
2. Isi harga beli dan harga jual.
3. Pastikan gudang/unit penyimpanan sudah ada.

---

## Tahap 5 - Operasional Harian Admin

Setelah setup selesai, ini alur harian paling aman:

1. Login.
2. Cek organisasi aktif dan unit aktif.
3. Cek notifikasi approval/pending.
4. Input transaksi sesuai modul.
5. Cek dashboard ringkasan.
6. Cek laporan utama.

Modul yang sering dipakai admin:

- `Kas & Bank`
- `Pembelian`
- `Penjualan`
- `Inventori`
- `HRIS`
- `Laporan`

Tips anti-kacau:

- Input transaksi di hari yang sama (jangan ditumpuk).
- Jangan edit/hapus data tanpa alasan jelas.
- Jika ragu, catat dulu di catatan internal tim.

---

## Tahap 6 - Monitoring & Kontrol

Minimal yang dicek admin setiap hari:

1. Saldo kas/bank (`Kas & Bank`).
2. Penjualan dan pembayaran masuk.
3. Pembelian dan hutang jatuh tempo.
4. Stok menipis.
5. Approval yang menunggu.

Minimal yang dicek mingguan:

1. `Laporan` (Laba Rugi, Neraca, Arus Kas).
2. `Aging (AR/AP)` untuk piutang/hutang.
3. `Audit Trail` untuk jejak aktivitas user.

---

## Tahap 7 - Billing SaaS (Langganan NIZAM)

Menu: `Billing`

Yang bisa dilakukan:

1. Pilih paket/addon/topup token AI.
2. Sistem membuat invoice otomatis.
3. Lakukan transfer sesuai instruksi bank.
4. Upload bukti pembayaran.
5. Tunggu status jadi `PAID`.

Tambahan:

- Bisa pakai voucher jika ada kode promo.
- Invoice bisa dibuka dan di-print/PDF.

Catatan:

- Hindari membuat invoice baru berulang untuk item yang sama jika masih `UNPAID`.

---

## Tahap 8 - Keamanan Data (Sangat Penting)

### Yang wajib dilakukan admin

1. Pakai password kuat.
2. Jangan bagikan password ke siapapun.
3. Batasi role admin hanya untuk orang yang benar-benar perlu.
4. Cek audit trail secara rutin.

### Fitur berbahaya: Reset Data

Di `Pengaturan Bisnis` ada `Danger Zone`.

Mode reset:

- `Reset Transaksi`.
- `Reset Semua Data Operasional`.

PENTING:

- Ini aksi besar dan tidak bisa di-undo.
- Hanya owner yang boleh eksekusi.
- Wajib isi teks konfirmasi manual.

---

## Tahap 9 - Penutupan Hari (Akhir)

Sebelum logout, lakukan checklist cepat:

1. Semua transaksi penting hari ini sudah masuk.
2. Tidak ada approval kritis yang tertinggal.
3. Saldo kas/bank tidak aneh.
4. Laporan ringkas harian sudah dicek.
5. Logout dari akun.

Cara logout:

- Klik menu profil/keluar di sidebar, lalu pilih `Logout`.

Selesai. Itu adalah alur "dari login sampai akhir hari kerja".

---

## Troubleshooting Cepat

### Tidak bisa login (admin bisnis)

- Cek email/password.
- Coba reset password dari menu `Lupa password`.
- Pastikan keyboard tidak caps lock.

### Login berhasil tapi balik ke onboarding

- Artinya akun belum terhubung ke organisasi aktif.
- Lanjutkan onboarding atau minta owner menambahkan akses.

### Menu tertentu tidak muncul

Penyebab umum:

- Paket SaaS belum mencakup modul itu.
- Permission role kamu belum diizinkan.
- Kamu bukan owner/admin untuk menu tertentu.

### Tidak bisa tambah cabang/user

Penyebab umum:

- Role kamu bukan owner/admin.
- Kuota paket SaaS sudah penuh.

---

## Checklist Harian Siap Pakai

Gunakan ini tiap hari (boleh copy ke SOP internal):

- [ ] Login dan cek unit/cabang aktif.
- [ ] Cek notifikasi approval.
- [ ] Input transaksi kas/bank.
- [ ] Input transaksi jual/beli hari ini.
- [ ] Cek stok kritis.
- [ ] Cek laporan ringkas (kas, laba rugi singkat).
- [ ] Cek audit trail jika ada aktivitas sensitif.
- [ ] Logout.

---

Kalau kamu mau, saya bisa lanjutkan versi **SOP per divisi** (Admin Keuangan, Admin Gudang, Admin HRIS) supaya tugas tim lebih jelas dan tidak tumpang tindih.
