# Script Voice Over Tutorial NIZAM ERP

## Konteks

Script ini disusun setelah memetakan alur utama codebase `nizam-app`, khususnya:

- auth dan onboarding organisasi
- dashboard, sidebar, header, branch selector, dan startup wizard
- setup awal bisnis: profil bisnis, cabang, pengguna, role, CoA, kas dan bank
- modul inti: CRM, inventory, gudang, purchasing, sales, quotation, pipeline, POS, komisi reseller
- modul pendukung: HRIS, approval center, audit, laporan, BSC, forecast
- modul lanjutan yang tersedia di repo: manufaktur, fleet, service order, sales page

## Asumsi Produksi Video

- Target video: owner atau admin bisnis yang baru pertama kali memakai NIZAM.
- Gaya video: tutorial end-to-end, bukan video promosi.
- Durasi ideal: sekitar 12 sampai 16 menit.
- Sudut pandang: satu organisasi baru, lalu user menyiapkan data dasar sampai siap operasional.
- Catatan penting: banyak transaksi operasional di NIZAM idealnya dilakukan saat satu unit atau cabang aktif sudah dipilih dari header.
- Catatan penting: menu yang tampil bisa berbeda tergantung paket SaaS dan permission role.

---

## Script Voice Over

### 1. Opening

**Visual**
Landing ke halaman login, lalu potong cepat ke dashboard, inventory, sales, laporan, dan approval center.

**Voice over**
Selamat datang di tutorial penggunaan NIZAM ERP. Kalau Anda sedang membangun atau merapikan operasional bisnis, video ini dibuat untuk membantu Anda melihat alur kerja NIZAM dengan lebih tenang dan lebih jelas. Untuk saat ini, pintu masuk NIZAM memang dimulai dari halaman login. Dari sana, kita akan melihat langkah-langkah penting mulai dari membuat organisasi, menyiapkan data master, mencatat transaksi, sampai membaca laporan bisnis. Selain alur inti itu, kita juga akan menyorot beberapa fitur yang cukup menonjol di NIZAM, seperti manajemen zakat, strategi berbasis Balanced Scorecard, approval terpusat, dan operasional multi-cabang. Tutorial ini cocok untuk owner atau admin yang ingin memahami bagaimana NIZAM dipakai sebagai sistem operasional harian, bukan hanya sebagai dashboard angka.

### 2. Login Ke Sistem

**Visual**
Tampilkan halaman login. Sorot dua tab: `Pemilik / Admin Bisnis` dan `Login Karyawan`.

**Voice over**
Di halaman login NIZAM, ada dua jalur masuk. Tab pertama adalah untuk pemilik atau admin bisnis yang login menggunakan email dan password. Tab kedua adalah untuk karyawan yang masuk menggunakan NIK dan password. Untuk tutorial ini, kita masuk sebagai pemilik atau admin bisnis, karena dari akun inilah proses setup organisasi, pengaturan akses, dan aktivasi modul biasanya dilakukan.

### 3. Onboarding Organisasi

**Visual**
Setelah login pertama kali, tampil halaman `NIZAM Setup`. Isi nama perusahaan lalu submit.

**Voice over**
Kalau akun sudah login tetapi belum punya organisasi aktif, NIZAM langsung mengarahkan kita ke halaman onboarding. Di sini cukup isi nama perusahaan, lalu klik tombol aktivasi. Setelah itu sistem akan menyiapkan lingkungan ERP, termasuk konteks organisasi yang nanti dipakai di seluruh modul. Dari titik ini, user tidak perlu membuat workspace secara manual, karena alur awal sudah disiapkan langsung di aplikasi.

### 4. Mengenal Dashboard Utama

**Visual**
Masuk ke dashboard. Sorot sidebar, header, pemilih organisasi, pemilih unit atau cabang, lalu startup wizard di bagian atas.

**Voice over**
Begitu onboarding selesai, kita masuk ke dashboard utama. Di sisi kiri ada sidebar berisi modul-modul utama, mulai dari finance, operasional, marketing dan sales, HRIS, insight, sampai konfigurasi. Di bagian header, kita bisa berpindah organisasi, memilih unit atau cabang aktif, dan memakai quick access untuk konteks kerja harian. Kalau Anda melihat mode semua unit, ingat bahwa itu biasanya dipakai untuk ringkasan agregat. Saat ingin membuat transaksi baru, pilih dulu satu unit aktif agar stok, kas, dan jurnal tidak tercampur.

### 5. Ikuti Startup Wizard

**Visual**
Sorot wizard awal: `Buat Kas/Bank`, `Input Modal Awal`, `Persiapan Stok`, `Mulai Berjualan`, `Pantau Arus Kas`.

