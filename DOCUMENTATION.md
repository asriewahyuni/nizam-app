# NIZAM ERP Documentation

Dokumen ini disusun dari audit langsung terhadap kode pada **29 Maret 2026**. Seluruh isi di bawah mengacu ke kondisi repo saat ini, bukan ke README lama.

## 1. Ringkasan Eksekutif

NIZAM ERP adalah aplikasi ERP multi-tenant berbasis Next.js App Router dan Supabase. Sistem ini memadukan modul akuntansi, kas & bank, inventory, purchasing, sales, POS, HRIS, payroll, fixed assets, budgeting, tax, zakat, approval, audit, manufacturing, fleet, service order, billing SaaS, pricing, admin SaaS, mode demo, serta landing khusus voucher ABS.

Snapshot saat audit:

- `55` route page file
- `40` client page/component utama
- `41` server action file
- `127` migration SQL
- `6` test file
- `1` route handler (`app/api/export/route.ts`)
- `1` request proxy (`proxy.ts`)

## 2. Stack Aktual

| Lapisan | Implementasi aktual |
|---|---|
| Framework | Next.js `16.2.1` |
| UI runtime | React `19.2.4` |
| Router | App Router |
| Rendering mix | Server Components + Client Components + Server Actions |
| Request interception | `proxy.ts` |
| Database | Supabase / PostgreSQL |
| Auth | Supabase Auth |
| Security | RLS PostgreSQL + org isolation + role/module gating |
| Styling | Tailwind CSS `4.2.2`, custom `NizamUI`, Framer Motion |
| Charts | Recharts |
| XLSX export | ExcelJS |
| OCR / AI | Google Gemini via `@google/generative-ai` |
| Email | Resend |
| QR / Scan | `html5-qrcode`, `qrcode.react` |
| Test runner | Vitest `4.1.1` |

## 3. Struktur Repo

### 3.1 Folder utama

- `app/`: seluruh route App Router.
- `modules/`: domain business logic dan server actions.
- `components/`: shared UI dan shared layout components.
- `lib/`: utilitas, Supabase client/server, hooks, email sender.
- `supabase/migrations/`: evolusi skema database.
- `types/database.types.ts`: tipe database Supabase.
- `__tests__/`: unit test dan mock helper.
- `public/`: manifest PWA dan aset publik.

### 3.2 Entry points penting

- `app/layout.tsx`: root layout, metadata, viewport, manifest.
- `app/(auth)/layout.tsx`: layout halaman login/register.
- `app/(dashboard)/layout.tsx`: layout utama dashboard, guard session/org/module/RBAC.
- `proxy.ts`: refresh session Supabase dan proteksi route.
- `app/api/export/route.ts`: endpoint export XLSX.
- `next.config.mjs`: build `standalone`, namun TypeScript build errors di-ignore.

### 3.3 Shared UI penting

- `components/ui/NizamUI.tsx`: `SafeButton`, `PageHeader`, `StatCard`, `EmptyState`, `SectionCard`, `SectionHeader`, `StatusBadge`, `ConfirmDialog`.
- `components/shared/AppSidebar.tsx`: navigasi modul berdasarkan role, permission, enabled modules, dan mode demo.
- `components/shared/AppHeader.tsx`: header organisasi, branch switcher, pending approvals.
- `components/shared/StartupWizard.tsx`: wizard startup.
- `components/shared/MobileBottomNav.tsx`: navigasi mobile.
- `components/shared/BarcodeScanner.tsx` dan `BarcodeLabel.tsx`: barcode scan/print.

## 4. Arsitektur Aplikasi

### 4.1 Routing model

NIZAM menggunakan App Router. Route dibagi menjadi:

- `(auth)`: login, register, join invitation, forgot/update password.
- `(dashboard)`: seluruh area aplikasi setelah user punya org aktif.
- route publik khusus: `/`, `/demo`, `/abs`, `/onboarding`.
- route handler: `/api/export`.

### 4.2 Root flow

- `/` memeriksa session lewat `getSession()`.
- Jika belum login, user diarahkan ke `/login`.
- Jika sudah login tetapi belum punya organisasi aktif, root menampilkan onboarding.
- Jika organisasi aktif tersedia, user diarahkan ke `/dashboard`.

### 4.3 Dashboard layout guard

`app/(dashboard)/layout.tsx` melakukan:

- validasi session
- validasi organisasi aktif
- fetch notifikasi lintas modul
- module guard berbasis `enabledModules`
- permission guard untuk non-owner/non-admin
- render sidebar, header, demo banner, startup wizard, mobile nav, dan floating plan badge

Layout ini juga membaca header `x-pathname` yang di-set di `lib/supabase/middleware.ts`.

### 4.4 Proxy

Repo ini sudah mengikuti istilah **Proxy** milik Next.js 16.

`proxy.ts`:

- memanggil `updateSession(request)`
- menyegarkan cookie session Supabase
- redirect user login ke dashboard bila sudah auth
- redirect user anonymous dari route privat ke login

Route yang dianggap privat mencakup hampir seluruh area bisnis: `/dashboard`, `/billing`, `/cash`, `/contacts`, `/factory`, `/fleet`, `/hris`, `/pos`, `/pricing`, `/profil-saya`, `/reports`, `/services`, `/settings`, `/accounting`, `/inventory`, `/sales`, `/purchasing`, dan `/admin`.

### 4.5 Route handler

`app/api/export/route.ts` menerima `GET` dan menghasilkan file XLSX untuk:

- `type=pl`
- `type=bs`
- `type=gl`
- `type=zakat`

Guard yang dipakai:

- user harus login
- `orgId` harus diberikan
- user harus tercatat sebagai anggota aktif di `org_members`

## 5. Auth, Tenant, Org, dan Akses

### 5.1 Model tenant

Isolasi tenant bertumpu pada:

- `organizations`
- `org_members`
- `roles`
- hampir semua tabel bisnis memiliki `org_id`
- policy RLS membaca `auth.uid()` dan keanggotaan org

### 5.2 Alur auth yang tersedia

#### Owner / business account

- `signUp(formData)`: daftar owner berbasis email/password.
- `signIn(formData)`: login email/password.
- `signOut()`: logout dan redirect ke `/login`.

#### Employee account

- `verifyEmployeeNikByToken(token, nik)`: verifikasi invitation token + NIK.
- `registerEmployeeAccount(formData)`: membuat auth user internal staff.
- `signInWithNik(formData)`: login staff via NIK + password.
- `requestPasswordReset(nik)`: menandai permintaan reset dari sisi HRIS.
- `resetEmployeePassword(employeeId, newPassword)`: reset password karyawan via admin client.
- `sendPasswordResetEmail(formData)`: reset password via email Supabase.

