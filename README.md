# NIZAM ERP

Dokumentasi ini telah diaudit ulang berdasarkan kode aktual pada **29 Maret 2026**.

NIZAM adalah ERP multi-tenant berbasis Next.js + Prisma/PostgreSQL untuk operasi bisnis Indonesia: akuntansi, kas/bank, purchasing, sales, inventory, HRIS/payroll, manufaktur, fleet, service order, billing SaaS, dan modul pelengkap seperti zakat, audit, BSC, serta demo onboarding.

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
| Backend | Prisma + PostgreSQL |
| Auth | NextAuth Credentials + RBAC aplikasi |
| Reporting | ExcelJS, Recharts |
| AI | Google Gemini / AI Studio (`GOOGLE_AI_STUDIO_KEY`) |
| Email | Resend |
| Testing | Vitest 4 |

## Baca Dokumentasi Lengkap

Dokumentasi lengkap proyek ada di [DOCUMENTATION.md](./DOCUMENTATION.md).

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
3. Isi `DATABASE_URL`, kredensial email, dan variabel opsional yang diperlukan.
4. Jalankan migrasi database sesuai workflow Prisma/PostgreSQL yang digunakan repo.
5. Jalankan:

```bash
npm install
npm run dev
```

Perintah lain:

```bash
npm run test
npm run build
```

## Update Penting Dibanding Dokumentasi Sebelumnya

- Stack frontend sudah naik ke **Next.js 16** dan **React 19**, bukan Next.js 15.
- Runtime minimum sekarang **Node.js 20+**, bukan 18+.
- Proteksi request memakai **`proxy.ts`** (terminologi Next.js 16), bukan penyebutan middleware lama.
- Migrasi aktif sudah jauh lebih panjang: **127 file SQL** dengan titik terbaru sampai `1085_sync_official_saas_module_catalog.sql`.
- Fitur yang kini jelas hadir di kode: billing SaaS, voucher ABS, demo session, invitation token organisasi, avatar karyawan, service orders, fleet hardening, barcode foundation, warehouse bins, dan module activation SaaS.

## Catatan

README ini sengaja dibuat ringkas sebagai pintu masuk. Untuk audit teknis lengkap, daftar route, modul, action, migrasi, dan temuan implementasi, lihat [DOCUMENTATION.md](./DOCUMENTATION.md).