**Voice over**
NIZAM juga menampilkan startup wizard untuk membantu user baru memahami urutan setup yang paling aman. Alurnya sederhana: buat rekening kas atau bank dulu, input modal awal, siapkan stok dan produk, mulai transaksi penjualan, lalu pantau arus kas dari laporan. Wizard ini sangat membantu karena mengikuti logika implementasi ERP yang benar: siapkan struktur keuangan dulu, baru masuk ke transaksi operasional.

### 6. Lengkapi Profil Bisnis

**Visual**
Buka `Pengaturan Bisnis` atau `Profil Bisnis`. Tampilkan logo, brand name, slug, dan pengaturan identitas perusahaan.

**Voice over**
Langkah berikutnya adalah melengkapi profil bisnis. Di halaman Profil Bisnis, owner bisa mengatur nama brand, logo perusahaan, identitas slug bisnis, dan format identifikasi sistem yang dipakai lintas modul. Ini penting karena data ini akan muncul di berbagai dokumen, seperti invoice, surat jalan, dan tampilan brand di POS maupun halaman publik.

### 7. Aktifkan Chart of Accounts

**Visual**
Masuk ke menu `Akun (CoA)`. Tunjukkan tombol `Aktifkan CoA PSAK` atau `Aktifkan CoA Standar PSAK`.

**Voice over**
Setelah profil bisnis, kita masuk ke menu Akun atau Chart of Accounts. Di sinilah struktur rekening akuntansi disiapkan. Jika perusahaan baru belum memiliki CoA, cukup klik aktivasi CoA standar PSAK. Setelah aktif, struktur akun aset, liabilitas, ekuitas, pendapatan, dan beban akan siap dipakai oleh modul-modul lain. Ini adalah fondasi utama karena hampir semua transaksi NIZAM pada akhirnya terhubung ke jurnal dan laporan keuangan.

### 8. Buat Cabang Dan Atur Struktur Tim

**Visual**
Buka `Cabang`, tambah cabang baru. Lanjut ke `Pengguna & Hak Akses`, lalu `Akses & Jabatan`.

**Voice over**
Kalau bisnis Anda punya lebih dari satu lokasi, buat dulu cabang atau unit kerja dari menu Cabang. Setelah itu, lanjut ke Pengguna dan Hak Akses untuk membuat link aktivasi anggota tim. NIZAM memakai undangan berbasis token, jadi admin cukup membuat link aktivasi, memilih role atau jabatan, menentukan masa berlaku, lalu membagikan link tersebut ke user yang akan bergabung. Supaya akses tiap orang rapi, kita juga bisa membuka menu role untuk mengatur permission per domain, misalnya siapa yang boleh mengakses inventory, sales, HRIS, atau finance.

### 9. Siapkan Kas Dan Bank

**Visual**
Buka `Kas & Bank`. Tambah rekening, lalu buat transaksi masuk sebagai modal awal.

**Voice over**
Setelah struktur organisasi siap, kita masuk ke kas dan bank. Di sini owner dapat menambahkan rekening kas kecil, rekening bank operasional, atau rekening lain yang dipakai bisnis. Sesuai arahan startup wizard, setelah rekening dibuat kita bisa input modal awal sebagai transaksi masuk. Nanti uang yang masuk ke rekening ini akan menjadi dasar arus kas awal, dan jurnalnya akan mengalir ke akun modal atau akun lawan yang sesuai.

### 10. Buat Master Kontak

**Visual**
Buka `Pelanggan & Pemasok (CRM)`. Tambah customer lalu tambah vendor.

**Voice over**
Sebelum masuk ke pembelian dan penjualan, siapkan dulu master relasi bisnis dari menu CRM. Di halaman ini, kita bisa membuat customer, supplier, atau kontak umum. Kontak yang sudah dibuat akan dipakai ulang di modul pembelian, penjualan, POS, sampai service order. Dengan begitu, data pelanggan dan vendor tidak tercecer di banyak tempat, dan histori transaksinya tetap konsisten.

### 11. Siapkan Gudang Dan Produk

**Visual**
Buka `Gudang (WMS)`, buat gudang. Lanjut ke `Inventory & Stock`, tambah produk baru, kategori, satuan, barcode, akun persediaan.

**Voice over**
Berikutnya kita siapkan gudang dan produk. Dari menu gudang, buat lokasi fisik penyimpanan barang terlebih dahulu. Setelah itu masuk ke inventory untuk menambahkan produk baru, lengkap dengan nama, SKU, kategori, satuan, harga, barcode, dan keterkaitan akun persediaan. NIZAM juga mendukung kartu stok, write-off, transfer antar gudang, sampai barcode label. Jadi sejak awal, data persediaan sudah disiapkan untuk kebutuhan operasional dan akuntansi sekaligus.

### 12. Jalankan Pembelian