### 5.3 Organisasi aktif

`getActiveOrg()` melakukan:

- baca session user
- dukungan mode demo via cookie `nizam_demo_org_id`
- ambil membership aktif paling awal
- resolve plan aktif dan enabled modules dari `saas_packages`
- gabungkan `active_addons`
- ambil `job_title` dari tabel `employees`

Hook client `useActiveOrgId()` memanggil `getActiveOrgIdAction()` agar resolusi org aktif konsisten dengan server.

### 5.4 Onboarding

`createOrganization(formData)`:

- membuat `organizations`
- membuat `org_members` dengan role `owner`
- mengisi `settings.plan`
- dapat men-trigger mode demo (`plan=demo`)
- dapat auto-apply voucher ABS (`plan=abs`)

### 5.5 RBAC dan module gating

Kontrol akses terjadi di dua level:

- level database: RLS dan role/membership
- level aplikasi: guard modul dan permission di dashboard layout + sidebar

Sumber data utamanya:

- `roles.permissions`
- `organizations.enabled_modules`
- `saas_packages.modules`
- `organizations.active_addons`

### 5.6 Admin SaaS

`app/(dashboard)/admin/layout.tsx` memakai allowlist email `SUPER_ADMIN_EMAILS`. Hanya email tertentu yang bisa masuk ke `/admin`.

## 6. Peta Route

### 6.1 Route publik dan auth

| Route | Fungsi |
|---|---|
| `/` | Root redirect/login/onboarding/dashboard gate |
| `/onboarding` | Pembuatan organisasi baru |
| `/demo` | Mulai sesi demo |
| `/abs` | Landing voucher ABS2024 |
| `/sp/[orgSlug]/[pageSlug]` | Sales page publik per organisasi |
| `/login` | Login owner/staff |
| `/register` | Registrasi owner |
| `/forgot-password` | Kirim reset password email |
| `/update-password` | Set password baru |
| `/join/[token]` | Aktivasi akun karyawan lewat token |

### 6.2 Route dashboard inti

| Route | Fungsi |
|---|---|
| `/dashboard` | KPI overview, OCF, runway, pareto analytics |
| `/profil-saya` | Profil karyawan aktif |
| `/billing` | Billing organisasi aktif |
| `/billing/invoice/[id]` | Halaman print invoice billing |
| `/pricing` | Daftar paket SaaS |
| `/admin` | Admin panel SaaS |

### 6.3 Route finance & accounting

| Route | Fungsi |
|---|---|
| `/cash` | Bank accounts, bank transactions, kas/bank overview |
| `/accounting/journal` | Buku besar dan jurnal manual |
| `/accounting/aging` | AR/AP aging |
| `/accounting/approvals` | Approval center |
| `/accounting/assets` | Fixed assets |
| `/accounting/audit` | Audit integritas data |
| `/accounting/budgets` | Budgeting dan budget vs actual |
| `/accounting/closing` | Fiscal period closing/opening |
| `/accounting/forecast` | Cash flow forecast |
| `/accounting/reimburse` | Reimbursement |
| `/accounting/tax` | Ringkasan pajak |
| `/accounting/zakat` | Zakat tijarah dan haul |
| `/settings/accounts` | Chart of Accounts |
| `/settings/accounts/new` | Tambah akun |
| `/settings/accounts/[id]` | Edit akun |

### 6.4 Route operasional

| Route | Fungsi |
|---|---|
| `/inventory` | Master produk, opname, transfer, write-off, barcode |
| `/inventory/warehouses` | Master gudang |
| `/inventory/warehouses/[id]` | Detail bin gudang |
| `/inventory/ledger/[id]` | Stock ledger produk |
| `/purchasing` | PO, penerimaan, pembayaran, retur, purchase requests |
| `/factory` | BoM, work order, completion |
| `/fleet` | Fleet assets, bookings, routes, schedules, tickets, attendance, maintenance |
| `/services` | Service/job orders |

### 6.5 Route sales & CRM

| Route | Fungsi |
|---|---|
| `/contacts` | Customer/supplier CRM |
| `/pos` | POS transaksi tunai |
| `/sales` | Sales order, delivery, payment, return |
| `/sales/quotations` | Quotation |
| `/sales/pipeline` | Sales pipeline |
| `/sales/commission` | Komisi penjualan |
| `/sales/promos` | Promo UI |
| `/sales/pages` | Sales Page Studio, generator halaman, publish, leads |

### 6.6 Route HRIS & settings

| Route | Fungsi |
|---|---|
| `/hris` | Karyawan, payroll components, payroll runs, activation |
| `/settings/business` | Profil bisnis, format dokumen, logo, slug, dan danger zone reset data |
| `/settings/roles` | Struktur jabatan dan permissions |
| `/settings/users` | Membership organisasi |
| `/settings/branches` | Cabang/divisi |
| `/settings/audit` | Audit trail admin/user |
| `/audit` | Redirect ke `/settings/audit` |

### 6.7 Route reports

| Route | Fungsi |
|---|---|
| `/reports` | P&L, balance sheet, cash flow |
| `/reports/bsc` | Balanced scorecard |
| `/reports/pareto` | Pareto report |

## 7. Modul Bisnis

### 7.1 Organization & SaaS Core

File utama:

- `modules/organization/actions/org.actions.ts`
- `modules/organization/actions/org-id.actions.ts`
- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/approval.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/hris.actions.ts`

Kemampuan:

- create/update organization
- active org resolution
- branch management
- invitation token management
- owner-only reset transaksi dan reset seluruh data operasional
- billing invoice creation
- payment proof upload confirmation
- voucher activation
- approval queue dan approval history
- audit log admin-level

Tabel yang banyak disentuh:

- `organizations`
- `org_members`
- `branches`
- `org_invitations`
- `saas_packages`
- `saas_invoices`
- `saas_vouchers`
- `approval_requests`
- `audit_logs`

### 7.2 Accounting

File action:

- `coa.actions.ts`
- `journal.actions.ts`
- `reports.actions.ts`
- `export.actions.ts`
- `analytics.actions.ts`
- `aging.actions.ts`
- `tax.actions.ts`
- `zakat.actions.ts`
- `assets.actions.ts`
- `budget.actions.ts`
- `closing.actions.ts`
- `forecast.actions.ts`
- `audit.actions.ts`
- `bsc.actions.ts`
- `shariah.actions.ts`
- `price.actions.ts`
- `reimburse.actions.ts`

Kemampuan penting:

- manual journal + auto-post
- posting/void journal dan two-way sync ke sub-ledger tertentu
- balance sheet, P&L, cash flow, general ledger
- XLSX export
- dashboard analytics dan pareto
- AR/AP aging
- tax ledger summary untuk akun `1401`, `2201`, `2202`, `2203`
- zakat haul dengan nishab emas/perak dan timeline aset
- fixed assets, capitalization, depreciation preview/run, disposal
- budgeting dan budget vs actual
- fiscal period open/close
- cash flow forecast
- audit integrity checks
- reimbursement + receipt upload + approval
- shariah account activation/injection

Tabel/RPC penting:

- `journal_entries`, `journal_lines`, `account_balances`
- `accounts`, `fixed_assets`, `asset_depreciation_logs`
- `budgets`, `fiscal_periods`
- `reimbursements`, `reimbursement_items`
- `zakat_haul`, `zakat_asset_timeline`, `zakat_haul_events`
- RPC seperti `seed_default_coa`, `process_asset_disposal`

### 7.3 Cash & Bank

File action:

- `modules/cash/actions/bank.actions.ts`
- `modules/cash/actions/reconcile.actions.ts`

Kemampuan:

- CRUD rekening bank
- input transaksi kas/bank
- fetch transaksi terbaru
- hapus transaksi sambil void linked journal
- upload/parse CSV mutasi bank
- daftar mutasi belum match

Tabel:

- `bank_accounts`
- `bank_transactions`
- `bank_mutations`
- `journal_entries`

### 7.4 Inventory & WMS

File action:

- `modules/inventory/actions/inventory.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`

Kemampuan:

- master produk
- perhitungan stock in/out/value dari `stock_movements`
- stock adjustment
- write-off
- transfer antar gudang
- warehouse dan warehouse bins
- barcode lookup
- stock ledger per produk

Catatan implementasi:

- transfer stok dimodelkan sebagai adjustment dua baris
- adjustment dibuat via helper collision-safe untuk nomor adjustment
- beberapa operasi tergantung RPC `process_inventory_adjustment`

Tabel/RPC:

- `products`
- `stock_movements`
- `inventory_adjustments`
- `inventory_adjustment_items`
- `inventory_stocks`
- `warehouses`
- `warehouse_bins`
- RPC `process_inventory_adjustment`

### 7.5 Purchasing

File action:

- `modules/purchasing/actions/purchasing.actions.ts`

Kemampuan:

- create PO dengan alokasi landed cost
- auto-create/update produk dari baris PO
- receive purchase dan sync stock + GL
- void purchase via RPC atomik
- purchase payment
- purchase return
- purchase requests untuk manufaktur/pembelian internal

Tabel/RPC penting:

- `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`
- `purchase_requests`
- `stock_movements`, `inventory_stocks`
- RPC `process_purchase_atomic`
- RPC `void_purchase_atomic`
- RPC `process_purchase_payment_atomic`
- RPC `process_purchase_return_atomic`
- RPC `adjust_inventory_stock`

### 7.6 Sales, Quotation, POS

File action:

- `modules/sales/actions/sales.actions.ts`
- `modules/sales/actions/pos.actions.ts`
- `modules/sales/actions/sales-page.actions.ts`
- `modules/sales/lib/sales-page.ts`
- `modules/sales/lib/sales-page.server.ts`

Kemampuan:

- create sales order
- approval request untuk sales order baru
- delivery via RPC atomik
- void sale dan revert stock/journal terkait
- sales payment
- sales return
- quotation create/convert
- POS cash sale dengan walk-in customer fallback
- generator sales page per organisasi
- publish route publik `/sp/[orgSlug]/[pageSlug]`
- Meta Pixel ID per halaman
- lead capture publik via `/api/sales-pages/lead`

Tabel/RPC penting:

- `sales`, `sales_items`, `sales_payments`, `sales_returns`
- `sales_pages`
- `sales_page_leads`
- `approval_requests`
- `contacts`
- RPC `process_sales_delivery_atomic`
- RPC `process_sales_payment_atomic`
- RPC `process_sales_return_atomic`

### 7.7 Contacts / CRM

File action:

- `modules/contacts/actions/contact.actions.ts`

Kemampuan:

- daftar contact by type
- tambah customer/supplier
- digunakan lintas purchasing, sales, POS, services, fleet ticketing

### 7.8 HRIS & Payroll

File action:

- `modules/hris/actions/employee.actions.ts`
- `modules/hris/actions/expense.actions.ts`
- `modules/hris/actions/payroll.actions.ts`
- `modules/auth/actions/auth.actions.ts` juga terlibat untuk aktivasi dan reset password

Kemampuan:

- CRUD karyawan
- upload avatar karyawan
- self profile update
- payroll component management
- payroll runs
- generate payslip via RPC
- pay payroll via RPC
- fix empty payroll journals
- expense claims
- reset password permintaan HR
- invitation-based employee activation

Tabel/RPC penting:

- `employees`
- `payroll_components`
- `payroll_runs`
- `payslips`
- `payslip_lines`
- `attendance`
- `leave_requests`
- `expense_claims`
- RPC `generate_payslips_for_run`
- RPC `process_payroll_payment`
- RPC `void_payroll_run`
- RPC `process_expense_claim`

UI tab utama di `HrisClient.tsx`:

- `EMPLOYEES`
- `POSITIONS`
- `PAYROLL`
- `ATTENDANCE`
- `RUNS`
- `ACTIVATION`

### 7.9 Manufacturing

File action:

- `modules/factory/actions/factory.actions.ts`

Kemampuan:

- BoM header dan item
- work order
- work order extra costs
- finish goods bins
- work order completion via RPC v2 dengan fallback v1
- create purchase requests dari kebutuhan produksi

Tabel/RPC:

- `production_boms`
- `production_bom_items`
- `production_work_orders`
- `production_wo_costs`
- `purchase_requests`
- RPC `process_work_order_completion_v2`
- RPC `process_work_order_completion`

### 7.10 Fleet & Rental / PO Bus

File action:

- `modules/fleet/actions/fleet.actions.ts`

Kemampuan:

- asset fleet
- booking rental dengan overlap guard
- sync status asset terhadap booking aktif
- route management
- schedule management
- ticketing
- maintenance/medical record kendaraan
- crew management
- attendance crew via GPS + QR
- terminal management

Sub-area UI di `FleetClient.tsx`:

- `UNITS`
- `BOOKINGS`
- `PO_BUS`
- `LABS`

Sub-tab PO bus:

- `ROUTES`
- `SCHEDULES`
- `TICKETING`
- `CREW`
- `ATTENDANCE`

Tabel/RPC:

- `fleet_assets`
- `fleet_bookings`
- `fleet_routes`
- `fleet_schedules`
- `fleet_tickets`
- `fleet_maintenance_labs`
- `fleet_terminals`
- `attendance`
- RPC `create_fleet_medical_record`

### 7.11 Service Orders

File action:

- `modules/services/actions/service.actions.ts`

Kemampuan:

- daftar service orders
- create service order
- update status service order

Tabel:

- `service_orders`

### 7.12 Demo & ABS

File action:

- `modules/demo/actions/demo.actions.ts`

Kemampuan:

- login/boot demo account `demo@nizam.app`
- hapus org demo lama dan buat org demo baru
- seed data berdasarkan tipe bisnis
- set cookie `nizam_demo_org_id`
- cleanup demo org saat logout

Tipe demo:

- `COMPUTER`
- `CATERING`
- `RESTAURANT`
- `SUPPLIER_MBG`
- `BLANK`

Landing `/abs` memeriksa voucher `ABS2024` dan mengarahkan registrasi plan ABS.

### 7.13 AI & Email

File:

- `modules/ai/actions/vision.actions.ts`
- `lib/email/sender.ts`

Kemampuan AI:

- OCR receipt/invoice memakai Gemini
- normalisasi format Rupiah Indonesia
- fallback error manual input jika AI gagal

Kemampuan email:

- kirim invoice email
- kirim promo broadcast

## 8. Database & Migrasi

### 8.1 Gambaran umum

Repo menyimpan:

- `129` migration SQL di `supabase/migrations/`
- `master_init.sql` sebagai bootstrap SQL lama/fondasi

### 8.2 Entitas inti

Entitas inti yang paling sering muncul:

- organisasi dan membership: `organizations`, `org_members`, `roles`, `branches`
- akuntansi: `accounts`, `journal_entries`, `journal_lines`, `account_balances`
- cash/bank: `bank_accounts`, `bank_transactions`, `bank_mutations`
- inventory: `products`, `stock_movements`, `inventory_stocks`, `inventory_adjustments`, `inventory_adjustment_items`, `warehouses`, `warehouse_bins`
- sales: `sales`, `sales_items`, `sales_payments`, `sales_returns`
- sales page: `sales_pages`, `sales_page_leads`
- purchasing: `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_requests`
- HRIS: `employees`, `payroll_components`, `payroll_runs`, `payslips`, `payslip_lines`, `attendance`, `leave_requests`, `expense_claims`
- approval/audit: `approval_requests`, `audit_logs`
- assets: `fixed_assets`, `asset_depreciation_logs`
- manufacturing: `production_boms`, `production_bom_items`, `production_work_orders`, `production_wo_costs`
- fleet: `fleet_assets`, `fleet_bookings`, `fleet_routes`, `fleet_schedules`, `fleet_tickets`, `fleet_maintenance_labs`, `fleet_terminals`
- services: `service_orders`
- SaaS: `saas_packages`, `saas_invoices`, `saas_vouchers`, `saas_config`
- zakat: `zakat_haul`, `zakat_haul_events`, `zakat_asset_timeline`

### 8.3 Migration timeline ringkas

#### Foundation ERP

- `001_organizations.sql`: organizations, org_members, helper RLS.
- `002_rbac.sql`: roles, permission engine.
- `003_chart_of_accounts.sql`: CoA dasar.
- `004_journal_entries.sql`: journal core.
- `005` sampai `048`: cash/bank, sales/purchasing, inventory, assets, payroll, budgeting, aging, audit, performance helper, RLS hardening.

#### Manufacturing / Fleet / Services / Multi-branch

- `1000_manufacturing_foundation.sql`
- `1001_manufacturing_completion_engine.sql`
- `1002_fleet_rental_foundation.sql`
- `1003_service_order_foundation.sql`
- `1004_multi_branch_infrastructure.sql`

#### Shariah / Zakat / Barcode / Production request

- `1006_shariah_coa_addon.sql`
- `1007_shariah_modes.sql`
- `1008_update_rpc_shariah.sql`
- `1009_zakat_haul.sql`
- `1010_zakat_intra_day_history.sql`
- `1015_zakat_asset_timeline.sql`
- `1028_barcode_foundation.sql`
- `1036_production_purchasing_request.sql`

#### Fleet, org governance, storage, SaaS expansion

- `1040_fleet_medical_record.sql`
- `1045_fleet_crew_refactor.sql`
- `1046_fleet_smart_attendance.sql`
- `1052_storage_setup.sql`
- `1054_org_slug_registration.sql`
- `1056_org_module_activation.sql`
- `1064_add_org_hierarchy.sql`
- `1065_add_saas_package_limits.sql`
- `1066_create_service_orders.sql`
- `1067_saas_billing_system.sql`
- `1069_billing_activation_engine.sql`
- `1070_saas_global_config.sql`
- `1072_billing_proof_storage.sql`
- `1073_org_invitation_tokens.sql`
- `1077_add_saas_vouchers.sql`
- `1078_employee_profile_fields.sql`
- `1079_fleet_hardening.sql`
- `1080_reset_org_data_v2.sql`
- `1081_sales_page_module.sql`

### 8.4 Stored procedures / RPC / triggers yang penting

Beberapa procedure/fungsi yang menjadi tulang punggung:

- `seed_default_coa`
- `process_purchase_atomic`
- `void_purchase_atomic`
- `process_purchase_payment_atomic`
- `process_purchase_return_atomic`
- `process_sales_delivery_atomic`
- `process_sales_payment_atomic`
- `process_sales_return_atomic`
- `process_inventory_adjustment`
- `adjust_inventory_stock`
- `update_product_average_cost`
- `generate_payslips_for_run`
- `process_payroll_payment`
- `void_payroll_run`
- `process_expense_claim`
- `process_work_order_completion_v2`
- `process_work_order_completion`
- `create_fleet_medical_record`
- `process_asset_disposal`
- `reset_org_data`

### 8.5 Storage buckets yang dipakai

- `brand_assets`: logo organisasi
- `receipts`: bukti reimbursement
- `avatars`: avatar karyawan
- `billing-proofs`: bukti bayar billing SaaS

## 9. Environment Variables Aktual

Environment variable yang benar-benar dipakai di kode:

| Variable | Status | Kegunaan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | wajib | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | wajib | anon key frontend/server SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | opsional tetapi dibutuhkan untuk fitur tertentu | admin client: employee provisioning, reset password, dsb |
| `GOOGLE_AI_STUDIO_KEY` | opsional | OCR receipt |
| `RESEND_API_KEY` | opsional | pengiriman email invoice/promo |
| `NEXT_PUBLIC_SITE_URL` | opsional | redirect URL reset password |
| `VERCEL_URL` | opsional | fallback origin saat deploy Vercel |

## 10. Setup dan Operasional

### 10.1 Prasyarat

- Node.js `>=20.0.0`
- project Supabase
- migrasi SQL
- env vars diisi

### 10.2 Script yang tersedia

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:coverage
npm run test:erp
npm run test:erp:coverage
```

