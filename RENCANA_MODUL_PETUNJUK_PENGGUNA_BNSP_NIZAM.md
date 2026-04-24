# Rencana Modul Petunjuk Pengguna NIZAM Berbasis Standar Minimum BNSP/PBK

Dokumen ini adalah rencana kerja awal untuk menyusun modul petunjuk pengguna NIZAM dari awal sampai akhir.

Catatan penting:

- Dokumen ini memakai pendekatan "minimum BNSP/PBK" yang disesuaikan untuk konteks aplikasi ERP.
- Saya memakai interpretasi yang aman dan praktis: struktur modul dibangun mengikuti pola `Buku Informasi`, `Buku Kerja`, dan `Buku Penilaian`.
- Ini bukan klaim bahwa sudah final lolos verifikasi lembaga tertentu. Ini adalah fondasi yang rapi agar dokumen NIZAM siap diarahkan ke format yang dekat dengan praktik BNSP/Kemnaker.

---

## 1. Tujuan Rencana

Menyusun modul petunjuk pengguna NIZAM yang:

- mudah dipahami pengguna non-teknis,
- mudah dibayangkan oleh pengguna baru karena dilengkapi screenshot nyata,
- bisa dipakai untuk onboarding dan pelatihan internal,
- punya struktur yang konsisten dan bisa diuji,
- cukup dekat dengan format minimum modul pelatihan berbasis kompetensi.

---

## 2. Asumsi Kerja

Agar rencana ini bisa langsung dipakai, saya memakai asumsi berikut:

- Ruang lingkup awal adalah petunjuk pengguna NIZAM secara umum, bukan hanya satu modul kecil.
- Target utama versi pertama adalah pengguna operasional dan admin bisnis.
- Dokumen akhir akan dibagi per peran dan per alur kerja, supaya tidak menjadi satu manual yang terlalu panjang.
- Fase pertama fokus pada fitur inti yang paling sering dipakai saat onboarding dan operasional harian.

Jika nanti Anda ingin fokus ke modul tertentu, misalnya `Syirkah`, `Accounting`, atau `Inventory`, rencana ini tinggal dipersempit tanpa mengubah kerangkanya.

---

## 3. Acuan Minimum Yang Dipakai

Struktur dasar yang saya pakai berasal dari praktik modul pelatihan berbasis kompetensi di ekosistem Kemnaker/BNSP:

- `Buku Informasi`: berisi pengetahuan dasar, tujuan, istilah, konsep, dan pemahaman alur.
- `Buku Kerja`: berisi langkah kerja, latihan, checklist, dan tugas praktik.
- `Buku Penilaian`: berisi instrumen evaluasi, kunci cek, dan bukti kompetensi.

Untuk konteks aplikasi NIZAM, penyesuaiannya menjadi:

- `Buku Informasi` untuk mengenalkan sistem, peran user, menu, istilah, aturan akses, dan alur bisnis.
- `Buku Kerja` untuk panduan klik-langkah, skenario kerja, studi kasus, dan checklist pekerjaan.
- `Buku Penilaian` untuk memastikan user benar-benar mampu menjalankan tugas, bukan hanya membaca panduan.

Tambahan adaptasi untuk aplikasi:

- bagian `keselamatan kerja` diterjemahkan menjadi `keamanan data, otorisasi, dan ketelitian input`,
- bagian `alat dan bahan` diterjemahkan menjadi `akun, browser, data awal, dokumen pendukung, dan hak akses`,
- bagian `unjuk kerja` diterjemahkan menjadi `simulasi penggunaan fitur dan penyelesaian tugas nyata`.

---

## 4. Bentuk Dokumen Yang Direkomendasikan

Supaya tetap rapi dan realistis, hasil akhirnya sebaiknya tidak berupa satu file raksasa. Struktur yang saya rekomendasikan:

1. `Modul Induk Pengguna NIZAM`
2. `Buku Informasi`
3. `Buku Kerja`
4. `Buku Penilaian`
5. `Lampiran Screenshot, Form, dan Glosarium`

Prinsip penting:

- screenshot adalah bagian inti modul, bukan pelengkap,
- setiap alur utama wajib memiliki visual layar yang nyata,
- teks harus menjelaskan apa yang terlihat di screenshot,
- untuk pengguna pemula, tampilan sebelum aksi dan sesudah aksi sebaiknya sama-sama ditunjukkan.

Lalu isi modul dipecah menjadi 2 lapis:

### Lapis A. Modul Umum Semua Pengguna

- pengenalan NIZAM,
- login dan keamanan akun,
- onboarding organisasi,
- memilih organisasi dan unit aktif,
- mengenal dashboard dan menu,
- aturan dasar input data,
- logout, reset password, dan troubleshooting dasar.

