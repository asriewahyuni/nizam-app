# Blueprint Nizam Mini ERP

> Dokumen ini menjelaskan arsitektur, definisi core, dan filosofi desain sistem Nizam ERP.
> Ditujukan untuk developer, product manager, dan stakeholder teknis.

---

## Filosofi Dasar

Nizam dibangun di atas satu prinsip teknis fundamental:

> **Setiap baris data di-scope ke `org_id`.**

Migration pertama (`001_organizations.sql`) sudah menetapkan ini — `organizations` adalah *root entity*, bukan user. User hanya "anggota" dari sebuah org. Ini bukan kebetulan; ini keputusan arsitektur yang menentukan seluruh bentuk sistem dan memungkinkan Nizam beroperasi sebagai platform **multi-tenant sejati**.

---

## Layer Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM LAYER                                             │
│  SaaS Billing · Paket Langganan · Auth · Multi-tenant       │
├─────────────────────────────────────────────────────────────┤
│  GOVERNANCE LAYER                                           │
│  Org Hierarchy · RBAC · Branch · Approval · Audit Log       │
├─────────────────────────────────────────────────────────────┤
│  CORE ERP LAYER          ← "otak" sistem                    │
│  Accounting · Finance · Inventory                           │
│  Purchasing · Sales · HRIS                                  │
├─────────────────────────────────────────────────────────────┤
│  VERTICAL MODULE LAYER                                      │
│  Fleet · Factory · Construction · Workshop · Syirkah        │
│  Koperasi · LMS · Services · E-Commerce · Marketplace       │
└─────────────────────────────────────────────────────────────┘
```

Prinsip dependensi antar layer:

- **Core** bergantung pada Governance, tidak pada Vertical.
- **Vertical** bergantung pada Core (semua posting ke journal_lines, menggunakan accounts, inventory, dll).
- **Governance** tidak bergantung pada siapapun — dia yang mengontrol semua.
- **Platform** adalah wrapper eksternal yang memonetisasi keseluruhan sistem.

---

## Core ERP — Definisi & Alasan

Kriteria sebuah modul disebut **Core**:

1. **Modul lain bergantung padanya** — ada FK, trigger, atau join dari modul lain ke sini.
2. **Sistem tidak bisa beroperasi tanpanya** — bukan fitur opsional, tapi prasyarat.

Berdasarkan dua kriteria ini, ada **6 modul Core**:

---

### 1. 🏛️ Accounting (Akuntansi)

**Mengapa Core:**
Semua modul lain pada akhirnya *posting* ke sini. Sales menghasilkan jurnal pendapatan. Payroll menghasilkan jurnal beban gaji. Fleet, Factory, Construction — semuanya berakhir di `journal_lines`. Tabel `accounts` (Chart of Accounts) adalah hub FK terbesar di sistem — **28+ tabel** me-reference-nya langsung. Tanpa CoA aktif, tidak ada yang bisa diposting.

**Isi modul:**
- Chart of Accounts (CoA) — standar PSAK
- Journal Entries & Journal Lines
- General Ledger
- Bank Reconciliation
- Opening Balances
- Fiscal Period Closing
- Budgeting
- Multi-currency
- Tax Engine (PPN/PPh 21/PPh 23)
- Shariah Account Mapping

**Standar:** PSAK (Pernyataan Standar Akuntansi Keuangan) Indonesia. Hierarki 3 level: Root → Group → Detail/Posting.

---

### 2. 💰 Finance (Kas & Bank)

**Mengapa Core:**
`bank_accounts` dan `cash_transactions` adalah titik masuk/keluar uang nyata. Setiap pembayaran dari modul manapun (Sales Payment, Purchase Payment, Payroll Disbursement) bermuara ke sini. Berbeda dari Accounting yang mencatat *pencatatan*, Finance mencatat *pergerakan kas aktual*.

**Isi modul:**
- Bank Accounts & Petty Cash
- Cash Transactions (masuk/keluar)
- Sales Payments (penerimaan piutang)
- Purchase Payments (pelunasan hutang)
- Aging Receivables & Payables
- Cash Flow reporting

---

### 3. 📦 Inventory (Persediaan)

**Mengapa Core:**
Sales tidak bisa delivery tanpa stok. Purchasing tidak bisa receive tanpa menambah stok. Factory tidak bisa produksi tanpa raw material. Semua modul operasional bergantung pada stock level dan valuasi. Ada mekanisme `inventory_movements` yang auto-trigger dari setiap transaksi barang di seluruh sistem.

**Isi modul:**
- Products & Product Categories
- Stock Movements (otomatis dari transaksi)
- Inventory Adjustments
- Inventory Transfers (antar cabang)
- Landed Cost (biaya pengiriman ke HPP)
- Average Cost Valuation
- Warehouse Management (add-on)

---

### 4. 🛒 Purchasing (Pembelian)

**Mengapa Core:**
Supply chain dimulai dari sini. Siklus `PO → Goods Receipt → AP → Payment` menyentuh tiga modul sekaligus: Inventory (tambah stok), Accounting (catat hutang & HPP), dan Finance (kas keluar). Hampir tidak ada bisnis yang tidak punya proses pembelian.

**Isi modul:**
- Purchase Orders (PO)
- Goods Receipt / Penerimaan Barang
- Purchase Returns
- Purchase Payments
- Supplier Management
- Purchase Reporting

---

### 5. 🏷️ Sales (Penjualan)

**Mengapa Core:**
Revenue entry point utama. Siklus `Sales Order → Delivery → Invoice → Payment` menyentuh: Inventory (kurangi stok), Accounting (catat pendapatan & piutang), dan Finance (kas masuk). Bersama Purchasing membentuk **siklus bisnis penuh** (buy-sell cycle).

**Isi modul:**
- Sales Orders
- Delivery / Pengiriman
- Sales Invoices
- Sales Returns
- Sales Payments
- Point of Sale (POS)
- CRM (kontak pelanggan)
- Shariah Sales Mode (murabahah, dll)

---

### 6. 👥 HRIS (Human Resource & Payroll)

**Mengapa Core:**
Di hampir semua bisnis Indonesia, payroll adalah pengeluaran terbesar dan paling reguler. HRIS di Nizam bukan sekadar data karyawan — proses payroll secara otomatis men-generate `journal_lines` (beban gaji, hutang PPh 21, disbursement ke bank). Integrasi akuntansi yang dalam ini yang membuatnya Core, bukan add-on.

**Isi modul:**
- Employees & Departments
- Payroll & Payslips
- Payroll Components (gaji pokok, tunjangan, potongan)
- Leave Management
- Expense Claims & Reimbursement
- Attendance
- PPh 21 Integration

---

## Governance Layer

Bukan modul bisnis, tapi **wajib ada** — sistem tidak bisa berjalan tanpa layer ini.

### Organization & Branch

- **Multi-tenant:** Satu user bisa memiliki beberapa org (PT, CV, Koperasi, Yayasan).
- **Multi-entity (Holding):** Org bisa punya `parent_org_id` — struktur holding company. CoA child org bisa diwarisi dari parent (`mode: INHERITED`) atau mandiri (`mode: LOCAL`).
- **Branch (Cabang):** Di dalam satu org bisa ada banyak cabang. Data transaksi bisa di-filter per branch. Laporan konsolidasi tersedia di level org.

### RBAC (Role-Based Access Control)

Hierarki role: `owner → admin → manager → staff → viewer`

Setiap server action mengecek role sebelum eksekusi. Ada granular `permissions` array per-role untuk kontrol yang lebih detail (misal: `manage_accounting`, `approve_purchase`, dll).

### Approval System

Workflow approval multi-level untuk transaksi kritis (PO di atas threshold, void jurnal yang sudah posted, dll). Built-in sejak awal — bukan plugin.

### Audit Log

Setiap operasi `INSERT / UPDATE / DELETE` pada tabel kritis terekam dengan `old_data` dan `new_data` dalam format JSONB. Forensic trail yang tidak bisa dimatikan dari aplikasi.

---

## Vertical Modules — Industry Pack

Modul yang menjawab kebutuhan industri spesifik. Semuanya **bergantung pada Core** untuk pencatatan keuangan, tapi Core tidak bergantung pada mereka. Bisa diaktifkan sebagai add-on per org.

| Modul | Target Industri | Integrasi Core |
|---|---|---|
| **Fleet & Rental** | Transportasi, bus, ambulans, kapal, kendaraan sewa | Depreciation → Accounting; Fuel/Maintenance → Purchasing |
| **Factory / Manufacturing** | Pabrik, produksi, BOM | BOM → Inventory; Work Order → Accounting (WIP) |
| **Construction** | Kontraktor, RAB, progress billing | Budget → Accounting; Progress Invoice → Sales |
| **Workshop / Bengkel** | Bengkel motor, service center | Service Order → Sales; Sparepart → Inventory |
| **Services / Job Order** | Jasa umum, proyek, billing per-jam | Job Billing → Sales; Resource Cost → Accounting |
| **Syirkah** | Kemitraan bisnis syariah | Bagi hasil → Accounting (Equity); Ijab-Qobul digital |
| **Koperasi Syariah** | Simpan pinjam, murabahah, mudharabah | Simpanan → Accounting; Pembiayaan → Finance |
| **LMS** | Lembaga pelatihan, kursus berbayar | Enrollment Fee → Sales; Instructor Cost → HRIS |
| **E-Commerce** | Toko online dengan theme builder | Orders → Sales; Stock → Inventory |
| **Marketplace** | Platform multi-seller | Komisi → Accounting; Seller Settlement → Finance |

---

## Platform Layer — Nizam sebagai SaaS

Nizam **menjual dirinya sendiri** melalui infrastruktur SaaS bawaan:

- `saas_packages` — Paket langganan: **Mini, Pro, Enterprise, ABS Special**
- `saas_invoices` — Penagihan otomatis ke tenant
- `saas_vouchers` — Diskon/trial voucher
- Sistem **reseller** — mitra yang bisa menjual Nizam ke klien mereka
- `org_module_instances` — Tracking status onboarding per modul per org

**Distribusi modul per paket:**

| Modul | Mini | Pro | Enterprise |
|---|:---:|:---:|:---:|
| Accounting | ✅ | ✅ | ✅ |
| Finance | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ |
| Purchasing | ✅ | ✅ | ✅ |
| Sales + POS | ✅ | ✅ | ✅ |
| CRM | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| HRIS | add-on | ✅ | ✅ |
| Manufacturing | add-on | ✅ | ✅ |
| Audit | add-on | ✅ | ✅ |
| Fleet & Rental | add-on | add-on | ✅ |
| Construction | add-on | add-on | ✅ |
| Multi-Entity | add-on | add-on | add-on |

---

## Shariah-First Design

Hampir semua modul keuangan punya mode syariah. Ini bukan afterthought — built-in sejak desain awal:

- **`shariah_settings`** per-org: toggle aktif/nonaktif akun syariah
- **CoA Syariah:** dedicated akun murabahah, mudharabah, musyarakah, zakat
- **Sales Mode Syariah:** invoice dengan akad murabahah
- **Syirkah Module:** kemitraan dengan bagi hasil, ijab-qobul digital, signing lifecycle
- **Koperasi Syariah:** simpanan pokok/wajib, pembiayaan IMBT, sertifikasi DPS
- **Zakat Engine:** kalkulasi zakat maal, zakat perusahaan

Ada dedicated migrations untuk injeksi akun-akun syariah ke dalam CoA standar PSAK. Ini menunjukkan Nizam dirancang sejak awal untuk pasar Indonesia yang religius — bukan konversi dari sistem konvensional.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5.9 |
| Database | Railway PostgreSQL (via `pg` native client) |
| Auth | Internal auth berbasis cookie session |
| Styling | TailwindCSS v4 + Framer Motion |
| Storage | AWS S3 |
| Email | Mailketing API |
| AI | Google Vertex AI + Google AI Studio |
| Monitoring | Sentry + Microsoft Clarity |
| Testing | Vitest |

**Catatan penting:** Supabase tidak lagi digunakan sebagai runtime. `lib/supabase/` adalah compatibility layer di atas Railway PostgreSQL. Semua query data dan auth berjalan penuh di Railway dengan internal auth session.

---

## Ringkasan

```
Core Nizam = Accounting + Finance + Inventory + Purchasing + Sales + HRIS
```

Dengan **Governance Layer** (Org, RBAC, Approval, Audit) sebagai fondasi wajib di bawahnya, dan **Vertical Modules** sebagai ekstensi yang *menulis ke Core* — bukan sistem terpisah.

Satu sumber kebenaran untuk semua pencatatan keuangan: **`journal_lines`**.
Satu root entity untuk semua data: **`organizations`**.

---

*Dokumen ini di-generate berdasarkan analisis codebase nizam-app per Mei 2026.*
