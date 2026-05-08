# NIZAM ERP

NIZAM adalah aplikasi ERP multi-tenant untuk operasional bisnis Indonesia yang dibangun dengan Next.js, React, dan PostgreSQL. Repository ini mencakup modul akuntansi, kas/bank, purchasing, sales, inventory, HRIS/payroll, manufaktur, fleet, services, SaaS billing, edukasi, dan beberapa flow onboarding publik.

Dokumentasi ini ditujukan sebagai pintu masuk utama untuk programmer dan developer internal. Fokusnya adalah membantu tim baru cepat memahami arsitektur, alur kerja, dan cara menjalankan project tanpa harus membaca seluruh codebase dari nol.

## Ringkasan Cepat

| Area | Stack |
|---|---|
| Frontend | Next.js 16, React 19, App Router |
| Styling | Tailwind CSS 4, Framer Motion |
| Backend | Server Actions, Route Handlers |
| Database | PostgreSQL native (`pg`) dengan lapisan kompatibilitas Supabase |
| Auth | Internal auth dan compatibility flow untuk mode legacy |
| Testing | Vitest |
| Runtime | Node.js 20.19.x |

## Status Arsitektur Saat Ini

Codebase sedang berada dalam fase transisi dokumentasi dan infrastruktur:

- Jalur database utama saat ini sudah mengarah ke PostgreSQL native melalui [`lib/db/postgres.ts`](/Users/manbook/nizam-app/lib/db/postgres.ts:1) dan [`lib/supabase/server.ts`](/Users/manbook/nizam-app/lib/supabase/server.ts:1).
- Beberapa nama file, helper, dan flow masih menggunakan istilah `supabase` karena layer kompatibilitas lama masih dipertahankan agar migrasi kode tidak mematahkan modul yang ada.
- Middleware masih mendukung dua mode auth lewat [`lib/supabase/middleware.ts`](/Users/manbook/nizam-app/lib/supabase/middleware.ts:1): `supabase` dan `internal`.

Karena itu, developer baru disarankan membaca dokumentasi di `docs/` sebagai referensi utama, bukan hanya mengandalkan nama file.

## Quick Start

### 1. Prasyarat

- Node.js `20.19.x`
- npm
- Akses ke database project
- File environment lokal

### 2. Setup

```bash
npm install
cp .env.local.example .env.local
```

Isi `.env.local` sesuai mode yang ingin dipakai:

- Mode yang direkomendasikan untuk runtime saat ini: `DATABASE_URL` atau `RAILWAY_DATABASE_URL`
- Jika memakai internal auth: `AUTH_PROVIDER=internal` dan `INTERNAL_AUTH_SESSION_SECRET`
- Jika masih membutuhkan flow kompatibilitas lama: isi variabel Supabase yang relevan
- File [`.env.local.example`](/Users/manbook/nizam-app/.env.local.example:1) bisa dipakai sebagai baseline, tetapi untuk mode PostgreSQL native Anda mungkin tetap perlu menambahkan env database yang belum tercantum penuh di sana.

### 3. Menjalankan aplikasi

```bash
npm run dev
```

### 4. Menjalankan test

```bash
npm run test
```

## Peta Dokumentasi

Dokumentasi utama untuk developer ada di folder [`docs/`](./docs/README.md):

- [`docs/README.md`](./docs/README.md): indeks dokumentasi developer
- [`docs/developer-guide.md`](./docs/developer-guide.md): panduan setup, workflow, dan kebiasaan kerja tim
- [`docs/architecture.md`](./docs/architecture.md): arsitektur aplikasi, auth, data access, dan request flow
- [`docs/modules.md`](./docs/modules.md): peta modul bisnis, route, dan lokasi kode

Dokumen besar yang sudah ada tetap dipertahankan sebagai referensi tambahan:

- [`DOCUMENTATION.md`](./DOCUMENTATION.md): dokumentasi audit codebase versi panjang
- [`PLAYBOOK_MIGRASI_KE_NIZAM.md`](./PLAYBOOK_MIGRASI_KE_NIZAM.md): playbook onboarding dan migrasi client
- [`CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md`](./CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md): checklist tim onboarding
- [`PANDUAN_ADMIN_SAAS_NIZAM.md`](./PANDUAN_ADMIN_SAAS_NIZAM.md): panduan operasional admin SaaS
- [`templates/migrasi/README.md`](./templates/migrasi/README.md): template migrasi data

## Struktur Repository

```text
nizam-app/
├── app/                # Route Next.js App Router
├── components/         # Shared UI dan reusable components
├── docs/               # Dokumentasi developer yang dirapikan
├── lib/                # Infra, helper, auth, db, email, hooks
├── modules/            # Business logic per domain
├── scripts/            # Script utilitas, migrasi, sinkronisasi
├── supabase/           # Migration SQL dan artefak legacy/compatibility
├── __tests__/          # Vitest test suites
└── public/             # Asset statis
```

## Script Yang Sering Dipakai

| Command | Fungsi |
|---|---|
| `npm run dev` | Menjalankan aplikasi dalam mode development |
| `npm run build` | Build production |
| `npm run start` | Menjalankan standalone server |
| `npm run test` | Menjalankan seluruh test Vitest |
| `npm run test:watch` | Menjalankan test dalam mode watch |
| `npm run test:coverage` | Menjalankan test dengan coverage |
| `npm run lint` | Menjalankan ESLint |
| `npm run supabase:start` | Menyalakan Supabase local |
| `npm run supabase:stop` | Mematikan Supabase local |
| `npm run supabase:status` | Melihat status Supabase local |
| `npm run supabase:db:reset` | Reset database Supabase local |
| `npm run supabase:migrate-local-data` | Clone data dari project lama ke local |
| `npm run db:railway:sync` | Dry-run sinkronisasi schema ke Railway |
| `npm run db:railway:sync:apply` | Apply sinkronisasi schema ke Railway |
| `npm run db:railway:data:sync` | Dry-run sinkronisasi data ke Railway |
| `npm run db:railway:data:sync:apply` | Apply sinkronisasi data ke Railway |
| `npm run db:railway:readiness` | Verifikasi kesiapan cutover |

## Area Modul Utama

- `accounting`: jurnal, buku besar, audit, zakat, reimburse, analytics
- `cash`: kas, bank, rekonsiliasi
- `contacts`: CRM dan master kontak
- `factory`: manufaktur dan BOM
- `fleet`: armada dan rental
- `hris`: karyawan, attendance, payroll, leave, expense, self-service
- `inventory`: produk, gudang, stok
- `purchasing`: PR, PO, penerimaan, vendor flow
- `sales`: quotation, order, POS, komisi, sales page
- `services`: job order dan layanan
- `organization`, `settings`, `saas`, `edu`, `syirkah`: modul platform dan fitur pendukung

Detail lengkap tiap modul ada di [`docs/modules.md`](./docs/modules.md).

## Catatan Untuk Developer

- Jangan berasumsi semua referensi `supabase` berarti project masih fully Supabase-native.
- Cek lebih dulu apakah sebuah modul membaca PostgreSQL native, compatibility layer, atau flow transisional.
- Perubahan pada auth, organization context, dan route protection sebaiknya selalu ditinjau bersama [`app/(dashboard)/layout.tsx`](/Users/manbook/nizam-app/app/(dashboard)/layout.tsx:1), [`proxy.ts`](/Users/manbook/nizam-app/proxy.ts:1), dan [`lib/supabase/middleware.ts`](/Users/manbook/nizam-app/lib/supabase/middleware.ts:1).

## Lisensi dan Kepemilikan

Repository ini bersifat private dan ditujukan untuk pengembangan internal NIZAM.