**Visual**
Buka `Purchasing`. Tampilkan tombol `Vendor Baru`, `Buat PO (Belanja)`, histori PO, lalu proses terima barang.

**Voice over**
Setelah vendor dan produk tersedia, kita bisa mulai proses pembelian. Di modul Purchasing, admin membuat purchase order ke supplier, menambahkan item, menentukan termin pembayaran, lalu menerbitkan PO. Saat barang diterima, sistem akan menambah stok dan sekaligus menyinkronkan jurnal yang relevan. Di modul ini juga tersedia permintaan pembelian internal, pembayaran pembelian, retur, serta alur draft sebelum PO resmi diterbitkan.

### 13. Kelola Penawaran Dan Pipeline

**Visual**
Buka `Penawaran Harga`, buat quotation baru. Lalu masuk ke `Sales Pipeline`.

**Voice over**
Untuk sisi penjualan, NIZAM menyediakan alur yang lebih rapi dimulai dari quotation. Di menu Penawaran Harga, tim sales bisa membuat penawaran resmi untuk calon pelanggan sebelum order benar-benar disetujui. Dari sana, dokumen quotation bisa dikonversi ke order penjualan. Jika Anda ingin memantau progres peluang bisnis, gunakan menu Sales Pipeline. Tampilan kanban ini membantu tim melihat posisi lead, negosiasi draft, order yang sedang berjalan, sampai transaksi yang sudah selesai.

### 14. Buat Sales Order Atau Invoice Penjualan

**Visual**
Buka `Sales & Invoicing`. Tambah customer, buat invoice jual, lalu sorot tombol kirim barang, cetak surat jalan, cetak invoice, retur.

**Voice over**
Setelah penawaran disetujui, masuk ke modul Sales and Invoicing. Di sini admin atau tim sales dapat membuat sales order atau langsung invoice penjualan, menambahkan item, menentukan termin, dan menyimpan sebagai draft bila belum final. Saat transaksi sudah siap, dokumen bisa diterbitkan, dikirim, lalu dicetak sebagai invoice atau surat jalan. NIZAM juga menyiapkan retur penjualan serta pengamanan stok agar barang tidak oversold untuk skenario non-SALAM.

### 15. Target Dan Komisi Reseller

**Visual**
Buka `Target & Komisi Reseller`. Tambah reseller, lihat target, estimasi komisi, dan invoice channel.

**Voice over**
Jika bisnis Anda memakai channel partner atau reseller, gunakan menu Target dan Komisi Reseller. Di halaman ini, kita bisa membuat master reseller personal maupun perusahaan mitra, menentukan target bulanan, serta menetapkan skema komisi persen atau nominal tetap. Yang penting, NIZAM menyimpan snapshot komisi di invoice saat transaksi dibuat. Artinya, perubahan setting reseller hari ini tidak akan mengubah perhitungan invoice lama, dan nilai tagihan customer tetap aman karena komisi dihitung di luar invoice customer.

### 16. Gunakan POS Untuk Penjualan Cepat

**Visual**
Masuk ke `POS (Kasir)`. Tambah item ke keranjang, pilih customer, terapkan promo, pilih metode pembayaran, selesaikan transaksi.

**Voice over**
Untuk transaksi retail yang lebih cepat, gunakan modul POS. Tampilan POS dirancang untuk kasir, dengan alur pilih produk, atur jumlah, pilih customer, pakai promo atau voucher, lalu selesaikan pembayaran tunai maupun non tunai. Saat transaksi selesai, stok fisik akan berkurang dari gudang yang dipilih, dan pencatatan ke rekening POS serta jurnal terkait berjalan otomatis. Jadi penjualan cepat tetap tercatat dengan disiplin seperti transaksi back office.

### 17. Optimalkan Modul Sales Tambahan

**Visual**
Buka `Promo & Reward`, lalu `Sales Page`, lalu halaman publik sales page.

**Voice over**
Di sisi marketing, NIZAM juga punya modul tambahan seperti promo dan reward, serta Sales Page Studio. Modul ini bisa dipakai untuk membuat landing page penjualan, menyusun penawaran berbasis template, bahkan mempublikasikan halaman publik untuk menangkap lead. Lead yang masuk dapat diteruskan ke pipeline, sehingga aktivitas marketing tidak berhenti di halaman promosi saja, tetapi benar-benar tersambung ke proses penjualan.

### 18. Kelola SDM Di HRIS

**Visual**
Buka `Karyawan (HRIS)`, lalu pindah tab ke `Absensi & Cuti`, `Payroll Components`, `Proses Penggajian`, dan `Activation`.

