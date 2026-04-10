# Railway Decoupling Plan (Tanpa Ketergantungan Supabase)

Dokumen ini adalah jalur eksekusi bertahap untuk pindah dari Supabase ke Railway Postgres dan menghapus dependency Supabase dari runtime app.

## Status Saat Ini

1. Schema migration ke Railway sudah didukung (`db:railway:sync`).
2. Data table SQL ke Railway sudah didukung (`db:railway:data:sync`).
3. Jalur orkestrasi cutover SQL/auth sudah didukung (`db:railway:cutover` + `db:railway:readiness`).
3. App runtime masih bergantung pada:
   - Supabase Auth (`auth.*` di banyak server action)
   - Supabase Storage (`storage.from(...)`)
   - Supabase JS SDK (`@supabase/ssr`, `@supabase/supabase-js`)

## Fase 1: Database Stabil Di Railway

1. Terapkan semua migration ke Railway:
   - `npm run db:railway:sync`
   - `npm run db:railway:sync:apply`
2. Migrasikan data SQL:
   - `npm run db:railway:data:sync`
   - `npm run db:railway:data:sync:apply`
   - atau jalankan orkestrasi:
     - `npm run db:railway:cutover`
     - `INTERNAL_AUTH_BOOTSTRAP_PASSWORD=... npm run db:railway:cutover:apply`
3. Verifikasi parity schema:
   - `npm run db:railway:parity`
4. Verifikasi readiness SQL/auth:
   - `npm run db:railway:readiness`
5. Tambahkan jalur koneksi Postgres langsung di aplikasi (non-breaking):
   - `lib/db/postgres.ts`
   - `GET /api/healthz-db`

Status fase 1 saat ini:
1. Schema sync: selesai.
2. Data table SQL sync: selesai.
3. Koneksi langsung ke Railway dari app (health endpoint): selesai.
4. Runtime business flow masih memakai Supabase client: belum (masuk fase 2).

## Fase 2: Lepas Supabase Auth

1. Tentukan provider auth baru:
   - NextAuth/Auth.js + DB session, atau
   - JWT/session kustom berbasis tabel `users`/`sessions`.
2. Buat tabel auth internal di Railway (`users`, `sessions`, `password_resets`, dll).
3. Refactor `modules/auth/actions/auth.actions.ts` agar tidak memanggil `supabase.auth`.
4. Refactor middleware auth (`lib/supabase/middleware.ts`) ke middleware auth internal.
5. Migrasi akun lama (mapping `auth.users` ke tabel auth internal).

## Fase 3: Lepas Supabase Storage

1. Pilih object storage pengganti (S3-compatible).
2. Ganti call `supabase.storage` dengan adapter storage internal.
3. Migrasi bucket/object dari Supabase Storage ke storage baru.
4. Update URL publik/file signing di fitur billing dan brand assets.

## Fase 4: Hapus Paket Dan Konfigurasi Supabase

1. Hapus dependency:
   - `@supabase/ssr`
   - `@supabase/supabase-js`
2. Hapus utilitas `lib/supabase/*` setelah semua callsite dipindah.
3. Bersihkan env:
   - `NEXT_PUBLIC_SUPABASE_*`
   - `SUPABASE_*`
4. Tutup jalur script khusus Supabase yang sudah tidak dipakai.

## Catatan Risiko

1. Migrasi auth adalah bagian paling kritis (session/login/reset password).
2. Banyak server action mengandalkan RLS/RPC Supabase; perlu pengganti permission guard di app/db layer.
3. Migration harus bertahap per modul agar tidak memutus operasional.