### 10.3 Catatan build

`next.config.mjs` saat ini mengaktifkan:

```js
typescript: {
  ignoreBuildErrors: true,
}
```

Artinya build produksi tidak akan gagal walaupun masih ada error TypeScript.

Status verifikasi terakhir:

- `npm run build` berhasil pada audit lanjutan 29 Maret 2026.
- Next.js tetap menampilkan `Skipping validation of types` karena flag di atas masih aktif.
- Penyebab flag belum dicabut adalah backlog error TypeScript lintas modul, bukan error baru pada perbaikan dokumentasi/audit ini.

## 11. Testing & Quality

### 11.1 Vitest

`vitest.config.ts`:

- environment: `node`
- coverage provider: `v8`
- reporter: `text`, `html`

### 11.2 Test suites yang ada

- `__tests__/accounting.test.ts`
- `__tests__/auth.actions.test.ts`
- `__tests__/fleet.actions.test.ts`
- `__tests__/middleware.test.ts`
- `__tests__/proxy.test.ts`
- `__tests__/helpers/supabase-mock.ts`

### 11.3 Fokus coverage saat ini

- validasi balance journal
- zakat nishab calculation
- payroll calculation engine
- auth actions
- Supabase middleware/proxy behavior
- fleet booking, maintenance, attendance

