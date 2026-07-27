# Migrasi & Sinkronisasi WordPress/Sejoli → Nizam (CORe ISEC)

Situs WordPress lama (`ssh://ubuntu@43.133.147.191/var/www/coreisec.id`) **masih aktif**
menerima order dan progres belajar baru selama masa transisi ke Nizam. Data yang sudah
di-import (order, member, enrollment, completion) adalah snapshot per tanggal import
terakhir — bukan live sync. Sampai ada cron otomatis terpasang (belum diimplementasikan),
re-sync harus dijalankan manual dengan urutan di bawah.

## Prosedur re-sync manual

Jalankan berurutan dari root repo. Setiap langkah "check" aman dijalankan kapan saja
(read-only/dry-run); jangan jalankan langkah "apply" tanpa membaca hasil dry-run-nya
lebih dulu.

```bash
# 1. Export snapshot terbaru dari WordPress via SSH (read-only di sisi WP)
npm run coreisec:export -- --org-id=<org_id> --store-id=<store_id>

# 2. Validasi snapshot yang baru diexport
npm run coreisec:snapshot:validate -- output/coreisec/<snapshot-id>

# 3. Cek perubahan mapping legacy-id → target-id (dry-run), baru apply jika aman
npm run coreisec:mapping:check -- output/coreisec/<snapshot-id>
npm run coreisec:mapping:apply -- output/coreisec/<snapshot-id>

# 4. Dry-run full import, baca ringkasan diff-nya sebelum lanjut
npm run coreisec:import:check -- output/coreisec/<snapshot-id>

# 5. Apply ke database produksi (hanya setelah dry-run direview)
npm run coreisec:import:apply -- output/coreisec/<snapshot-id>

# 6. Salin media baru (gambar/sertifikat) ke S3 jika ada
npm run coreisec:media:copy -- output/coreisec/<snapshot-id>

# 7. Cek kesiapan / konsistensi data pasca-import
npm run coreisec:readiness
```

Import bersifat idempotent (upsert berbasis `external_source` + `external_id`), jadi
menjalankan ulang snapshot yang sama tidak akan menduplikasi data.

## Yang perlu diperhatikan setiap re-sync

- **Order historis** masuk ke `commerce_historical_order_archives` (bukan
  `ecommerce_orders`) secara sengaja, supaya tidak memicu ulang jurnal akuntansi/kas
  untuk transaksi lama yang sudah selesai di masa lalu. Halaman
  `/lms/admin/penjualan/transaksi` menggabungkan keduanya secara read-only untuk
  ditampilkan (lihat `modules/edu/lib/lms-sales.server.ts`).
- **Completion asli** dari `wp_sejolisa_lms_complete_course` diimport sebagai
  `learning_lesson_progress` (status `COMPLETED`), lalu di-rollup otomatis ke
  `learning_enrollments.completed_at` saat proses import (lihat `importProgress` di
  `import-handlers.ts`). Tidak perlu langkah backfill manual lagi untuk snapshot baru.
- **Nomor HP** diambil dari usermeta `_phone` (bukan `phone`) — lihat
  `wordpress-export.php` fungsi export user.
- Level gamifikasi member (`/lms/admin/members`) dihitung dari
  `enrolled_count + completed_count * 2`, supaya completion asli menambah nilai tapi
  tidak pernah menurunkan level dibanding sebelumnya.

## Jadwal otomatis (belum diimplementasikan)

Rekomendasi ke depan: buat cron job di level infra server (mis. Railway cron / systemd
timer) yang menjalankan langkah 1–7 di atas secara berkala (mis. harian), bukan
mengandalkan sesi Claude Code untuk memicunya. Keputusan otomatisasi ini masih tertunda
per diskusi 2026-07-28 — dilakukan manual dulu sampai ada keputusan lanjutan.
