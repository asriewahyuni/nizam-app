---
title: "Implementasi E-Commerce"
description: "Dokumen ini menjelaskan apa saja yang sudah benar-benar dibuat untuk modul e-commerce NIZAM, bagaimana alurnya bekerja hari ini, dan batas yang masih perlu dise"
sidebar:
  label: "Implementasi E-Commerce"
---

> Dokumen ini disinkronkan otomatis dari file sumber `ecommerce-implementation.md` di root project docs.

Dokumen ini menjelaskan apa saja yang sudah benar-benar dibuat untuk modul e-commerce NIZAM, bagaimana alurnya bekerja hari ini, dan batas yang masih perlu disempurnakan sebelum masuk ke skala yang lebih besar.

## 1. Tujuan Implementasi Saat Ini

Fondasi e-commerce saat ini ditujukan untuk:

- membuka storefront publik per store
- mendukung multi-store per brand atau lini bisnis
- memakai katalog master yang sama tetapi bisa punya tampilan dan harga berbeda per store
- menerima guest checkout
- menerima pembayaran transfer manual dengan upload bukti
- membuat order e-commerce lebih dulu, lalu sinkron ke ERP setelah pembayaran divalidasi
- memberi tim internal dashboard untuk mengatur store, katalog, theme, dan review order

Target praktisnya adalah **pilot jual untuk 1 sampai 3 store**, bukan enterprise scale penuh.

## 2. Ringkasan Fitur Yang Sudah Jadi

### Admin dan operasi

- Menu dashboard `E-Commerce` sudah aktif.
- Admin bisa membuat store baru.
- Admin bisa mengatur domain store.
- Admin bisa mengatur zona dan tarif ongkir.
- Admin bisa mengatur katalog publik per store.
- Admin bisa mengatur varian produk publik.
- Admin bisa upload asset theme.
- Admin bisa edit theme visual untuk `beranda`, `koleksi`, dan `detail produk`.
- Admin bisa memakai alur `Draft → Preview → Publish`.
- Admin bisa review bukti pembayaran.
- Admin bisa approve, reject, dan retry sinkron ERP.
- Admin bisa melihat readiness gate store dan observasi order dasar.

### Storefront publik

- Route publik utama: `/toko/[orgSlug]/[storeSlug]`
- Halaman koleksi: `/toko/[orgSlug]/[storeSlug]/koleksi`
- Halaman detail produk: `/toko/[orgSlug]/[storeSlug]/produk/[productSlug]`
- Halaman status order publik: `/toko/[orgSlug]/[storeSlug]/pesanan/[orderNumber]?token=...`
- Storefront mendukung pencarian katalog dasar.
- Detail produk mendukung galeri fallback, pilihan varian, dan indikator stok.
- Checkout memakai guest-first flow.
- Setelah checkout berhasil, pelanggan diarahkan ke halaman status order publik.
- Pelanggan bisa membuka kembali order lewat link akses aman.
- Pelanggan bisa upload ulang bukti pembayaran selama status order masih mengizinkan.

### Back-end transaksi

- Order e-commerce disimpan terpisah dari tabel `sales`.
- Checkout menyimpan snapshot harga, ongkir, item, dan theme checkout.
- Upload bukti pembayaran masuk ke tabel pembayaran order.
- Saat admin approve pembayaran:
  - sistem cek stok lagi
  - sistem reserve stok
  - sistem buat `sales ORDERED` di ERP
  - sistem buat `sales_items`
  - sistem catat pembayaran ERP
- Jika sinkron ERP gagal, order masuk status exception dan bisa di-retry dari dashboard.

## 3. Route Penting

### Route admin

- `/ecommerce`

### Route publik

- `/toko/[orgSlug]/[storeSlug]`
- `/toko/[orgSlug]/[storeSlug]/koleksi`
- `/toko/[orgSlug]/[storeSlug]/produk/[productSlug]`
- `/toko/[orgSlug]/[storeSlug]/pesanan/[orderNumber]`

### API route

- `POST /api/ecommerce/checkout`
- `POST /api/ecommerce/orders/[orderNumber]/payment-proof`
- `GET /api/ecommerce/resolve-domain`

## 4. File Inti Yang Perlu Diketahui

### UI admin

- `app/(dashboard)/ecommerce/page.tsx`
- `app/(dashboard)/ecommerce/EcommerceAdminClient.tsx`
- `app/(dashboard)/ecommerce/ThemeHomepageEditor.tsx`

### UI publik

- `app/toko/[orgSlug]/[storeSlug]/page.tsx`
- `app/toko/[orgSlug]/[storeSlug]/koleksi/page.tsx`
- `app/toko/[orgSlug]/[storeSlug]/produk/[productSlug]/page.tsx`
- `app/toko/[orgSlug]/[storeSlug]/pesanan/[orderNumber]/page.tsx`
- `app/toko/[orgSlug]/[storeSlug]/pesanan/[orderNumber]/OrderStatusClient.tsx`
- `app/toko/[orgSlug]/[storeSlug]/StorefrontClient.tsx`