### Lapis B. Modul Peran atau Domain

- Admin Bisnis,
- Keuangan dan Kas Bank,
- Sales dan POS,
- Purchasing,
- Inventory dan Gudang,
- HRIS,
- Reporting,
- Syirkah,
- modul lanjutan lain sesuai kebutuhan.

Dengan pola ini, standar minimum tetap terpenuhi, tetapi dokumennya tetap usable untuk tim.

---

## 5. Ruang Lingkup Fase 1

Agar bisa selesai lebih cepat dan langsung dipakai, fase pertama saya sarankan mencakup:

1. Login, reset password, dan aktivasi user.
2. Onboarding organisasi.
3. Navigasi dashboard.
4. Pengaturan awal bisnis.
5. Pengaturan cabang atau unit.
6. Pengaturan role dan user.
7. Setup kas dan bank.
8. Setup master data dasar.
9. Transaksi harian dasar.
10. Approval dan pengecekan data.
11. Laporan ringkas.
12. Penutupan kerja harian dan logout.

Modul seperti `Factory`, `Fleet`, `Construction`, dan beberapa fitur spesialis dapat masuk fase berikutnya.

---

## 6. Struktur Isi Dokumen Final

### A. Struktur Buku Informasi

Isi minimal yang saya rekomendasikan:

1. Cover dokumen
2. Identitas dokumen
3. Versi dan tanggal berlaku
4. Tujuan umum
5. Tujuan khusus
6. Sasaran pengguna
7. Prasyarat penggunaan
8. Gambaran sistem NIZAM
9. Struktur menu dan peran
10. Istilah penting
11. Aturan keamanan data
12. Alur proses dari awal sampai akhir
13. Ringkasan modul per domain
14. FAQ dasar
15. Daftar referensi

Catatan visual untuk Buku Informasi:

- tampilkan screenshot dashboard utama,
- tampilkan screenshot sidebar dan area header,
- tampilkan screenshot pemilihan organisasi aktif dan unit aktif,
- jika ada istilah baru, beri cuplikan layar yang menunjukkan letaknya.

### B. Struktur Buku Kerja

Isi minimal yang saya rekomendasikan:

1. Identitas unit latihan
2. Tujuan praktik
3. Data awal yang harus disiapkan
4. Langkah kerja rinci
5. Screenshot atau titik klik penting
6. Checklist keberhasilan
7. Skenario latihan
8. Tugas praktik mandiri
9. Catatan kesalahan umum
10. Lembar verifikasi hasil

Catatan visual untuk Buku Kerja:

- langkah penting minimal punya screenshot sebelum aksi,
- hasil akhir minimal punya screenshot sesudah aksi,
- tombol, field, dan menu penting perlu diberi penanda angka atau lingkaran,
- proses panjang sebaiknya memakai urutan `Gambar 1`, `Gambar 2`, `Gambar 3`.

### C. Struktur Buku Penilaian

Isi minimal yang saya rekomendasikan:

1. Identitas unit penilaian
2. Metode penilaian
3. Kriteria kompeten atau belum kompeten
4. Soal teori singkat
5. Uji praktik berbasis skenario
6. Daftar cek unjuk kerja
7. Catatan evaluator
8. Rekap hasil penilaian
9. Tanda tangan verifikasi

---

## 7. Standar Screenshot Wajib

Supaya modul benar-benar mudah dipahami, saya sarankan aturan screenshot berikut dijadikan standar tetap:

1. Screenshot harus berasal dari tampilan aplikasi NIZAM yang nyata.
2. Screenshot harus jelas, tidak blur, dan fokus pada area kerja utama.
3. Data sensitif harus disamarkan jika memakai data produksi.
4. Setiap screenshot harus punya judul singkat.
5. Setiap screenshot harus punya caption penjelas.
6. Jika ada aksi penting, beri penanda visual seperti angka, kotak, atau panah.
7. Hindari satu halaman berisi terlalu banyak screenshot kecil.
8. Gunakan urutan visual yang konsisten dari langkah awal sampai hasil akhir.

Format caption yang direkomendasikan:

- `Gambar 1. Halaman login NIZAM`
- `Gambar 2. Memilih tab Pemilik / Admin Bisnis`
- `Gambar 3. Dashboard setelah login berhasil`

Jenis screenshot yang wajib ada dalam modul umum:

1. Halaman login
2. Halaman lupa password
3. Halaman aktivasi atau join user
4. Halaman onboarding organisasi
5. Dashboard utama
6. Sidebar dan menu modul
7. Pemilihan organisasi aktif
8. Pemilihan unit atau cabang aktif
9. Form input dasar
10. Contoh notifikasi sukses
11. Contoh notifikasi error atau validasi
12. Halaman laporan ringkas