**Voice over**
Kalau perusahaan juga ingin mengelola SDM dari sistem yang sama, buka modul HRIS. Di sini Anda bisa membuat data karyawan, menyusun posisi atau jabatan, mengelola absensi dan cuti, mendefinisikan komponen payroll, lalu menjalankan proses penggajian. NIZAM juga mendukung aktivasi akun karyawan berbasis undangan, sehingga tim dapat masuk memakai NIK dan melihat portal kerja sesuai permission masing-masing.

### 19. Approval Center Dan Audit

**Visual**
Buka `Approval Center`, tampilkan list pending approval, detail dokumen, tombol setujui dan QR signature. Lanjut ke `Audit Trail` atau `Audit Integritas`.

**Voice over**
Supaya kontrol internal tetap rapi, NIZAM menyediakan Approval Center. Di sinilah dokumen yang membutuhkan persetujuan dikumpulkan, lengkap dengan detail, histori, dan keputusan approve atau reject. Saat disetujui, sistem bahkan menyiapkan tanda tangan digital berbasis QR. Selain itu, ada juga modul audit trail dan audit integritas untuk membantu admin menelusuri perubahan data, memeriksa kualitas jurnal, dan menjaga kebersihan data operasional.

### 20. Baca Laporan Bisnis, Zakat, dan BSC

**Visual**
Buka `Laporan Keuangan`, pindah tab antara laba rugi, neraca, dan arus kas. Lanjut ke `Manajemen Zakat`, `Strategi (BSC)`, `Aging`, `Forecast`, dan `Pareto`.

**Voice over**
Semua proses tadi akan bermuara ke laporan. Di menu Laporan Keuangan, owner dapat membaca laba rugi, neraca, dan arus kas secara real-time dari buku besar. Untuk pengawasan yang lebih dalam, NIZAM juga menyediakan aging piutang dan hutang, proyeksi kas, analisis pareto, manajemen zakat, dan strategi berbasis Balanced Scorecard. Dua area terakhir ini cukup menarik karena tidak selalu hadir di sistem operasional biasa, terutama untuk bisnis yang ingin memantau zakat perdagangan dan target strategi secara lebih terstruktur.

### 21. Modul Lanjutan Bila Dibutuhkan

**Visual**
Montage singkat `Manufaktur`, `Fleet & Rental`, dan `Job Order (Jasa)`.

**Voice over**
Bila paket modul Anda aktif, NIZAM juga menyediakan area lanjutan seperti manufaktur untuk BoM dan work order, fleet untuk armada, jadwal, ticketing, dan presensi kru, serta job order jasa untuk layanan berbasis pekerjaan. Modul-modul ini tetap memakai pola data yang sama: berbasis organisasi, cabang, approval, dan jurnal yang saling terhubung.

### 22. Penutup

**Visual**
Kembali ke dashboard. Tampilkan ringkasan sidebar dan metrik utama.

**Voice over**
Itulah alur utama penggunaan NIZAM ERP, mulai dari login, setup organisasi, pengaturan master data, transaksi pembelian dan penjualan, sampai ke HRIS, approval, dan laporan manajemen. Yang ingin ditunjukkan di sini bukan klaim berlebihan, tetapi alur kerja yang memang sudah tersedia dan saling terhubung. Mulai dari stok, kas, tim, akuntansi, sampai fitur seperti zakat dan BSC, NIZAM bisa dipakai sebagai sistem kerja yang lebih rapi dan lebih terukur. Setelah ini, Anda bisa melanjutkan dengan membuat SOP per role agar setiap tim memakai menu yang sesuai tanggung jawabnya.

---

## Catatan Presenter

- Saat merekam, gunakan akun owner atau admin agar menu setup dan konfigurasi terlihat lengkap.
- Untuk NIZAM sendiri, jangan narasikan seolah-olah produk sudah punya landing page publik. Flow aktual saat ini dimulai dari halaman login.
- Jika tidak semua modul aktif di akun demo, narasikan bahwa tampilan menu mengikuti paket SaaS dan permission role.
- Saat memperagakan transaksi, selalu pastikan satu unit aktif sudah dipilih dari header.
- Jika ingin versi video yang lebih singkat, bagian manufaktur, fleet, service order, dan sales page bisa dijadikan montage cepat.
- Hindari kalimat yang terlalu mutlak seperti “semua bisnis pasti cocok” atau “fiturnya paling lengkap”. Lebih aman menyebut keunggulan yang memang terlihat di produk, seperti zakat, BSC, approval, dan konteks multi-cabang.
- Jika ingin versi video per divisi, script ini paling mudah dipecah menjadi:
  - setup owner
  - finance and accounting
  - sales and marketing
  - inventory and purchasing
  - HRIS and approval

## Rekomendasi Potongan Video

- Versi penuh: 12 sampai 16 menit
- Versi onboarding owner: 4 sampai 6 menit
- Versi sales and operations: 5 sampai 7 menit
- Versi finance and reporting: 4 sampai 6 menit
