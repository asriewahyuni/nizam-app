# NIZAM ERP

NIZAM adalah aplikasi ERP multi-tenant untuk operasional bisnis Indonesia yang dibangun dengan Next.js, React, dan PostgreSQL. Repository ini mencakup modul akuntansi, kas/bank, purchasing, sales, inventory, HRIS/payroll, manufaktur, fleet, services, SaaS billing, edukasi, dan beberapa flow onboarding publik.

Dokumentasi ini ditujukan sebagai pintu masuk utama untuk programmer dan developer internal. Fokusnya adalah membantu tim baru cepat memahami arsitektur, alur kerja, dan cara menjalankan project tanpa harus membaca seluruh codebase dari nol.

## Ringkasan Cepat

| Area | Stack |
|---|---|
| Frontend | Next.js 16, React 19, App Router |
| Styling | Tailwind CSS 4, Framer Motion |
| Backend | Server Actions, Route Handlers |
| Database | **Railway PostgreSQL** (via `pg` native client) |
| Auth | **Internal Auth** (Nizam-native, cookie-based) |
| Storage | Railway S3-compatible bucket |
| Testing | Vitest |
| Runtime | Node.js 20.19.x |

## Status Arsitektur

✅ **Production-ready.** Project sudah 100% pakai Railway PostgreSQL + Internal Auth.

**Tidak ada koneksi ke Supabase Cloud.**

> ⚠️ **Catatan tentang Nama "Supabase" di Codebase**
>
> Beberapa folder dan file masih menggunakan nama `supabase` (misal `lib/supabase/server.ts`).
> Ini hanya **legacy naming** dari layer kompatibilitas — bukan koneksi ke Supabase Cloud.
>
> - `lib/supabase/server.ts` = drop-in replacement untuk Supabase SDK, tapi query ke Railway PostgreSQL
> - `scripts/legacy/supabase-migration/` = scripts historical (sudah di-archive)
> - Auth pakai **Internal Auth** (`AUTH_PROVIDER=internal`), bukan Supabase Auth
>
> Detail: [`lib/supabase/README.md`](./lib/supabase/README.md)

## Quick Start

### 1. Prasyarat

- Node.js `20.19.x`
- npm
- Akses ke database Railway PostgreSQL
- File `.env` lokal

### 2. Setup

```bash
npm install
cp .env.local.example .env
```

Isi `.env` dengan:

```bash
# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://...
RAILWAY_DATABASE_URL=postgresql://...

# Internal Auth (Nizam-native)
AUTH_PROVIDER=internal
NEXTAUTH_SECRET=<your-secret>

# Storage (Railway S3)
RAILWAY_STORAGE_*=...
```

File [`.env.local.example`](./.env.local.example) bisa dipakai sebagai baseline.

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
- [`docs/BACKUP_SCHEDULER.md`](./docs/BACKUP_SCHEDULER.md): scheduler backup database otomatis

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
├── docs/               # Dokumentasi developer
├── lib/                # Infra, helper, auth, db, email, hooks
│   ├── db/            # PostgreSQL native client (Railway)
│   ├── supabase/      # Legacy compat layer (bukan Supabase Cloud, lihat README di dalamnya)
│   └── scheduler/     # Background jobs (backup, etc)
├── modules/            # Business logic per domain
├── scripts/            # Script utilitas
│   └── legacy/        # Archived migration scripts (Supabase → Railway)
├── supabase/           # Migration SQL files (naming legacy, applied ke Railway)
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
| `npm run db:railway:sync` | Dry-run sinkronisasi schema ke Railway |
| `npm run db:railway:sync:apply` | Apply sinkronisasi schema ke Railway |
| `npm run db:railway:readiness` | Verifikasi kesiapan cutover |

> ⚠️ Script `supabase:*` di `package.json` masih ada untuk legacy local dev environment. **Tidak digunakan di production.**

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

- **Project ini TIDAK pakai Supabase Cloud.** Nama "supabase" di code = legacy compatibility wrapper.
- Semua query ke database = Railway PostgreSQL.
- Auth = Internal Auth (cookie `nizam_internal_session`), bukan Supabase Auth.
- Storage = Railway S3-compatible bucket, bukan Supabase Storage.
- Jangan install/setup Supabase project — tidak diperlukan.
- Untuk akses database, butuh `DATABASE_URL` ke Railway PostgreSQL.

## Lisensi dan Kepemilikan

Repository ini bersifat private dan ditujukan untuk pengembangan internal NIZAM.
