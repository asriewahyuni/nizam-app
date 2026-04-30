# Roadmap Wave E-Commerce

Dokumen ini adalah roadmap wave lengkap untuk membawa modul e-commerce NIZAM dari MVP saat ini menuju versi yang matang, stabil, dan mendekati fitur penuh.

Dokumen implementasi saat ini tetap ada di:

- [`ecommerce-implementation.md`](./ecommerce-implementation.md)

Dokumen ini fokus ke pertanyaan:

- setelah MVP, langkah berikutnya apa
- urutan bangunnya bagaimana
- mana yang wajib dulu dan mana yang bisa menyusul
- kapan modul bisa dianggap benar-benar matang secara operasional

## 1. Arti "Fitur Sempurna" di Dokumen Ini

Di dokumen ini, istilah "sempurna" tidak berarti tanpa perubahan lagi. Maksudnya adalah:

- alur katalog sampai order benar-benar utuh
- tidak ada proses penting yang masih manual tanpa kontrol
- tim sales, operasional, dan customer punya alur yang jelas
- stok, pembayaran, pengiriman, dan laporan saling nyambung
- sistem aman dipakai harian dalam skala bisnis nyata

Jadi target akhirnya adalah:

- matang secara bisnis
- matang secara teknis
- matang secara operasional

## 2. Prinsip Urutan Wave

Roadmap ini disusun dengan prinsip:

1. jangan membangun payment sebelum checkout stabil
2. jangan membangun checkout final sebelum pricing dan variant rapi
3. jangan mengunci stok sebelum aturan fulfilment jelas
4. jangan mengejar fitur cantik dulu kalau audit trail dan status order belum rapi
5. setiap wave harus menambah nilai nyata, bukan hanya menambah tombol

## 3. Kondisi Saat Ini

Posisi sekarang ada di antara Wave 0 dan Wave 1, karena sudah ada:

- dashboard admin `E-Commerce`
- storefront publik `/toko/[orgSlug]`
- katalog dari `products`
- pembacaan stok dari `inventory_stocks`
- promo dari `organizations.settings.sales_promos`
- keranjang lokal
- order request yang masuk sebagai draft `quotation`

Artinya pondasi awal sudah ada, tetapi belum cukup untuk disebut e-commerce penuh.

## 4. Ringkasan Wave

| Wave | Fokus | Hasil utama |
|---|---|---|
| Wave 0 | Stabilisasi fondasi | MVP aman dipakai dan tidak membingungkan tim |
| Wave 1 | Merchandising katalog | Produk publik benar-benar layak dipajang |
| Wave 2 | Variant & pricing engine | Harga dan SKU per varian menjadi rapi |
| Wave 3 | Checkout & order lifecycle | Keranjang menjadi checkout yang lebih serius |
| Wave 4 | Payment & confirmation | Pembayaran masuk ke alur order |
| Wave 5 | Fulfilment & shipping | Gudang dan pengiriman benar-benar nyambung |
| Wave 6 | Customer portal & retention | Pelanggan punya akun, histori, dan retensi |
| Wave 7 | B2B, multi-store, omnichannel | Siap untuk model bisnis lebih kompleks |
| Wave 8 | Hardening enterprise | Performa, observability, security, dan audit matang |

## 5. Wave 0 — Stabilisasi Fondasi

### Tujuan

Merapikan MVP agar aman dipakai internal sebelum fitur baru ditambah banyak.

### Scope

- pengaturan dasar toko per organisasi
- status publish toko
- status publish produk
- penentuan branch default untuk order publik
- perapian notes dan audit trail quotation dari storefront
- validasi promo lebih tegas
- fallback jika produk sudah tidak aktif saat checkout

### Perubahan data yang disarankan

- tambah settings organisasi untuk e-commerce
- tambah flag publikasi produk, misalnya:
  - `is_published_to_store`
  - `store_sort_order`
  - `store_badges`

