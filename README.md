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

- [PLAYBOOK_MIGRASI_KE_NIZAM.md](./PLAYBOOK_MIGRASI_KE_NIZAM.md) untuk panduan onboarding user pindahan dari Excel atau aplikasi lain.
- [CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md](./CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md) untuk checklist internal tim onboarding saat menangani migrasi client.
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
```

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
