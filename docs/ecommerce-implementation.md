# Implementasi E-Commerce

Dokumen ini menjelaskan implementasi modul e-commerce yang baru ditambahkan ke NIZAM. Fokus dokumen ini adalah membantu developer memahami apa yang sudah dibangun, bagaimana alurnya bekerja, file mana yang terlibat, dan batasan MVP saat ini.

## 1. Tujuan Implementasi

Target implementasi ini adalah menghadirkan dasar e-commerce yang terasa mirip pola Odoo, tetapi tetap mengikuti struktur NIZAM yang sudah ada.

Yang ingin dicapai:

- ada modul admin `E-Commerce` di dashboard
- ada storefront publik untuk katalog produk
- katalog publik memakai data produk dan promo yang sudah ada di ERP
- pelanggan bisa menambahkan produk ke keranjang
- pelanggan bisa mengirim permintaan order
- permintaan order masuk ke ERP sebagai draft `quotation`, bukan hanya form dummy

Implementasi ini sengaja belum langsung melompat ke payment gateway atau order fulfillment penuh. Fokus tahap ini adalah membuat jalur publik ke ERP yang benar-benar fungsional.

## 2. Gambaran Fitur Yang Sudah Jalan

Saat ini modul e-commerce sudah mencakup:

- dashboard admin `E-Commerce`
- storefront publik di route `/toko/[orgSlug]`
- pencarian produk
- filter kategori
- status stok siap, stok tipis, atau habis
- tampilan promo aktif dari modul sales
- keranjang lokal di browser
- form checkout ringan
- pembuatan draft quotation ke tabel `sales` dan `sales_items`
- pembuatan atau update kontak pelanggan di `contacts`

Yang belum masuk tahap ini:

- varian produk seperti ukuran, warna, atau atribut
- wishlist permanen
- payment gateway
- ongkir otomatis
- customer account / portal order
- multi-price list B2B/B2C
- reservasi stok saat item masuk keranjang

## 3. Route dan Titik Masuk

### Dashboard admin

- `/ecommerce`

Route ini dipakai tim internal untuk melihat kesiapan katalog, promo, dan arah pengembangan modul.

### Storefront publik

- `/toko/[orgSlug]`

Contoh:

- `/toko/nama-organisasi`

Route ini dipakai pelanggan untuk melihat katalog, memilih produk, mengisi data, lalu mengirim permintaan order.

### API publik

- `/api/ecommerce/order-request`

Route ini menerima data checkout dari storefront publik lalu membuat draft quotation di ERP.

## 4. File Yang Terlibat

### Route dashboard

- `app/(dashboard)/ecommerce/page.tsx`
- `app/(dashboard)/ecommerce/EcommerceClient.tsx`

Tanggung jawab:

- memuat data produk, gudang, dan promo dari server
- membentuk view data e-commerce untuk admin
- menampilkan blueprint fitur, ringkasan katalog, dan link ke storefront

### Route publik toko

- `app/toko/[orgSlug]/page.tsx`
- `app/toko/[orgSlug]/StorefrontClient.tsx`

Tanggung jawab:

- mengambil data toko publik berdasarkan `orgSlug`
- menampilkan hero, statistik, produk, promo, dan keranjang
- menangani input pelanggan dan submit order request

### API checkout

- `app/api/ecommerce/order-request/route.ts`

Tanggung jawab:

- sanitasi input publik
- validasi field wajib
- meneruskan payload ke helper server
- mengembalikan respon sukses atau error yang ramah dibaca

### Helper domain

- `modules/ecommerce/lib/ecommerce.ts`
- `modules/ecommerce/lib/ecommerce.server.ts`

Tanggung jawab `ecommerce.ts`:

- normalisasi data produk dan promo
- membentuk view model storefront
- menghitung preview cart
- mencari promo aktif berdasarkan kode

Tanggung jawab `ecommerce.server.ts`:

- resolve organisasi publik dari `slug`
- mengambil katalog produk aktif
- menghitung stok dari `inventory_stocks`
- membuat kontak pelanggan bila belum ada
- membuat draft quotation ke `sales`
- membuat item order ke `sales_items`

### Navigasi dashboard

- `components/shared/AppSidebar.tsx`

Tanggung jawab:

- menambahkan menu `E-Commerce`
- sekaligus merapikan pola `hasMounted` agar lolos lint React

## 5. Sumber Data Yang Dipakai