Kalau belum mau tambah kolom, minimal perlu ada strategi settings-level yang jelas. Tetapi untuk jangka panjang, kolom eksplisit lebih aman.

### UI admin yang perlu ada

- toggle aktif atau nonaktif toko
- pengaturan judul toko, deskripsi, kontak, jam operasional
- pengaturan branch default
- daftar produk yang tayang vs tidak tayang

### Definition of Done

- toko bisa dimatikan tanpa mematikan modul sales
- produk tidak otomatis tayang semua kalau bisnis belum siap
- order publik selalu masuk ke branch yang jelas
- tim sales bisa membedakan quotation dari e-commerce vs quotation manual
- tidak ada order publik yang gagal hanya karena produk sudah dihapus di tengah jalan tanpa pesan yang jelas

## 6. Wave 1 — Merchandising Katalog

### Tujuan

Membuat storefront tampil seperti toko sungguhan, bukan daftar produk ERP yang dibuka ke publik.

### Scope

- gambar produk utama dan galeri
- deskripsi publik yang lebih rapi
- kategori publik
- koleksi atau campaign
- hero banner per toko
- produk unggulan
- produk baru
- produk promo
- SEO title dan meta description per produk
- search yang lebih baik

### Perubahan data yang disarankan

- tabel atau kolom media produk
- deskripsi publik terpisah dari deskripsi internal bila diperlukan
- slug produk publik
- metadata SEO produk

### UI publik yang perlu ada

- halaman katalog
- halaman detail produk
- filter kategori
- sorting harga, terbaru, terlaris
- badge promo, baru, stok tipis

### UI admin yang perlu ada

- editor sederhana untuk konten toko
- urutan produk dan koleksi
- upload gambar produk
- preview sebelum publish

### Definition of Done

- setiap produk publik punya identitas visual yang layak
- pengguna bisa masuk dari katalog ke detail produk
- admin bisa mengatur produk unggulan tanpa edit kode
- tampilan toko sudah pantas dipakai presentasi ke client

## 7. Wave 2 — Variant dan Pricing Engine

### Tujuan

Menyelesaikan masalah paling penting yang membuat toko belum setara dengan platform modern: varian, atribut, dan harga yang benar.

### Scope

- atribut produk seperti ukuran, warna, bahan
- kombinasi varian
- SKU per varian
- stok per varian
- harga per varian
- compare price / harga coret
- minimum order quantity
- satuan jual khusus
- price list per segmen customer

### Perubahan data yang disarankan

- `product_attributes`
- `product_attribute_values`
- `product_variants`
- relasi variant ke stok
- relasi variant ke sales item
- struktur price list

### Dampak besar yang harus diperhatikan

- `sales_items` harus bisa menunjuk varian, bukan hanya produk induk
- stok harus dibaca per varian
- promo mungkin perlu rule level variant
- laporan sales harus bisa agregasi per produk dan per varian

### Definition of Done

- customer bisa memilih varian dengan benar
- SKU dan stok mengikuti varian yang dipilih
- tim sales dan gudang tidak salah baca item pesanan
- tidak ada lagi kasus satu produk punya banyak pilihan tetapi order masuk tanpa identitas varian

## 8. Wave 3 — Checkout dan Order Lifecycle

### Tujuan

Mengubah keranjang lokal dan form sederhana menjadi checkout yang lebih serius dan lebih dekat ke transaksi nyata.

### Scope

- cart persistence
- update quantity dan remove item yang lebih stabil
- alamat pengiriman dan alamat tagihan
- pilihan pickup vs delivery
- estimasi biaya tambahan
- pajak checkout
- term pembayaran
- draft order yang lebih terstruktur
- order number khusus e-commerce bila perlu
- status order publik

### Status yang disarankan

Contoh status:

- `CART`
- `CHECKOUT_PENDING`
- `AWAITING_PAYMENT`
- `PAID`
- `READY_TO_FULFILL`
- `SHIPPED`
- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

### Catatan desain

Pada titik ini perlu diputuskan apakah:

