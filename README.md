# NIZAM ERP

Dokumentasi ini telah diaudit ulang berdasarkan kode aktual pada **29 Maret 2026**.

NIZAM adalah ERP multi-tenant berbasis Next.js + Supabase untuk operasi bisnis Indonesia: akuntansi, kas/bank, purchasing, sales, inventory, HRIS/payroll, manufaktur, fleet, service order, billing SaaS, dan modul pelengkap seperti zakat, audit, BSC, serta demo onboarding.

## Snapshot Repo Saat Ini

- `55` halaman App Router (`app/**/page.tsx`)
- `40` client page/component utama (`*Client.tsx`)
- `41` server action files (`modules/**/actions/*.ts`)
- `127` file migrasi SQL di `supabase/migrations/`
- `7` file test Vitest

## Stack Aktual

| Area | Teknologi |
|---|---|
| Frontend | Next.js `16.2.1`, React `19.2.4`, App Router |
| Styling | Tailwind CSS `4.2.2`, Framer Motion |
| Backend | Supabase SSR + PostgreSQL |
| Auth | Supabase Auth + RBAC custom + RLS |
| Reporting | ExcelJS, Recharts |
| AI | Google Gemini / AI Studio (`GOOGLE_AI_STUDIO_KEY`) |
| Email | Resend |
| Testing | Vitest 4 |

## Baca Dokumentasi Lengkap

Dokumentasi lengkap proyek ada di [DOCUMENTATION.md](./DOCUMENTATION.md).

Dokumen operasional tambahan:

- [DOKUMENTASI_OPEN_API_NIZAM.md](./DOKUMENTASI_OPEN_API_NIZAM.md) untuk panduan fitur Open API, API key, endpoint publik, webhook, dan spesifikasi `/api/openapi`.
- [PLAYBOOK_MIGRASI_KE_NIZAM.md](./PLAYBOOK_MIGRASI_KE_NIZAM.md) untuk panduan onboarding user pindahan dari Excel atau aplikasi lain.
- [CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md](./CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md) untuk checklist internal tim onboarding saat menangani migrasi client.
- [RAILWAY_DECOUPLING_PLAN.md](./RAILWAY_DECOUPLING_PLAN.md) untuk roadmap migrasi ke Railway dan pelepasan dependency runtime Supabase.
- [templates/migrasi/README.md](./templates/migrasi/README.md) untuk paket template CSV migrasi yang bisa dibagikan ke client.
- [templates/migrasi/NIZAM_Migration_Template.xlsx](./templates/migrasi/NIZAM_Migration_Template.xlsx) untuk workbook Excel multi-sheet yang siap diberikan ke client.

Isi utamanya mencakup:

- arsitektur aplikasi dan struktur folder
- auth, organisasi, RLS, RBAC, dan module gating
- peta route yang aktif saat ini
- ringkasan lengkap modul bisnis dan server actions
- peta migrasi database dan storage bucket
- daftar environment variable aktual
- temuan audit dokumentasi dan update dibanding README lama

## Setup Singkat

1. Gunakan Node.js `>=20`.
2. Salin `.env.local.example` menjadi `.env.local`.
3. Isi kredensial Supabase dan variabel opsional yang diperlukan.
4. Jalankan migrasi Supabase sesuai urutan file di `supabase/migrations/`, atau gunakan Supabase CLI.
5. Jalankan:

```bash
npm install
npm run dev
```

Perintah lain:

```bash
npm run test
npm run build
npm run supabase:start
npm run supabase:stop
npm run supabase:status
npm run supabase:db:reset
npm run supabase:migrate-local-data
npm run db:railway:sync
npm run db:railway:sync:apply
npm run db:railway:data:sync
npm run db:railway:data:sync:apply
npm run db:railway:parity
npm run db:railway:readiness
npm run db:railway:cutover
npm run db:railway:cutover:apply
```

### Sinkronisasi Supabase -> Railway (Staging/Prod)

Gunakan flow ini supaya schema Railway tetap mutakhir mengikuti migration di `supabase/migrations`.

1. Cek parity dulu:
   ```bash
   npm run db:railway:parity
   ```
2. Simulasikan migration (aman, tidak apply):
   ```bash
   npm run db:railway:sync
   ```
