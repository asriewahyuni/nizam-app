# Workflow Tim IT Nizam App

> Panduan menyeluruh alur kerja pengembangan, database, deployment, dan operasional untuk Tim IT internal Nizam.
> Dokumen ini melengkapi [`AGENTS.md`](./AGENTS.md) (aturan & konvensi codebase) dan [`docs/developer-guide.md`](./docs/developer-guide.md) (panduan setup detail). Baca ketiganya sebagai satu paket sebelum mulai bekerja di repository ini.

**Terakhir diverifikasi terhadap kondisi repo:** Agustus 2026.

---

## Daftar Isi

1. [Ringkasan Stack](#1-ringkasan-stack)
2. [Onboarding Developer Baru](#2-onboarding-developer-baru)
3. [Environment Variables & Mode Database](#3-environment-variables--mode-database)
4. [Alur Kerja Git & Branching](#4-alur-kerja-git--branching)
5. [Code Review & Definition of Done](#5-code-review--definition-of-done)
6. [Alur Kerja Database & Migrasi SQL](#6-alur-kerja-database--migrasi-sql)
7. [Alur Kerja Pengembangan Modul Baru (Anti-Silo ERP)](#7-alur-kerja-pengembangan-modul-baru-anti-silo-erp)
8. [Alur Kerja UI/UX](#8-alur-kerja-uiux)
9. [Testing & QA](#9-testing--qa)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Deployment ke Railway](#11-deployment-ke-railway)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [Insiden Produksi & Hotfix](#13-insiden-produksi--hotfix)
14. [Keamanan & Data Sensitif](#14-keamanan--data-sensitif)
15. [Referensi Cepat Script npm](#15-referensi-cepat-script-npm)
16. [Dokumen Terkait](#16-dokumen-terkait)
17. [Checklist Ringkas Sebelum Merge](#17-checklist-ringkas-sebelum-merge)

---

## 1. Ringkasan Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | Railway PostgreSQL (via `pg` native client) |
| Auth | Internal auth berbasis session cookie (`nizam_internal_session`) |
| Styling | TailwindCSS + `clsx` + `tailwind-merge` (`cn()` di `lib/utils.ts`) |
| Email | Mailketing API |
| Storage | AWS S3 / Railway S3-compatible |
| AI | Google Vertex AI + Google AI Studio |
| Monitoring | Sentry |
| Analytics | Microsoft Clarity |
| Testing | Vitest |
| Node | `20.19.x` (dikunci di `package.json` → `engines`) |

**Fakta paling penting yang wajib dipahami setiap anggota tim baru:**
Folder `lib/supabase/` dan `supabase/` **bukan** koneksi ke Supabase Cloud. Ini adalah compatibility layer + arsip riwayat migrasi. Semua data dan auth berjalan penuh di Railway PostgreSQL + internal auth. Jangan pernah men-setup Supabase Cloud project baru untuk kebutuhan apa pun di repo ini.

---

## 2. Onboarding Developer Baru

```bash
git clone https://github.com/asriewahyuni/nizam-app.git
cd nizam-app
npm install
cp .env.local.example .env.local
# isi minimal DATABASE_URL / RAILWAY_DATABASE_URL dan INTERNAL_AUTH_SESSION_SECRET

# aktifkan git hooks proyek (wajib, sekali per clone)
bash scripts/setup-hooks.sh

npm run dev
```

`scripts/setup-hooks.sh` menjalankan `git config core.hooksPath .githooks`. Tanpa langkah ini, hook `post-commit` (lihat [§6](#6-alur-kerja-database--migrasi-sql)) tidak aktif dan migrasi baru tidak akan otomatis ter-apply saat commit lokal.

Setelah `npm run dev` jalan, verifikasi:
- `http://localhost:3000/api/healthz` → aplikasi hidup
- `http://localhost:3000/api/healthz-db` → koneksi database sehat
- `npm run db:runtime:show` → konfirmasi database mana yang sebenarnya sedang dipakai (Railway vs lokal)

---

## 3. Environment Variables & Mode Database

Aturan praktis:
- `.env.local` = override milik mesin masing-masing, **tidak pernah di-commit**.
- Urutan prioritas koneksi database runtime: `DATABASE_URL` → `RAILWAY_DATABASE_URL` → `DATABASE_PUBLIC_URL`.
- `AUTH_PROVIDER=internal` adalah satu-satunya mode aktif — jangan set ke `supabase`.

| Variabel | Wajib? | Keterangan |
|---|---|---|
| `DATABASE_URL` / `RAILWAY_DATABASE_URL` | Ya | Koneksi utama ke PostgreSQL runtime |
| `INTERNAL_AUTH_SESSION_SECRET` | Ya | Secret untuk sign session cookie internal auth |
| `MAILKETING_API_TOKEN`, `MAILKETING_FROM_EMAIL` | Untuk fitur email | Pengiriman email transaksional |
| `GOOGLE_CLOUD_PROJECT`, `GOOGLE_AI_STUDIO_KEY` | Untuk fitur AI | Vertex AI / AI Studio |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENABLED` | Opsional | Error monitoring |
| `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | Legacy | Hanya untuk script lama / compat layer, bukan koneksi aktif |

Untuk pindah mode kerja lokal ↔ Railway (misalnya menguji fitur dengan data produksi yang sudah di-clone ke lokal), ikuti [`docs/database-mode-switching.md`](./docs/database-mode-switching.md) dan gunakan:

```bash
npm run db:clone:local     # clone database Railway ke PostgreSQL lokal
npm run db:runtime:show    # cek DB mana yang sedang aktif dipakai app
```

---

## 4. Alur Kerja Git & Branching

Berdasarkan riwayat commit dan branch aktif di repo ini:

- **`main`** — branch produksi utama. Push ke `main` memicu CI (`vitest-ci.yml`, `build-and-push.yml`) dan deploy Railway.
- **`main-hotfix`** — branch terpisah yang dipakai untuk hotfix cepat saat produksi bermasalah, di luar siklus normal `main`. Lihat [§13](#13-insiden-produksi--hotfix).
- **Branch fitur/fix**: `feat/<deskripsi-singkat>`, `fix/<deskripsi-singkat>`, atau `<domain>/<deskripsi>` (mis. `codex/role-permission-fix`). Branch hasil kerja AI assistant biasanya berprefix `claude/...` atau `codex/...`.

### Konvensi commit message

Ikuti pola yang sudah konsisten dipakai di riwayat commit:

```
<type>(<scope>): <deskripsi singkat, imperative>
```

Contoh nyata dari repo: `fix(kojasmat): fix anggota login failing on PWA cold start`, `feat(kojasmat): add pull-to-refresh to anggota portal PWA`.

- `type`: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- `scope`: nama modul/domain (`kojasmat`, `lms`, `fleet`, `accounting`, dll) — opsional tapi sangat dianjurkan agar riwayat mudah ditelusuri per modul
- Deskripsi dalam bahasa Inggris, present tense, tanpa titik di akhir

### Alur PR

1. Branch dari `main` terbaru.
2. Kerjakan perubahan, commit dengan pesan yang jelas.
3. Push branch, buka Pull Request ke `main` di GitHub.
4. CI (`vitest-ci.yml`) wajib hijau sebelum merge.
5. Merge menggunakan `Merge pull request #N` (bukan rebase/squash manual di luar GitHub) agar riwayat PR tetap tertaut ke nomor PR-nya — konsisten dengan pola merge commit yang sudah ada di `git log`.

---

## 5. Code Review & Definition of Done

Sebelum meminta review / merge, pastikan:

- [ ] Tidak ada import Supabase SDK langsung (`@supabase/supabase-js`) — hanya boleh lewat `lib/supabase/server.ts` / `client.ts` atau `queryPostgres()`.
- [ ] Tidak ada `any` yang tidak perlu; tipe spesifik dipakai.
- [ ] Error yang dikembalikan ke client sudah disanitasi (pola `{ data, error }`).
- [ ] Semua transaksi uang baru sudah lewat `lib/erp-bridge/finances.ts` (lihat [§7](#7-alur-kerja-pengembangan-modul-baru-anti-silo-erp)) — **bukan** `INSERT`/`UPDATE` manual ke `journal_entries` / `cash_transactions` / `inventory_stocks`.
- [ ] Istilah `branches` di UI/pesan error selalu ditulis **"Cabang"**, bukan "unit".
- [ ] Perubahan yang menyentuh UI mengikuti checklist [§8](#8-alur-kerja-uiux).
- [ ] Test relevan sudah dijalankan (`npm run test` atau `npm run test:erp`) dan lulus.
- [ ] Jika ada migrasi SQL baru, sudah diverifikasi jalan bersih di database lokal/staging (lihat [§6](#6-alur-kerja-database--migrasi-sql)).

---

## 6. Alur Kerja Database & Migrasi SQL

Ini adalah bagian paling sensitif dari workflow — kesalahan di sini langsung berdampak ke seluruh tenant produksi.

### 6.1 Konvensi penomoran migrasi

File migrasi hidup di `supabase/migrations/` (nama folder legacy, isinya adalah source of truth schema Railway), dengan pola:

```
supabase/migrations/<NNNN>_<nama_modul>_<deskripsi_singkat>.sql
```

Contoh nyata terbaru: `1417_workshop_fleet_mode.sql`, `1418_canvasser_pro.sql`, `1419_canvasser_customer_assignment.sql`. Nomor urut **naik terus**, tidak pernah dipakai ulang — cek nomor tertinggi yang ada sebelum membuat file baru.

### 6.2 Cara migrasi benar-benar dijalankan (jangan jalankan SQL manual di dashboard)

Jangan pernah tempel SQL mentah langsung ke SQL console/dashboard database untuk mengubah schema produksi. Semua migrasi **wajib** lewat file bernomor di `supabase/migrations/` dan dijalankan lewat tooling repo, karena tracking-nya berbasis tabel `schema_migrations` di database target — migrasi yang diterapkan manual tidak akan tercatat dan bisa menyebabkan drift atau ter-apply dobel di lingkungan lain.

Tiga jalur migrasi berjalan otomatis di repo ini:

1. **Manual / lokal**: `npm run db:migrate` (menjalankan `scripts/migrate-pending.mjs`). Script ini membaca semua file `.sql` yang belum tercatat di `schema_migrations`, urut berdasarkan nomor, lalu apply satu per satu. Prioritas koneksi: `RAILWAY_DATABASE_URL` → `DATABASE_URL` → fallback baca dari `.env.local`.
2. **Otomatis saat commit** (`.githooks/post-commit`): jika commit terakhir menyertakan file baru di `supabase/migrations/*.sql`, hook ini otomatis menjalankan `node scripts/migrate-pending.mjs` ke database yang dikonfigurasi di environment lokal developer. Hook ini hanya aktif jika `scripts/setup-hooks.sh` sudah pernah dijalankan (lihat [§2](#2-onboarding-developer-baru)).
3. **Otomatis saat deploy**: `npm run start` (dipakai sebagai `startCommand` di Railway) menjalankan `npm run db:migrate && node scripts/start-standalone.mjs` — artinya **setiap deploy ke Railway otomatis meng-apply migrasi pending ke database produksi sebelum server baru menyala**. Konsekuensinya: migrasi yang ikut ter-merge ke `main` akan langsung tereksekusi ke produksi pada deploy berikutnya, tanpa gerbang approval manual tambahan. Review migrasi SQL di PR harus seketat review kode aplikasi.

### 6.3 Checklist menulis migrasi baru

- [ ] Nomor file lebih besar dari nomor tertinggi yang sudah ada di `supabase/migrations/`.
- [ ] Migrasi idempotent / aman dijalankan sekali (hindari `DROP` destruktif tanpa backup plan).
- [ ] Untuk kolom baru bertipe array primitif (`text[]`, `uuid[]`), jangan asumsikan `JSON.stringify` di layer aplikasi — lihat catatan `_serializeDbParam()` di `lib/db/postgres-client.ts` (AGENTS.md §4) agar tidak memicu error `malformed array literal`.
- [ ] Jika kolom baru bertipe `enum`, jangan pakai operator `LIKE`/`ILIKE` pada query yang menyentuhnya — cek `information_schema` dulu; enum + `LIKE` gagal secara silent di beberapa kasus.
- [ ] Sudah dites jalan bersih via `npm run db:migrate` di database lokal/clone sebelum PR dibuka.

### 6.4 Clone & sinkronisasi database

```bash
npm run db:clone:local        # clone penuh database Railway ke PostgreSQL lokal
npm run db:railway:sync       # dry-run: cek perbedaan schema
npm run db:railway:sync:apply # apply perbedaan schema ke Railway
```

---

## 7. Alur Kerja Pengembangan Modul Baru (Anti-Silo ERP)

Nizam App adalah ERP — modul baru **dilarang keras** menjadi "silo" (mencatat data sendiri tanpa terhubung ke modul inti). Ini adalah hukum besi yang di-enforce di level code review, bukan sekadar saran.

### 7.1 Struktur file standar modul

```
modules/<domain>/
  actions/   # Server Actions ('use server')
  lib/       # helper domain-specific
```

### 7.2 Integrasi wajib per jenis transaksi

| Jenis transaksi | Wajib panggil | Lokasi |
|---|---|---|
| Uang masuk (revenue) | `ERPBridge.recordRevenue(...)` | `lib/erp-bridge/finances.ts` |
| Uang keluar (expense) | `ERPBridge.recordExpense(...)` | `lib/erp-bridge/finances.ts` |
| Harga pokok penjualan (COGS) | `ERPBridge.recordCOGS(...)` | `lib/erp-bridge/finances.ts` |
| Perpindahan/penggunaan barang fisik | Catat ke `inventory_movements` | modul inventori |
| Penugasan staf/kru, presensi | Tautkan ke tabel `employees` | modul HRIS |
| Invoice dari dokumen operasional (SO/DO/WO) | `createInvoiceFromOperational`, `createInvoiceFromWorkOrder`, `createInvoiceFromLmsBatch`, `createPurchaseFromOperational` | `modules/operational-bridge/actions/bridge.actions.ts` |

Catatan implementasi nyata dari `ERPBridge.recordRevenue()`: fungsi ini otomatis membuat `journal_entries` (debit/kredit seimbang) dan **otomatis mengirim notifikasi Slack** untuk transaksi ≥ Rp 10.000.000. Jangan duplikasi logika ini secara manual di modul baru — panggil fungsi yang sudah ada.

### 7.3 Aturan hierarki organisasi (relevan saat modul menyentuh multi-tenant/branch)

- Hanya **anak perusahaan** (org dengan `parent_org_id`) yang boleh membuat Cabang.
- Organisasi induk **tidak boleh** membuat Cabang.
- Anak perusahaan **tidak boleh** memiliki anak perusahaan sendiri (maksimal 2 level: induk → anak → cabang).
- Enforcement ada di `createBranch()` dan `linkSubOrganization()` (`modules/organization/actions/org.actions.ts`) — jangan bypass validasi ini di modul baru.

**Sebelum menutup pekerjaan modul apa pun yang menyentuh uang**, wajib verifikasi transaksinya sudah muncul di Buku Besar / Laporan Laba Rugi. Ini bukan opsional.

---

## 8. Alur Kerja UI/UX

Setiap pekerjaan UI/UX (halaman baru, komponen, redesign, dark mode, dsb.) **wajib** mengaktifkan skill **UI/UX Pro Max** (`.claude/skills/ui-ux-pro-max/SKILL.md`) sebelum menulis kode:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<jenis_produk> <keyword>" --design-system -p "Nizam ERP"
```

Aturan minimum yang selalu berlaku (detail lengkap di AGENTS.md):

- Tidak ada emoji sebagai icon struktural — pakai `lucide-react` / `@heroicons/react`.
- `cursor-pointer` + hover state (transisi 150–300ms) di semua elemen yang bisa diklik.
- Kontras teks minimum 4.5:1 (light & dark mode).
- Focus state terlihat untuk navigasi keyboard; `prefers-reduced-motion` dihormati.
- Ditest di breakpoint 375px, 768px, 1024px, 1440px; touch target minimum 44×44px.
- Kelas Tailwind dirapikan lewat `cn()` (`lib/utils.ts`).
- Desain mengikuti standar **Modern Clean Fintech / SaaS UI (Card-Based Minimalism)** — card putih `rounded-2xl`, `border-slate-200/80`, `shadow-sm`, action utama (bayar, CTA) selalu di urutan paling atas, warna brand diambil dinamis dari `store.brandColor`/`org.brandColor` (bukan hardcode), section alamat pengiriman disembunyikan untuk produk digital.

---

## 9. Testing & QA

```bash
npm run test            # semua test (vitest run)
npm run test:erp        # subset test ERP inti: accounting, auth, fleet, middleware, proxy
npm run test:erp:coverage
npm run test:coverage   # semua test + coverage report
npm run test:watch      # mode watch untuk development
```

Test hidup di `__tests__/`, satu file per domain (`accounting.test.ts`, `sales.actions.test.ts`, `org.actions.test.ts`, dll — lebih dari 60 file test saat ini). Sebelum membuka PR, minimal jalankan test domain yang disentuh; untuk perubahan yang menyentuh auth/session/middleware/proxy, wajib jalankan `npm run test:erp` karena itu adalah subset yang juga dijalankan CI.

---

## 10. CI/CD Pipeline

Dua workflow GitHub Actions aktif di `.github/workflows/`:

| Workflow | Trigger | Yang dilakukan |
|---|---|---|
| `vitest-ci.yml` | push/PR ke `main`, `master`, `development` | `npm ci` → `npm run test` → `npm run test:erp` |
| `build-and-push.yml` | push ke `main`, atau manual (`workflow_dispatch`) | `npm ci` → `npm run build` (production) → upload artifact `.next` (retensi 7 hari) |

Catatan: `build-and-push.yml` **tidak** melakukan deploy — ini hanya build validation + artifact upload. Deploy sebenarnya terjadi di Railway (lihat [§11](#11-deployment-ke-railway)), yang men-trigger build-nya sendiri saat `main` ter-update.

---

## 11. Deployment ke Railway

Konfigurasi di `railway.json`:

```json
{
  "build": { "builder": "RAILPACK", "buildCommand": "npm run build" },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/healthz",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Alur deploy: Railway build via Railpack (`npm run build`) → jalankan `npm run start`, yang berurutan menjalankan **migrasi database pending** lalu menyalakan server standalone (`scripts/start-standalone.mjs`) → Railway polling `/api/healthz` sampai sehat sebelum mengarahkan traffic → jika container crash, Railway restart otomatis (maks 10x).

**Implikasi operasional:** karena migrasi berjalan otomatis di setiap deploy, jangan pernah merge PR yang mengandung migrasi SQL yang belum ditest, meskipun kode aplikasinya sendiri sudah benar — file SQL yang salah akan langsung tereksekusi ke database produksi saat deploy berikutnya berjalan.

---

## 12. Monitoring & Observability

- **Sentry** — error tracking server & edge (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`). Aktif via `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_ENABLED=true`.
- **Microsoft Clarity** — analytics perilaku user, di-init lewat `instrumentation-client.ts`.
- **Health check endpoints**:
  - `GET /api/healthz` — liveness aplikasi (dipakai Railway healthcheck).
  - `GET /api/healthz-db` — konektivitas database.

Saat mencurigai ada masalah produksi, cek Sentry dahulu untuk error yang sudah tertangkap, lalu `/api/healthz-db` untuk isolasi apakah masalahnya di layer database atau aplikasi.

---

## 13. Insiden Produksi & Hotfix

Repo ini memiliki branch `main-hotfix` yang secara historis dipakai sebagai jalur cepat untuk perbaikan darurat produksi (contoh nyata: `hotfix: add missing VersionIntegrityButton import in AppHeader`).

Alur yang direkomendasikan saat terjadi insiden produksi:

1. Konfirmasi dan isolasi masalah lewat Sentry + `/api/healthz-db` + log Railway.
2. Buat branch fix dari `main` (bukan dari branch fitur yang sedang berjalan).
3. Buat perubahan **seminimal mungkin** yang menyasar akar masalah — hindari menumpuk refactor di tengah hotfix.
4. Jalankan test relevan secara lokal (`npm run test:erp` minimal, karena itu subset yang menjaga auth/middleware/proxy tetap stabil).
5. PR ke `main`, minta review meskipun darurat — jangan skip CI (`--no-verify` dilarang kecuali user secara eksplisit meminta).
6. Setelah merge, pantau deploy Railway (`/api/healthz`) dan Sentry untuk konfirmasi insiden benar-benar selesai, bukan hanya gejalanya hilang sementara.
7. Jika root cause menyentuh schema database, migrasi baru tetap wajib mengikuti aturan [§6](#6-alur-kerja-database--migrasi-sql) — tidak ada jalan pintas SQL manual meskipun kondisi darurat.

---

## 14. Keamanan & Data Sensitif

- Error yang dikembalikan ke client harus disanitasi — jangan bocorkan stack trace atau detail query SQL mentah ke response API.
- Semua query dan mutasi harus menjaga isolasi tenant (`org_id` / `branch_id`) — jangan pernah query lintas organisasi tanpa filter eksplisit.
- Auth berbasis session cookie internal (`nizam_internal_session`), tabel `internal_auth_users` / `internal_auth_sessions`. Verifikasi di server dengan `getInternalAuthSession()` (`lib/auth/internal-auth.server.ts`).
- Jangan commit file `.env*` yang berisi secret asli. Saat `git add` sebelum commit, selalu review `git status` untuk memastikan tidak ada file kredensial ikut ter-stage.
- Validasi input dilakukan baik di client (UX) maupun server (source of truth) — jangan percaya validasi client saja.

---

## 15. Referensi Cepat Script npm

| Kategori | Command | Kegunaan |
|---|---|---|
| Dev | `npm run dev` | Development server (Turbopack) |
| Dev | `npm run dev:webpack` | Development server tanpa Turbopack |
| Build | `npm run build` | Build production |
| Build | `npm run start` | `db:migrate` + jalankan server standalone (dipakai Railway) |
| Lint | `npm run lint` | ESLint |
| Test | `npm run test` / `test:erp` / `test:coverage` / `test:watch` | Lihat [§9](#9-testing--qa) |
| DB | `npm run db:migrate` | Apply migrasi pending ke database aktif |
| DB | `npm run db:clone:local` | Clone Railway → PostgreSQL lokal |
| DB | `npm run db:runtime:show` | Tampilkan database runtime yang benar-benar dipakai |
| DB | `npm run db:railway:sync` / `db:railway:sync:apply` | Cek/terapkan perbedaan schema |
| DB | `npm run db:railway:readiness` | Cek kesiapan cutover Railway |
| Supabase local | `npm run supabase:start` / `supabase:stop` / `supabase:db:reset` | Hanya untuk kebutuhan compat-layer lokal, bukan runtime utama |
| Template | `npm run templates:migrasi` / `templates:coa` | Generate template Excel untuk migrasi data / CoA |
| CoA fix | `npm run coa:fix:check` / `coa:fix:apply` | Deteksi & perbaiki Chart of Accounts non-standar |
| Report | `npm run report:weekly-system-usage` | Kirim laporan pemakaian sistem mingguan |

---

## 16. Dokumen Terkait

- [`AGENTS.md`](./AGENTS.md) — aturan & konvensi codebase lengkap (wajib dibaca, ini adalah sumber kebenaran utama).
- [`docs/developer-guide.md`](./docs/developer-guide.md) — panduan setup lokal & cara membaca alur fitur.
- [`docs/database-mode-switching.md`](./docs/database-mode-switching.md) — detail pindah mode database lokal ↔ Railway.
- [`docs/architecture.md`](./docs/architecture.md) — arsitektur sistem.
- [`docs/modules.md`](./docs/modules.md) — daftar & status modul.
- [`ROUTER_PROXY_SETUP.md`](./ROUTER_PROXY_SETUP.md) — setup proxy routing (jika environment kerja memerlukannya).
- `.claude/skills/ui-ux-pro-max/SKILL.md` — skill design system untuk semua pekerjaan UI/UX.

---

## 17. Checklist Ringkas Sebelum Merge

- [ ] Branch dibuat dari `main` terbaru.
- [ ] Commit message mengikuti pola `type(scope): deskripsi`.
- [ ] `npm run test` / `npm run test:erp` lulus lokal.
- [ ] Tidak ada import Supabase SDK langsung; tidak ada raw SQL manual ke `journal_entries`/`inventory_stocks`.
- [ ] Transaksi uang baru sudah lewat `ERPBridge`; barang fisik sudah lewat `inventory_movements`; staf/kru sudah tertaut `employees`.
- [ ] Migrasi baru (jika ada) bernomor urut benar dan sudah dites via `npm run db:migrate`.
- [ ] UI baru mengikuti checklist [§8](#8-alur-kerja-uiux) (tanpa emoji icon, cursor-pointer, kontras, responsive).
- [ ] Tidak ada file `.env*` atau secret ikut ter-commit.
- [ ] CI (`vitest-ci.yml`) hijau di PR.