## 12. Update Dibanding Dokumentasi Lama

Berikut perubahan paling penting yang perlu diketahui:

- README lama menyebut **Next.js 15**, padahal repo sekarang memakai **Next.js 16.2.1**.
- README lama menyebut **Node.js 18+**, padahal `package.json` sekarang meminta **Node.js 20+**.
- Istilah proteksi request sekarang sebaiknya disebut **Proxy** (`proxy.ts`), mengikuti Next.js 16.
- Rentang migrasi tidak lagi berhenti di `1023`; repo saat ini memiliki `129` file migrasi dan titik paling baru mencapai seri `1081`.
- Fitur SaaS/billing sekarang jauh lebih matang: invoice SaaS, package duration, package limits, vouchers, proof storage, config global, billing activation.
- Fitur demo dan voucher ABS sekarang nyata di repo, termasuk auto-seed demo data dan landing `/abs`.
- Fleet saat ini bukan sekadar foundation; sudah ada booking guard, route/schedule/ticketing, crew attendance, maintenance RPC, dan hardening RLS.
- Employee profile sudah bertambah avatar, WhatsApp, dan dukungan reset password yang lebih jelas.
- Setelah audit, halaman `/settings/users` tidak lagi memakai invite mock. Sekarang ia membuat link aktivasi nyata berbasis `org_invitations`.
- Setelah audit, fallback API key di `lib/email/sender.ts` sudah dihapus dan email sender sekarang wajib memakai `RESEND_API_KEY`.
- Setelah audit, typo redirect stock ledger dari `/onboard` ke `/onboarding` sudah diperbaiki.
- Setelah audit lanjutan, halaman `/settings/business` sekarang memiliki danger zone reset dengan dua mode: `Reset Transaksi` dan `Reset Semua Data Operasional`.
- Audit lanjutan juga menambahkan migrasi `1080_reset_org_data_v2.sql` untuk memperkuat fungsi reset organisasi dan memperbaiki trigger closed period saat delete journal.
- Audit pengembangan terbaru menambahkan modul Sales Page lengkap dengan studio dashboard, route publik `/sp/[orgSlug]/[pageSlug]`, lead capture endpoint, dan migrasi `1081_sales_page_module.sql`.

## 13. Temuan Audit Teknis

Temuan ini saya catat agar dokumentasi juga berfungsi sebagai audit kondisi aktual repo:

- `next.config.mjs` masih mengabaikan TypeScript build errors. Ini mempercepat build, tetapi meningkatkan risiko deploy dengan type issue.
- `lib/email/sender.ts` kini sudah env-only, tetapi semua environment deployment tetap harus memastikan `RESEND_API_KEY` tersedia sebelum fitur email dipakai.
- `app/(dashboard)/settings/users/UsersClient.tsx` kini memakai invitation token yang nyata, tetapi sebagian area settings/admin lain masih mengandalkan client-side Supabase writes.
- `app/(dashboard)/inventory/ledger/[id]/page.tsx` sudah redirect ke `/onboarding`; temuan ini ditutup pada audit lanjutan.
- Reset data organisasi sekarang sudah punya guardrail owner-only dan konfirmasi berlapis, tetapi migrasi SQL baru tetap perlu dijalankan di environment Supabase agar fungsi reset v2 tersedia di database.
- Modul Sales Page sudah bisa dipakai end-to-end di kode, tetapi migrasi `1081_sales_page_module.sql` tetap harus dijalankan di Supabase agar tabel `sales_pages` dan `sales_page_leads` tersedia.
- Sebagian area admin/settings menggunakan client-side Supabase writes secara langsung, bukan server actions khusus.

## 14. Inventaris File Aksi

Daftar action file per domain:

- `modules/accounting/actions/aging.actions.ts`
- `modules/accounting/actions/analytics.actions.ts`
- `modules/accounting/actions/assets.actions.ts`
- `modules/accounting/actions/audit.actions.ts`
- `modules/accounting/actions/bsc.actions.ts`
- `modules/accounting/actions/budget.actions.ts`
- `modules/accounting/actions/closing.actions.ts`
- `modules/accounting/actions/coa.actions.ts`
- `modules/accounting/actions/export.actions.ts`
- `modules/accounting/actions/forecast.actions.ts`
- `modules/accounting/actions/journal.actions.ts`
- `modules/accounting/actions/price.actions.ts`
- `modules/accounting/actions/reimburse.actions.ts`
- `modules/accounting/actions/reports.actions.ts`
- `modules/accounting/actions/shariah.actions.ts`
- `modules/accounting/actions/tax.actions.ts`
- `modules/accounting/actions/zakat.actions.ts`
- `modules/ai/actions/vision.actions.ts`
- `modules/auth/actions/auth.actions.ts`
- `modules/cash/actions/bank.actions.ts`
- `modules/cash/actions/reconcile.actions.ts`
- `modules/contacts/actions/contact.actions.ts`
- `modules/demo/actions/demo.actions.ts`
- `modules/factory/actions/factory.actions.ts`
- `modules/fleet/actions/fleet.actions.ts`
- `modules/hris/actions/employee.actions.ts`
- `modules/hris/actions/expense.actions.ts`
- `modules/hris/actions/payroll.actions.ts`
- `modules/inventory/actions/inventory.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`
- `modules/organization/actions/approval.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/hris.actions.ts`
- `modules/organization/actions/org-id.actions.ts`
- `modules/organization/actions/org.actions.ts`
- `modules/purchasing/actions/purchasing.actions.ts`
- `modules/sales/actions/pos.actions.ts`
- `modules/sales/actions/sales-page.actions.ts`
- `modules/sales/actions/sales.actions.ts`
- `modules/services/actions/service.actions.ts`
- `modules/settings/actions/audit.actions.ts`