Implementasi ini tidak membuat master produk baru. Semua katalog publik memakai sumber data ERP yang sudah ada.

### Produk

Sumber utama:

- tabel `products`

Field penting yang dipakai:

- `id`
- `name`
- `sku`
- `description`
- `category`
- `unit`
- `selling_price`
- `type`
- `is_active`

### Stok

Sumber utama:

- tabel `inventory_stocks`
- tabel `warehouses`

Cara hitung:

1. ambil semua gudang aktif milik organisasi
2. ambil semua stok di `inventory_stocks`
3. jumlahkan kuantitas per `product_id`
4. tampilkan hasilnya sebagai `stockAvailable`

Catatan:

- tahap ini hanya membaca stok
- belum ada reservasi stok saat item dimasukkan ke keranjang

### Promo

Sumber utama:

- `organizations.settings.sales_promos`

Promo tidak disimpan di tabel baru. Implementasi ini mengikuti pola modul sales yang sudah ada, yaitu membaca promo dari settings organisasi.

### Kontak pelanggan

Sumber utama:

- tabel `contacts`

Strategi saat checkout:

1. cari kontak berdasarkan nomor telepon
2. jika tidak ada, cari berdasarkan email
3. jika tetap tidak ada, buat kontak baru bertipe `CUSTOMER`
4. jika sudah ada, update data dasarnya

### Draft quotation

Sumber utama:

- tabel `sales`
- tabel `sales_items`

Draft dibuat dengan status:

- `QUOTATION`

Ini penting karena hasil checkout publik langsung masuk ke alur sales internal, bukan data terpisah yang harus disalin manual.

## 6. Alur End-to-End

Alur sederhananya seperti ini:

1. Pengguna membuka `/toko/[orgSlug]`.
2. Server mencari organisasi aktif berdasarkan slug.
3. Server mengambil produk aktif, stok, dan promo aktif.
4. Halaman publik menampilkan katalog dan promo.
5. Pelanggan menambahkan item ke keranjang.
6. Sistem menghitung subtotal, diskon promo, dan estimasi grand total di sisi client.
7. Pelanggan mengisi nama, WhatsApp, email, alamat, dan catatan.
8. Browser mengirim payload ke `/api/ecommerce/order-request`.
9. API memvalidasi input dasar lalu memanggil helper server.
10. Helper server memastikan produk masih aktif dan total order valid.
11. Helper server mencari atau membuat kontak pelanggan.
12. Helper server membuat draft quotation di `sales`.
13. Helper server membuat detail item di `sales_items`.
14. Browser menerima nomor draft quotation dan menampilkan pesan sukses.

## 7. Detail Perhitungan Cart

Perhitungan cart saat ini berjalan di helper:

- `buildCartPreview()` di `modules/ecommerce/lib/ecommerce.ts`

Yang dihitung:

- subtotal semua item
- promo aktif berdasarkan kode
- nilai diskon
- grand total setelah diskon

Catatan penting:

- kalkulasi ini adalah estimasi yang ditampilkan ke pelanggan
- pajak, ongkir, dan biaya tambahan belum dimasukkan pada tahap ini
- finalisasi harga tetap bisa disesuaikan tim sales saat menindaklanjuti quotation

## 8. Detail Pembuatan Draft Quotation

Helper utama:

- `createPublicEcommerceOrderRequest()` di `modules/ecommerce/lib/ecommerce.server.ts`

Langkah internalnya:

1. validasi `orgSlug`, nama, nomor WhatsApp, dan item keranjang
2. ambil produk aktif organisasi
3. cocokkan setiap item cart ke master produk
4. hitung subtotal
5. cek promo aktif jika ada kode promo
6. hitung alokasi diskon per item
7. ambil cabang aktif pertama sebagai `branch_id` bila tersedia
8. cari atau buat kontak pelanggan
9. insert draft ke `sales`
10. insert detail item ke `sales_items`

Catatan desain:

- implementasi ini sengaja membuat draft quotation, bukan langsung `FINISHED`
- tujuannya agar tim internal masih bisa cek stok nyata, negosiasi, ongkir, dan syarat bayar

## 9. Validasi dan Proteksi Dasar

### Di sisi client

Storefront memvalidasi dasar:

- field wajib
- keranjang tidak boleh kosong

### Di sisi API

Route handler memvalidasi:

- `orgSlug`
- `fullName`
- `phone`
- struktur item checkout

