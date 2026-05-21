# Legacy: Supabase → Railway Migration Scripts

> ⚠️ **ARCHIVED — Tidak digunakan lagi**
>
> Folder ini berisi scripts historical yang dipakai saat migrasi dari Supabase ke Railway PostgreSQL.
> Migrasi sudah **selesai**. Project sekarang **100% pakai Railway**.

## Konteks

Project Nizam dulu menggunakan Supabase Cloud sebagai backend (DB + Auth + Storage).
Pada 2026-04-11, dilakukan migrasi penuh ke Railway PostgreSQL + Internal Auth.

Scripts di folder ini adalah artifact dari proses migrasi tersebut.

## Daftar Scripts

| Script | Fungsi |
|--------|--------|
| `cutover-supabase-to-railway.mjs` | Final cutover script (point-of-no-return) |
| `migrate-supabase-data-to-railway.mjs` | Migrasi data table per table |
| `migrate-supabase-to-local.mjs` | Untuk testing lokal sebelum cutover |
| `sync-supabase-to-railway.mjs` | Incremental sync selama transition period |
| `full-sync-supabase-to-railway.mjs` | Full sync (bukan incremental) |
| `deep-sync-supabase-to-railway.mjs` | Deep validation + sync |
| `sync-supabase-rest-to-railway.mjs` | Sync via Supabase REST API (untuk data tertentu) |
| `check-supabase-railway-parity.mjs` | Validate data integrity antara source & target |
| `apply-sql-file-with-supabase.mjs` | Apply SQL migration via Supabase client |

## Kenapa Disimpan?

1. **Audit Trail** — Jejak proses migrasi untuk akuntabilitas
2. **Reference** — Kalau ada kasus serupa di masa depan
3. **Documentation** — Code adalah dokumentasi paling akurat tentang "apa yang dilakukan saat itu"

## Kenapa Tidak Dihapus?

- Storage cost negligible (text files kecil)
- Risk: kalau dibutuhkan untuk debug data lama → repot kalau sudah dihapus
- Best practice: archive, jangan delete

## Bisa Dihapus Kapan?

**Aman dihapus** setelah:
- ✅ 1 tahun sejak migration (2027-04-11+)
- ✅ Tidak ada audit/compliance yang merujuk ke data Supabase
- ✅ Backup migration audit log tersimpan di tempat lain

## Status Project Saat Ini

- **Database:** Railway PostgreSQL (✅ aktif)
- **Auth:** Internal Auth Nizam-native (✅ aktif)
- **Storage:** Railway S3-compatible (✅ aktif)
- **Supabase Cloud:** ❌ Tidak digunakan, tidak ada koneksi

## Cara Pakai (Jika Diperlukan)

⚠️ **JANGAN jalankan tanpa diskusi tim dulu.**

Scripts ini butuh credentials Supabase Cloud yang sudah **disabled**. Tidak akan jalan tanpa setup ulang.

Kalau ada use case real, kontak tim engineering lead untuk approval.