## 15. Inventaris Route File

Daftar `page.tsx` yang ada saat audit:

- `app/page.tsx`
- `app/onboarding/page.tsx`
- `app/demo/page.tsx`
- `app/abs/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/join/[token]/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/update-password/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/profil-saya/page.tsx`
- `app/(dashboard)/billing/page.tsx`
- `app/(dashboard)/billing/invoice/[id]/page.tsx`
- `app/(dashboard)/pricing/page.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/cash/page.tsx`
- `app/(dashboard)/contacts/page.tsx`
- `app/(dashboard)/inventory/page.tsx`
- `app/(dashboard)/inventory/warehouses/page.tsx`
- `app/(dashboard)/inventory/warehouses/[id]/page.tsx`
- `app/(dashboard)/inventory/ledger/[id]/page.tsx`
- `app/(dashboard)/purchasing/page.tsx`
- `app/(dashboard)/factory/page.tsx`
- `app/(dashboard)/fleet/page.tsx`
- `app/(dashboard)/services/page.tsx`
- `app/(dashboard)/pos/page.tsx`
- `app/(dashboard)/sales/page.tsx`
- `app/(dashboard)/sales/quotations/page.tsx`
- `app/(dashboard)/sales/pipeline/page.tsx`
- `app/(dashboard)/sales/commission/page.tsx`
- `app/(dashboard)/sales/promos/page.tsx`
- `app/(dashboard)/sales/pages/page.tsx`
- `app/(dashboard)/hris/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/reports/bsc/page.tsx`
- `app/(dashboard)/reports/pareto/page.tsx`
- `app/(dashboard)/accounting/aging/page.tsx`
- `app/(dashboard)/accounting/approvals/page.tsx`
- `app/(dashboard)/accounting/assets/page.tsx`
- `app/(dashboard)/accounting/audit/page.tsx`
- `app/(dashboard)/accounting/budgets/page.tsx`
- `app/(dashboard)/accounting/closing/page.tsx`
- `app/(dashboard)/accounting/forecast/page.tsx`
- `app/(dashboard)/accounting/journal/page.tsx`
- `app/(dashboard)/accounting/reimburse/page.tsx`
- `app/(dashboard)/accounting/tax/page.tsx`
- `app/(dashboard)/accounting/zakat/page.tsx`
- `app/(dashboard)/settings/accounts/page.tsx`
- `app/(dashboard)/settings/accounts/new/page.tsx`
- `app/(dashboard)/settings/accounts/[id]/page.tsx`
- `app/(dashboard)/settings/audit/page.tsx`
- `app/(dashboard)/settings/branches/page.tsx`
- `app/(dashboard)/settings/business/page.tsx`
- `app/(dashboard)/settings/roles/page.tsx`
- `app/(dashboard)/settings/users/page.tsx`
- `app/(dashboard)/audit/page.tsx`
- `app/sp/[orgSlug]/[pageSlug]/page.tsx`

## 16. Aktivitas Lanjutan (30 Maret 2026)

Update ini dilakukan setelah implementasi awal modul Sales Page selesai, dengan fokus ke hardening dan kontrol paket SaaS.

### 16.1 SaaS package editor: modul Sales Page

- Form **Edit/Buat Paket SaaS** di `app/(dashboard)/admin/page.tsx` sekarang memiliki opsi modul baru: `Sales Page` pada grup `Marketing & Sales`.
- Tujuan: owner SaaS bisa memasukkan fitur Sales Page hanya ke paket tertentu.

### 16.2 Guard akses modul Sales Page

- `app/(dashboard)/layout.tsx` diperbarui agar path `/sales/pages` memakai guard modul khusus `Sales Page` (tidak lagi otomatis ikut modul `Sales` biasa).
- Permission check untuk path ini tetap memakai domain permission `sales`, sehingga role internal sales tetap konsisten.
- `components/shared/AppSidebar.tsx` diperbarui: menu `Sales Page` kini memakai `module_key: 'Sales Page'` agar visibilitas menu mengikuti paket yang benar.

### 16.3 Hardening publik Sales Page

- Sanitasi URL CTA ditambahkan melalui helper `normalizeSalesPageCtaUrl(...)` di:
  - `modules/sales/lib/sales-page.ts`
  - dipakai juga saat insert/update di `modules/sales/lib/sales-page.server.ts`
- Tujuan sanitasi: menolak skema URL berbahaya dan hanya mengizinkan anchor (`#...`), path relatif (`/...`), atau URL `http/https`.

### 16.4 Form lead toggle dan status response API

- `app/sp/[orgSlug]/[pageSlug]/SalesPagePublicView.tsx` kini menghormati `formSettings.enabled`.
  - Jika nonaktif, form lead tidak dirender dan diganti panel info.
- `app/api/sales-pages/lead/route.ts` kini mengembalikan `404` untuk kasus page tidak ditemukan / belum dipublikasikan (sebelumnya selalu `500`).

### 16.5 Verifikasi pasca perubahan

- `npm run test` lulus (`5` test file, `42` test).
- `npm run build` lulus, termasuk route:
  - `/sales/pages`
  - `/sp/[orgSlug]/[pageSlug]`
  - `/api/sales-pages/lead`
- `npm run lint` masih gagal karena backlog lint lintas modul lama (bukan khusus perubahan Sales Page ini).

### 16.6 Hotfix 404 output Sales Page

- Studio Sales Page (`app/(dashboard)/sales/pages/page.tsx`) tidak lagi memakai fallback slug statis `'nizam'`.
  - Fallback baru menggunakan `orgId` saat `organizations.slug` kosong.
- Resolver publik (`modules/sales/lib/sales-page.server.ts`) diperbarui:
  - menerima parameter org dari **slug atau UUID org**,
  - melakukan normalisasi `pageSlug` sebelum query,
  - memastikan nilai `org.slug` selalu terisi (fallback ke `org.id`) agar form lead publik tetap bisa mengirimkan identifier yang valid.