- tetap memakai `sales` sebagai order utama
- atau membuat tabel `ecommerce_orders` lalu sinkron ke `sales`

Rekomendasi:

- kalau ingin cepat, tetap pakai `sales`
- kalau ingin kuat jangka panjang, mulai siapkan tabel order e-commerce sendiri

### Definition of Done

- customer punya checkout yang lebih lengkap dari sekadar form lead
- status order bisa ditrack
- tim internal bisa membedakan order yang baru checkout, belum bayar, atau siap diproses

## 9. Wave 4 — Payment dan Konfirmasi

### Tujuan

Membuat pelanggan bisa menyelesaikan pembayaran dengan cara yang jelas dan bisa diaudit.

### Scope

- payment gateway
- transfer manual dengan upload bukti
- expiry payment
- webhook pembayaran
- update status order otomatis setelah bayar
- sinkron ke invoice bila model bisnis memerlukannya
- ledger atau audit trail pembayaran

### Metode yang ideal

Minimal dukung:

- transfer bank manual
- VA / virtual account
- QRIS
- payment link

### Area yang harus hati-hati

- idempotency webhook
- double payment
- payment sukses tapi order gagal update
- pembayaran sebagian
- order dibatalkan setelah bayar

### Definition of Done

- pembayaran bisa dikonfirmasi otomatis atau semi otomatis
- order tidak lagi bergantung pada follow-up manual untuk tahu sudah bayar atau belum
- finance dan sales melihat status yang sama

## 10. Wave 5 — Fulfilment, Gudang, dan Shipping

### Tujuan

Membuat order publik benar-benar menggerakkan operasional gudang dan pengiriman.

### Scope

- reservasi stok
- alokasi gudang
- picking list
- packing
- shipment creation
- nomor resi
- tracking status pengiriman
- shipping fee final
- split shipment
- backorder jika stok tidak cukup

### Perubahan penting

- stok tidak cukup hanya dibaca, tetapi harus bisa direserve
- gudang mana yang fulfil order harus punya aturan
- status pengiriman perlu sinkron ke order

### Alur ideal

1. order dibayar
2. stok direserve
3. gudang dipilih
4. picking dibuat
5. packing selesai
6. shipment dikirim
7. nomor resi tersimpan
8. status order berubah

### Definition of Done

- order publik benar-benar sampai ke pengiriman
- gudang tidak perlu proses manual di luar sistem
- customer bisa tahu status kirimnya

## 11. Wave 6 — Customer Portal dan Retention

### Tujuan

Membuat pelanggan kembali lagi, bukan hanya datang sekali lalu hilang.

### Scope

- akun pelanggan
- login customer
- histori order
- reorder
- wishlist
- alamat tersimpan
- tracking order mandiri
- invoice download
- notification center
- review produk
- stok masuk kembali notification
- kupon personal

### Retention features yang bernilai tinggi

- abandoned cart reminder
- rekomendasi produk
- repeat order cepat
- promo khusus pelanggan lama

### Definition of Done

- pelanggan tidak harus selalu chat admin untuk tanya status
- pelanggan bisa belanja ulang dengan lebih cepat
- ada dasar untuk CRM dan retensi jangka panjang

## 12. Wave 7 — B2B, Multi-Store, dan Omnichannel

### Tujuan

Membuka jalan agar e-commerce tidak hanya cocok untuk retail sederhana, tapi juga untuk model bisnis yang lebih kompleks.

### Scope

- customer group
- B2B login
- price list berbeda
- quotation approval untuk customer corporate
- minimum order per customer group
- multi-store dalam satu organisasi
- domain atau subdomain per store
- sinkron POS ke toko online
- konektor marketplace
- katalog berbeda per store

### Contoh use case

- toko retail dan toko grosir dalam satu tenant
- cabang A punya katalog berbeda dari cabang B
- reseller melihat harga khusus
- corporate customer harus minta approval internal dulu

### Definition of Done