3. Jika hasil dry-run sesuai, apply ke Railway:
   ```bash
   npm run db:railway:sync:apply
   ```

Catatan:
- `db:railway:sync` default **dry-run** agar tidak ada perubahan tidak sengaja.
- Script otomatis mencoba ambil DB URL dari Railway CLI (`Postgres` service).
- Untuk source Supabase via linked project, pastikan `supabase login`/`SUPABASE_ACCESS_TOKEN` tersedia.

### Sinkronisasi Data Supabase -> Railway

Gunakan flow ini untuk meng-copy isi tabel SQL setelah schema Railway siap.

1. Simulasikan dump (aman, tidak apply):
   ```bash
   npm run db:railway:data:sync
   ```
2. Jika dry-run sesuai, apply ke Railway:
   ```bash
   npm run db:railway:data:sync:apply
   ```

Catatan:
- Script ini fokus migrasi **data tabel SQL** (default schema `public`).
- Script ini **tidak** memindahkan Supabase Auth users dan Supabase Storage objects.
- Untuk source linked Supabase, pastikan `supabase login`/`SUPABASE_ACCESS_TOKEN` tersedia.
- Untuk override source DB URL, gunakan `SUPABASE_SOURCE_DB_URL` atau `--source-db-url`.

### Backfill `auth.users` di Railway

Jika hasil sinkronisasi data membuat relasi `user_id` ke `auth.users` kosong/orphan, jalankan:

```bash
npm run db:railway:auth:backfill
npm run db:railway:auth:backfill:apply
```

Command ini membuat/menyelaraskan baris `auth.users` dari data `public.org_members` dan `public.employees` agar FK tetap valid di Railway.

### Bootstrap `internal_auth_users` di Railway

Untuk menyiapkan akun login mode `AUTH_PROVIDER=internal` dari data user existing:

```bash
npm run db:railway:internal-auth:bootstrap
INTERNAL_AUTH_BOOTSTRAP_PASSWORD='temporary-password' npm run db:railway:internal-auth:bootstrap:apply
```

Catatan:
- `legacy_user_id` akan dipetakan ke `auth.users.id` agar kompatibel dengan data lama.
- `--apply` butuh password sementara (`INTERNAL_AUTH_BOOTSTRAP_PASSWORD` atau `--password`).

### Cutover SQL/Auth Supabase -> Railway

Jika ingin menjalankan jalur cutover database dan auth dalam satu command, gunakan:

```bash
npm run db:railway:cutover
INTERNAL_AUTH_BOOTSTRAP_PASSWORD='temporary-password' npm run db:railway:cutover:apply
```

Command ini mengorkestrasi:
- schema sync ke Railway
- public SQL data sync dari Supabase ke Railway
- backfill `auth.users` di Railway
- bootstrap `public.internal_auth_users`
- readiness check SQL/auth antara Supabase dan Railway

Untuk verifikasi tanpa write, gunakan:

```bash
npm run db:railway:readiness
```

Catatan:
- flow ini fokus ke SQL data + auth di Railway
- Supabase Storage objects masih perlu dipindah terpisah sebelum runtime benar-benar lepas dari Supabase

### Health Check Railway DB (Direct)

Untuk verifikasi koneksi Postgres direct dari runtime app (tanpa Supabase client), gunakan endpoint:

```bash
GET /api/healthz-db
```

Endpoint ini membaca `DATABASE_URL`/`RAILWAY_DATABASE_URL`/`DATABASE_PUBLIC_URL`.

## Mode Auth Runtime

- `AUTH_PROVIDER=supabase` (default): login tetap memakai Supabase Auth.
- `AUTH_PROVIDER=internal`: login membaca tabel `public.internal_auth_users` + `public.internal_auth_sessions`.
- Saat mode `internal`, isi `INTERNAL_AUTH_SESSION_SECRET`.

Catatan: mode `internal` saat ini baru fondasi untuk cutover bertahap dan belum menutup semua flow lanjutan (misalnya login-as tenant owner dan reset password email).

## Mode Supabase Saat Development

Seleksi target Supabase dipusatkan di `lib/supabase/config.ts`.

