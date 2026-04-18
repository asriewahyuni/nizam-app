# Module Map

Dokumen ini membantu developer menemukan domain bisnis, route utama, dan lokasi kode yang biasanya perlu disentuh saat mengerjakan fitur tertentu.

## 1. Peta Modul Dashboard

| Modul | Route utama | Lokasi kode | Fungsi utama |
|---|---|---|---|
| Accounting | `/accounting` | `modules/accounting`, `app/(dashboard)/accounting` | Jurnal, buku besar, audit, zakat, reimburse, analytics |
| Cash | `/cash` | `modules/cash`, `app/(dashboard)/cash` | Kas, bank, rekonsiliasi |
| Contacts | `/contacts` | `modules/contacts`, `app/(dashboard)/contacts` | CRM, pelanggan, kontak |
| Dashboard | `/dashboard` | `app/(dashboard)/dashboard` | Ringkasan operasional utama |
| Edu | `/learning`, `/edu` | `modules/edu`, `components/edu`, `app/(dashboard)/learning`, `app/edu` | Mode edukasi dan kompetensi |
| Factory | `/factory` | `modules/factory`, `app/(dashboard)/factory` | Produksi, BOM, proses manufaktur |
| Fleet | `/fleet` | `modules/fleet`, `app/(dashboard)/fleet` | Armada, rental, operasional kendaraan |
| HRIS | `/hris` | `modules/hris`, `app/(dashboard)/hris` | Karyawan, attendance, payroll, leave, expense |
| Inventory | `/inventory` | `modules/inventory`, `app/(dashboard)/inventory` | Produk, gudang, stok |
| Purchasing | `/purchasing` | `modules/purchasing`, `app/(dashboard)/purchasing` | Permintaan pembelian, PO, vendor |
| Sales | `/sales`, `/pos` | `modules/sales`, `app/(dashboard)/sales`, `app/(dashboard)/pos` | Penjualan, quotation, POS, komisi, sales page |
| Services | `/services` | `modules/services`, `app/(dashboard)/services` | Job order dan layanan |
| Settings | `/settings` | `modules/settings`, `app/(dashboard)/settings` | Pengaturan bisnis, role, audit, migrasi |
| SaaS | `/billing`, `/pricing`, `/saas` | `modules/saas`, `app/(dashboard)/billing`, `app/(dashboard)/pricing`, `app/(dashboard)/saas` | Billing, paket, operator SaaS |
| Syirkah | `/syirkah` | `modules/syirkah`, `app/(dashboard)/syirkah` | Fitur partnership/syirkah |

## 2. Modul Platform dan Pendukung

| Area | Lokasi | Keterangan |
|---|---|---|
| Auth | `modules/auth`, `app/(auth)`, `app/auth` | Login, register, join, signout, session flow |
| Organization | `modules/organization` | Active org, branch, role, billing, approval |
| Demo | `modules/demo`, `app/demo` | Demo session dan onboarding experience |
| Public sales pages | `app/sp`, `modules/sales/lib` | Landing page publik dan lead capture |
| API & integration | `app/api`, `lib/api` | Export, health check, API key validation, webhook helper |

## 3. Pola Lokasi Kode

Saat mencari file yang relevan, gunakan patokan ini:

- UI halaman: `app/<route>/page.tsx`
- UI kompleks interaktif: `*Client.tsx` di folder route
- Mutasi/fetch domain: `modules/<domain>/actions/*.ts`
- Helper domain: `modules/<domain>/lib/*.ts`
- Helper umum: `lib/*`
- Shared shell dan navigation: `components/shared/*`
- Primitive UI: `components/ui/*`

## 4. Modul Yang Sering Bersinggungan

Beberapa area cenderung berubah bersama:

- `sales`, `inventory`, dan `accounting` untuk alur transaksi
- `hris`, `organization`, dan `settings` untuk role, employee, dan access control
- `saas`, `organization`, dan `billing` untuk subscription dan module enablement
- `auth`, `organization`, `proxy.ts`, dan `lib/supabase/middleware.ts` untuk perubahan login atau proteksi route

## 5. Rute Publik Penting

Selain dashboard, ada beberapa route non-dashboard yang sering perlu diketahui:

| Route | Tujuan |
|---|---|
| `/` | Entry point aplikasi |
| `/login` | Login |
| `/register` | Registrasi |
| `/onboarding` | Setup organisasi |
| `/demo` | Demo mode |
| `/abs` | Landing page ABS |
| `/sp/[orgSlug]/[pageSlug]` | Sales page publik |
| `/api/healthz` | Health check aplikasi |
| `/api/healthz-db` | Health check database |
| `/api/openapi` | Endpoint OpenAPI |

## 6. Cara Memilih Titik Masuk Saat Debugging

Jika issue yang Anda tangani adalah:

- masalah tampilan atau interaksi: mulai dari route `app/` dan client component
- masalah data atau mutasi: mulai dari `modules/<domain>/actions/`
- masalah login, redirect, atau session: mulai dari `proxy.ts`, `lib/supabase/middleware.ts`, dan `modules/auth/`
- masalah tenant atau akses modul: mulai dari `app/(dashboard)/layout.tsx` dan `modules/organization/`
