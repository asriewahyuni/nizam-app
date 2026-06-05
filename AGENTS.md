# AGENTS.md

## Gambaran Umum Codebase Nizam App
Repository `nizam-app` adalah sebuah solusi ERP (Enterprise Resource Planning) modern yang dikembangkan menggunakan TypeScript. Repository ini dirancang secara modular dan terstruktur untuk mendukung fitur seperti autentikasi pengguna, onboarding, manajemen database, dan berbagai modul bisnis (akuntansi, inventori, HR, commerce, dan lainnya).

Panduan ini ditujukan untuk asisten AI agar memahami struktur kode, konvensi, dan alur kerja pengembangan dalam repository ini.

---

## Stack Teknologi Aktif

| Layer | Teknologi |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | Railway PostgreSQL (via `pg` native client) |
| Auth | Internal auth berbasis session cookie (tabel `internal_auth_*`) |
| Styling | TailwindCSS + `clsx` + `tailwind-merge` |
| Email | Mailketing API |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| AI | Google Vertex AI + Google AI Studio |
| Monitoring | Sentry |
| Analytics | Microsoft Clarity |
| Animasi | Framer Motion |
| Testing | Vitest |

> **Catatan penting**: Supabase **tidak lagi digunakan** sebagai runtime database maupun auth provider. Direktori `lib/supabase/` dan `supabase/` masih ada, tetapi hanya sebagai compatibility layer dan penyimpanan migration history. Semua query data dan autentikasi sudah berjalan penuh di Railway PostgreSQL dengan internal auth.

---

## Struktur Codebase

### 1. **Direktori Utama**

- **`app/`**:
  Berisi halaman dan layout bawaan Next.js (App Router). Contoh:
  - `page.tsx`: Redirect pengguna berdasarkan sesi login dan status organisasi.
  - `layout.tsx`: Tata letak utama dan metadata global.
  - `(dashboard)/`: Halaman utama ERP setelah login.
  - `(auth)/`: Halaman login dan autentikasi.
  - `demo/`: Komponen untuk sesi demo (misalnya `DemoClient.tsx`).
  - `api/`: Route handlers Next.js, termasuk `/api/db` untuk proxy query browser ke PostgreSQL.

- **`lib/`**:
  Library utilitas dan integrasi eksternal.
  - `utils.ts`: Fungsi utilitas umum (format mata uang, membuat slug, dll).
  - `db/`: Koneksi dan query ke Railway PostgreSQL.
    - `postgres.ts`: Pool koneksi dan fungsi `queryPostgres()` utama.
    - `postgres-client.ts`: Native PostgreSQL client yang kompatibel dengan interface Supabase SDK.
    - `runtime-target.ts`: Deteksi runtime target (Railway vs lokal).
  - `auth/`: Sistem internal auth berbasis cookie session.
    - `internal-auth.server.ts`: Login, verifikasi session, dan manajemen kredensial.
    - `internal-auth.shared.ts`: Konstanta dan tipe yang dipakai server + client.
    - `provider.ts`: Auth provider abstraction.
  - `supabase/`: **Compatibility layer** — bukan koneksi ke Supabase Cloud.
    - `server.ts`: Drop-in replacement dengan interface Supabase SDK, semua query dirouting ke PostgreSQL.
    - `client.ts`: Browser client yang merouting query ke `/api/db`.
    - `config.ts`: Helper config (deprecated, dipertahankan agar tidak ada import error).
  - `storage/`: Integrasi AWS S3 untuk object storage.
  - `email/`: Utilitas pengiriman email via Mailketing API.
  - `monitoring/`: Konfigurasi Sentry.

- **`scripts/`**:
  Skrip untuk database, migrasi data, dan maintenance.
  - `clone-railway-to-local.mjs`: Clone database Railway ke PostgreSQL lokal.
  - `sync-supabase-to-railway.mjs`: Sinkronisasi schema dari Supabase ke Railway (migration tooling).
  - `bootstrap-railway-internal-auth-users.mjs`: Setup akun internal auth di Railway.
  - `backfill-railway-auth-users.mjs`: Backfill user dari Supabase Auth ke internal auth.
  - `apply-sql-file-with-supabase.mjs`: Helper untuk apply file SQL.

- **`supabase/`**:
  Berisi history migrasi database dalam format SQL dan `config.toml` untuk Supabase CLI.
  File-file di sini digunakan sebagai referensi schema, bukan untuk koneksi runtime.

- **`__tests__/`**:
  Unit dan integration test menggunakan Vitest.

### 2. **Komponen Utama**

- **UI / Client-Side**:
  Komponen React di folder `app/`, menggunakan React hooks dan Framer Motion untuk animasi.

- **Server Actions & Route Handlers**:
  Server-side business logic di `app/` menggunakan Next.js Server Actions dan Route Handlers.
  Query ke database selalu lewat `lib/db/postgres.ts` atau `lib/supabase/server.ts` (yang sudah diredirect ke PostgreSQL).