### Honeypot

Field `website` dipakai sebagai honeypot sederhana untuk mengurangi spam bot.

Kalau field ini terisi:

- request dianggap sukses palsu
- tetapi sistem tidak membuat draft quotation

### Sanitasi teks

Semua field publik dipotong panjangnya agar lebih aman:

- nama
- email
- telepon
- alamat
- catatan
- promoCode

## 10. Keputusan Desain Penting

Beberapa keputusan implementasi sengaja diambil agar aman untuk MVP:

### 1. Tidak membuat tabel e-commerce baru

Alasan:

- katalog sudah ada di `products`
- promo sudah ada di settings organisasi
- quotation sudah ada di `sales`

Keuntungan:

- integrasi cepat
- minim duplikasi data
- tim sales tetap bekerja di tempat yang sama

### 2. Checkout masuk ke quotation, bukan order final

Alasan:

- ongkir belum otomatis
- pembayaran belum online
- stok belum direservasi
- proses follow-up manual masih dibutuhkan

### 3. Cabang memakai cabang aktif pertama

Alasan:

- tabel `sales` butuh konteks `branch_id`
- storefront publik belum punya pemilih cabang

Konsekuensinya:

- kalau organisasi punya banyak cabang, order publik saat ini akan masuk ke cabang aktif pertama yang ditemukan
- ini area yang perlu diperjelas pada tahap berikutnya

## 11. Batasan MVP Saat Ini

Berikut batasan yang wajib dipahami sebelum modul ini dianggap setara penuh dengan Odoo:

- belum ada varian produk
- belum ada filter atribut
- belum ada compare product
- belum ada wishlist permanen
- belum ada akun pelanggan
- belum ada histori order publik
- belum ada payment gateway
- belum ada ongkir real-time
- belum ada notifikasi stok masuk kembali
- belum ada multi-store dalam satu organisasi
- belum ada price list khusus customer group

## 12. Rekomendasi Tahap Lanjut

Urutan pengembangan yang paling logis setelah MVP ini:

### Tahap 2

- varian produk dan atribut
- kategori dan filter yang lebih kaya
- pickup branch selector
- admin control untuk publish atau unpublish produk ke etalase

### Tahap 3

- ongkir otomatis
- payment gateway
- status order publik
- notifikasi WhatsApp atau email ke pelanggan dan sales

### Tahap 4

- customer portal
- B2B/B2C price list
- repeat order
- wishlist dan akun pelanggan

Kalau butuh versi yang jauh lebih lengkap dan berurutan per wave, lanjut baca:

- [`ecommerce-roadmap.md`](./ecommerce-roadmap.md)

## 13. Cara Uji Manual

### Uji dashboard admin

1. login ke dashboard
2. buka menu `E-Commerce`
3. pastikan statistik produk, kategori, promo, dan link storefront tampil

### Uji storefront publik

1. buka `/toko/[orgSlug]`
2. cek apakah produk tampil
3. gunakan pencarian
4. gunakan filter kategori
5. tambahkan item ke keranjang
6. coba kode promo aktif
7. isi form pelanggan
8. submit order request
9. pastikan muncul nomor draft quotation

### Uji hasil ke ERP

1. buka modul sales
2. cari draft dengan status `QUOTATION`
3. cek notes order
4. cek item order di detail quotation
5. cek apakah kontak customer sudah tercatat atau terupdate

## 14. Verifikasi Yang Sudah Dijalankan

Saat implementasi awal, verifikasi yang dijalankan adalah:

- `npx eslint` pada file-file yang diubah
- `npm run build`

Hasilnya:

- lint lolos
- build lolos
- route baru berhasil terdaftar

## 15. Ringkasan Singkat Untuk Developer Baru

Kalau Anda ingin cepat paham implementasi ini, urutan baca paling efisien adalah:

1. `app/(dashboard)/ecommerce/page.tsx`
2. `app/(dashboard)/ecommerce/EcommerceClient.tsx`
3. `app/toko/[orgSlug]/page.tsx`
4. `app/toko/[orgSlug]/StorefrontClient.tsx`
5. `app/api/ecommerce/order-request/route.ts`
6. `modules/ecommerce/lib/ecommerce.server.ts`
7. `modules/ecommerce/lib/ecommerce.ts`

Dengan urutan itu Anda bisa melihat alur dari UI admin, UI publik, API publik, sampai insert data ke ERP.