- satu organisasi bisa punya lebih dari satu pola jual
- toko online tidak hanya cocok untuk model B2C sederhana
- pricing dan katalog bisa dibedakan tanpa hack manual

## 13. Wave 8 — Hardening Enterprise

### Tujuan

Membuat modul ini kuat di performa, observability, security, dan governance.

### Scope

- audit trail lengkap untuk order, payment, shipment, refund
- observability dan alerting
- dashboard funnel conversion
- performance tuning query katalog dan checkout
- rate limiting API publik
- anti-spam lebih kuat
- backup flow saat gateway gagal
- load test
- test automation end-to-end
- akses role admin e-commerce yang lebih detail
- disaster recovery procedure

### Monitoring yang ideal

- conversion rate
- add-to-cart rate
- checkout started
- checkout completed
- payment success rate
- order cancellation rate
- return rate
- stock-out rate
- abandoned cart rate

### Definition of Done

- sistem tetap stabil saat traffic naik
- error penting cepat terdeteksi
- tim bisa audit kejadian penting tanpa bongkar data mentah
- modul siap dipakai untuk operasi jangka panjang

## 14. Dependency Antar Wave

Urutan dependency yang disarankan:

1. Wave 0 harus selesai sebelum ekspansi besar
2. Wave 1 dan Wave 2 boleh sedikit overlap, tapi variant tidak boleh lompat tanpa keputusan model data
3. Wave 3 harus selesai sebelum payment penuh
4. Wave 4 harus stabil sebelum fulfilment otomatis besar-besaran
5. Wave 5 harus solid sebelum multi-store dan omnichannel
6. Wave 6 dan Wave 7 bisa berjalan paralel sebagian
7. Wave 8 berjalan terus, tapi puncaknya setelah flow bisnis utama matang

## 15. Rekomendasi Prioritas Nyata

Kalau tujuannya adalah cepat punya toko yang benar-benar layak dipakai bisnis, urutan paling masuk akal adalah:

### Prioritas A

- Wave 0
- Wave 1
- Wave 2

Karena tanpa ini, toko masih terasa seperti data ERP yang dibuka ke publik.

### Prioritas B

- Wave 3
- Wave 4
- Wave 5

Karena ini yang mengubah toko dari "katalog dengan form" menjadi "sistem order sungguhan".

### Prioritas C

- Wave 6
- Wave 7
- Wave 8

Karena ini yang membuatnya matang, kuat, dan siap skala.

## 16. Definition of Done Global

Modul e-commerce baru bisa dianggap matang penuh jika semua poin ini terpenuhi:

- katalog publik bisa dikelola admin tanpa edit kode
- produk, gambar, kategori, SEO, dan promo tertata
- varian dan harga per varian berfungsi benar
- checkout punya alamat, pengiriman, pajak, dan pembayaran jelas
- status order bisa dilacak end-to-end
- stok teralokasi dan fulfilment berjalan lewat sistem
- customer punya portal dan histori order
- model B2B dan B2C sama-sama mungkin
- monitoring, audit, test, dan security sudah memadai

## 17. Rekomendasi Dokumen Turunan

Setelah roadmap wave ini disetujui, sebaiknya ada dokumen lanjutan per area:

- `ecommerce-schema-plan.md`
- `ecommerce-admin-sop.md`
- `ecommerce-customer-flow.md`
- `ecommerce-payment-design.md`
- `ecommerce-fulfilment-design.md`
- `ecommerce-test-plan.md`

## 18. Kesimpulan

MVP saat ini sudah membuka jalan yang benar, karena order publik sudah masuk ke ERP. Tetapi untuk sampai ke modul e-commerce yang benar-benar matang, perjalanan yang paling aman adalah membangunnya bertahap per wave.

Kalau dipaksa lompat ke payment, multi-store, atau marketplace sebelum variant, checkout, dan fulfilment rapi, hasilnya akan cepat terlihat canggih tetapi rapuh di operasional.

Roadmap wave ini dibuat supaya pengembangan tetap cepat, tetapi tidak sembrono.
