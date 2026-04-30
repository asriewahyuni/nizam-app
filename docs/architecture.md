# Architecture Overview

Dokumen ini merangkum arsitektur teknis NIZAM dari sisi route, auth, tenancy, akses data, dan boundary antar layer.

## 1. Gambaran Arsitektur

Secara garis besar, aplikasi dibangun dengan pola berikut:

1. Next.js App Router menangani route server dan client.
2. Route dashboard diproteksi oleh proxy dan layout guard.
3. UI interaktif diletakkan di client component.
4. Mutasi dan sebagian fetch domain berjalan melalui server actions.
5. Akses data dilakukan melalui adapter yang saat ini mengarah ke PostgreSQL native.

## 2. Lapisan Utama

| Layer | Lokasi | Peran |
|---|---|---|
| Routing | `app/` | Halaman, layout, route handler |
| UI Reusable | `components/` | Komponen bersama dan primitive UI |
| Domain Logic | `modules/` | Server actions dan helper business logic |
| Infra | `lib/` | Auth, db, supabase compatibility, email, hooks |
| Database Schema | `supabase/migrations/` | Riwayat migrasi SQL |
| Verification | `__tests__/` | Test suite Vitest |

## 3. Routing Model

### Route group penting

- `app/(auth)`: halaman login dan registrasi
- `app/(dashboard)`: area utama ERP setelah login
- `app/api`: route handler seperti export, health check, openapi
- `app/demo`, `app/onboarding`, `app/sp`, `app/toko`: flow publik atau onboarding

### Entry points penting

| File | Fungsi |
|---|---|
| [`app/layout.tsx`](/Users/manbook/nizam-app/app/layout.tsx:1) | Root layout aplikasi |
| [`app/(dashboard)/layout.tsx`](/Users/manbook/nizam-app/app/(dashboard)/layout.tsx:1) | Guard dashboard, organisasi aktif, module gating, RBAC |
| [`proxy.ts`](/Users/manbook/nizam-app/proxy.ts:1) | Intersepsi request global |
| [`lib/supabase/middleware.ts`](/Users/manbook/nizam-app/lib/supabase/middleware.ts:1) | Logika auth redirect dan session refresh |

## 4. Request dan Session Flow

Alur sederhananya:

1. Request masuk ke `proxy.ts`.
2. `proxy.ts` meneruskan ke `updateSession(request)`.
3. Middleware menentukan apakah route bersifat public, auth, atau protected.
4. Jika user lolos, request diteruskan ke route target.
5. Untuk dashboard, `app/(dashboard)/layout.tsx` melakukan guard tambahan seperti active org, module gating, demo/subscription checks, dan permission checks.

Arsitektur ini berarti proteksi akses tidak hanya terjadi di satu titik. Ada kombinasi antara proxy, middleware, dan layout guard.

## 5. Auth Model

Codebase masih mendukung dua mode provider:

- `supabase`
- `internal`

Resolver provider ada di [`lib/auth/provider.ts`](/Users/manbook/nizam-app/lib/auth/provider.ts:1).

Catatan penting:

- Middleware masih memeriksa kedua mode tersebut.
- Implementasi `createClient()` di [`lib/supabase/server.ts`](/Users/manbook/nizam-app/lib/supabase/server.ts:1) saat ini sudah menjadi adapter ke PostgreSQL native dan internal auth session.
- Nama `supabase` pada helper tidak otomatis berarti request benar-benar menuju Supabase Cloud.

## 6. Tenancy dan Akses Organisasi

NIZAM adalah aplikasi multi-tenant. Praktik akses utamanya:

- User bekerja dalam konteks organisasi aktif.
- Dashboard guard memaksa keberadaan active org.
- Hak akses dipengaruhi oleh role, permission, enabled modules, dan dalam beberapa flow juga branch access.

### Model organisasi vs unit operasional

Ada dua konsep tenancy yang perlu dibedakan dengan tegas:

- `organizations.parent_org_id` mewakili hierarki entitas, misalnya holding ke anak perusahaan.
- `branches` mewakili unit operasional di dalam satu entitas, bukan otomatis anak perusahaan.
- Setiap organisasi saat ini tetap memiliki satu unit default `Unit Utama` dengan kode `MAIN`.
- `Unit Utama` dipakai sebagai anchor teknis untuk context access, RLS, dan beberapa governance finance master.
- Dalam UX, `Unit Utama` sebaiknya dipahami sebagai konteks operasional default internal organisasi. Jika sebuah entitas hanya punya satu unit, UI tidak perlu menampilkannya seolah-olah bisnis tersebut sudah multi-unit.