- **Database Layer**:
  Semua query database berjalan via `pg` (node-postgres) ke Railway PostgreSQL.
  Environment variable utama: `DATABASE_URL` atau `RAILWAY_DATABASE_URL`.

---

## Konvensi dan Praktik Terbaik

1. **Penggunaan Bahasa**:
   - Dominan dikembangkan menggunakan TypeScript.
   - Migrasi database menggunakan SQL / PLpgSQL.

2. **Styling**:
   - Kelas TailwindCSS dirapikan menggunakan `clsx` dan `tailwind-merge` melalui fungsi `cn` di `utils.ts`.

3. **Penanganan Error**:
   - Error harus disanitasi sebelum dikembalikan ke client.
   - Gunakan pola `{ data, error }` yang konsisten dengan interface Supabase SDK.

4. **Database**:
   - Jangan pernah import `@supabase/supabase-js` langsung untuk query data.
   - Gunakan `createClient()` dari `lib/supabase/server.ts` (server) atau `lib/supabase/client.ts` (browser), yang sudah diredirect ke PostgreSQL.
   - Atau gunakan `queryPostgres()` dari `lib/db/postgres.ts` untuk query raw.
   - **Array serialization di `postgres-client.ts`**: `_serializeDbParam()` membedakan dua jenis array:
     - *Primitive array* (`string[]`, `uuid[]`, dll.) → dikirim sebagai JS array native agar pg bind ke kolom `text[]` / `uuid[]`.
     - *Structured array* (item berupa object/array) → di-`JSON.stringify` untuk kolom `jsonb`.
     Jangan mengubah logika ini; mengubahnya ke `JSON.stringify` semua array akan menyebabkan error `malformed array literal` pada kolom `text[]`.

5. **Auth**:
   - Tidak ada Supabase Auth. Autentikasi menggunakan internal auth session berbasis cookie.
   - Gunakan `getInternalAuthSession()` dari `lib/auth/internal-auth.server.ts` di server.
   - `AUTH_PROVIDER=internal` adalah satu-satunya mode yang aktif.

6. **Terminologi Branch**:
   - Istilah yang dipakai pengguna untuk `branches` adalah **"Cabang"** (bukan "unit").
   - Semua error message, label UI, dan teks yang mengacu ke entitas `branches` harus menggunakan "Cabang".
   - Default branch pertama saat org dibuat bernama `'Cabang Utama'` (code: `MAIN`).

7. **Aturan Hierarki Organisasi**:
   - Hanya **anak perusahaan** (org dengan `parent_org_id`) yang boleh membuat Cabang.
   - Organisasi induk (org tanpa `parent_org_id`) **tidak boleh** membuat Cabang.
   - Anak perusahaan **tidak boleh** memiliki anak perusahaan sendiri (hierarki maksimal 2 level: induk → anak → cabang).
   - Aturan ini di-enforce di `createBranch()` dan `linkSubOrganization()` di `modules/organization/actions/org.actions.ts`.

8. **Komentar Kode**:
   - Setiap modul wajib memiliki komentar singkat dengan deskripsi fungsinya.

---

## Environment Variables Utama

