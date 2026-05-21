# Developer Guide

Dokumen ini membantu developer menjalankan project, memahami kebiasaan kerja repo, dan tahu harus mulai dari mana saat mengerjakan fitur atau bugfix.

> ⚠️ **Sebelum Lu Mulai:** Project ini TIDAK pakai Supabase Cloud.
> Beberapa nama folder/file masih pakai kata "supabase" karena legacy compatibility layer.
> Realitanya semua query ke **Railway PostgreSQL**. Detail di [`lib/supabase/README.md`](../lib/supabase/README.md).

## 1. Prasyarat

- Node.js `20.19.x`
- npm
- Akses ke environment project
- Akses database yang sesuai dengan mode kerja tim

Versi Node dikunci di [`package.json`](/Users/manbook/nizam-app/package.json:1) melalui field `engines`.

## 2. Setup Lokal

### Install dependency

```bash
npm install
```

### Siapkan environment

```bash
cp .env.local.example .env.local
```

Aturan praktis file env:

- `.env` = baseline atau referensi default project
- `.env.local` = override milik mesin Anda sendiri
- untuk pindah mode lokal ↔ Railway, biasanya yang Anda edit adalah `.env.local`
- jika nama variabel yang sama ada di keduanya, anggap `.env.local` yang menang saat kerja lokal

Variabel penting yang perlu dipahami:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Koneksi utama ke PostgreSQL runtime |
| `RAILWAY_DATABASE_URL` | Alternatif koneksi PostgreSQL Railway |
| `DATABASE_PUBLIC_URL` | Fallback koneksi DB |
| `AUTH_PROVIDER` | Mode auth aktif: `supabase` atau `internal` |
| `INTERNAL_AUTH_SESSION_SECRET` | Wajib saat memakai internal auth |
| `NEXT_PUBLIC_SUPABASE_*` | Variabel compatibility/legacy untuk flow yang masih memerlukannya |
| `SUPABASE_SERVICE_ROLE_KEY` | Dipakai sebagian script atau flow admin lama |

Catatan penting:

- [`.env.local.example`](/Users/manbook/nizam-app/.env.local.example:1) adalah titik awal yang baik, tetapi belum selalu merepresentasikan seluruh kebutuhan mode PostgreSQL native terbaru.
- Runtime data access utama saat ini membaca PostgreSQL native.
- Urutan env database runtime adalah `DATABASE_URL` lalu `RAILWAY_DATABASE_URL` lalu `DATABASE_PUBLIC_URL`.
- Nama file `lib/supabase/*` masih banyak dipakai sebagai compatibility layer.
- Jangan menghapus env Supabase tanpa memastikan flow yang Anda sentuh memang tidak lagi membutuhkannya.
- Jika perlu pindah mode lokal ↔ Railway, baca [`database-mode-switching.md`](./database-mode-switching.md).

## 3. Menjalankan Project

### Development

```bash
npm run dev
```

### Build production

```bash
npm run build
```

### Run standalone server

```bash
npm run start
```

## 4. Script Yang Paling Sering Dipakai

| Command | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan app untuk development |
| `npm run dev:webpack` | Menjalankan app tanpa Turbopack |
| `npm run build` | Build production |
| `npm run lint` | Validasi lint |
| `npm run test` | Menjalankan semua test |
| `npm run test:erp` | Menjalankan subset test ERP inti |
| `npm run test:coverage` | Menjalankan test dengan coverage |
| `npm run supabase:start` | Menjalankan Supabase local |
| `npm run supabase:db:reset` | Reset database Supabase local |
| `npm run db:runtime:show` | Menampilkan database runtime aktif yang benar-benar dipakai aplikasi |
| `npm run db:clone:local` | Clone penuh database online ke PostgreSQL lokal biasa |
| `npm run db:railway:sync` | Simulasi sinkronisasi schema |
| `npm run db:railway:data:sync` | Simulasi sinkronisasi data |
| `npm run db:railway:readiness` | Pemeriksaan kesiapan cutover |

## 5. Struktur Kerja Codebase

### `app/`

Berisi route Next.js App Router.

- `app/(auth)`: login, register, forgot password, join invitation
- `app/(dashboard)`: seluruh halaman modul yang memerlukan autentikasi
- `app/api`: route handlers
- `app/demo`, `app/onboarding`, `app/sp`: flow publik dan onboarding

### `modules/`

Berisi business logic utama yang dipisah per domain. Umumnya pola file-nya adalah:

- `modules/<domain>/actions/*.ts`: server actions
- `modules/<domain>/lib/*.ts`: helper domain

### `lib/`

Berisi utilitas lintas modul:

- `lib/db`: koneksi PostgreSQL native
- `lib/supabase`: compatibility layer, middleware, config
- `lib/auth`: provider dan internal auth utilities
- `lib/email`: integrasi email
- `lib/saas`: katalog modul dan helper SaaS

### `supabase/`

Masih dipakai untuk migration SQL dan artefak transisional. Walaupun nama folder ini legacy, isi SQL migration-nya tetap penting untuk memahami evolusi schema.

## 6. Cara Membaca Alur Fitur

Untuk memahami satu fitur dengan cepat, biasanya urutannya seperti ini:

1. Buka halaman di `app/` yang merender fitur.
2. Cari client component terkait, misalnya `SomethingClient.tsx`.
3. Lihat server action yang dipanggil dari `modules/<domain>/actions/`.
4. Cek helper domain di `modules/<domain>/lib/` atau `lib/`.
5. Jika menyentuh auth, tenant, atau ACL, cek `app/(dashboard)/layout.tsx`, `proxy.ts`, dan `lib/supabase/middleware.ts`.

## 7. Konvensi Implementasi

- Gunakan TypeScript yang ketat dan hindari `any` jika masih memungkinkan.
- Letakkan business logic domain di `modules/`, bukan menumpuk di route file.
- Anggap `app/(dashboard)/layout.tsx` sebagai guard utama untuk session, active org, module gating, dan sebagian permission flow.
- Pastikan query dan mutasi tetap mempertahankan isolasi tenant per organisasi.
- Jika mengubah flow auth atau session, verifikasi mode `internal` dan `supabase` bila keduanya masih didukung.

## 8. Testing dan Verifikasi

Sebelum menyelesaikan perubahan, minimal lakukan salah satu verifikasi yang relevan:

- `npm run test`
- `npm run test:erp`
- `npm run build`

Repo ini menggunakan Vitest melalui [`vitest.config.ts`](/Users/manbook/nizam-app/vitest.config.ts:1). Build Next.js dikonfigurasi `standalone` di [`next.config.mjs`](/Users/manbook/nizam-app/next.config.mjs:1).

## 9. Alur Database dan Auth

Realita codebase saat ini:

- Query runtime utama membaca PostgreSQL via [`lib/db/postgres.ts`](/Users/manbook/nizam-app/lib/db/postgres.ts:1).
- Banyak action masih memanggil `createClient()` dari [`lib/supabase/server.ts`](/Users/manbook/nizam-app/lib/supabase/server.ts:1), tetapi implementasinya sudah menjadi adapter ke PostgreSQL native.
- Middleware auth masih mempertimbangkan `AUTH_PROVIDER` melalui [`lib/auth/provider.ts`](/Users/manbook/nizam-app/lib/auth/provider.ts:1).

Implikasinya:

- Nama helper tidak selalu sama dengan backend yang benar-benar dipakai.
- Saat debugging, cek implementasi helper, bukan hanya nama filenya.
- Perubahan di layer adapter berpotensi berdampak luas ke banyak modul sekaligus.

## 10. Troubleshooting Singkat

### Error koneksi database

Periksa nilai:

- `DATABASE_URL`
- `RAILWAY_DATABASE_URL`
- `DATABASE_PUBLIC_URL`
- `npm run db:runtime:show`

Error ini biasanya berasal dari [`lib/db/postgres.ts`](/Users/manbook/nizam-app/lib/db/postgres.ts:1).

### Login berperilaku berbeda antar environment

Periksa:

- `AUTH_PROVIDER`
- cookie session internal
- env Supabase jika environment masih memakai flow kompatibilitas

### Route dashboard me-redirect terus

Tinjau:

- [`app/(dashboard)/layout.tsx`](/Users/manbook/nizam-app/app/(dashboard)/layout.tsx:1)
- [`proxy.ts`](/Users/manbook/nizam-app/proxy.ts:1)
- [`lib/supabase/middleware.ts`](/Users/manbook/nizam-app/lib/supabase/middleware.ts:1)

## 11. Rekomendasi Onboarding Developer Baru

Urutan belajar yang paling efisien:

1. Jalankan aplikasi secara lokal.
2. Baca [`architecture.md`](./architecture.md).
3. Pelajari [`modules.md`](./modules.md) untuk menemukan domain yang akan dikerjakan.
4. Ikuti satu flow end-to-end dari route, client component, server action, sampai query database.