- Tujuan hotfix: menghilangkan kasus route publik valid yang sebelumnya tetap berakhir `404` karena mismatch slug organisasi.

### 16.7 Tombol aktivasi publish cepat

- `app/(dashboard)/sales/pages/SalesPageStudioClient.tsx` sekarang memiliki tombol `Aktivasi` per kartu halaman di Library.
- Panel `Ringkasan Aktif` juga menampilkan tombol `Aktivasi Publish` saat status halaman masih `DRAFT`.
- Tombol ini langsung mengubah status ke `PUBLISHED` tanpa wajib membuka modal edit, untuk mempercepat go-live URL publik.

### 16.8 Hybrid generator: template + AI prompt

- Studio generator (`app/(dashboard)/sales/pages/SalesPageStudioClient.tsx`) kini mendukung:
  - `Template Layout` picker (Lead Capture, Webinar Funnel, Product Launch, Consulting Offer),
  - kolom `Prompt AI / Brief Campaign`,
  - input `Hero Image URL` dan `Hero Image Alt` saat membuat draft.
- Model data generator diperluas di `modules/sales/lib/sales-page.ts`:
  - type template ID,
  - katalog template,
  - default CTA/offer per template.
- Server generator (`modules/sales/lib/sales-page.server.ts`) kini mencoba enrich copy via Gemini (`gemini-2.5-flash`) ketika:
  - `aiPrompt` diisi, dan
  - `GOOGLE_AI_STUDIO_KEY` tersedia.
- Jika AI gagal / key tidak tersedia, sistem fallback otomatis ke output template default sehingga alur create tetap aman.

### 16.9 Visual template frame + color guide

- Template picker di modal generator tidak lagi hanya dropdown teks.
- `app/(dashboard)/sales/pages/SalesPageStudioClient.tsx` sekarang menampilkan:
  - kartu visual mini (frame/wireframe) untuk tiap template layout,
  - indicator template terpilih,
  - panel `Color Guide` untuk template aktif (palet warna referensi).
- Tujuan UX:
  - user bisa melihat gambaran struktur halaman sebelum generate,
  - user punya referensi warna awal saat menyusun hero image dan copy.

### 16.10 Variasi output layout per template (bukan hanya warna)

- Public renderer `app/sp/[orgSlug]/[pageSlug]/SalesPagePublicView.tsx` dirombak agar setiap template menghasilkan struktur layout berbeda:
  - `LEAD_CAPTURE`: hero + proof strip + form-first.
  - `WEBINAR`: hero event + agenda/proof ringkas + register emphasis.
  - `PRODUCT_LAUNCH`: launch card layout + feature/value stack emphasis.
  - `CONSULTING`: authority dark-hero + problem-solution framing.
- Tujuan: menjawab issue “layout sama semua” pada output Sales Page.

### 16.11 Persist template id ke database Sales Page

- Menambahkan field `template_id` pada tabel `sales_pages` melalui migrasi baru:
  - `supabase/migrations/1082_ai_token_economy_and_sales_template.sql`
- Domain model diperbarui:
  - `modules/sales/lib/sales-page.ts`
  - `modules/sales/lib/sales-page.server.ts`
  - `app/(dashboard)/sales/pages/SalesPageStudioClient.tsx`
- Template terpilih saat generate sekarang tersimpan dan dipakai kembali saat render publik/edit/update.

### 16.12 AI token economy: wallet, usage log, topup package, topup order

- Migrasi `1082_ai_token_economy_and_sales_template.sql` menambahkan:
  - `ai_token_wallets` (saldo token per tenant/org),
  - `ai_token_usage_logs` (ledger debit/credit token),
  - `ai_token_topup_packages` (katalog paket topup token),
  - `ai_token_topup_orders` (relasi invoice -> paket topup token),
  - helper policy function `is_platform_admin()` + policy RLS terkait.
- Default config token juga ditambahkan ke `saas_config`:
  - `ai_token_policy`
  - `ai_token_inventory`

### 16.13 Integrasi token AI ke generator + header + billing

- Generator Sales Page AI kini menghitung konsumsi token dan melakukan debit wallet:
  - `modules/sales/lib/sales-page.server.ts`
  - `modules/ai/lib/ai-token.server.ts`
- Jika token tidak cukup untuk generate AI, sistem menolak generate AI dan menampilkan pesan topup.
- Header dashboard sekarang menampilkan badge saldo token AI + popup ringkas:
  - `components/shared/AppHeader.tsx`
  - `app/(dashboard)/layout.tsx`
- Halaman billing menambahkan section topup token AI:
  - `app/(dashboard)/billing/page.tsx`
  - user bisa beli paket token, checkout invoice, dan saldo token bertambah setelah pembayaran diproses.

### 16.14 Admin tab AI Tokens (stok, HPP, rekomendasi harga, paket topup)

- Admin SaaS mendapatkan tab baru `AI Tokens` di:
  - `app/(dashboard)/admin/page.tsx`
- Tab ini memuat:
  - konfigurasi biaya token (input/output), average token usage, overhead, margin,
  - stok global token + agregat saldo tenant + total penggunaan,
  - kalkulasi otomatis HPP per generate dan rekomendasi harga jual (per generate / per 1K token),
  - CRUD paket topup token AI (aktif/nonaktif, harga, token, cost/HPP paket).
- Approval invoice di admin kini mendeteksi invoice topup token dan mengkredit saldo wallet tenant otomatis.

### 16.15 Integrasi Kanban, Custom Domain DNS, dan Realtime Notifications

- **Sales Pipeline Kanban Enhancements**:
  - `PipelineClient.tsx` ditambah fitur *Fullscreen Mode* untuk keleluasaan pengelolaan prospek dan drag-and-drop.
  - Form Quick Add Card dimasukkan agar sales rep bisa manual entri tanpa membuat SPK baru.
  - Setiap Kanban Card dilengkapi aksi cepat 1-klik Follow-Up (WhatsApp & Email).
  - Implementasi *Supabase Realtime WebSocket* untuk mendengar `INSERT` record `sales`. Kanban langsung memunculkan Toast hijau "Lead Masuk!" dan me-refresh view tanpa perlu di-reload secara manual.
- **Custom Domain (DNS) pada Sales Page**:
  - `SalesPageStudioClient.tsx` dipindahkan UI "Domain Khusus (DNS)" ke panel "Ringkasan Aktif". User bisa dengan mudah mengisi domain custom (contoh: `promo.domain.com`) tanpa harus membuka Editor berukuran besar.
  - Diberikan panduan pengarahan A Record/CNAME ke IP NIZAM Server.