```env
# Database (wajib)
DATABASE_URL=postgresql://postgres:<password>@<host>:<port>/railway
# atau
RAILWAY_DATABASE_URL=postgresql://postgres:<password>@<host>:<port>/railway

# Auth (wajib)
INTERNAL_AUTH_SESSION_SECRET=replace-with-random-long-secret

# Email
MAILKETING_API_TOKEN=your-mailketing-token-here
MAILKETING_FROM_EMAIL=info@kliknizam.app

# AI (opsional, untuk fitur AI)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_AI_STUDIO_KEY=your-google-ai-studio-key-here

# Monitoring (opsional)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_ENABLED=true

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Lihat `.env.example` untuk daftar lengkap variabel environment.

---

## Alur Kerja Pengembangan

### **Persiapan Lingkungan**
- Clone repository:
  ```bash
  git clone https://github.com/asriewahyuni/nizam-app.git
  ```
- Instal dependensi:
  ```bash
  npm install
  ```
- Salin dan isi environment variables:
  ```bash
  cp .env.example .env.local
  # Edit .env.local — isi minimal DATABASE_URL dan INTERNAL_AUTH_SESSION_SECRET
  ```

### **Menjalankan Proyek Secara Lokal**
```bash
npm run dev
```

Database wajib sudah bisa diakses via `DATABASE_URL` (Railway atau PostgreSQL lokal).

### **Skrip Database Utama**

| Perintah | Fungsi |
|---|---|
| `npm run db:clone:local` | Clone database Railway ke PostgreSQL lokal |
| `npm run db:runtime:show` | Tampilkan info koneksi database runtime |
| `npm run db:railway:sync` | Cek perbedaan schema Railway vs Supabase (dry-run) |
| `npm run db:railway:sync:apply` | Apply perbedaan schema ke Railway |

### **Pengujian**
```bash
npm run test           # Semua test
npm run test:erp       # Test modul ERP utama
npm run test:coverage  # Test dengan laporan coverage
```

---

## UI/UX Pro Max Skill — Wajib Diaktifkan untuk Semua Pekerjaan UI/UX

Project ini menggunakan **UI/UX Pro Max Skill** (v2.5.0) — sebuah AI skill yang menyediakan design intelligence profesional. Skill ini **wajib diaktifkan secara otomatis** setiap kali ada permintaan terkait UI/UX, komponen, halaman, atau desain.

### Lokasi Skill

| AI Tool | Path Skill |
|---|---|
| Claude / Zed | `.claude/skills/ui-ux-pro-max/SKILL.md` |
| Cursor | `.cursor/skills/ui-ux-pro-max/SKILL.md` |
| Windsurf | `.windsurf/skills/ui-ux-pro-max/SKILL.md` |
| Copilot | `.github/skills/ui-ux-pro-max/SKILL.md` |
| Semua AI lain | Baca panduan di bawah ini |

**Jika AI tool kamu mendukung skill loading native** → baca file `SKILL.md` dari path yang sesuai di atas.

### Kapan Skill Ini Diaktifkan

Aktifkan skill ini secara otomatis ketika user meminta:
- Membuat halaman baru, landing page, dashboard, komponen UI
- Memilih warna, font, style, atau tema
- Review atau perbaikan UI/UX yang sudah ada
- Implementasi dark mode, animasi, atau accessibility
- Perbaikan layout, spacing, atau responsivitas

### Alur Kerja Wajib (untuk semua AI)

**Step 1 — Analisis Kebutuhan:**
Identifikasi jenis produk, target pengguna, dan keyword style dari permintaan user.

**Step 2 — Generate Design System (WAJIB sebelum menulis kode UI apapun):**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product_type> <keywords>" --design-system -p "Nizam ERP"
```
Perintah ini menghasilkan: Pattern, Style, Color Palette, Typography, Key Effects, dan Anti-Patterns.

**Step 3 — Domain Search (jika perlu detail tambahan):**
```bash
# Cari style spesifik
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain style

# Cari UX guidelines
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain ux

# Cari typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain typography

# Cari color palette
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain color
```

**Step 4 — Stack Guidelines (Next.js + TailwindCSS):**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack nextjs
```

### Aturan UI Wajib untuk Nizam App

Berikut aturan minimum yang SELALU diterapkan pada setiap pekerjaan UI:

1. **Tidak ada emoji sebagai icon** — Gunakan Lucide React (`lucide-react`) atau Heroicons (`@heroicons/react`).
2. **`cursor-pointer` pada semua elemen yang bisa diklik.**
3. **Hover states** dengan transisi halus `150–300ms`.
4. **Kontras teks minimum 4.5:1** untuk light mode, 4.5:1 untuk dark mode.
5. **Focus states visible** untuk navigasi keyboard.
6. **`prefers-reduced-motion`** dihormati untuk semua animasi.
7. **Responsive**: wajib ditest pada 375px, 768px, 1024px, 1440px.
8. **Touch targets** minimum 44×44px.
9. **Semantic HTML** dan ARIA attributes yang benar.
10. **Spacing system** konsisten: gunakan kelipatan 4/8px (TailwindCSS spacing).

### Pre-Delivery Checklist (wajib sebelum selesai)

- [ ] Design system sudah di-generate dan diikuti
- [ ] Tidak ada emoji sebagai icon struktural
- [ ] Semua elemen clickable punya `cursor-pointer` dan hover state
- [ ] Kontras warna memenuhi standar WCAG AA (4.5:1)
- [ ] Focus state visible untuk keyboard navigation
- [ ] Responsif di semua breakpoint utama
- [ ] Tidak ada layout shift saat interaksi
- [ ] TailwindCSS kelas dirapikan dengan `cn()` dari `lib/utils.ts`

---

## Catatan Penting untuk Asisten AI

1. **Jangan gunakan Supabase SDK secara langsung** — `lib/supabase/` sudah menjadi compatibility layer di atas PostgreSQL. Import dari sana tetap valid.
2. Ikuti praktik TypeScript yang ketat: gunakan tipe yang spesifik, hindari `any`.
3. Jangan hardcode konfigurasi — selalu gunakan environment variables.
4. Validasi input di komponen client dan sanitasi data sensitif sebelum dikirim ke API.
5. Jika memperluas fungsi utilitas di `lib/utils.ts`, pastikan reusable dan tidak spesifik ke satu fitur.
6. Query database selalu server-side. Browser client merouting ke `/api/db`.

---

Untuk informasi lebih lanjut:
- [Dokumentasi Next.js](https://nextjs.org/docs)
- [Dokumentasi node-postgres (pg)](https://node-postgres.com)
- [Dokumentasi Railway](https://docs.railway.app)

Selamat Coding!