### API dan domain logic

- `app/api/ecommerce/checkout/route.ts`
- `app/api/ecommerce/orders/[orderNumber]/payment-proof/route.ts`
- `modules/ecommerce/actions/ecommerce.actions.ts`
- `modules/ecommerce/lib/ecommerce.ts`
- `modules/ecommerce/lib/ecommerce.server.ts`

### Database

- `supabase/migrations/1237_ecommerce_theme_builder_foundation.sql`
- `supabase/migrations/1238_ecommerce_public_order_access_and_hardening.sql`

## 5. Alur Bisnis Yang Sudah Jalan

### A. Setup store

1. Admin membuat store.
2. Admin memilih branch, warehouse, dan rekening penerima.
3. Admin menyiapkan transfer instruction.
4. Admin menyiapkan zona ongkir dan tarif.
5. Admin menyiapkan katalog publik.
6. Admin menyiapkan theme lalu publish.

### B. Pengalaman pembeli

1. Pengunjung membuka storefront store.
2. Pengunjung melihat katalog atau detail produk.
3. Pengunjung menambahkan produk ke keranjang.
4. Pengunjung mengisi alamat dan data checkout.
5. Sistem mencocokkan ongkir dari alamat.
6. Sistem membuat order e-commerce.
7. Pengunjung diarahkan ke halaman status order.
8. Pengunjung transfer manual lalu upload bukti bayar.

### C. Review pembayaran

1. Admin membuka dashboard e-commerce.
2. Admin melihat order yang menunggu review.
3. Admin melihat bukti bayar dan catatan order.
4. Admin memilih:
   - approve
   - reject
   - retry ERP bila ada exception

### D. Sinkron ERP setelah approve

1. Sistem lock order dan pembayaran.
2. Sistem cek stok lagi.
3. Sistem cari atau buat contact customer.
4. Sistem buat sales order ERP dengan status `ORDERED`.
5. Sistem buat item penjualan ERP.
6. Sistem reserve stok di tabel e-commerce reservation.
7. Sistem post pembayaran ke ERP.
8. Sistem update status order menjadi siap dipenuhi.

## 6. Data dan Tabel Penting

### Store dan storefront

- `stores`
- `store_domains`
- `store_settings`
- `store_shipping_zones`
- `store_shipping_rates`

### Katalog dan theme

- `store_products`
- `product_variants`
- `store_variant_overrides`
- `ecommerce_product_media`
- `store_theme_versions`
- `store_theme_assets`

### Order dan pembayaran

- `ecommerce_orders`
- `ecommerce_order_addresses`
- `ecommerce_order_items`
- `ecommerce_order_payments`
- `ecommerce_order_events`
- `ecommerce_inventory_reservations`
- `ecommerce_public_request_logs`

## 7. Hardening Yang Sudah Masuk

- checkout memakai `idempotency key` agar klik ganda tidak mudah membuat order dobel
- upload bukti bayar bisa memakai `client upload key`
- halaman order publik memakai token akses aman
- token akses order punya masa berlaku
- rate limit ringan sudah disiapkan untuk checkout dan upload bukti
- draft theme preview tetap memakai renderer storefront yang sama dengan halaman publik
- dashboard admin punya status sinkron ERP, error terakhir, dan riwayat event

## 8. Yang Sudah Dimigrasikan Ke PostgreSQL

Saat dokumen ini dibuat, migrasi berikut sudah diterapkan ke database runtime:

- `1237_ecommerce_theme_builder_foundation.sql`
- `1238_ecommerce_public_order_access_and_hardening.sql`

Artinya tabel dasar e-commerce, token akses order publik, field idempotency, dan log request publik sudah tersedia di PostgreSQL.

## 9. Batas Yang Masih Ada Hari Ini

Walau fondasinya sudah kuat, ada beberapa hal yang masih sengaja ditahan:

- belum ada payment gateway
- belum ada ongkir kurir real-time
- belum ada login customer atau customer portal penuh
- editor visual baru mencakup `beranda`, `koleksi`, dan `detail produk`, belum drag-and-drop bebas
- bukti bayar masih direview manual
- observability saat ini masih level dashboard dasar, belum monitoring penuh
- retry ERP sudah ada, tetapi resolusi kasus ekstrem masih butuh disiplin operasional

## 10. Cara Verifikasi Dasar Setelah Deploy

Minimal lakukan pengecekan ini:

1. Buka `/ecommerce` dan pastikan store bisa dipilih.
2. Pastikan ada theme draft dan published.
3. Buka storefront publik store.
4. Coba checkout dengan 1 produk.
5. Pastikan diarahkan ke halaman status order publik.
6. Upload bukti pembayaran dari halaman order publik.
7. Review dari dashboard admin.
8. Approve pembayaran.
9. Pastikan order berubah ke `READY_TO_FULFILL` dan `SYNCED`.

## 11. Dokumen Lanjutan

Untuk prioritas kerja setelah kondisi saat ini, lanjut ke:

- [`ecommerce-next-steps.md`](./ecommerce-next-steps.md)