Jenis screenshot yang wajib ada dalam modul per domain:

1. Halaman daftar data
2. Tombol tambah data
3. Form input
4. Hasil simpan
5. Status approval atau validasi
6. Tampilan laporan atau hasil akhir

---

## 8. Peta Isi Dari Awal Sampai Akhir

Supaya benar-benar "dari awal sampai akhir", isi modul final sebaiknya mengikuti urutan pengalaman pengguna:

1. Sebelum memakai aplikasi
2. Cara masuk ke sistem
3. Cara membuat atau mengaktifkan organisasi
4. Cara memahami dashboard
5. Cara menyiapkan data dasar
6. Cara menjalankan transaksi harian
7. Cara mengecek approval dan validasi
8. Cara melihat laporan
9. Cara menutup pekerjaan harian
10. Cara menangani masalah umum

Untuk versi per domain, urutannya tetap sama:

1. tujuan pekerjaan,
2. data yang dibutuhkan,
3. langkah kerja di sistem,
4. hasil yang harus muncul,
5. kesalahan yang harus dihindari,
6. bukti kompetensi.

---

## 9. Tahapan Pengerjaan Dari Awal Sampai Akhir

### Tahap 1. Inisiasi dan Penetapan Scope

Output:

- nama dokumen,
- target pembaca,
- daftar modul prioritas,
- batas versi pertama.

Aktivitas:

- menetapkan apakah modul fokus untuk semua user atau hanya per divisi,
- menetapkan peran prioritas,
- menetapkan level detail.

### Tahap 2. Inventarisasi Fitur dan Alur Nyata

Output:

- daftar route, menu, dan fitur yang masuk dokumen,
- daftar alur nyata pengguna,
- daftar fitur yang belum siap didokumentasikan.

Aktivitas:

- memetakan menu dari aplikasi,
- mencocokkan dengan kebutuhan pengguna,
- memisahkan fitur inti dan fitur lanjutan.

### Tahap 3. Pemetaan Kompetensi Pengguna

Output:

- unit kompetensi internal pengguna NIZAM.

Contoh:

- mampu login dan memilih unit aktif,
- mampu membuat data master dasar,
- mampu mencatat transaksi sesuai peran,
- mampu memeriksa hasil dan laporan dasar.

### Tahap 4. Menyusun Outline Buku Informasi

Output:

- daftar bab final untuk pemahaman teori dan alur.

### Tahap 5. Menyusun Outline Buku Kerja

Output:

- daftar latihan praktik per topik,
- checklist langkah,
- skenario penggunaan.

### Tahap 6. Menyusun Outline Buku Penilaian

Output:

- instrumen tes teori,
- instrumen uji praktik,
- rubrik penilaian.

### Tahap 7. Pengumpulan Bukti dan Material

Output:

- screenshot,
- contoh data,
- contoh hasil output,
- daftar error umum,
- daftar istilah.

Aktivitas tambahan wajib:

- mengambil screenshot untuk setiap alur utama,
- menyusun daftar nama file screenshot,
- menandai area penting pada screenshot,
- memastikan screenshot sesuai versi UI terbaru.

### Tahap 8. Penulisan Draft Lengkap

Output:

- draft `Buku Informasi`,
- draft `Buku Kerja`,
- draft `Buku Penilaian`.

Aktivitas tambahan wajib:

- memasukkan screenshot di tiap bab yang relevan,
- mencocokkan teks dengan tampilan layar,
- menghindari bab yang hanya berisi teks panjang tanpa visual.

### Tahap 9. Review Substansi Internal

Output:

- koreksi dari PIC produk, operasional, atau trainer,
- daftar revisi wajib.

### Tahap 10. Uji Coba Ke Pengguna

Output:

- umpan balik user baru,
- titik yang masih membingungkan,
- langkah yang perlu screenshot tambahan.

### Tahap 11. Validasi dan Finalisasi

Output:

- versi final siap pakai,
- nomor versi,
- tanggal berlaku,
- penanggung jawab dokumen.

### Tahap 12. Distribusi dan Pemeliharaan

Output:

- lokasi file final,
- aturan update,
- daftar perubahan per versi.

---

## 10. Deliverable Yang Akan Dihasilkan

Jika kita lanjutkan sampai selesai, hasil yang ideal adalah:

1. `Rencana modul`
2. `Outline lengkap`
3. `Buku Informasi`
4. `Buku Kerja`
5. `Buku Penilaian`
6. `Paket screenshot terstruktur`
7. `Checklist evaluasi pengguna`
8. `Template update versi dokumen`

---

## 11. Standar Minimal Kelayakan Dokumen