Komponen guard paling penting ada di [`app/(dashboard)/layout.tsx`](/Users/manbook/nizam-app/app/(dashboard)/layout.tsx:1).

Yang dilakukan layout ini antara lain:

- memastikan organisasi aktif tersedia
- memeriksa status demo dan subscription expiry
- mencocokkan route dengan modul SaaS yang diaktifkan
- memeriksa permission untuk non-owner dan non-admin
- memuat konteks branch dan shell dashboard

## 7. Data Access Layer

### Kondisi saat ini

Lapisan data utama berada di:

- [`lib/db/postgres.ts`](/Users/manbook/nizam-app/lib/db/postgres.ts:1)
- [`lib/supabase/server.ts`](/Users/manbook/nizam-app/lib/supabase/server.ts:1)
- [`lib/supabase/config.ts`](/Users/manbook/nizam-app/lib/supabase/config.ts:1)

### Hal yang perlu dipahami

- `lib/db/postgres.ts` membuat koneksi `pg` ke `DATABASE_URL`, `RAILWAY_DATABASE_URL`, atau `DATABASE_PUBLIC_URL`.
- `lib/supabase/server.ts` menjaga antarmuka `createClient()` dan `createAdminClient()` agar modul lama tetap bisa berjalan.
- `lib/supabase/config.ts` masih ada untuk compatibility dan beberapa flow transisional.

Kesimpulannya, adapter compatibility adalah boundary yang sangat penting di repo ini.

## 8. Pola Implementasi Fitur

Pola yang paling sering muncul:

1. Halaman server di `app/.../page.tsx`
2. Client component seperti `FeatureClient.tsx`
3. Server action di `modules/<domain>/actions/*.ts`
4. Helper atau formatter di `modules/<domain>/lib` atau `lib/`

Keuntungan pola ini:

- UI dan business logic lebih terpisah
- route file tetap tipis
- server actions lebih mudah dicari berdasarkan domain

## 9. API Routes

Beberapa route handler yang aktif saat ini berada di:

- [`app/api/db/route.ts`](/Users/manbook/nizam-app/app/api/db/route.ts:1)
- [`app/api/export/route.ts`](/Users/manbook/nizam-app/app/api/export/route.ts:1)
- [`app/api/fix-trial/route.ts`](/Users/manbook/nizam-app/app/api/fix-trial/route.ts:1)
- [`app/api/healthz/route.ts`](/Users/manbook/nizam-app/app/api/healthz/route.ts:1)
- [`app/api/healthz-db/route.ts`](/Users/manbook/nizam-app/app/api/healthz-db/route.ts:1)
- [`app/api/openapi/route.ts`](/Users/manbook/nizam-app/app/api/openapi/route.ts:1)
- `app/api/ecommerce/order-request/route.ts`

### Public commerce flow

Untuk modul e-commerce, ada satu jalur publik tambahan:

1. pelanggan membuka `/toko/[orgSlug]`
2. route publik memuat katalog aktif organisasi
3. submit checkout ringan dikirim ke `/api/ecommerce/order-request`
4. route handler membuat draft quotation di ERP melalui helper `modules/ecommerce/lib/ecommerce.server.ts`

Arsitektur ini membuat storefront publik tetap tipis di layer route, sementara keputusan bisnis utama tetap berada di helper server.

## 10. Testing dan Build

- Testing memakai Vitest lewat [`vitest.config.ts`](/Users/manbook/nizam-app/vitest.config.ts:1)
- Build Next.js memakai output `standalone` lewat [`next.config.mjs`](/Users/manbook/nizam-app/next.config.mjs:1)

Catatan:

- `typescript.ignoreBuildErrors` bernilai `true`, jadi build tidak selalu cukup untuk menjamin type safety penuh.
- Untuk perubahan yang sensitif, sebaiknya jalankan test yang relevan selain hanya `npm run build`.

## 11. Area Transisi Yang Perlu Diwaspadai

Developer baru sering bingung di area berikut:

- nama file `supabase` yang sekarang sebenarnya menjadi adapter PostgreSQL
- env lama dan env baru hidup berdampingan
- middleware masih mengenal mode auth ganda
- migrasi SQL tetap berada di folder `supabase/`

Jika ada keraguan, prioritaskan membaca implementasi file, bukan hanya nama direktori.