- **Automasi CRM Landing Page -> Pipeline**:
  - `createPublicSalesPageLead` diubah perilakunya. Saat lead publik (kunjungan ke `/sp`) melakukan submit landing page, sistem akan *Otomatis Membuat Contact* dan *Membuat Sales Card (Kanban) berstatus NEW*, lalu menyinkronkannya dengan `created_by` milik kreator Sales Page.
- **Perbaikan Environment Rendering**:
  - `next.config.mjs` diubah untuk *Next 16 Turbopack compatibility* dengan memastikan tidak ada konfigurasi `webpack watchOptions` yang berbenturan dengan Turbopack caching. Endless re-rendering loops berhasil dikurangi signifikan pada arsitektur bawaan Next.js 16.

### 16.16 Hardening auth redirect, proxy matcher, dan stabilisasi akses halaman terakhir

Update ini dilakukan untuk menutup isu operasional: setelah input/navigasi user, aplikasi kadang terasa compile/render berulang, perlu refresh manual, dan setelah refresh kembali ke `/dashboard` alih-alih ke halaman terakhir.

- **Perubahan utama di `lib/supabase/middleware.ts`**:
  - Menambahkan pemisahan path yang jelas:
    - `AUTH_PAGE_PREFIXES` (login/register),
    - `PROTECTED_PAGE_PREFIXES` (dashboard + modul privat),
    - path bypass internal (`/_next`, `/api`, metadata file).
  - Menambahkan short-circuit agar middleware **tidak melakukan auth lookup berat** untuk route publik/internal yang tidak perlu.
  - Menambahkan sanitasi `redirectTo` via `normalizeRedirectTarget(...)` untuk mencegah open redirect path berbahaya.
  - Redirect dari route privat ke login sekarang menyimpan path lengkap berikut query (`pathname + search`), sehingga konteks tab/filter tetap pulih setelah login.
  - Jika user sudah login tetapi mengakses `/login`/`/register`, middleware sekarang memprioritaskan:
    1. `redirectTo` dari query (jika valid),
    2. fallback referer internal yang valid,
    3. fallback akhir `/dashboard`.

- **Perubahan `proxy.ts` matcher**:
  - Menambahkan pengecualian route yang tidak perlu diproses proxy:
    - `api`,
    - `_next/static`,
    - `_next/image`,
    - `_next/webpack-hmr`,
    - metadata (`favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`),
    - path file berekstensi.
  - Menambahkan rule `missing` header prefetch (`next-router-prefetch`, `purpose=prefetch`) agar request prefetch tidak memicu jalur auth/proxy utama.

### 16.17 Sinkronisasi ACL dashboard layout + verifikasi test

- **Perubahan `app/(dashboard)/layout.tsx`**:
  - Guard modul/RBAC diperluas agar lebih selaras dengan route aktual dan nomenklatur modul pada sidebar/paket SaaS.
  - Menambahkan `RouteModuleEntry` dengan:
    - `aliases` modul (contoh: Finance/Accounting, Inventory/Warehouse, Marketing/Sales),
    - `permissionKeys` jamak per route family.
  - Menambahkan helper `moduleNameMatches(...)` untuk matching modul yang lebih toleran terhadap variasi label plan/add-on.
  - Menambahkan coverage path yang sebelumnya rawan mismatch guard:
    - `/inventory/warehouses`,
    - `/cash`,
    - `/contacts`,
    - serta penguatan mapping untuk family `/accounting`, `/reports`, `/hris`, `/services`.
  - Dampak: menurunkan false redirect ke `/dashboard` pada akses halaman yang sebenarnya valid menurut paket/role.

- **Perubahan test (`__tests__/middleware.test.ts`)**:
  - Menambah skenario:
    - `redirectTo` mempertahankan query params untuk route privat,
    - user terautentikasi pada `/login` dengan `redirectTo` diarahkan ke halaman target (bukan selalu dashboard),
    - request internal `/_next/webpack-hmr` dibypass tanpa auth lookup.

- **Verifikasi pasca perubahan**:
  - `npm run test -- __tests__/middleware.test.ts __tests__/proxy.test.ts` lulus (`2` file test, `7` test case).
  - `npx eslint lib/supabase/middleware.ts proxy.ts app/(dashboard)/layout.tsx __tests__/middleware.test.ts` lulus.

### 16.18 Modul Penawaran & Penjualan Khusus Pengelola SaaS (tanpa buka Admin page)

Update ini menambahkan modul operasional SaaS owner yang berdiri sendiri, sehingga tim pengelola platform bisa mengelola pipeline komersial tanpa harus masuk ke halaman `/admin`.

- **Route baru khusus operator SaaS**:
  - `/saas` (redirect ke `/saas/penjualan`)
  - `/saas/penawaran`
  - `/saas/penjualan`
- Implementasi file:
  - `app/(dashboard)/saas/layout.tsx`
  - `app/(dashboard)/saas/page.tsx`
  - `app/(dashboard)/saas/penawaran/page.tsx`
  - `app/(dashboard)/saas/penjualan/page.tsx`
  - `app/(dashboard)/saas/SaasOperatorClient.tsx`

- **Hak akses platform admin dipusatkan**:
  - util baru `lib/saas/platform-admin.ts` (`isPlatformAdminEmail`)
  - `app/(dashboard)/admin/layout.tsx` dipindahkan menggunakan util ini agar konsisten dengan modul operator SaaS baru.

- **Server Actions baru untuk operator SaaS**:
  - `modules/saas/actions/operator-sales.actions.ts`
  - Fitur:
    - ambil snapshot data tenant/paket/invoice lintas tenant (`getOperatorSaasSnapshot`)
    - buat penawaran SaaS (`createOperatorQuotation`)
    - konversi penawaran menjadi penjualan (`convertQuotationToSale`)
    - tandai penjualan paid + aktivasi plan tenant (`markOperatorSalePaid`)

- **Akses cepat tanpa membuka halaman admin**:
  - `components/shared/AppSidebar.tsx` sekarang menampilkan grup menu `SaaS Operator` (Penawaran SaaS + Penjualan SaaS) hanya untuk email platform admin.
  - Guard tambahan: grup `SaaS Operator` dibypass dari filter `enabledModules`/`permission` tenant biasa agar selalu terlihat untuk platform admin.

- **Hardening proteksi route**:
  - `lib/supabase/middleware.ts` menambah prefix privat `/saas` agar flow redirect login konsisten untuk modul baru.

- **Verifikasi**:
  - lint file baru/terkait lulus (tanpa error; ada warning lama `<img>` di sidebar yang tidak terkait modul baru).