Saya sarankan modul dianggap layak minimal jika:

- ada tujuan umum dan tujuan khusus,
- ada sasaran pembaca yang jelas,
- ada prasyarat penggunaan,
- ada langkah kerja yang urut,
- ada screenshot pada setiap alur penting,
- ada bukti hasil yang harus muncul,
- ada daftar kesalahan umum,
- ada latihan praktik,
- ada instrumen penilaian,
- ada versi dokumen dan penanggung jawab.

Kalau salah satu bagian itu belum ada, modul masih belum kuat untuk disebut siap pakai.

---

## 12. Strategi Penulisan Yang Paling Efektif Untuk NIZAM

Daripada langsung membuat satu manual besar, saya rekomendasikan pola berikut:

1. Buat `Modul Induk` dulu.
2. Buat `Modul Umum Semua User`.
3. Buat `Modul Admin Bisnis`.
4. Buat `Modul Per Divisi` satu per satu.

Urutan prioritas yang paling aman:

1. Umum
2. Admin Bisnis
3. Keuangan
4. Sales
5. Inventory
6. Purchasing
7. HRIS
8. Syirkah
9. Modul spesialis lainnya

Alasannya sederhana: user baru biasanya tersandung di login, setup awal, role, dan transaksi dasar lebih dulu.

---

## 13. Strategi Visual Untuk Pengguna Pemula

Karena targetnya agar pemula mudah membayangkan proses, strategi visual yang saya sarankan adalah:

1. Satu topik besar dibuka dengan screenshot full halaman.
2. Setelah itu tampilkan screenshot detail untuk tombol atau field penting.
3. Gunakan kalimat pendek di bawah screenshot.
4. Hindari paragraf panjang sebelum pembaca melihat bentuk layarnya.
5. Tampilkan contoh hasil akhir agar pengguna tahu target yang benar.

Pola paling efektif:

1. `Lihat layar`
2. `Kenali bagian penting`
3. `Ikuti langkah`
4. `Bandingkan hasil`
5. `Cek jika ada kesalahan`

---

## 14. Estimasi Eksekusi

Kalau dikerjakan bertahap dan rapi, pembagian realistisnya seperti ini:

- Tahap perencanaan dan outline: 1 sampai 2 hari kerja
- Draft modul umum: 2 sampai 4 hari kerja
- Draft modul domain prioritas: 3 sampai 7 hari kerja tergantung jumlah modul
- Review dan revisi: 1 sampai 3 hari kerja

Jika hanya membuat fase pertama yang inti, biasanya jauh lebih cepat selesai dibanding mencoba mendokumentasikan semua modul sekaligus.

---

## 15. Rekomendasi Langkah Berikutnya

Sesudah dokumen rencana ini, langkah paling efektif adalah:

1. tetapkan dulu apakah versi pertama untuk seluruh NIZAM atau fokus satu domain,
2. susun `outline modul umum`,
3. susun daftar screenshot wajib per bab,
4. lanjut tulis `Buku Informasi` lebih dulu,
5. setelah itu turunkan ke `Buku Kerja`,
6. tutup dengan `Buku Penilaian`.

Jika ingin progres paling cepat, saya sarankan mulai dari:

- `Modul Umum Semua Pengguna NIZAM`, lalu
- `Modul Admin Bisnis NIZAM`.

---

## 16. Referensi Acuan

Referensi yang dipakai untuk arah struktur minimal:

- BNSP, halaman unduhan `MUK 2023`, yang menampilkan `Form Buku Kerja 2023` dan modul asesmen:
  `https://bnsp.go.id/download?id=15`
- Kementerian Ketenagakerjaan, contoh `Modul Pelatihan Berbasis Kompetensi` yang memakai format `Buku Informasi`:
  `https://e-training.kemnaker.go.id/asset/directory/bm/434/3%20MENERAPKAN%20DESIGN%20BRIEF/3-%20Buku%20informasi%20Menerapkan%20Desain%20Brief%20%281%29.pdf`
- Praktik umum PBK yang membagi modul menjadi `Buku Informasi`, `Buku Kerja`, dan `Buku Penilaian` saya pakai sebagai kerangka adaptasi untuk dokumen pengguna aplikasi.

---

## 17. Kesimpulan

Ya, modul petunjuk pengguna seperti yang Anda minta bisa dibuat.

Pendekatan yang paling aman adalah:

- memakai format minimum ala PBK/BNSP,
- membaginya menjadi `Buku Informasi`, `Buku Kerja`, dan `Buku Penilaian`,
- menjadikan screenshot sebagai bagian wajib, bukan tambahan,
- menulisnya per alur dan per peran,
- memulai dari modul umum dan admin dulu sebelum masuk ke modul spesialis.