- Jika `NEXT_PUBLIC_SUPABASE_TARGET=local`, app memakai `NEXT_PUBLIC_SUPABASE_LOCAL_URL`, `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY`, dan `SUPABASE_LOCAL_SERVICE_ROLE_KEY`.
- Jika `NEXT_PUBLIC_SUPABASE_TARGET` kosong atau bernilai selain `local`, app memakai `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.

Artinya Anda bisa menyimpan kredensial remote dan local sekaligus di `.env.local`, lalu cukup switch lewat satu flag dan restart dev server.

### Jalankan App Lokal Dengan Supabase Online

Gunakan mode ini jika ingin develop di mesin lokal tetapi database/auth/storage tetap memakai project Supabase online.

1. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`.
2. Pastikan `NEXT_PUBLIC_SUPABASE_TARGET` kosong, dihapus, atau bukan `local`.
3. Jalankan `npm run dev`.

### Jalankan App Lokal Dengan Supabase Local

Gunakan mode ini jika ingin test penuh tanpa menyentuh project online.

1. Jalankan `npm run supabase:start`.
2. Ambil `API URL`, `anon key`, dan `service_role key` dari `npm run supabase:status`.
3. Isi `NEXT_PUBLIC_SUPABASE_LOCAL_URL`, `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY`, dan `SUPABASE_LOCAL_SERVICE_ROLE_KEY` di `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_TARGET=local`.
5. Jalankan `npm run dev`.

Jika butuh database lokal yang bersih, jalankan `npm run supabase:db:reset`. Skema lokal akan dibangun dari SQL di `supabase/migrations/`.

### Clone Data Online Ke Supabase Local

Gunakan ini jika Anda ingin app lokal tetap memakai Supabase local, tetapi isi data awalnya berasal dari project online.

1. Pastikan kredensial remote tetap terisi: `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
2. Pastikan Supabase local sudah running dan blok `NEXT_PUBLIC_SUPABASE_LOCAL_URL`, `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY` sudah benar.
3. Jalankan `npm run supabase:migrate-local-data`.
4. Jalankan app dengan `NEXT_PUBLIC_SUPABASE_TARGET=local`.

Catatan penting:

- Script migrasi meng-copy auth users, public tables, dan storage objects ke stack local.
- Password user lokal hasil clone di-set ulang menjadi `LocalTest123!`.
- Jika Anda mengubah target Supabase, restart `npm run dev` agar process Next.js membaca env terbaru.

### Cara Switch Cepat

#### Dari Supabase Local ke Supabase Online

1. Ubah `NEXT_PUBLIC_SUPABASE_TARGET` menjadi kosong, hapus, atau isi nilai selain `local`.
2. Pastikan variabel remote (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) tetap valid.
3. Restart `npm run dev`.

Stack Supabase local boleh tetap hidup; app tidak akan memakainya selama target bukan `local`.

#### Dari Supabase Online ke Supabase Local

1. Pastikan `npm run supabase:start` sudah berjalan.
2. Pastikan variabel local (`NEXT_PUBLIC_SUPABASE_LOCAL_URL`, `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY`) valid.
3. Set `NEXT_PUBLIC_SUPABASE_TARGET=local`.
4. Restart `npm run dev`.

## Update Penting Dibanding Dokumentasi Sebelumnya

- Stack frontend sudah naik ke **Next.js 16** dan **React 19**, bukan Next.js 15.
- Runtime minimum sekarang **Node.js 20+**, bukan 18+.
- Proteksi request memakai **`proxy.ts`** (terminologi Next.js 16), bukan penyebutan middleware lama.
- Migrasi aktif sudah jauh lebih panjang: **127 file SQL** dengan titik terbaru sampai `1085_sync_official_saas_module_catalog.sql`.
- Fitur yang kini jelas hadir di kode: billing SaaS, voucher ABS, demo session, invitation token organisasi, avatar karyawan, service orders, fleet hardening, barcode foundation, warehouse bins, dan module activation SaaS.

## Catatan

README ini sengaja dibuat ringkas sebagai pintu masuk. Untuk audit teknis lengkap, daftar route, modul, action, migrasi, dan temuan implementasi, lihat [DOCUMENTATION.md](./DOCUMENTATION.md).
