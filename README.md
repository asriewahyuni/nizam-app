# NIZAM ERP

**Enterprise Resource Planning berbasis cloud untuk bisnis Indonesia.**  
Dibangun di atas Next.js 15 (App Router) + Supabase (PostgreSQL).

---

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 (App Router, Server Components, Server Actions) |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth + RBAC custom |
| AI | Google Gemini 2.5 Flash (OCR nota) |
| Export | ExcelJS (XLSX enterprise-grade) |
| Styling | Tailwind CSS + NizamUI design system |

---

## Setup Cepat

### 1. Prerequisites
- Node.js 18+
- Akun Supabase (free tier cukup untuk development)
- Google AI Studio API Key (untuk OCR nota, opsional)

### 2. Clone & Install

```bash
git clone <repo-url>
cd nizam-app
npm install
```

### 3. Environment Variables

Salin `.env.local.example` ke `.env.local` dan isi:

```bash
cp .env.local.example .env.local
```

Variabel yang **wajib** diisi:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Untuk Server Actions
GOOGLE_AI_STUDIO_KEY=AIzaSy...          # Untuk OCR fitur (opsional)
```

### 4. Jalankan Migrations

Di Supabase Dashboard → SQL Editor, jalankan semua file di `supabase/migrations/` **secara berurutan** (001 → 1023).

Atau via Supabase CLI:
```bash
npx supabase db push
```

### 5. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## Arsitektur Keamanan (RLS)

NIZAM menggunakan **Row Level Security (RLS) PostgreSQL** sebagai layer keamanan utama. Setiap query ke database secara otomatis difilter berdasarkan `auth.uid()` user yang sedang login.

### Hierarki Isolasi Data

```
Organizations (Tenant)
  └── org_members (user ↔ org linkage + role)
        ├── journal_entries  (filtered by org_id)
        ├── products         (filtered by org_id)  
        ├── employees        (filtered by org_id)
        └── ...semua tabel bisnis lainnya
```

### RBAC Roles

| Role | Akses |
|---|---|
| `owner` | Full access semua modul |
| `admin` | Full access kecuali billing |
| `manager` | Read/write operasional, tidak bisa hapus data sensitif |
| `staff` | Input transaksi, tidak bisa void/approve |
| `hr` | Akses modul HRIS & Payroll saja |
| `viewer` | Read-only di semua modul |

**Catatan kritis:** RLS diaktifkan di SEMUA tabel bisnis. Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) bypass RLS — jangan pernah expose ke client.

---

## Struktur Modul

```
modules/
├── accounting/actions/
│   ├── journal.actions.ts      # Core ledger engine (double-entry)
│   ├── reports.actions.ts      # P&L, Balance Sheet, Cash Flow
│   ├── export.actions.ts       # XLSX export engine (ExcelJS)
│   ├── zakat.actions.ts        # Zakat Tijarah (fiqh-compliant)
│   ├── assets.actions.ts       # Fixed assets & depreciation
│   ├── payroll → via HRIS
│   └── ...16 action files total
├── ai/actions/
│   └── vision.actions.ts       # Gemini OCR untuk nota/receipt
├── hris/                       # Employee, payroll, attendance
├── inventory/                  # Products, stock movements, WMS
├── sales/                      # SO, payments, returns
├── purchasing/                 # PO, payments, returns
└── ...
```

### Logika Bisnis di Database

Operasi kritikal diimplementasikan sebagai **PostgreSQL Stored Procedures** untuk menjamin atomicity:

- `generate_payslips_for_run(p_run_id)` — Generate slip gaji massal
- `process_payroll_payment(p_run_id, p_bank_account_id, p_created_by)` — Bayar gaji + auto-journal
- `process_expense_claim(p_claim_id, ...)` — Approve reimbursement + journal
- `recalculate_average_cost()` — Trigger: update average cost setiap ada inbound stock
- `validate_journal_balance_on_post()` — Trigger: cegah posting jurnal tidak balance

---

## Modul yang Tersedia

| Modul | Status | Catatan |
|---|---|---|
| Akuntansi & GL | ✅ Production-ready | Double-entry, audit trail, full reports |
| Zakat Tijarah | ✅ Production-ready | Fiqh-compliant, haul tracking Hijriah |
| HRIS & Payroll | ✅ Production-ready | Terintegrasi GL |
| Sales & Purchasing | ✅ Production-ready | Termasuk return & payment |
| POS Kasir | ✅ Production-ready | WhatsApp receipt, tax, discount |
| Inventory & WMS | ✅ Production-ready | Average cost, multi-warehouse |
| Fixed Assets | ✅ Production-ready | Termasuk disposal |
| Aging Report AR/AP | ✅ Production-ready | |
| Manufacturing (BoM) | 🟡 Foundation | Schema siap, UI perlu verifikasi |
| Fleet & Rental | 🟡 Foundation | Schema siap |
| BSC (Balanced Scorecard) | ✅ Available | |
| Multi-Branch | 🟡 Partial | Infrastructure ada, konsolidasi dalam progress |

---

## Export Laporan

NIZAM menghasilkan file XLSX enterprise-grade via endpoint `GET /api/export`:

| Parameter `type` | Laporan |
|---|---|
| `pl` | Laporan Laba Rugi |
| `bs` | Neraca (Balance Sheet) |
| `gl` | Buku Besar Umum |
| `zakat` | Laporan Zakat Tijarah (untuk audit LAZ) |

---

## Deployment

Dioptimasi untuk **Vercel**. Pastikan semua environment variables di-set di Vercel dashboard.

```bash
npx vercel --prod
```

---

## Kontribusi

1. Fork repo ini
2. Jalankan `npm run dev` untuk development
3. Migrations baru harus menggunakan nomor urut berikutnya (`1024_xxx.sql`)
4. Server Actions (`'use server'`) harus selalu validasi `auth.uid()` sebelum operasi
5. Semua tabel baru **wajib** mengaktifkan RLS dan membuat policy yang sesuai

---

*NIZAM ERP — Built for Indonesia. Honest Accounting, Halal Business.*
